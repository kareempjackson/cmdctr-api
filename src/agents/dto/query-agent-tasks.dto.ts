import { IsOptional, IsString, IsEnum, IsArray, IsInt, Min, IsDateString, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskType, TaskPriority } from './create-agent-task.dto';
import { TaskStatus } from './update-agent-task.dto';

export class QueryAgentTasksDto {
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsDateString()
  scheduledForAfter?: string;

  @IsOptional()
  @IsDateString()
  scheduledForBefore?: string;

  @IsOptional()
  @IsDateString()
  createdAtAfter?: string;

  @IsOptional()
  @IsDateString()
  createdAtBefore?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc';
} 