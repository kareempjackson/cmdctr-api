import { IsString, IsNotEmpty } from 'class-validator';

export class AnalyzeTaskDto {
  @IsString()
  @IsNotEmpty()
  instruction: string;
}

export interface AnalyzeTaskResponse {
  understanding: string;
  approach: string[];
  estimatedDuration: string;
  requiredResources: string[];
} 