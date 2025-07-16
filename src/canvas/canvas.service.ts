import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockInstruction } from '../prompt/prompt.service';
import { ActivityService } from '../activity/activity.service';

export interface CanvasBlock {
  id: string;
  type: string;
  position: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
  config: any;
  data?: any;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasLayout {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  blocks: CanvasBlock[];
}

export interface CreateCanvasDto {
  workspaceId: string;
  name?: string;
  description?: string;
  blocks: BlockInstruction[];
  initialPrompt?: string;
}

export interface UpdateCanvasDto {
  name?: string;
  description?: string;
  blocks?: BlockInstruction[];
  initialPrompt?: string;
}

@Injectable()
export class CanvasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async createCanvas(
    userId: string,
    dto: CreateCanvasDto,
  ): Promise<CanvasLayout> {
    console.log('CanvasService.createCanvas called with:', { userId, dto });
    
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, dto.workspaceId);

    // Create canvas layout
    const canvas = await this.prisma.canvasLayout.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name || 'Untitled Canvas',
        description: dto.description,
        createdBy: userId,
        initialPrompt: dto.initialPrompt,
        blocks: {
          create: dto.blocks.map((block, index) => ({
            type: block.type,
            position: block.position ?? index,
            title: block.title,
            config: block.config || {},
            data: block.data || null,
            metadata: {},
          })),
        },
      },
      include: {
        blocks: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Log canvas creation activity
    await this.activityService.logActivity({
      userId,
      workspaceId: dto.workspaceId,
      category: 'canvas',
      action: 'create',
      resource: canvas.id,
      description: `Created canvas "${canvas.name}" with ${canvas.blocks.length} blocks`,
      metadata: {
        canvasId: canvas.id,
        canvasName: canvas.name,
        canvasDescription: dto.description,
        blocksCreated: canvas.blocks.length,
        blockTypes: canvas.blocks.map(block => block.type),
        workspaceId: dto.workspaceId,
      },
      status: 'success',
    });

    return this.formatCanvasResponse(canvas);
  }

  async createCanvasFromTask(userId: string, dto: { taskId: string; workspaceId: string; name?: string; description?: string }): Promise<CanvasLayout> {
    // Get the task with result
    const task = await this.prisma.agentTask.findUnique({
      where: { id: dto.taskId },
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

    if (task.createdBy !== userId) {
      throw new UnauthorizedException('You can only create canvases from your own tasks');
    }

    if (!task.result) {
      throw new BadRequestException('Task has no result to display in canvas');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, dto.workspaceId);

    // Generate canvas name if not provided
    const canvasName = dto.name || this.generateCanvasNameFromTask(task);
    const canvasDescription = dto.description || `Canvas generated from ${task.type} task completed on ${new Date(task.completedAt || '').toLocaleDateString()}`;

    // Convert task result to canvas blocks
    const blocks = this.convertTaskResultToBlocks(task);

    // Create the canvas
    const createCanvasDto = {
      workspaceId: dto.workspaceId,
      name: canvasName,
      description: canvasDescription,
      blocks,
    };

    return this.createCanvas(userId, createCanvasDto);
  }

  async getCanvas(userId: string, canvasId: string): Promise<CanvasLayout> {
    const canvas = await this.prisma.canvasLayout.findUnique({
      where: { id: canvasId },
      include: {
        blocks: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, canvas.workspaceId);

    return this.formatCanvasResponse(canvas);
  }

  async getWorkspaceCanvases(
    userId: string,
    workspaceId: string,
  ): Promise<CanvasLayout[]> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, workspaceId);

    const canvases = await this.prisma.canvasLayout.findMany({
      where: { workspaceId },
      include: {
        blocks: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return canvases.map(canvas => this.formatCanvasResponse(canvas));
  }

  async updateCanvas(
    userId: string,
    canvasId: string,
    dto: UpdateCanvasDto,
  ): Promise<CanvasLayout> {
    const canvas = await this.prisma.canvasLayout.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, canvas.workspaceId);

    // Update canvas and blocks in a transaction
    const updatedCanvas = await this.prisma.$transaction(async (tx) => {
      // Update canvas metadata
      const updated = await tx.canvasLayout.update({
        where: { id: canvasId },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      // If blocks are provided, replace all blocks
      if (dto.blocks) {
        // Delete existing blocks
        await tx.canvasBlock.deleteMany({
          where: { canvasId },
        });

        // Create new blocks
        await tx.canvasBlock.createMany({
          data: dto.blocks.map((block, index) => ({
            canvasId,
            type: block.type,
            position: block.position ?? index,
            title: block.title,
            config: block.config || {},
            data: block.data || null,
            metadata: {},
          })),
        });
      }

      // Return updated canvas with blocks
      return tx.canvasLayout.findUnique({
        where: { id: canvasId },
        include: {
          blocks: {
            orderBy: { position: 'asc' },
          },
        },
      });
    });

    // Log canvas update activity
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.workspaceId,
      category: 'canvas',
      action: 'update',
      resource: canvasId,
      description: `Updated canvas "${updatedCanvas!.name}"`,
      metadata: {
        canvasId: canvasId,
        canvasName: updatedCanvas!.name,
        canvasDescription: dto.description,
        blocksUpdated: dto.blocks ? dto.blocks.length : 0,
        blockTypes: dto.blocks ? dto.blocks.map(block => block.type) : [],
        workspaceId: canvas.workspaceId,
        changes: dto,
      },
      status: 'success',
    });

    return this.formatCanvasResponse(updatedCanvas!);
  }

  async deleteCanvas(userId: string, canvasId: string): Promise<void> {
    const canvas = await this.prisma.canvasLayout.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, canvas.workspaceId);

    // Log canvas deletion activity before deleting
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.workspaceId,
      category: 'canvas',
      action: 'delete',
      resource: canvasId,
      description: `Deleted canvas "${canvas.name}"`,
      metadata: {
        canvasId: canvasId,
        canvasName: canvas.name,
        canvasDescription: canvas.description,
        workspaceId: canvas.workspaceId,
      },
      status: 'success',
    });

    // Delete canvas (blocks will be deleted via cascade)
    await this.prisma.canvasLayout.delete({
      where: { id: canvasId },
    });
  }

  async addBlock(
    userId: string,
    canvasId: string,
    block: BlockInstruction,
  ): Promise<CanvasBlock> {
    const canvas = await this.prisma.canvasLayout.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, canvas.workspaceId);

    // Get the next position
    const maxPosition = await this.prisma.canvasBlock.aggregate({
      where: { canvasId },
      _max: { position: true },
    });

    const nextPosition = (maxPosition._max.position || -1) + 1;

    console.log('CanvasService.addBlock received block:', block);
    const prismaData = {
      canvasId,
      type: block.type,
      position: block.position ?? nextPosition,
      title: block.title,
      config: block.config || {},
      data: block.data || null,
      metadata: {},
    };
    console.log('CanvasService.addBlock prismaData:', prismaData);

    const createdBlock = await this.prisma.canvasBlock.create({
      data: prismaData,
    });

    // Log block addition activity
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.workspaceId,
      category: 'block',
      action: 'create',
      resource: createdBlock.id,
      description: `Added ${block.type} block "${block.title || 'Untitled'}" to canvas "${canvas.name}"`,
      metadata: {
        blockId: createdBlock.id,
        blockType: block.type,
        blockTitle: block.title,
        canvasId: canvas.id,
        canvasName: canvas.name,
        position: createdBlock.position,
        workspaceId: canvas.workspaceId,
      },
      status: 'success',
    });

    return this.formatBlockResponse(createdBlock);
  }

  async updateBlock(
    userId: string,
    blockId: string,
    updates: Partial<BlockInstruction>,
  ): Promise<CanvasBlock> {
    const block = await this.prisma.canvasBlock.findUnique({
      where: { id: blockId },
      include: { canvas: true },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, block.canvas.workspaceId);

    const updatedBlock = await this.prisma.canvasBlock.update({
      where: { id: blockId },
      data: {
        type: updates.type,
        title: updates.title,
        config: updates.config,
        data: updates.data,
        position: updates.position,
      },
    });

    // Log block update activity
    await this.activityService.logActivity({
      userId,
      workspaceId: block.canvas.workspaceId,
      category: 'block',
      action: 'update',
      resource: blockId,
      description: `Updated ${updatedBlock.type} block "${updatedBlock.title || 'Untitled'}" in canvas "${block.canvas.name}"`,
      metadata: {
        blockId: blockId,
        blockType: updatedBlock.type,
        blockTitle: updatedBlock.title,
        canvasId: block.canvas.id,
        canvasName: block.canvas.name,
        workspaceId: block.canvas.workspaceId,
        changes: updates,
      },
      status: 'success',
    });

    return this.formatBlockResponse(updatedBlock);
  }

  async deleteBlock(userId: string, blockId: string): Promise<void> {
    const block = await this.prisma.canvasBlock.findUnique({
      where: { id: blockId },
      include: { canvas: true },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, block.canvas.workspaceId);

    // Log block deletion activity before deleting
    await this.activityService.logActivity({
      userId,
      workspaceId: block.canvas.workspaceId,
      category: 'block',
      action: 'delete',
      resource: blockId,
      description: `Deleted ${block.type} block "${block.title || 'Untitled'}" from canvas "${block.canvas.name}"`,
      metadata: {
        blockId: blockId,
        blockType: block.type,
        blockTitle: block.title,
        canvasId: block.canvas.id,
        canvasName: block.canvas.name,
        workspaceId: block.canvas.workspaceId,
      },
      status: 'success',
    });

    // Delete block
    await this.prisma.canvasBlock.delete({
      where: { id: blockId },
    });
  }

  async reorderBlocks(
    userId: string,
    canvasId: string,
    blockIds: string[],
  ): Promise<void> {
    const canvas = await this.prisma.canvasLayout.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, canvas.workspaceId);

    // Update positions in a transaction
    await this.prisma.$transaction(
      blockIds.map((blockId, index) =>
        this.prisma.canvasBlock.update({
          where: { id: blockId },
          data: { position: index },
        }),
      ),
    );
  }

  private async verifyWorkspaceAccess(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied to workspace');
    }
  }

  private formatCanvasResponse(canvas: any): CanvasLayout {
    return {
      id: canvas.id,
      workspaceId: canvas.workspaceId,
      name: canvas.name,
      description: canvas.description,
      createdBy: canvas.createdBy,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
      blocks: canvas.blocks.map((block: any) => this.formatBlockResponse(block)),
    };
  }

  private formatBlockResponse(block: any): CanvasBlock {
    return {
      id: block.id,
      type: block.type,
      position: block.position,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      title: block.title,
      config: block.config,
      data: block.data,
      metadata: block.metadata,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }

  private generateCanvasNameFromTask(task: any): string {
    if (task.parameters?.title) {
      return `${task.parameters.title} - Results`;
    }
    if (task.parameters?.description) {
      return `${task.parameters.description} - Results`;
    }
    return `${task.type.charAt(0).toUpperCase() + task.type.slice(1)} Task Results`;
  }

  private convertTaskResultToBlocks(task: any): BlockInstruction[] {
    if (!task.result) {
      return [];
    }

    const blocks: BlockInstruction[] = [];
    const result = task.result;

    // Add title block
    blocks.push({
      type: 'text',
      title: `Task Result: ${this.getTaskDisplayName(task)}`,
      config: {},
      data: {
        content: `# ${this.getTaskDisplayName(task)}\n\n**Task Type:** ${task.type}\n**Completed:** ${new Date(task.completedAt || '').toLocaleDateString()}\n**Agent:** ${task.agent?.name || 'Unknown'}`
      },
      position: 0
    });

    // Handle different result structures based on task type
    if (task.type === 'knowledge' || task.type === 'report') {
      this.addResearchBlocks(blocks, result);
    } else if (task.type === 'document') {
      this.addDocumentBlocks(blocks, result);
    } else if (task.type === 'workflow') {
      this.addWorkflowBlocks(blocks, result);
    } else if (task.type === 'agent_instruction') {
      this.addInstructionBlocks(blocks, result);
    } else {
      // Generic result handling
      this.addGenericBlocks(blocks, result);
    }

    // Add metadata block
    blocks.push({
      type: 'text',
      title: 'Task Details',
      config: {},
      data: {
        content: `## Task Information\n\n**Parameters:**\n\`\`\`json\n${JSON.stringify(task.parameters, null, 2)}\n\`\`\`\n\n**Execution Time:** ${this.getExecutionTime(task)}\n**Priority:** ${task.priority}`
      },
      position: blocks.length
    });

    return blocks;
  }

  private getTaskDisplayName(task: any): string {
    if (task.parameters?.title) {
      return task.parameters.title;
    }
    if (task.parameters?.description) {
      return task.parameters.description;
    }
    return `${task.type.charAt(0).toUpperCase() + task.type.slice(1)} Task`;
  }

  private getExecutionTime(task: any): string {
    if (!task.createdAt || !task.completedAt) {
      return 'Unknown';
    }
    const start = new Date(task.createdAt);
    const end = new Date(task.completedAt);
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  private addResearchBlocks(blocks: BlockInstruction[], result: any) {
    if (result.summary) {
      blocks.push({
        type: 'text',
        title: 'Executive Summary',
        config: {},
        data: { content: `## Summary\n\n${result.summary}` },
        position: blocks.length
      });
    }

    if (result.findings || result.keyFindings) {
      const findings = result.findings || result.keyFindings;
      blocks.push({
        type: 'text',
        title: 'Key Findings',
        config: {},
        data: { content: `## Key Findings\n\n${Array.isArray(findings) ? findings.map((f: any) => `• ${f}`).join('\n') : findings}` },
        position: blocks.length
      });
    }

    if (result.recommendations) {
      blocks.push({
        type: 'text',
        title: 'Recommendations',
        config: {},
        data: { content: `## Recommendations\n\n${Array.isArray(result.recommendations) ? result.recommendations.map((r: any) => `• ${r}`).join('\n') : result.recommendations}` },
        position: blocks.length
      });
    }

    if (result.analysis || result.details) {
      blocks.push({
        type: 'text',
        title: 'Detailed Analysis',
        config: {},
        data: { content: `## Analysis\n\n${result.analysis || result.details}` },
        position: blocks.length
      });
    }
  }

  private addDocumentBlocks(blocks: BlockInstruction[], result: any) {
    if (result.content) {
      blocks.push({
        type: 'text',
        title: 'Document Content',
        config: {},
        data: { content: result.content },
        position: blocks.length
      });
    }

    if (result.sections && Array.isArray(result.sections)) {
      result.sections.forEach((section: any, index: number) => {
        blocks.push({
          type: 'text',
          title: section.title || `Section ${index + 1}`,
          config: {},
          data: { content: section.content || section.text || JSON.stringify(section) },
          position: blocks.length
        });
      });
    }
  }

  private addWorkflowBlocks(blocks: BlockInstruction[], result: any) {
    if (result.steps && Array.isArray(result.steps)) {
      blocks.push({
        type: 'timeline',
        title: 'Workflow Steps',
        config: {},
        data: {
          items: result.steps.map((step: any, index: number) => ({
            id: index.toString(),
            title: step.title || step.name || `Step ${index + 1}`,
            description: step.description || step.details || '',
            date: step.completedAt || step.timestamp || new Date().toISOString(),
            status: step.status || 'completed'
          }))
        },
        position: blocks.length
      });
    }

    if (result.summary) {
      blocks.push({
        type: 'text',
        title: 'Workflow Summary',
        config: {},
        data: { content: `## Workflow Summary\n\n${result.summary}` },
        position: blocks.length
      });
    }
  }

  private addInstructionBlocks(blocks: BlockInstruction[], result: any) {
    if (result.actions && Array.isArray(result.actions)) {
      blocks.push({
        type: 'list',
        title: 'Actions Performed',
        config: {},
        data: {
          items: result.actions.map((action: any, index: number) => ({
            id: index.toString(),
            text: action.description || action.name || action,
            completed: action.status === 'completed' || true
          }))
        },
        position: blocks.length
      });
    }

    if (result.deliverables && Array.isArray(result.deliverables)) {
      result.deliverables.forEach((deliverable: any, index: number) => {
        blocks.push({
          type: 'text',
          title: deliverable.title || `Deliverable ${index + 1}`,
          config: {},
          data: { content: deliverable.content || deliverable.description || JSON.stringify(deliverable) },
          position: blocks.length
        });
      });
    }
  }

  private addGenericBlocks(blocks: BlockInstruction[], result: any) {
    if (typeof result === 'string') {
      blocks.push({
        type: 'text',
        title: 'Result',
        config: {},
        data: { content: result },
        position: blocks.length
      });
    } else if (typeof result === 'object') {
      if (result.content) {
        blocks.push({
          type: 'text',
          title: 'Content',
          config: {},
          data: { content: result.content },
          position: blocks.length
        });
      }

      if (result.summary) {
        blocks.push({
          type: 'text',
          title: 'Summary',
          config: {},
          data: { content: result.summary },
          position: blocks.length
        });
      }

      if (!result.content && !result.summary) {
        blocks.push({
          type: 'text',
          title: 'Result Data',
          config: {},
          data: { content: `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` },
          position: blocks.length
        });
      }
    }
  }
} 