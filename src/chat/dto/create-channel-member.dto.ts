import { IsString } from 'class-validator';

export class CreateChannelMemberDto {
  @IsString()
  channelId: string;

  @IsString()
  userId: string;
}
