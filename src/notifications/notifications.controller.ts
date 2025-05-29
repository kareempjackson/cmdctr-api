import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationQueryDto,
  BulkUpdateNotificationsDto,
  CreateNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
  CreateNotificationTemplateDto,
  NotificationResponse,
  NotificationStats,
} from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============ NOTIFICATIONS ENDPOINTS ============

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully' })
  async create(@Body() createNotificationDto: CreateNotificationDto): Promise<NotificationResponse> {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async findAll(
    @Request() req: any,
    @Query() query: NotificationQueryDto,
  ): Promise<{ notifications: NotificationResponse[]; total: number }> {
    return this.notificationsService.findAll(req.user.sub, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics for the current user' })
  @ApiResponse({ status: 200, description: 'Notification stats retrieved successfully' })
  async getStats(
    @Request() req: any,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<NotificationStats> {
    return this.notificationsService.getStats(req.user.sub, workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notification' })
  @ApiResponse({ status: 200, description: 'Notification retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<NotificationResponse> {
    return this.notificationsService.findOne(id, req.user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a notification' })
  @ApiResponse({ status: 200, description: 'Notification updated successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ): Promise<NotificationResponse> {
    return this.notificationsService.update(id, req.user.sub, updateNotificationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async remove(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.notificationsService.remove(id, req.user.sub);
  }

  @Put('bulk/update')
  @ApiOperation({ summary: 'Bulk update notifications' })
  @ApiResponse({ status: 200, description: 'Notifications updated successfully' })
  async bulkUpdate(
    @Request() req: any,
    @Body() bulkUpdateDto: BulkUpdateNotificationsDto,
  ): Promise<{ updated: number }> {
    return this.notificationsService.bulkUpdate(req.user.sub, bulkUpdateDto);
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @Request() req: any,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllAsRead(req.user.sub, workspaceId);
  }

  // ============ NOTIFICATION PREFERENCES ENDPOINTS ============

  @Post('preferences')
  @ApiOperation({ summary: 'Create notification preference' })
  @ApiResponse({ status: 201, description: 'Notification preference created successfully' })
  async createPreference(
    @Body() createPreferenceDto: CreateNotificationPreferenceDto,
  ) {
    return this.notificationsService.createPreference(createPreferenceDto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  @ApiResponse({ status: 200, description: 'Notification preferences retrieved successfully' })
  async getPreferences(
    @Request() req: any,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.notificationsService.getPreferences(req.user.sub, workspaceId);
  }

  @Put('preferences/:id')
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiResponse({ status: 200, description: 'Notification preference updated successfully' })
  @ApiResponse({ status: 404, description: 'Notification preference not found' })
  async updatePreference(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updatePreferenceDto: UpdateNotificationPreferenceDto,
  ) {
    return this.notificationsService.updatePreference(id, req.user.sub, updatePreferenceDto);
  }

  @Delete('preferences/:id')
  @ApiOperation({ summary: 'Delete notification preference' })
  @ApiResponse({ status: 200, description: 'Notification preference deleted successfully' })
  @ApiResponse({ status: 404, description: 'Notification preference not found' })
  async deletePreference(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.notificationsService.deletePreference(id, req.user.sub);
  }

  // ============ NOTIFICATION TEMPLATES ENDPOINTS ============

  @Post('templates')
  @ApiOperation({ summary: 'Create notification template' })
  @ApiResponse({ status: 201, description: 'Notification template created successfully' })
  async createTemplate(@Body() createTemplateDto: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(createTemplateDto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all notification templates' })
  @ApiResponse({ status: 200, description: 'Notification templates retrieved successfully' })
  async getTemplates() {
    return this.notificationsService.getTemplates();
  }

  @Get('templates/:name')
  @ApiOperation({ summary: 'Get a specific notification template' })
  @ApiResponse({ status: 200, description: 'Notification template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Notification template not found' })
  async getTemplate(@Param('name') name: string) {
    return this.notificationsService.getTemplate(name);
  }

  @Post('templates/:name/send')
  @ApiOperation({ summary: 'Send notification using template' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully using template' })
  async sendFromTemplate(
    @Param('name') templateName: string,
    @Body() data: {
      recipientId: string;
      variables: Record<string, any>;
      overrides?: Partial<CreateNotificationDto>;
    },
  ): Promise<NotificationResponse> {
    return this.notificationsService.createFromTemplate(
      templateName,
      data.recipientId,
      data.variables,
      data.overrides,
    );
  }

  // ============ ADMIN/UTILITY ENDPOINTS ============

  @Delete('cleanup/expired')
  @ApiOperation({ summary: 'Cleanup expired notifications' })
  @ApiResponse({ status: 200, description: 'Expired notifications cleaned up successfully' })
  async cleanupExpired(): Promise<{ deleted: number }> {
    return this.notificationsService.cleanupExpiredNotifications();
  }

  @Delete('cleanup/old-read')
  @ApiOperation({ summary: 'Cleanup old read notifications' })
  @ApiResponse({ status: 200, description: 'Old read notifications cleaned up successfully' })
  async cleanupOldRead(@Query('daysOld') daysOld?: number): Promise<{ deleted: number }> {
    return this.notificationsService.cleanupOldReadNotifications(daysOld ? parseInt(daysOld.toString()) : 30);
  }
} 