import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString } from 'class-validator';

export class UsageResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  userId: string;

  @ApiProperty({ example: 150, description: 'Number of requests made' })
  requests: number;

  @ApiProperty({ example: 50000, description: 'Number of tokens used' })
  tokens: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Last reset date' })
  lastReset: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class IncrementUsageDto {
  @ApiProperty({ example: 100, description: 'Number of tokens used', required: false })
  @IsOptional()
  @IsNumber()
  tokensUsed?: number;

  @ApiProperty({ example: 'prompt', description: 'Type of usage', required: false })
  @IsOptional()
  @IsString()
  usageType?: string;
}

export class UsageLimitDto {
  @ApiProperty({ example: 1000, description: 'Maximum requests allowed' })
  requestsLimit: number;

  @ApiProperty({ example: 100000, description: 'Maximum tokens allowed' })
  tokensLimit: number;

  @ApiProperty({ example: 150, description: 'Current requests used' })
  requestsUsed: number;

  @ApiProperty({ example: 50000, description: 'Current tokens used' })
  tokensUsed: number;

  @ApiProperty({ example: 850, description: 'Remaining requests' })
  requestsRemaining: number;

  @ApiProperty({ example: 50000, description: 'Remaining tokens' })
  tokensRemaining: number;
} 