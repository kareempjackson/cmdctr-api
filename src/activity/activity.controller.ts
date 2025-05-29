import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';
import { ActivityFiltersDto, LogActivityDto, AuditFiltersDto, LogAuditDto } from './dto/activity-filters.dto';

@ApiTags('Activity & Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get activity logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category (auth, agent, workspace, file, system)' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (success, error, warning, info)' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID' })
  @ApiQuery({ name: 'agentId', required: false, description: 'Filter by agent ID' })
  @ApiQuery({ name: 'resource', required: false, description: 'Filter by resource ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (ISO string)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in description' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (default: 20, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field (timestamp, category, action, status)' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc, desc)' })
  async getActivityLogs(@Query() filters: ActivityFiltersDto) {
    return this.activityService.getActivities(filters);
  }

  @Get('logs/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get activity logs for a specific workspace' })
  @ApiResponse({ status: 200, description: 'Workspace activity logs retrieved successfully' })
  async getWorkspaceActivityLogs(
    @Param('workspaceId') workspaceId: string,
    @Query() filters: Partial<ActivityFiltersDto>,
  ) {
    return this.activityService.getWorkspaceActivities(workspaceId, filters);
  }

  @Get('logs/user/:userId')
  @ApiOperation({ summary: 'Get activity logs for a specific user' })
  @ApiResponse({ status: 200, description: 'User activity logs retrieved successfully' })
  async getUserActivityLogs(
    @Param('userId') userId: string,
    @Query() filters: Partial<ActivityFiltersDto>,
  ) {
    return this.activityService.getUserActivities(userId, filters);
  }

  @Get('logs/agent/:agentId')
  @ApiOperation({ summary: 'Get activity logs for a specific agent' })
  @ApiResponse({ status: 200, description: 'Agent activity logs retrieved successfully' })
  async getAgentActivityLogs(
    @Param('agentId') agentId: string,
    @Query() filters: Partial<ActivityFiltersDto>,
  ) {
    return this.activityService.getAgentActivities(agentId, filters);
  }

  @Get('logs/export')
  @ApiOperation({ summary: 'Export activity logs' })
  @ApiResponse({ status: 200, description: 'Activity logs exported successfully' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format (json, csv)', enum: ['json', 'csv'] })
  async exportActivityLogs(
    @Query() filters: ActivityFiltersDto,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    const data = await this.activityService.exportActivities(filters, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.csv');
      return res.send(data);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.json');
    return res.json(data);
  }

  @Post('logs')
  @ApiOperation({ summary: 'Log a new activity (admin/system use)' })
  @ApiResponse({ status: 201, description: 'Activity logged successfully' })
  async logActivity(@Body() logActivityDto: LogActivityDto, @Req() req: any) {
    // Add request metadata
    const metadata = {
      ...logActivityDto.metadata,
      requestId: req.id,
    };

    return this.activityService.logActivity({
      ...logActivityDto,
      metadata,
      ipAddress: logActivityDto.ipAddress || req.ip,
      userAgent: logActivityDto.userAgent || req.get('User-Agent'),
    });
  }

  @Get('audit')
  @ApiOperation({ summary: 'Get audit trail with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved successfully' })
  @ApiQuery({ name: 'entityType', required: false, description: 'Filter by entity type (agent, workspace, user, file)' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filter by entity ID' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action (create, update, delete)' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (ISO string)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (default: 20, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field (timestamp, action, entityType)' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc, desc)' })
  async getAuditTrail(@Query() filters: AuditFiltersDto) {
    return this.activityService.getAuditTrail(filters);
  }

  @Get('audit/entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit history for a specific entity' })
  @ApiResponse({ status: 200, description: 'Entity audit history retrieved successfully' })
  async getEntityAuditHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.activityService.getEntityHistory(entityType, entityId);
  }

  @Post('audit')
  @ApiOperation({ summary: 'Log a new audit entry (admin/system use)' })
  @ApiResponse({ status: 201, description: 'Audit entry logged successfully' })
  async logAudit(@Body() logAuditDto: LogAuditDto) {
    return this.activityService.logAudit(logAuditDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get activity statistics and insights' })
  @ApiResponse({ status: 200, description: 'Activity statistics retrieved successfully' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (ISO string)' })
  async getActivityStats(
    @Query('workspaceId') workspaceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.activityService.getActivityStats(workspaceId, startDate, endDate);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard data for activity overview' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboardData(@Req() req: any) {
    const userId = req.user.id;
    
    // Get user's workspaces to filter activities
    const userWorkspaces = await this.activityService['prisma'].workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    
    const workspaceIds = userWorkspaces.map(w => w.workspaceId);
    
    // Get recent activities across user's workspaces
    const recentActivities = await this.activityService.getActivities({
      workspaceId: workspaceIds.length > 0 ? workspaceIds[0] : undefined, // For now, use first workspace
      page: 1,
      pageSize: 10,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    } as ActivityFiltersDto);

    // Get stats for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats = await this.activityService.getActivityStats(
      workspaceIds.length > 0 ? workspaceIds[0] : undefined,
      thirtyDaysAgo.toISOString(),
    );

    return {
      recentActivities: recentActivities.activities,
      stats,
      summary: {
        totalActivities: stats.totalActivities,
        errorRate: stats.statusCounts.error ? 
          (stats.statusCounts.error / stats.totalActivities * 100).toFixed(2) : '0',
        mostActiveCategory: Object.entries(stats.categoryCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'none',
      },
    };
  }
} 