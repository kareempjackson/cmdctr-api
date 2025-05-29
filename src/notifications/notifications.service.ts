import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationQueryDto,
  BulkUpdateNotificationsDto,
  CreateNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
  CreateNotificationTemplateDto,
  NotificationType,
  NotificationPriority,
  DeliveryChannel,
  NotificationResponse,
  NotificationStats,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ============ NOTIFICATIONS CRUD ============

  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.create({
      data: {
        ...createNotificationDto,
        deliveryChannels: createNotificationDto.deliveryChannels,
        expiresAt: createNotificationDto.expiresAt ? new Date(createNotificationDto.expiresAt) : null,
      },
    });

    // Trigger delivery based on channels
    await this.deliverNotification(notification.id);

    return this.formatNotificationResponse(notification);
  }

  async findAll(
    recipientId: string,
    query: NotificationQueryDto,
  ): Promise<{ notifications: NotificationResponse[]; total: number }> {
    const where = {
      recipientId,
      ...(query.workspaceId && { workspaceId: query.workspaceId }),
      ...(query.type && { type: query.type }),
      ...(query.category && { category: query.category }),
      ...(query.priority && { priority: query.priority }),
      ...(query.isRead !== undefined && { isRead: query.isRead }),
      // Filter out expired notifications
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map(this.formatNotificationResponse),
      total,
    };
  }

  async findOne(id: string, recipientId: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        recipientId,
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.formatNotificationResponse(notification);
  }

  async update(
    id: string,
    recipientId: string,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, recipientId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: {
        ...updateNotificationDto,
        ...(updateNotificationDto.isRead === true && !notification.readAt && { readAt: new Date() }),
      },
    });

    return this.formatNotificationResponse(updatedNotification);
  }

  async remove(id: string, recipientId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, recipientId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    await this.prisma.notification.delete({ where: { id } });
  }

  async bulkUpdate(
    recipientId: string,
    bulkUpdateDto: BulkUpdateNotificationsDto,
  ): Promise<{ updated: number }> {
    const updateData: any = {};
    
    if (bulkUpdateDto.isRead !== undefined) {
      updateData.isRead = bulkUpdateDto.isRead;
      if (bulkUpdateDto.isRead === true) {
        updateData.readAt = new Date();
      }
    }

    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: bulkUpdateDto.notificationIds },
        recipientId,
      },
      data: updateData,
    });

    return { updated: result.count };
  }

  async markAllAsRead(recipientId: string, workspaceId?: string): Promise<{ updated: number }> {
    const where: any = {
      recipientId,
      isRead: false,
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const result = await this.prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async getStats(recipientId: string, workspaceId?: string): Promise<NotificationStats> {
    const where: any = {
      recipientId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const [total, unread, byType, byPriority] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where,
        _count: { type: true },
      }),
      this.prisma.notification.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true },
      }),
    ]);

    const typeStats = Object.values(NotificationType).reduce((acc, type) => {
      acc[type] = byType.find(item => item.type === type)?._count.type || 0;
      return acc;
    }, {} as Record<NotificationType, number>);

    const priorityStats = Object.values(NotificationPriority).reduce((acc, priority) => {
      acc[priority] = byPriority.find(item => item.priority === priority)?._count.priority || 0;
      return acc;
    }, {} as Record<NotificationPriority, number>);

    return {
      total,
      unread,
      byType: typeStats,
      byPriority: priorityStats,
    };
  }

  // ============ NOTIFICATION PREFERENCES ============

  async createPreference(createPreferenceDto: CreateNotificationPreferenceDto) {
    return this.prisma.notificationPreference.create({
      data: {
        ...createPreferenceDto,
        channels: createPreferenceDto.channels,
      },
    });
  }

  async getPreferences(userId: string, workspaceId?: string) {
    return this.prisma.notificationPreference.findMany({
      where: {
        userId,
        ...(workspaceId && { workspaceId }),
      },
    });
  }

  async updatePreference(
    id: string,
    userId: string,
    updatePreferenceDto: UpdateNotificationPreferenceDto,
  ) {
    const preference = await this.prisma.notificationPreference.findFirst({
      where: { id, userId },
    });

    if (!preference) {
      throw new NotFoundException(`Notification preference with ID ${id} not found`);
    }

    return this.prisma.notificationPreference.update({
      where: { id },
      data: {
        ...updatePreferenceDto,
        ...(updatePreferenceDto.channels && { channels: updatePreferenceDto.channels }),
      },
    });
  }

  async deletePreference(id: string, userId: string): Promise<void> {
    const preference = await this.prisma.notificationPreference.findFirst({
      where: { id, userId },
    });

    if (!preference) {
      throw new NotFoundException(`Notification preference with ID ${id} not found`);
    }

    await this.prisma.notificationPreference.delete({ where: { id } });
  }

  // ============ NOTIFICATION TEMPLATES ============

  async createTemplate(createTemplateDto: CreateNotificationTemplateDto) {
    return this.prisma.notificationTemplate.create({
      data: {
        ...createTemplateDto,
        defaultChannels: createTemplateDto.defaultChannels,
      },
    });
  }

  async getTemplates() {
    return this.prisma.notificationTemplate.findMany({
      where: { isActive: true },
    });
  }

  async getTemplate(name: string) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { name },
    });

    if (!template) {
      throw new NotFoundException(`Template with name ${name} not found`);
    }

    return template;
  }

  // ============ DELIVERY METHODS ============

  private async deliverNotification(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        recipient: true,
        workspace: true,
      },
    });

    if (!notification) return;

    const channels = notification.deliveryChannels as DeliveryChannel[];

    // Check user preferences
    const preferences = await this.getUserDeliveryPreferences(
      notification.recipientId,
      notification.type,
      notification.category,
      notification.workspaceId,
    );

    // Filter channels based on preferences
    const allowedChannels = channels.filter(channel => 
      preferences.enabledChannels.includes(channel) && 
      this.isInQuietHours(preferences) === false
    );

    // Deliver via each allowed channel
    for (const channel of allowedChannels) {
      switch (channel) {
        case DeliveryChannel.EMAIL:
          await this.sendEmailNotification(notification);
          break;
        case DeliveryChannel.PUSH:
          await this.sendPushNotification(notification);
          break;
        case DeliveryChannel.IN_APP:
          // In-app notifications are handled by just creating the record
          break;
      }
    }
  }

  private async getUserDeliveryPreferences(
    userId: string,
    type: string,
    category?: string | null,
    workspaceId?: string | null,
  ) {
    const preferences = await this.prisma.notificationPreference.findFirst({
      where: {
        userId,
        type,
        ...(category && { category }),
        ...(workspaceId && { workspaceId }),
      },
    });

    // Default preferences if not found
    return {
      enabledChannels: preferences?.channels as DeliveryChannel[] || [DeliveryChannel.IN_APP],
      quietHoursStart: preferences?.quietHoursStart,
      quietHoursEnd: preferences?.quietHoursEnd,
      timezone: preferences?.timezone || 'UTC',
    };
  }

  private isInQuietHours(preferences: any): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    // Simple quiet hours check - can be enhanced with proper timezone handling
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(preferences.quietHoursStart.split(':')[0]);
    const endHour = parseInt(preferences.quietHoursEnd.split(':')[0]);

    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Quiet hours cross midnight
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  private async sendEmailNotification(notification: any): Promise<void> {
    // TODO: Implement email sending logic
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
      },
    });
  }

  private async sendPushNotification(notification: any): Promise<void> {
    // TODO: Implement push notification logic
    // This would integrate with your push service (Firebase, OneSignal, etc.)
    console.log('Push notification sent:', notification.title);
  }

  // ============ UTILITY METHODS ============

  async createFromTemplate(
    templateName: string,
    recipientId: string,
    variables: Record<string, any>,
    overrides: Partial<CreateNotificationDto> = {},
  ): Promise<NotificationResponse> {
    const template = await this.getTemplate(templateName);

    // Replace template variables
    const title = this.replaceTemplateVariables(template.titleTemplate, variables);
    const message = this.replaceTemplateVariables(template.messageTemplate, variables);

    const notificationData: CreateNotificationDto = {
      recipientId,
      title,
      message,
      type: template.type as NotificationType,
      category: template.category || undefined,
      priority: template.defaultPriority as NotificationPriority,
      deliveryChannels: template.defaultChannels as DeliveryChannel[],
      ...overrides,
    };

    return this.create(notificationData);
  }

  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  private formatNotificationResponse(notification: any): NotificationResponse {
    return {
      id: notification.id,
      recipientId: notification.recipientId,
      workspaceId: notification.workspaceId,
      title: notification.title,
      message: notification.message,
      type: notification.type as NotificationType,
      category: notification.category,
      priority: notification.priority as NotificationPriority,
      isRead: notification.isRead,
      readAt: notification.readAt,
      deliveryChannels: notification.deliveryChannels as DeliveryChannel[],
      emailSent: notification.emailSent,
      emailSentAt: notification.emailSentAt,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      resourceId: notification.resourceId,
      resourceType: notification.resourceType,
      metadata: notification.metadata,
      expiresAt: notification.expiresAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  // ============ CLEANUP METHODS ============

  async cleanupExpiredNotifications(): Promise<{ deleted: number }> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return { deleted: result.count };
  }

  async cleanupOldReadNotifications(daysOld: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lt: cutoffDate,
        },
      },
    });

    return { deleted: result.count };
  }
} 