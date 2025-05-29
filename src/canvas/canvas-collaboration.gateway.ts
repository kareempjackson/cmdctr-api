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

interface CollaboratorInfo {
  userId: string;
  userName: string;
  userColor: string;
  canvasId: string;
  lastActivity: number;
}

interface CursorUpdate {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  timestamp: number;
}

interface BlockUpdate {
  blockId: string;
  updates: any;
  userId: string;
  userName: string;
  timestamp: number;
}

interface BlockCreate {
  block: any;
  userId: string;
  userName: string;
  timestamp: number;
}

interface BlockDelete {
  blockId: string;
  userId: string;
  userName: string;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3005'],
    credentials: true,
  },
  namespace: '/canvas',
})
export class CanvasCollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CanvasCollaborationGateway.name);
  
  // Track active collaborators by canvas
  private collaborators = new Map<string, Map<string, CollaboratorInfo>>();
  
  // Track socket to user/canvas mapping
  private socketToUser = new Map<string, { userId: string; canvasId: string }>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    const userInfo = this.socketToUser.get(client.id);
    if (userInfo) {
      this.removeUserFromCanvas(userInfo.canvasId, userInfo.userId);
      this.socketToUser.delete(client.id);
      
      // Notify other users in the canvas
      client.to(`canvas:${userInfo.canvasId}`).emit('user_left', {
        userId: userInfo.userId,
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('join_canvas')
  handleJoinCanvas(
    @MessageBody() data: { canvasId: string; userId: string; userName: string; userColor: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { canvasId, userId, userName, userColor } = data;
    
    this.logger.log(`User ${userName} (${userId}) joining canvas ${canvasId}`);
    
    // Join the canvas room
    client.join(`canvas:${canvasId}`);
    
    // Track the socket to user mapping
    this.socketToUser.set(client.id, { userId, canvasId });
    
    // Add user to canvas collaborators
    this.addUserToCanvas(canvasId, {
      userId,
      userName,
      userColor,
      canvasId,
      lastActivity: Date.now(),
    });
    
    // Send current collaborators to the joining user
    const canvasCollaborators = this.collaborators.get(canvasId);
    if (canvasCollaborators) {
      const collaboratorsList = Array.from(canvasCollaborators.values());
      client.emit('collaborators_list', collaboratorsList);
    }
    
    // Notify other users in the canvas
    client.to(`canvas:${canvasId}`).emit('user_joined', {
      userId,
      userName,
      userColor,
      timestamp: Date.now(),
    });
    
    return { success: true, message: `Joined canvas ${canvasId}` };
  }

  @SubscribeMessage('leave_canvas')
  handleLeaveCanvas(
    @MessageBody() data: { canvasId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { canvasId, userId } = data;
    
    this.logger.log(`User ${userId} leaving canvas ${canvasId}`);
    
    // Leave the canvas room
    client.leave(`canvas:${canvasId}`);
    
    // Remove user from tracking
    this.removeUserFromCanvas(canvasId, userId);
    this.socketToUser.delete(client.id);
    
    // Notify other users in the canvas
    client.to(`canvas:${canvasId}`).emit('user_left', {
      userId,
      timestamp: Date.now(),
    });
    
    return { success: true, message: `Left canvas ${canvasId}` };
  }

  @SubscribeMessage('cursor_move')
  handleCursorMove(
    @MessageBody() data: CursorUpdate,
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) return;
    
    // Update user activity
    this.updateUserActivity(userInfo.canvasId, userInfo.userId);
    
    // Broadcast cursor position to other users in the canvas
    client.to(`canvas:${userInfo.canvasId}`).emit('cursor_update', {
      ...data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('block_update')
  handleBlockUpdate(
    @MessageBody() data: BlockUpdate,
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) return;
    
    this.logger.log(`Block updated in canvas ${userInfo.canvasId}: ${data.blockId}`);
    
    // Update user activity
    this.updateUserActivity(userInfo.canvasId, userInfo.userId);
    
    // Broadcast block update to other users in the canvas
    client.to(`canvas:${userInfo.canvasId}`).emit('block_updated', {
      ...data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('block_create')
  handleBlockCreate(
    @MessageBody() data: BlockCreate,
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) return;
    
    this.logger.log(`Block created in canvas ${userInfo.canvasId}`);
    
    // Update user activity
    this.updateUserActivity(userInfo.canvasId, userInfo.userId);
    
    // Broadcast block creation to other users in the canvas
    client.to(`canvas:${userInfo.canvasId}`).emit('block_created', {
      ...data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('block_delete')
  handleBlockDelete(
    @MessageBody() data: BlockDelete,
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) return;
    
    this.logger.log(`Block deleted in canvas ${userInfo.canvasId}: ${data.blockId}`);
    
    // Update user activity
    this.updateUserActivity(userInfo.canvasId, userInfo.userId);
    
    // Broadcast block deletion to other users in the canvas
    client.to(`canvas:${userInfo.canvasId}`).emit('block_deleted', {
      ...data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody() data: { blockId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) return;
    
    // Update user activity
    this.updateUserActivity(userInfo.canvasId, userInfo.userId);
    
    // Broadcast typing indicator to other users
    client.to(`canvas:${userInfo.canvasId}`).emit('user_typing', {
      userId: userInfo.userId,
      blockId: data.blockId,
      isTyping: true,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() data: { blockId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) return;
    
    // Broadcast typing stop to other users
    client.to(`canvas:${userInfo.canvasId}`).emit('user_typing', {
      userId: userInfo.userId,
      blockId: data.blockId,
      isTyping: false,
      timestamp: Date.now(),
    });
  }

  private addUserToCanvas(canvasId: string, collaborator: CollaboratorInfo) {
    if (!this.collaborators.has(canvasId)) {
      this.collaborators.set(canvasId, new Map());
    }
    
    const canvasCollaborators = this.collaborators.get(canvasId);
    if (canvasCollaborators) {
      canvasCollaborators.set(collaborator.userId, collaborator);
    }
  }

  private removeUserFromCanvas(canvasId: string, userId: string) {
    const canvasCollaborators = this.collaborators.get(canvasId);
    if (canvasCollaborators) {
      canvasCollaborators.delete(userId);
      
      // Clean up empty canvas maps
      if (canvasCollaborators.size === 0) {
        this.collaborators.delete(canvasId);
      }
    }
  }

  private updateUserActivity(canvasId: string, userId: string) {
    const canvasCollaborators = this.collaborators.get(canvasId);
    if (canvasCollaborators) {
      const collaborator = canvasCollaborators.get(userId);
      if (collaborator) {
        collaborator.lastActivity = Date.now();
      }
    }
  }

  // Method to get active collaborators for a canvas (for debugging/monitoring)
  getCanvasCollaborators(canvasId: string): CollaboratorInfo[] {
    const canvasCollaborators = this.collaborators.get(canvasId);
    return canvasCollaborators ? Array.from(canvasCollaborators.values()) : [];
  }

  // Method to broadcast system messages to a canvas
  broadcastToCanvas(canvasId: string, event: string, data: any) {
    this.server.to(`canvas:${canvasId}`).emit(event, {
      ...data,
      timestamp: Date.now(),
    });
  }
} 