import { IsString, IsOptional, IsObject, IsDateString, IsEnum, IsArray, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export enum TaskType {
  REMINDER = 'reminder',
  DOCUMENT = 'document',
  NOTIFICATION = 'notification',
  MEETING = 'meeting',
  KNOWLEDGE = 'knowledge',
  CUSTOM = 'custom',
  AGENT_INSTRUCTION = 'agent_instruction'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export class CreateAgentTaskDto {
  @IsString()
  agentId: string;

  @IsEnum(TaskType)
  type: TaskType;

  @IsObject()
  parameters: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetries?: number = 3;
} 