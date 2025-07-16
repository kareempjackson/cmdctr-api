import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateChannelMemberDto } from './dto/create-channel-member.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createChannel(dto: CreateChannelDto) {
    return this.prisma.chatChannel.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        isPrivate: dto.isPrivate ?? false,
        createdBy: dto.createdBy,
      },
    });
  }

  async addChannelMember(dto: CreateChannelMemberDto) {
    return this.prisma.chatChannelMember.create({
      data: {
        channelId: dto.channelId,
        userId: dto.userId,
      },
    });
  }

  async createMessage(dto: CreateMessageDto) {
    return this.prisma.chatMessage.create({
      data: {
        channelId: dto.channelId,
        userId: dto.userId,
        content: dto.content,
        threadRootId: dto.threadRootId,
        blockId: dto.blockId,
      },
    });
  }

  async listChannels(workspaceId: string) {
    return this.prisma.chatChannel.findMany({
      where: { workspaceId },
      include: { members: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listChannelMembers(channelId: string) {
    return this.prisma.chatChannelMember.findMany({
      where: { channelId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async listMessages(channelId: string, threadRootId?: string) {
    return this.prisma.chatMessage.findMany({
      where: {
        channelId,
        threadRootId: threadRootId ?? null,
      },
      orderBy: { createdAt: 'asc' },
      include: { user: true, threadReplies: true, feedback: true },
    });
  }

  async listChannelsPaginated(workspaceId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    const [channels, total] = await Promise.all([
      this.prisma.chatChannel.findMany({
        where: { workspaceId },
        include: { members: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.chatChannel.count({ where: { workspaceId } }),
    ]);
    return { channels, total, page, pageSize };
  }

  async listMessagesPaginated(channelId: string, threadRootId?: string, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { channelId, threadRootId: threadRootId ?? null },
        orderBy: { createdAt: 'asc' },
        include: { user: true, threadReplies: true, feedback: true },
        skip,
        take,
      }),
      this.prisma.chatMessage.count({ where: { channelId, threadRootId: threadRootId ?? null } }),
    ]);
    return { messages, total, page, pageSize };
  }

  // Add more methods for listing channels, messages, etc.
}