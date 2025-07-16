import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  workspaceId: string;

  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean = false;

  @IsString()
  createdBy: string;
} 