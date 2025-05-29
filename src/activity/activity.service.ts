import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityFiltersDto, LogActivityDto, AuditFiltersDto, LogAuditDto } from './dto/activity-filters.dto';

export interface LogActivityParams {
  category: string;
  action: string;
  description: string;
  userId?: string;
  workspaceId?: string;
  agentId?: string;
  resource?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
  duration?: number;
}

export interface LogAuditParams {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  workspaceId: string;
  fieldChanges?: any;
  reason?: string;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Core activity logging
  async logActivity(params: LogActivityParams) {
    try {
      const activity = await this.prisma.activityLog.create({
        data: {
          category: params.category,
          action: params.action,
          description: params.description,
          userId: params.userId,
          workspaceId: params.workspaceId,
          agentId: params.agentId,
          resource: params.resource,
          metadata: params.metadata,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          status: params.status || 'info',
          duration: params.duration,
        },
      });

      this.logger.debug(`Activity logged: ${params.category}:${params.action} - ${params.description}`);
      return activity;
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`, error.stack);
      // Don't throw - logging failures shouldn't break the main flow
      return null;
    }
  }

  // Specialized logging methods
  async logAuthActivity(userId: string, action: string, metadata?: any, ipAddress?: string, userAgent?: string) {
    return this.logActivity({
      category: 'auth',
      action,
      description: `User ${action}`,
      userId,
      metadata,
      ipAddress,
      userAgent,
      status: 'success',
    });
  }

  async logAgentActivity(agentId: string, userId: string, action: string, metadata?: any, duration?: number) {
    return this.logActivity({
      category: 'agent',
      action,
      description: `Agent ${action}`,
      userId,
      agentId,
      resource: agentId,
      metadata,
      duration,
      status: 'success',
    });
  }

  async logWorkspaceActivity(workspaceId: string, userId: string, action: string, metadata?: any) {
    return this.logActivity({
      category: 'workspace',
      action,
      description: `Workspace ${action}`,
      userId,
      workspaceId,
      resource: workspaceId,
      metadata,
      status: 'success',
    });
  }

  async logFileActivity(fileId: string, userId: string, agentId: string, action: string, metadata?: any) {
    return this.logActivity({
      category: 'file',
      action,
      description: `File ${action}`,
      userId,
      agentId,
      resource: fileId,
      metadata,
      status: 'success',
    });
  }

  async logSystemActivity(action: string, metadata?: any, status: string = 'info') {
    return this.logActivity({
      category: 'system',
      action,
      description: `System ${action}`,
      metadata,
      status,
    });
  }

  async logError(category: string, action: string, error: Error, userId?: string, workspaceId?: string, agentId?: string) {
    return this.logActivity({
      category,
      action,
      description: `Error in ${action}: ${error.message}`,
      userId,
      workspaceId,
      agentId,
      metadata: {
        error: error.message,
        stack: error.stack,
      },
      status: 'error',
    });
  }

  // Query activities with filtering and pagination
  async getActivities(filters: ActivityFiltersDto) {
    const {
      category,
      action,
      status,
      userId,
      workspaceId,
      agentId,
      resource,
      startDate,
      endDate,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'timestamp',
      sortOrder = 'desc',
    } = filters;

    // Ensure page and pageSize are numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const pageSizeNum = typeof pageSize === 'string' ? parseInt(pageSize, 10) : pageSize;

    // Validate converted numbers
    const validPage = isNaN(pageNum) ? 1 : Math.max(1, pageNum);
    const validPageSize = isNaN(pageSizeNum) ? 20 : Math.min(100, Math.max(1, pageSizeNum));

    const where: any = {};

    if (category) {
      if (category.includes(',')) {
        where.category = { in: category.split(',') };
      } else {
        where.category = category;
      }
    }

    if (action) where.action = action;
    if (status) {
      if (status.includes(',')) {
        where.status = { in: status.split(',') };
      } else {
        where.status = status;
      }
    }
    if (userId) where.userId = userId;
    if (workspaceId) where.workspaceId = workspaceId;
    if (agentId) where.agentId = agentId;
    if (resource) where.resource = resource;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Get total count
    const total = await this.prisma.activityLog.count({ where });

    // Get paginated results
    const activities = await this.prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        agent: {
          select: { id: true, name: true, purpose: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (validPage - 1) * validPageSize,
      take: validPageSize,
    });

    return {
      activities,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        total,
        totalPages: Math.ceil(total / validPageSize),
      },
    };
  }

  async getWorkspaceActivities(workspaceId: string, filters?: Partial<ActivityFiltersDto>) {
    return this.getActivities({
      ...filters,
      workspaceId,
    } as ActivityFiltersDto);
  }

  async getUserActivities(userId: string, filters?: Partial<ActivityFiltersDto>) {
    return this.getActivities({
      ...filters,
      userId,
    } as ActivityFiltersDto);
  }

  async getAgentActivities(agentId: string, filters?: Partial<ActivityFiltersDto>) {
    return this.getActivities({
      ...filters,
      agentId,
    } as ActivityFiltersDto);
  }

  // Export functionality
  async exportActivities(filters: ActivityFiltersDto, format: 'json' | 'csv' = 'json') {
    // Get all activities without pagination for export
    const { activities } = await this.getActivities({
      ...filters,
      page: 1,
      pageSize: 10000, // Large number for export
    });

    if (format === 'csv') {
      return this.convertToCSV(activities);
    }

    return activities;
  }

  private convertToCSV(activities: any[]): string {
    if (activities.length === 0) return 'timestamp,category,action,description,user,workspace,agent,status,duration\n';

    const headers = 'timestamp,category,action,description,user,workspace,agent,status,duration\n';
    const rows = activities.map(activity => {
      const timestamp = activity.timestamp.toISOString();
      const user = activity.user?.name || activity.user?.email || '';
      const workspace = activity.workspace?.name || '';
      const agent = activity.agent?.name || '';
      const duration = activity.duration || '';

      return `"${timestamp}","${activity.category}","${activity.action}","${activity.description.replace(/"/g, '""')}","${user}","${workspace}","${agent}","${activity.status}","${duration}"`;
    }).join('\n');

    return headers + rows;
  }

  // Audit trail functionality
  async logAudit(params: LogAuditParams) {
    try {
      const audit = await this.prisma.auditTrail.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          userId: params.userId,
          workspaceId: params.workspaceId,
          fieldChanges: params.fieldChanges,
          reason: params.reason,
        },
      });

      this.logger.debug(`Audit logged: ${params.entityType}:${params.entityId} - ${params.action}`);
      return audit;
    } catch (error) {
      this.logger.error(`Failed to log audit: ${error.message}`, error.stack);
      return null;
    }
  }

  async logEntityCreation(entityType: string, entityId: string, userId: string, workspaceId: string, data: any) {
    return this.logAudit({
      entityType,
      entityId,
      action: 'create',
      userId,
      workspaceId,
      fieldChanges: { created: data },
    });
  }

  async logEntityUpdate(entityType: string, entityId: string, userId: string, workspaceId: string, before: any, after: any) {
    const changes = this.calculateFieldChanges(before, after);
    return this.logAudit({
      entityType,
      entityId,
      action: 'update',
      userId,
      workspaceId,
      fieldChanges: changes,
    });
  }

  async logEntityDeletion(entityType: string, entityId: string, userId: string, workspaceId: string, data: any, reason?: string) {
    return this.logAudit({
      entityType,
      entityId,
      action: 'delete',
      userId,
      workspaceId,
      fieldChanges: { deleted: data },
      reason,
    });
  }

  private calculateFieldChanges(before: any, after: any): any {
    const changes: any = {};
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      if (before[key] !== after[key]) {
        changes[key] = {
          before: before[key],
          after: after[key],
        };
      }
    }

    return changes;
  }

  // Query audit trails
  async getAuditTrail(filters: AuditFiltersDto) {
    const {
      entityType,
      entityId,
      action,
      userId,
      workspaceId,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sortBy = 'timestamp',
      sortOrder = 'desc',
    } = filters;

    const where: any = {};

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (workspaceId) where.workspaceId = workspaceId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const total = await this.prisma.auditTrail.count({ where });

    const auditTrails = await this.prisma.auditTrail.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      auditTrails,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getEntityHistory(entityType: string, entityId: string) {
    return this.prisma.auditTrail.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  // Analytics and insights
  async getActivityStats(workspaceId?: string, startDate?: string, endDate?: string) {
    const where: any = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [
      totalActivities,
      categoryCounts,
      statusCounts,
      recentActivities,
    ] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.groupBy({
        by: ['category'],
        where,
        _count: { category: true },
      }),
      this.prisma.activityLog.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          agent: { select: { name: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalActivities,
      categoryCounts: categoryCounts.reduce((acc, item) => {
        acc[item.category] = item._count.category;
        return acc;
      }, {} as Record<string, number>),
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      recentActivities,
    };
  }
} 