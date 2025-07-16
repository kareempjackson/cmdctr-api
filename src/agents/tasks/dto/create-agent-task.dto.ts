import { IsString, IsOptional, IsObject, IsEnum, IsNumber, IsArray, IsDateString, Min, Max } from 'class-validator';

export enum TaskType {
  REMINDER = 'reminder',
  DOCUMENT = 'document',
  NOTIFICATION = 'notification',
  MEETING = 'meeting',
  KNOWLEDGE = 'knowledge',
  CALENDAR = 'calendar',
  EMAIL = 'email',
  SLACK = 'slack',
  POLICY = 'policy',
  REPORT = 'report',
  WORKFLOW = 'workflow',
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
  tags?: string[] = [];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number = 3;
} 