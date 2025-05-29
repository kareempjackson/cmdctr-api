import { IsOptional, IsString, IsInt, IsDateString, IsIn, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ActivityFiltersDto {
  @IsOptional()
  @IsString()
  category?: string; // 'auth', 'agent', 'workspace', 'file', 'system'

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  status?: string; // 'success', 'error', 'warning', 'info'

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string; // Search in description

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
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['timestamp', 'category', 'action', 'status'])
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: string = 'desc';
}

export class LogActivityDto {
  @IsString()
  category: string;

  @IsString()
  action: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  @IsIn(['success', 'error', 'warning', 'info'])
  status?: string = 'info';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration?: number;
}

export class AuditFiltersDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string; // 'create', 'update', 'delete'

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['timestamp', 'action', 'entityType'])
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: string = 'desc';
}

export class LogAuditDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsString()
  action: string;

  @IsString()
  userId: string;

  @IsString()
  workspaceId: string;

  @IsOptional()
  fieldChanges?: any;

  @IsOptional()
  @IsString()
  reason?: string;
} 