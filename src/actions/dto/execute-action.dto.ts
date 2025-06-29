import { IsString, IsNotEmpty, IsOptional, IsObject, IsArray } from 'class-validator';

export class ExecuteActionDto {
  @IsString()
  @IsNotEmpty()
  actionName: string;

  @IsObject()
  @IsOptional()
  parameters?: any;

  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;
} 