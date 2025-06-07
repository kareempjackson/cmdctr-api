import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ExecuteAgentDto {
  @IsString()
  @IsNotEmpty()
  input: string;

  @IsOptional()
  metadata?: any;
} 