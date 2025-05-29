import { IsString, IsBoolean, IsOptional, IsArray, IsDateString, IsEnum, IsNumber, IsUUID } from 'class-validator';

// Enums
export enum NotificationType {
  SYSTEM = 'system',
  ACTIVITY = 'activity',
  COLLABORATION = 'collaboration',
  TASK = 'task',
  SECURITY = 'security',
}

export enum NotificationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum DeliveryChannel {
  IN_APP = 'in-app',
  EMAIL = 'email',
  PUSH = 'push',
}

export enum DigestFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  IMMEDIATELY = 'immediately',
}

// Create Notification DTO
export class CreateNotificationDto {
  @IsUUID()
  recipientId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  deliveryChannels: DeliveryChannel[];

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsString()
  actionText?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// Update Notification DTO
export class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsString()
  actionText?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

// Notification Preference DTO
export class CreateNotificationPreferenceDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  channels: DeliveryChannel[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  digestMode?: boolean = false;

  @IsOptional()
  @IsEnum(DigestFrequency)
  digestFrequency?: DigestFrequency;
}

export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  channels?: DeliveryChannel[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  digestMode?: boolean;

  @IsOptional()
  @IsEnum(DigestFrequency)
  digestFrequency?: DigestFrequency;
}

// Notification Query DTO
export class NotificationQueryDto {
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsNumber()
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  offset?: number = 0;
}

// Bulk Operations DTO
export class BulkUpdateNotificationsDto {
  @IsArray()
  @IsUUID(4, { each: true })
  notificationIds: string[];

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

// Notification Template DTO
export class CreateNotificationTemplateDto {
  @IsString()
  name: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  titleTemplate: string;

  @IsString()
  messageTemplate: string;

  @IsOptional()
  @IsString()
  emailTemplate?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  defaultPriority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  defaultChannels: DeliveryChannel[];

  @IsOptional()
  @IsString()
  description?: string;
}

// Response DTOs
export interface NotificationResponse {
  id: string;
  recipientId: string;
  workspaceId?: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: string;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: Date;
  deliveryChannels: DeliveryChannel[];
  emailSent: boolean;
  emailSentAt?: Date;
  actionUrl?: string;
  actionText?: string;
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
} 