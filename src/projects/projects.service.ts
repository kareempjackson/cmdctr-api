import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateCanvasDto,
  UpdateCanvasDto,
  CreateBlockDto,
  UpdateBlockDto,
  BulkUpdateBlocksDto,
  ProjectResponseDto,
  CanvasResponseDto,
  BlockResponseDto,
  ProjectListResponseDto,
  ProjectStatus,
  CanvasType,
  BlockType,
} from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  // Project Methods
  async createProject(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, dto.workspaceId);

    // Check slug uniqueness within workspace
    const existingProject = await this.prisma.project.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: dto.workspaceId,
          slug: dto.slug,
        },
      },
    });

    if (existingProject) {
      throw new ConflictException('Project slug already exists in workspace');
    }

    const project = await this.prisma.project.create({
      data: {
        ...dto,
        ownerId: userId,
      },
      include: {
        canvases: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: dto.workspaceId,
      category: 'project',
      action: 'create',
      resource: project.id,
      description: `Created project "${project.name}"`,
      metadata: { projectId: project.id },
      status: 'success',
    });

    return this.formatProjectResponse(project);
  }

  async getProject(userId: string, projectId: string): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        canvases: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify access
    await this.verifyProjectAccess(userId, project);

    return this.formatProjectResponse(project);
  }

  async getWorkspaceProjects(userId: string, workspaceId: string): Promise<ProjectListResponseDto> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(userId, workspaceId);

    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        canvases: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      projects: projects.map(project => this.formatProjectResponse(project)),
      total: projects.length,
    };
  }

  async updateProject(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify access
    await this.verifyProjectAccess(userId, project);

    // Check slug uniqueness if updating slug
    if (dto.slug && dto.slug !== project.slug) {
      const existingProject = await this.prisma.project.findUnique({
        where: {
          workspaceId_slug: {
            workspaceId: project.workspaceId,
            slug: dto.slug,
          },
        },
      });

      if (existingProject) {
        throw new ConflictException('Project slug already exists in workspace');
      }
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: dto,
      include: {
        canvases: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: project.workspaceId,
      category: 'project',
      action: 'update',
      resource: projectId,
      description: `Updated project "${updatedProject.name}"`,
      metadata: { projectId, changes: dto },
      status: 'success',
    });

    return this.formatProjectResponse(updatedProject);
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify access
    await this.verifyProjectAccess(userId, project);

    // Delete project (canvases and blocks will be cascade deleted)
    await this.prisma.project.delete({
      where: { id: projectId },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: project.workspaceId,
      category: 'project',
      action: 'delete',
      resource: projectId,
      description: `Deleted project "${project.name}"`,
      metadata: { projectId },
      status: 'success',
    });
  }

  // Canvas Methods
  async createCanvas(userId: string, dto: CreateCanvasDto): Promise<CanvasResponseDto> {
    // Verify user has access to project
    const project = await this.verifyProjectAccess(userId, { id: dto.projectId } as any);

    const canvas = await this.prisma.canvas.create({
      data: {
        ...dto,
        createdBy: userId,
        config: dto.config || {},
      },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: project.workspaceId,
      category: 'canvas',
      action: 'create',
      resource: canvas.id,
      description: `Created canvas "${canvas.name}"`,
      metadata: { canvasId: canvas.id, projectId: dto.projectId },
      status: 'success',
    });

    return this.formatCanvasResponse(canvas);
  }

  async getCanvas(userId: string, canvasId: string): Promise<CanvasResponseDto> {
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: canvasId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
        project: true,
      },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, canvas.project);

    return this.formatCanvasResponse(canvas);
  }

  async getProjectCanvases(userId: string, projectId: string): Promise<CanvasResponseDto[]> {
    // Verify user has access to project
    await this.verifyProjectAccess(userId, { id: projectId } as any);

    const canvases = await this.prisma.canvas.findMany({
      where: { projectId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
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
  ): Promise<CanvasResponseDto> {
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: canvasId },
      include: { project: true },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, canvas.project);

    const updatedCanvas = await this.prisma.canvas.update({
      where: { id: canvasId },
      data: dto,
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.project.workspaceId,
      category: 'canvas',
      action: 'update',
      resource: canvasId,
      description: `Updated canvas "${updatedCanvas.name}"`,
      metadata: { canvasId, projectId: canvas.projectId, changes: dto },
      status: 'success',
    });

    return this.formatCanvasResponse(updatedCanvas);
  }

  async deleteCanvas(userId: string, canvasId: string): Promise<void> {
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: canvasId },
      include: { project: true },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, canvas.project);

    // Delete canvas (blocks will be cascade deleted)
    await this.prisma.canvas.delete({
      where: { id: canvasId },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.project.workspaceId,
      category: 'canvas',
      action: 'delete',
      resource: canvasId,
      description: `Deleted canvas "${canvas.name}"`,
      metadata: { canvasId, projectId: canvas.projectId },
      status: 'success',
    });
  }

  // Block Methods
  async createBlock(userId: string, dto: CreateBlockDto): Promise<BlockResponseDto> {
    // Verify user has access to canvas
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: dto.canvasId },
      include: { project: true },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, canvas.project);

    const block = await this.prisma.block.create({
      data: {
        ...dto,
        createdBy: userId,
        content: dto.content || {},
        config: dto.config || {},
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.project.workspaceId,
      category: 'block',
      action: 'create',
      resource: block.id,
      description: `Created ${dto.type} block`,
      metadata: { 
        blockId: block.id, 
        canvasId: dto.canvasId, 
        projectId: canvas.projectId,
        blockType: dto.type 
      },
      status: 'success',
    });

    return this.formatBlockResponse(block);
  }

  async getBlock(userId: string, blockId: string): Promise<BlockResponseDto> {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: {
        canvas: {
          include: { project: true },
        },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, block.canvas.project);

    return this.formatBlockResponse(block);
  }

  async getCanvasBlocks(userId: string, canvasId: string): Promise<BlockResponseDto[]> {
    // Verify user has access to canvas
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: canvasId },
      include: { project: true },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, canvas.project);

    const blocks = await this.prisma.block.findMany({
      where: { canvasId },
      orderBy: { order: 'asc' },
    });

    return blocks.map(block => this.formatBlockResponse(block));
  }

  async updateBlock(
    userId: string,
    blockId: string,
    dto: UpdateBlockDto,
  ): Promise<BlockResponseDto> {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: {
        canvas: {
          include: { project: true },
        },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, block.canvas.project);

    const updatedBlock = await this.prisma.block.update({
      where: { id: blockId },
      data: dto,
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: block.canvas.project.workspaceId,
      category: 'block',
      action: 'update',
      resource: blockId,
      description: `Updated ${block.type} block`,
      metadata: { 
        blockId, 
        canvasId: block.canvasId, 
        projectId: block.canvas.projectId,
        changes: dto 
      },
      status: 'success',
    });

    return this.formatBlockResponse(updatedBlock);
  }

  async bulkUpdateBlocks(
    userId: string,
    canvasId: string,
    dto: BulkUpdateBlocksDto,
  ): Promise<BlockResponseDto[]> {
    // Verify user has access to canvas
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: canvasId },
      include: { project: true },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, canvas.project);

    // Update blocks in transaction
    const updatedBlocks = await this.prisma.$transaction(
      dto.blocks.map(blockUpdate => 
        this.prisma.block.update({
          where: { id: blockUpdate.id },
          data: {
            ...blockUpdate,
            id: undefined, // Remove id from update data
          },
        })
      )
    );

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: canvas.project.workspaceId,
      category: 'block',
      action: 'bulk_update',
      resource: canvasId,
      description: `Bulk updated ${dto.blocks.length} blocks`,
      metadata: { 
        canvasId, 
        projectId: canvas.projectId,
        blocksUpdated: dto.blocks.length 
      },
      status: 'success',
    });

    return updatedBlocks.map(block => this.formatBlockResponse(block));
  }

  async deleteBlock(userId: string, blockId: string): Promise<void> {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: {
        canvas: {
          include: { project: true },
        },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Verify access through project
    await this.verifyProjectAccess(userId, block.canvas.project);

    // Delete block
    await this.prisma.block.delete({
      where: { id: blockId },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: block.canvas.project.workspaceId,
      category: 'block',
      action: 'delete',
      resource: blockId,
      description: `Deleted ${block.type} block`,
      metadata: { 
        blockId, 
        canvasId: block.canvasId, 
        projectId: block.canvas.projectId,
        blockType: block.type 
      },
      status: 'success',
    });
  }

  // Private helper methods
  private async verifyWorkspaceAccess(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to workspace');
    }
  }

  private async verifyProjectAccess(userId: string, project: any): Promise<any> {
    // If project is just an ID, fetch the full project
    if (typeof project === 'string' || (project && !project.workspaceId)) {
      const fullProject = await this.prisma.project.findUnique({
        where: { id: typeof project === 'string' ? project : project.id },
      });

      if (!fullProject) {
        throw new NotFoundException('Project not found');
      }

      project = fullProject;
    }

    // Check workspace access
    await this.verifyWorkspaceAccess(userId, project.workspaceId);
    
    return project;
  }

  private formatProjectResponse(project: any): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      workspaceId: project.workspaceId,
      ownerId: project.ownerId,
      description: project.description,
      aiContext: project.aiContext,
      colorTheme: project.colorTheme,
      status: project.status as ProjectStatus,
      isPublic: project.isPublic,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      canvases: project.canvases ? project.canvases.map(canvas => this.formatCanvasResponse(canvas)) : [],
    };
  }

  private formatCanvasResponse(canvas: any): CanvasResponseDto {
    return {
      id: canvas.id,
      name: canvas.name,
      projectId: canvas.projectId,
      type: canvas.type as CanvasType,
      description: canvas.description,
      createdBy: canvas.createdBy,
      config: canvas.config,
      aiContext: canvas.aiContext,
      layout: canvas.layout,
      isTemplate: canvas.isTemplate,
      isPublic: canvas.isPublic,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
      blocks: canvas.blocks ? canvas.blocks.map(block => this.formatBlockResponse(block)) : [],
    };
  }

  private formatBlockResponse(block: any): BlockResponseDto {
    return {
      id: block.id,
      canvasId: block.canvasId,
      type: block.type as BlockType,
      order: block.order,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      title: block.title,
      content: block.content,
      config: block.config,
      metadata: block.metadata,
      isCollapsed: block.isCollapsed,
      isLocked: block.isLocked,
      createdBy: block.createdBy,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }
} 