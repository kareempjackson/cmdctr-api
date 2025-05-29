import { ApiProperty } from '@nestjs/swagger';

export class SearchMemoryDto {
  @ApiProperty({ description: 'Search query for memory' })
  query: string;

  @ApiProperty({ description: 'Maximum number of results', required: false, default: 10 })
  limit?: number;
} 