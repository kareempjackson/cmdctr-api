import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  targetType: string; // 'block', 'message', 'insight'

  @IsString()
  targetId: string;

  @IsInt()
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
} 