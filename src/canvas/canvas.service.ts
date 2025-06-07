import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockInstruction } from '../prompt/prompt.service';

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
}

export interface UpdateCanvasDto {
  name?: string;
  description?: string;
  blocks?: BlockInstruction[];
}

@Injectable()
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.formatCanvasResponse(canvas);
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
        position: updates.position,
        title: updates.title,
        config: updates.config,
        data: updates.data,
      },
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
} 