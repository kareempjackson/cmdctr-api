import { IsString, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotePriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum NoteColor {
  YELLOW = 'yellow',
  BLUE = 'blue',
  GREEN = 'green',
  PINK = 'pink',
  PURPLE = 'purple',
  ORANGE = 'orange',
  RED = 'red',
  GRAY = 'gray',
}

// Note DTOs
export class CreateNoteDto {
  @ApiProperty({ description: 'Note title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Note content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Note color', enum: NoteColor })
  @IsOptional()
  @IsEnum(NoteColor)
  color?: NoteColor;

  @ApiPropertyOptional({ description: 'Is note pinned' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Note tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateNoteDto {
  @ApiPropertyOptional({ description: 'Note title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Note content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Note color', enum: NoteColor })
  @IsOptional()
  @IsEnum(NoteColor)
  color?: NoteColor;

  @ApiPropertyOptional({ description: 'Is note pinned' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Is note archived' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Note tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// Jot DTOs
export class CreateJotDto {
  @ApiProperty({ description: 'Jot text content' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Jot color', enum: NoteColor })
  @IsOptional()
  @IsEnum(NoteColor)
  color?: NoteColor;

  @ApiPropertyOptional({ description: 'Jot priority', enum: NotePriority })
  @IsOptional()
  @IsEnum(NotePriority)
  priority?: NotePriority;

  @ApiPropertyOptional({ description: 'Is jot completed' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class UpdateJotDto {
  @ApiPropertyOptional({ description: 'Jot text content' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Jot color', enum: NoteColor })
  @IsOptional()
  @IsEnum(NoteColor)
  color?: NoteColor;

  @ApiPropertyOptional({ description: 'Jot priority', enum: NotePriority })
  @IsOptional()
  @IsEnum(NotePriority)
  priority?: NotePriority;

  @ApiPropertyOptional({ description: 'Is jot completed' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

// Query DTOs
export class NotesQueryDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by pinned notes' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Filter by archived notes' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Filter by color', enum: NoteColor })
  @IsOptional()
  @IsEnum(NoteColor)
  color?: NoteColor;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  pageSize?: number = 20;
}

export class JotsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by completed jots' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: NotePriority })
  @IsOptional()
  @IsEnum(NotePriority)
  priority?: NotePriority;

  @ApiPropertyOptional({ description: 'Filter by color', enum: NoteColor })
  @IsOptional()
  @IsEnum(NoteColor)
  color?: NoteColor;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  pageSize?: number = 50;
}

// Response DTOs
export class NoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  createdBy: string;

  @ApiPropertyOptional()
  color?: string;

  @ApiProperty()
  isPinned: boolean;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  tags?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;

  @ApiPropertyOptional()
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export class JotResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  createdBy: string;

  @ApiPropertyOptional()
  color?: string;

  @ApiProperty()
  completed: boolean;

  @ApiPropertyOptional()
  priority?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export class NotesListResponseDto {
  @ApiProperty({ type: [NoteResponseDto] })
  notes: NoteResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class JotsListResponseDto {
  @ApiProperty({ type: [JotResponseDto] })
  jots: JotResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
} 