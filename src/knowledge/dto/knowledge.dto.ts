import { IsString, IsOptional, IsEnum, IsArray, IsInt, IsBoolean, IsUUID, IsDateString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Enums
export enum KnowledgeEntryType {
  PROMPT = 'prompt',
  DOCUMENT = 'document',
  PAGE = 'page',
}

export enum KnowledgeEntryStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum TrainingStatus {
  UNTRAINED = 'untrained',
  TRAINING = 'training',
  TRAINED = 'trained',
  FAILED = 'failed',
}

export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
}

// Request DTOs
export class CreateKnowledgeEntryDto {
  @IsEnum(KnowledgeEntryType)
  type: KnowledgeEntryType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(KnowledgeEntryStatus)
  status?: KnowledgeEntryStatus = KnowledgeEntryStatus.DRAFT;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  agentIds?: string[];

  // S3 file metadata
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class UpdateKnowledgeEntryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(KnowledgeEntryStatus)
  status?: KnowledgeEntryStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  agentIds?: string[];

  // S3 file metadata
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class KnowledgeQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(KnowledgeEntryType)
  type?: KnowledgeEntryType;

  @IsOptional()
  @IsEnum(KnowledgeEntryStatus)
  status?: KnowledgeEntryStatus;

  @IsOptional()
  @IsEnum(TrainingStatus)
  trainingStatus?: TrainingStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID(4)
  agentId?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'updatedAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateTagDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateAgentAccessDto {
  @IsArray()
  @IsUUID(4, { each: true })
  agentIds: string[];

  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel = AccessLevel.READ;
}

export class StartTrainingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

// Response DTOs
export class KnowledgeTagResponseDto {
  id: string;
  name: string;
  color?: string;
  workspaceId: string;
  createdAt: Date;
}

export class AgentAccessResponseDto {
  id: string;
  agentId: string;
  agentName: string;
  accessLevel: AccessLevel;
  createdAt: Date;
}

export class TrainingMetricsDto {
  accuracy?: number;
  confidence?: number;
  lastTrained?: Date;
  processingTime?: number;
  tokenCount?: number;
}

export class KnowledgeEntryResponseDto {
  id: string;
  workspaceId: string;
  type: KnowledgeEntryType;
  title: string;
  description?: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  status: KnowledgeEntryStatus;
  version: number;
  
  // Metadata
  createdBy: string;
  createdByName?: string;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Training
  trainingStatus: TrainingStatus;
  lastTrainedAt?: Date;
  trainingMetrics?: TrainingMetricsDto;
  
  // Relations
  tags: KnowledgeTagResponseDto[];
  agentAccess: AgentAccessResponseDto[];
}

export class KnowledgeListResponseDto {
  entries: KnowledgeEntryResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class KnowledgeStatsDto {
  totalEntries: number;
  entriesByType: Record<KnowledgeEntryType, number>;
  entriesByStatus: Record<KnowledgeEntryStatus, number>;
  entriesByTrainingStatus: Record<TrainingStatus, number>;
  totalTags: number;
  recentEntries: number; // Last 7 days
  trainingInProgress: number;
}

export class TrainingHistoryDto {
  id: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  metrics?: TrainingMetricsDto;
  errorMessage?: string;
  triggeredByName?: string;
}

export class BulkOperationDto {
  @IsArray()
  @IsUUID(4, { each: true })
  entryIds: string[];

  @IsString()
  operation: 'delete' | 'archive' | 'publish' | 'train';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkOperationResultDto {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  failureCount: number;
} 