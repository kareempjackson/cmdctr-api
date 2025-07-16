import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { UpdateAgentTaskDto } from './dto/update-agent-task.dto';
import { QueryAgentTasksDto } from './dto/query-agent-tasks.dto';
import { TaskExecutionService } from './task-execution.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private taskExecutionService: TaskExecutionService,
  ) {}

  async createTask(createTaskDto: CreateAgentTaskDto, userId: string) {
    // Verify agent exists
    const agent = await this.prisma.agent.findUnique({
      where: { id: createTaskDto.agentId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Create the task
    const task = await this.prisma.agentTask.create({
      data: {
        agentId: createTaskDto.agentId,
        type: createTaskDto.type,
        parameters: createTaskDto.parameters,
        status: 'pending',
        priority: createTaskDto.priority || 'medium',
        tags: createTaskDto.tags || [],
        maxRetries: createTaskDto.maxRetries || 3,
        retryCount: 0,
        scheduledFor: createTaskDto.scheduledFor ? new Date(createTaskDto.scheduledFor) : null,
        createdBy: userId,
        logs: {},
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If task is not scheduled, execute it immediately
    if (!task.scheduledFor) {
      this.taskExecutionService.processPendingTasks().catch(console.error);
    }

    return task;
  }

  async findAll(query: QueryAgentTasksDto) {
    const { page = 1, pageSize = 10, agentId, status, type, priority, search } = query;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    if (agentId) {
      where.agentId = agentId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { type: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
        { parameters: { path: ['$'], string_contains: search } },
      ];
    }

    // Get tasks with pagination
    const [tasks, total] = await Promise.all([
      this.prisma.agentTask.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.agentTask.count({ where }),
    ]);

    return {
      tasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateTask(id: string, updateTaskDto: UpdateAgentTaskDto) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only allow updates for pending tasks
    if (task.status !== 'pending') {
      throw new BadRequestException('Can only update pending tasks');
    }

    const updatedTask = await this.prisma.agentTask.update({
      where: { id },
      data: {
        ...(updateTaskDto.type && { type: updateTaskDto.type }),
        ...(updateTaskDto.parameters && { parameters: updateTaskDto.parameters }),
        ...(updateTaskDto.scheduledFor && { scheduledFor: new Date(updateTaskDto.scheduledFor) }),
        ...(updateTaskDto.priority && { priority: updateTaskDto.priority }),
        ...(updateTaskDto.tags && { tags: updateTaskDto.tags }),
        ...(updateTaskDto.maxRetries && { maxRetries: updateTaskDto.maxRetries }),
        updatedAt: new Date(),
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedTask;
  }

  async deleteTask(id: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only allow deletion of pending or failed tasks
    if (!['pending', 'failed'].includes(task.status)) {
      throw new BadRequestException('Can only delete pending or failed tasks');
    }

    await this.prisma.agentTask.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }

  async retryTask(id: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.status !== 'failed') {
      throw new BadRequestException('Can only retry failed tasks');
    }

    if (task.retryCount >= task.maxRetries) {
      throw new BadRequestException('Maximum retry attempts reached');
    }

    // Reset task to pending and increment retry count
    const updatedTask = await this.prisma.agentTask.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: task.retryCount + 1,
        result: undefined,
        completedAt: null,
        updatedAt: new Date(),
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Execute the task
    this.taskExecutionService.processPendingTasks().catch(console.error);

    return updatedTask;
  }

  async cancelTask(id: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!['pending', 'in_progress'].includes(task.status)) {
      throw new BadRequestException('Can only cancel pending or in-progress tasks');
    }

    const updatedTask = await this.prisma.agentTask.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedTask;
  }

  async getTaskStats(agentId?: string) {
    const where = agentId ? { agentId } : {};

    const [
      total,
      pending,
      scheduled,
      byStatus,
    ] = await Promise.all([
      this.prisma.agentTask.count({ where }),
      this.prisma.agentTask.count({ 
        where: { 
          ...where, 
          status: 'pending',
          scheduledFor: null 
        } 
      }),
      this.prisma.agentTask.count({ 
        where: { 
          ...where, 
          scheduledFor: { not: null } 
        } 
      }),
      this.prisma.agentTask.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true,
        },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      pending,
      scheduled,
      byStatus: statusCounts,
    };
  }
} 