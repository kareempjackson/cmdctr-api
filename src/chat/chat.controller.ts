import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateChannelMemberDto } from './dto/create-channel-member.dto';

// Stub AuthGuard for demonstration
class AuthGuardStub {
  canActivate() { return true; }
}

@ApiTags('chat')
@Controller('chat')
@UseGuards(AuthGuardStub)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('channels')
  async createChannel(@Body() dto: CreateChannelDto) {
    // TODO: get user from auth context
    return this.chatService.createChannel(dto);
  }

  @Post('channels/members')
  async addChannelMember(@Body() dto: CreateChannelMemberDto) {
    return this.chatService.addChannelMember(dto);
  }

  @Post('messages')
  async createMessage(@Body() dto: CreateMessageDto) {
    return this.chatService.createMessage(dto);
  }

  @Get('channels')
  async listChannels(@Query('workspaceId') workspaceId: string, @Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.chatService.listChannelsPaginated(workspaceId, Number(page), Number(pageSize));
  }

  @Get('channels/members')
  async listChannelMembers(@Query('channelId') channelId: string) {
    return this.chatService.listChannelMembers(channelId);
  }

  @Get('messages')
  async listMessages(@Query('channelId') channelId: string, @Query('threadRootId') threadRootId?: string, @Query('page') page = 1, @Query('pageSize') pageSize = 50) {
    return this.chatService.listMessagesPaginated(channelId, threadRootId, Number(page), Number(pageSize));
  }
}