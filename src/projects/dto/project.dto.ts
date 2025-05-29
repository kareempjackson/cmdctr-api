import { IsString, IsOptional, IsBoolean, IsArray, IsUUID, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  COMPLETED = 'completed',
}

export enum CanvasType {
  KANBAN = 'kanban',
  TABLE = 'table',
  CALENDAR = 'calendar',
  DOCUMENT = 'document',
  CUSTOM = 'custom',
}

export enum BlockType {
  TEXT = 'text',
  TABLE = 'table',
  CHART = 'chart',
  AGENT = 'agent',
  KANBAN = 'kanban',
  CALENDAR = 'calendar',
  DOCUMENT = 'document',
  IMAGE = 'image',
  CODE = 'code',
  TASK_LIST = 'task_list',
  EMBED = 'embed',
}

// Project DTOs
export class CreateProjectDto {
  @ApiProperty({ description: 'Project name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'URL-friendly slug for the project' })
  @IsString()
  slug: string;

  @ApiProperty({ description: 'Workspace ID' })
  @IsUUID()
  workspaceId: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'AI context for project understanding' })
  @IsOptional()
  @IsString()
  aiContext?: string;

  @ApiPropertyOptional({ description: 'Color theme for project (hex color)' })
  @IsOptional()
  @IsString()
  colorTheme?: string;

  @ApiPropertyOptional({ description: 'Whether project is publicly accessible', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Project name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug for the project' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'AI context for project understanding' })
  @IsOptional()
  @IsString()
  aiContext?: string;

  @ApiPropertyOptional({ description: 'Color theme for project (hex color)' })
  @IsOptional()
  @IsString()
  colorTheme?: string;

  @ApiPropertyOptional({ description: 'Project status', enum: ProjectStatus })
  @IsOptional()
  @IsIn(Object.values(ProjectStatus))
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Whether project is publicly accessible' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// Canvas DTOs
export class CreateCanvasDto {
  @ApiProperty({ description: 'Canvas name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ description: 'Canvas type', enum: CanvasType, default: CanvasType.CUSTOM })
  @IsOptional()
  @IsIn(Object.values(CanvasType))
  type?: CanvasType;

  @ApiPropertyOptional({ description: 'Canvas description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Canvas configuration', default: {} })
  @IsOptional()
  config?: any;

  @ApiPropertyOptional({ description: 'AI context for this canvas' })
  @IsOptional()
  @IsString()
  aiContext?: string;

  @ApiPropertyOptional({ description: 'Layout type', default: 'freeform' })
  @IsOptional()
  @IsString()
  layout?: string;

  @ApiPropertyOptional({ description: 'Whether canvas is a template', default: false })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ description: 'Whether canvas is publicly accessible', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateCanvasDto {
  @ApiPropertyOptional({ description: 'Canvas name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Canvas type', enum: CanvasType })
  @IsOptional()
  @IsIn(Object.values(CanvasType))
  type?: CanvasType;

  @ApiPropertyOptional({ description: 'Canvas description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Canvas configuration' })
  @IsOptional()
  config?: any;

  @ApiPropertyOptional({ description: 'AI context for this canvas' })
  @IsOptional()
  @IsString()
  aiContext?: string;

  @ApiPropertyOptional({ description: 'Layout type' })
  @IsOptional()
  @IsString()
  layout?: string;

  @ApiPropertyOptional({ description: 'Whether canvas is a template' })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ description: 'Whether canvas is publicly accessible' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// Block DTOs
export class CreateBlockDto {
  @ApiProperty({ description: 'Canvas ID' })
  @IsUUID()
  canvasId: string;

  @ApiProperty({ description: 'Block type', enum: BlockType })
  @IsIn(Object.values(BlockType))
  type: BlockType;

  @ApiProperty({ description: 'Order position in canvas' })
  order: number;

  @ApiPropertyOptional({ description: 'X coordinate for free-form layouts' })
  @IsOptional()
  x?: number;

  @ApiPropertyOptional({ description: 'Y coordinate for free-form layouts' })
  @IsOptional()
  y?: number;

  @ApiPropertyOptional({ description: 'Block width' })
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ description: 'Block height' })
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ description: 'Block title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Block data content', default: {} })
  @IsOptional()
  content?: any;

  @ApiPropertyOptional({ description: 'Block-specific configuration', default: {} })
  @IsOptional()
  config?: any;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'Whether block is collapsed', default: false })
  @IsOptional()
  @IsBoolean()
  isCollapsed?: boolean;

  @ApiPropertyOptional({ description: 'Whether block is locked', default: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class UpdateBlockDto {
  @ApiPropertyOptional({ description: 'Block type', enum: BlockType })
  @IsOptional()
  @IsIn(Object.values(BlockType))
  type?: BlockType;

  @ApiPropertyOptional({ description: 'Order position in canvas' })
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: 'X coordinate for free-form layouts' })
  @IsOptional()
  x?: number;

  @ApiPropertyOptional({ description: 'Y coordinate for free-form layouts' })
  @IsOptional()
  y?: number;

  @ApiPropertyOptional({ description: 'Block width' })
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ description: 'Block height' })
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ description: 'Block title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Block data content' })
  @IsOptional()
  content?: any;

  @ApiPropertyOptional({ description: 'Block-specific configuration' })
  @IsOptional()
  config?: any;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'Whether block is collapsed' })
  @IsOptional()
  @IsBoolean()
  isCollapsed?: boolean;

  @ApiPropertyOptional({ description: 'Whether block is locked' })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class BulkUpdateBlocksDto {
  @ApiProperty({ description: 'Array of block updates with IDs' })
  @IsArray()
  blocks: Array<{ id: string } & UpdateBlockDto>;
}

// Response DTOs
export class BlockResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  canvasId: string;

  @ApiProperty({ enum: BlockType })
  type: BlockType;

  @ApiProperty()
  order: number;

  @ApiPropertyOptional()
  x?: number;

  @ApiPropertyOptional()
  y?: number;

  @ApiPropertyOptional()
  width?: number;

  @ApiPropertyOptional()
  height?: number;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  content: any;

  @ApiProperty()
  config: any;

  @ApiPropertyOptional()
  metadata?: any;

  @ApiProperty()
  isCollapsed: boolean;

  @ApiProperty()
  isLocked: boolean;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CanvasResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ enum: CanvasType })
  type: CanvasType;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  config: any;

  @ApiPropertyOptional()
  aiContext?: string;

  @ApiProperty()
  layout: string;

  @ApiProperty()
  isTemplate: boolean;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [BlockResponseDto] })
  blocks: BlockResponseDto[];
}

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  aiContext?: string;

  @ApiPropertyOptional()
  colorTheme?: string;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [CanvasResponseDto] })
  canvases: CanvasResponseDto[];
}

export class ProjectListResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  projects: ProjectResponseDto[];

  @ApiProperty()
  total: number;
} 