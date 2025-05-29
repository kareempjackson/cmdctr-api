import { ApiProperty } from '@nestjs/swagger';

export class CloneAgentDto {
  @ApiProperty({ description: 'Name for the cloned agent' })
  name: string;
} 