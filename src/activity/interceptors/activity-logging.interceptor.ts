import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ActivityService } from '../activity.service';

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  constructor(private readonly activityService: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Extract request information
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent');
    const ipAddress = request.ip;
    const user = request.user;

    // Skip logging for certain endpoints to avoid noise
    const skipLogging = this.shouldSkipLogging(url, method);
    if (skipLogging) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful requests
        if (statusCode < 400) {
          this.logActivity(
            request,
            'success',
            duration,
            user,
            ipAddress,
            userAgent,
            data,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log error requests
        this.logActivity(
          request,
          'error',
          duration,
          user,
          ipAddress,
          userAgent,
          null,
          error,
        );

        throw error;
      }),
    );
  }

  private shouldSkipLogging(url: string, method: string): boolean {
    // Skip health checks, static files, and activity logging endpoints
    const skipPatterns = [
      '/health',
      '/metrics',
      '/favicon.ico',
      '/activity/logs', // Avoid recursive logging
      '/activity/audit',
      '/activity/stats',
    ];

    return skipPatterns.some(pattern => url.includes(pattern));
  }

  private async logActivity(
    request: any,
    status: string,
    duration: number,
    user: any,
    ipAddress: string,
    userAgent: string,
    responseData?: any,
    error?: any,
  ) {
    try {
      const { method, url, body, params, query } = request;
      
      // Determine category and action based on URL and method
      const { category, action, description, resource } = this.categorizeRequest(
        method,
        url,
        params,
        body,
      );

      // Prepare metadata
      const metadata: any = {
        method,
        url,
        params,
        query: this.sanitizeQuery(query),
        responseSize: responseData ? JSON.stringify(responseData).length : 0,
      };

      // Add error details if present
      if (error) {
        metadata.error = {
          message: error.message,
          statusCode: error.status || 500,
        };
      }

      // Extract workspace and agent IDs from request
      const workspaceId = this.extractWorkspaceId(request);
      const agentId = this.extractAgentId(request);

      await this.activityService.logActivity({
        category,
        action,
        description,
        userId: user?.id,
        workspaceId,
        agentId,
        resource,
        metadata,
        ipAddress,
        userAgent,
        status,
        duration,
      });
    } catch (loggingError) {
      this.logger.error(
        `Failed to log activity: ${loggingError.message}`,
        loggingError.stack,
      );
    }
  }

  private categorizeRequest(
    method: string,
    url: string,
    params: any,
    body: any,
  ): {
    category: string;
    action: string;
    description: string;
    resource?: string;
  } {
    // Auth endpoints
    if (url.includes('/auth/')) {
      return {
        category: 'auth',
        action: this.getAuthAction(url, method),
        description: `User ${this.getAuthAction(url, method)}`,
      };
    }

    // Agent endpoints
    if (url.includes('/agents')) {
      const agentId = params.id || params.agentId;
      return {
        category: 'agent',
        action: this.getAgentAction(url, method),
        description: `Agent ${this.getAgentAction(url, method)}`,
        resource: agentId,
      };
    }

    // Workspace endpoints
    if (url.includes('/workspace') || url.includes('/onboarding')) {
      const workspaceId = params.workspaceId || body?.workspaceId;
      return {
        category: 'workspace',
        action: this.getWorkspaceAction(url, method),
        description: `Workspace ${this.getWorkspaceAction(url, method)}`,
        resource: workspaceId,
      };
    }

    // File endpoints
    if (url.includes('/upload') || url.includes('/file')) {
      return {
        category: 'file',
        action: this.getFileAction(url, method),
        description: `File ${this.getFileAction(url, method)}`,
      };
    }

    // Default system category
    return {
      category: 'system',
      action: method.toLowerCase(),
      description: `${method} ${url}`,
    };
  }

  private getAuthAction(url: string, method: string): string {
    if (url.includes('/login')) return 'login';
    if (url.includes('/register')) return 'register';
    if (url.includes('/logout')) return 'logout';
    if (url.includes('/verify')) return 'verify';
    if (url.includes('/forgot-password')) return 'forgot-password';
    if (url.includes('/reset-password')) return 'reset-password';
    return method.toLowerCase();
  }

  private getAgentAction(url: string, method: string): string {
    if (method === 'POST' && !url.includes('/execute')) return 'create';
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    if (url.includes('/execute')) return 'execute';
    if (url.includes('/memory')) return 'memory-access';
    if (url.includes('/interactions')) return 'view-interactions';
    if (url.includes('/clone')) return 'clone';
    if (url.includes('/retrain')) return 'retrain';
    return 'view';
  }

  private getWorkspaceAction(url: string, method: string): string {
    if (method === 'POST') return 'create';
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    if (url.includes('/members')) return 'manage-members';
    return 'view';
  }

  private getFileAction(url: string, method: string): string {
    if (method === 'POST') return 'upload';
    if (method === 'DELETE') return 'delete';
    if (method === 'GET' && url.includes('/download')) return 'download';
    if (url.includes('/retrain')) return 'retrain';
    return 'access';
  }

  private extractWorkspaceId(request: any): string | undefined {
    // Try to extract workspace ID from various sources
    return (
      request.params?.workspaceId ||
      request.body?.workspaceId ||
      request.query?.workspaceId ||
      request.user?.currentWorkspaceId
    );
  }

  private extractAgentId(request: any): string | undefined {
    // Try to extract agent ID from various sources
    return (
      request.params?.id ||
      request.params?.agentId ||
      request.body?.agentId ||
      request.query?.agentId
    );
  }

  private sanitizeQuery(query: any): any {
    // Remove sensitive information from query parameters
    const sanitized = { ...query };
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
} 