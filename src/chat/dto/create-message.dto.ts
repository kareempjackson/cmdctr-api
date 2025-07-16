import { IsString, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  channelId: string;

  @IsString()
  userId: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  threadRootId?: string;

  @IsString()
  @IsOptional()
  blockId?: string;
}
