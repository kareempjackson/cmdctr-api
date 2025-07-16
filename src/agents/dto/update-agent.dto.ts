import { IsArray, IsOptional, IsIn, IsString, IsObject, IsBoolean } from 'class-validator';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsObject()
  config?: any; // JSON

  @IsOptional()
  @IsIn(['workspace', 'project', 'personal'])
  memoryScope?: 'workspace' | 'project' | 'personal';

  @IsOptional()
  @IsObject()
  permissions?: {
    canAccessFiles?: boolean;
    canReadJots?: boolean;
    canTakeActions?: boolean;
  };

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

export class UpdateAgentKnowledgeAccessDto {
  @IsArray()
  @IsString({ each: true })
  knowledgeEntryIds: string[];

  @IsOptional()
  @IsIn(['read', 'write'])
  accessLevel?: 'read' | 'write';
} 