import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3005'],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @MessageBody() data: { channelId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`channel:${data.channelId}`);
    // Optionally add to DB if not already a member
    await this.chatService.addChannelMember({ channelId: data.channelId, userId: data.userId });
    this.server.to(`channel:${data.channelId}`).emit('user_joined', { userId: data.userId });
    return { success: true };
  }

  @SubscribeMessage('leave_channel')
  handleLeaveChannel(
    @MessageBody() data: { channelId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`channel:${data.channelId}`);
    this.server.to(`channel:${data.channelId}`).emit('user_left', { userId: data.userId });
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { channelId: string; userId: string; content: string; threadRootId?: string; blockId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const message = await this.chatService.createMessage(data);
    this.server.to(`channel:${data.channelId}`).emit('new_message', message);
    return { success: true, message };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { channelId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`channel:${data.channelId}`).emit('user_typing', { userId: data.userId });
  }
}