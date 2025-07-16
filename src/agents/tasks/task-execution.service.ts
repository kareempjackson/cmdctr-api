import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionLibraryService } from './action-library.service';
import { TaskStatus } from '../dto/update-agent-task.dto';
import { TaskType } from '../dto/create-agent-task.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly actionLibrary: ActionLibraryService
  ) {}

  async startTaskProcessor() {
    if (this.isProcessing) {
      this.logger.warn('Task processor is already running');
      return;
    }

    this.isProcessing = true;
    this.logger.log('Starting task processor');

    // Process tasks in a loop
    while (this.isProcessing) {
      try {
        await this.processPendingTasks();
        await this.processScheduledTasks();
        
        // Wait before next iteration
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
      } catch (error) {
        this.logger.error('Error in task processor loop:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds on error
      }
    }
  }

  async stopTaskProcessor() {
    this.isProcessing = false;
    this.logger.log('Stopping task processor');
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processScheduledTasks() {
    try {
      const now = new Date();
      
      // Find tasks that are scheduled for now or in the past
      const scheduledTasks = await this.prisma.agentTask.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lte: now,
          },
        },
        include: {
          agent: true,
        },
      });

      for (const task of scheduledTasks) {
        await this.executeTask(task.id);
      }
    } catch (error) {
      this.logger.error('Error processing scheduled tasks:', error);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingTasks() {
    try {
      // Find pending tasks that are not scheduled
      const pendingTasks = await this.prisma.agentTask.findMany({
        where: {
          status: 'pending',
          scheduledFor: null,
        },
        include: {
          agent: true,
        },
        take: 5, // Process 5 tasks at a time
      });

      for (const task of pendingTasks) {
        await this.executeTask(task.id);
      }
    } catch (error) {
      this.logger.error('Error processing pending tasks:', error);
    }
  }

  private async executeTask(taskId: string) {
    try {
      // Get the task with agent information
      const task = await this.prisma.agentTask.findUnique({
        where: { id: taskId },
        include: {
          agent: true,
        },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found`);
        return;
      }

      // Update status to in_progress
      await this.prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: 'in_progress',
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Executing task ${taskId} of type ${task.type}`);

      // Execute the task using the action library
      const parameters = (task.parameters && typeof task.parameters === 'object') ? task.parameters : {};
      const context = {
        agentId: task.agentId,
        userId: task.createdBy,
        workspaceId: task.agent.workspaceId,
        taskId: task.id
      };
      const result = await this.actionLibrary.executeAction(task.type as any, parameters, context);

      // Update task with result
      await this.prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: result as any,
          completedAt: new Date(),
          updatedAt: new Date(),
          logs: {
            ...(task.logs as Record<string, any> || {}),
            executionTime: new Date().toISOString(),
            success: true,
          },
        },
      });

      this.logger.log(`Task ${taskId} completed successfully`);
    } catch (error) {
      this.logger.error(`Error executing task ${taskId}:`, error);

      // Get the task again for error handling
      const task = await this.prisma.agentTask.findUnique({
        where: { id: taskId },
      });

      if (!task) return;

      // Update task with error information
      await this.prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          updatedAt: new Date(),
          logs: {
            ...(task.logs as Record<string, any> || {}),
            executionTime: new Date().toISOString(),
            success: false,
            error: error.message,
            stack: error.stack,
          },
        },
      });

      // Handle retry logic
      await this.handleRetry(taskId);
    }
  }

  private async handleRetry(taskId: string) {
    try {
      const task = await this.prisma.agentTask.findUnique({
        where: { id: taskId },
      });

      if (!task) return;

      if (task.retryCount < task.maxRetries) {
        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, task.retryCount), 30000); // Max 30 seconds
        
        setTimeout(async () => {
          await this.executeTask(taskId);
        }, delay);
      }
    } catch (error) {
      this.logger.error(`Error handling retry for task ${taskId}:`, error);
    }
  }

  async retryTask(taskId: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status !== 'failed') {
      throw new Error('Can only retry failed tasks');
    }

    if (task.retryCount >= task.maxRetries) {
      throw new Error('Maximum retry attempts reached');
    }

    // Reset task to pending
    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        retryCount: task.retryCount + 1,
        result: undefined,
        completedAt: null,
        updatedAt: new Date(),
      },
    });

    // Execute the task
    await this.executeTask(taskId);
  }

  async cancelTask(taskId: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (!['pending', 'in_progress'].includes(task.status)) {
      throw new Error('Can only cancel pending or in-progress tasks');
    }

    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getTaskStats() {
    const stats = await this.prisma.agentTask.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    const totalTasks = await this.prisma.agentTask.count();
    const pendingTasks = await this.prisma.agentTask.count({
      where: {
        status: TaskStatus.PENDING,
        scheduledFor: null
      }
    });

    const scheduledTasks = await this.prisma.agentTask.count({
      where: {
        status: TaskStatus.PENDING,
        scheduledFor: {
          not: null
        }
      }
    });

    return {
      total: totalTasks,
      pending: pendingTasks,
      scheduled: scheduledTasks,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>)
    };
  }
} 