import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenaiService } from '../openai/openai.service';
import { ActivityService } from '../activity/activity.service';
import { ConfigService } from '../config/config.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
  }[];
  examples: string[];
  category: 'api' | 'file' | 'web' | 'system' | 'data' | 'communication';
}

export interface ActionExecution {
  actionName: string;
  parameters?: any;
  agentId: string;
  userId: string;
  workspaceId: string;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata?: any;
}

@Injectable()
export class ActionsService {
  private readonly actions: Map<string, ActionDefinition> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenaiService,
    private readonly activityService: ActivityService,
    private readonly config: ConfigService,
  ) {
    this.registerDefaultActions();
  }

  private registerDefaultActions() {
    // API Actions
    this.registerAction({
      name: 'http_request',
      description: 'Make HTTP requests to external APIs or web services',
      parameters: [
        { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)', required: true },
        { type: 'string', description: 'URL to make the request to', required: true },
        { type: 'object', description: 'Request headers (optional)', required: false },
        { type: 'object', description: 'Request body (optional)', required: false },
      ],
      examples: [
        'http_request("GET", "https://api.example.com/data")',
        'http_request("POST", "https://api.example.com/users", {"Content-Type": "application/json"}, {"name": "John"})',
      ],
      category: 'api',
    });

    // File Actions
    this.registerAction({
      name: 'read_file',
      description: 'Read content from a file',
      parameters: [
        { type: 'string', description: 'Path to the file to read', required: true },
        { type: 'string', description: 'Encoding (default: utf8)', required: false },
      ],
      examples: [
        'read_file("/path/to/file.txt")',
        'read_file("/path/to/file.json", "utf8")',
      ],
      category: 'file',
    });

    this.registerAction({
      name: 'write_file',
      description: 'Write content to a file',
      parameters: [
        { type: 'string', description: 'Path to the file to write', required: true },
        { type: 'string', description: 'Content to write to the file', required: true },
        { type: 'string', description: 'Encoding (default: utf8)', required: false },
      ],
      examples: [
        'write_file("/path/to/file.txt", "Hello World")',
        'write_file("/path/to/data.json", JSON.stringify(data))',
      ],
      category: 'file',
    });

    this.registerAction({
      name: 'list_files',
      description: 'List files in a directory',
      parameters: [
        { type: 'string', description: 'Directory path to list', required: true },
        { type: 'string', description: 'File pattern filter (optional)', required: false },
      ],
      examples: [
        'list_files("/path/to/directory")',
        'list_files("/path/to/directory", "*.txt")',
      ],
      category: 'file',
    });

    // Web Actions
    this.registerAction({
      name: 'web_scrape',
      description: 'Scrape content from a web page',
      parameters: [
        { type: 'string', description: 'URL to scrape', required: true },
        { type: 'string', description: 'CSS selector for specific content (optional)', required: false },
      ],
      examples: [
        'web_scrape("https://example.com")',
        'web_scrape("https://example.com", ".content")',
      ],
      category: 'web',
    });

    // System Actions
    this.registerAction({
      name: 'execute_command',
      description: 'Execute a system command',
      parameters: [
        { type: 'string', description: 'Command to execute', required: true },
        { type: 'string', description: 'Working directory (optional)', required: false },
      ],
      examples: [
        'execute_command("ls -la")',
        'execute_command("npm install", "/path/to/project")',
      ],
      category: 'system',
    });

    // Data Actions
    this.registerAction({
      name: 'query_database',
      description: 'Query the workspace database',
      parameters: [
        { type: 'string', description: 'SQL query to execute', required: true },
        { type: 'object', description: 'Query parameters (optional)', required: false },
      ],
      examples: [
        'query_database("SELECT * FROM users WHERE workspace_id = ?", [workspaceId])',
        'query_database("SELECT COUNT(*) as count FROM agents")',
      ],
      category: 'data',
    });

    // Communication Actions
    this.registerAction({
      name: 'send_email',
      description: 'Send an email',
      parameters: [
        { type: 'string', description: 'Recipient email address', required: true },
        { type: 'string', description: 'Email subject', required: true },
        { type: 'string', description: 'Email body', required: true },
        { type: 'string', description: 'Email format (text/html)', required: false },
      ],
      examples: [
        'send_email("user@example.com", "Test Subject", "Hello World")',
        'send_email("user@example.com", "Report", "<h1>Report</h1>", "html")',
      ],
      category: 'communication',
    });

    this.registerAction({
      name: 'create_notification',
      description: 'Create a notification in the workspace',
      parameters: [
        { type: 'string', description: 'Notification title', required: true },
        { type: 'string', description: 'Notification message', required: true },
        { type: 'string', description: 'Notification type (info/warning/error/success)', required: false },
        { type: 'array', description: 'User IDs to notify (optional)', required: false },
      ],
      examples: [
        'create_notification("Task Complete", "The analysis is finished")',
        'create_notification("Error", "Failed to process data", "error", ["user1", "user2"])',
      ],
      category: 'communication',
    });
  }

  private registerAction(action: ActionDefinition) {
    this.actions.set(action.name, action);
  }

  async getAvailableActions(): Promise<ActionDefinition[]> {
    return Array.from(this.actions.values());
  }

  async executeAction(execution: ActionExecution): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      // Verify agent permissions
      await this.verifyAgentPermissions(execution.agentId, execution.userId, execution.workspaceId);

      // Get action definition
      const actionDef = this.actions.get(execution.actionName);
      if (!actionDef) {
        throw new BadRequestException(`Unknown action: ${execution.actionName}`);
      }

      // Execute the action
      let result: any;
      switch (execution.actionName) {
        case 'http_request':
          result = await this.executeHttpRequest(execution.parameters);
          break;
        case 'read_file':
          result = await this.executeReadFile(execution.parameters);
          break;
        case 'write_file':
          result = await this.executeWriteFile(execution.parameters);
          break;
        case 'list_files':
          result = await this.executeListFiles(execution.parameters);
          break;
        case 'web_scrape':
          result = await this.executeWebScrape(execution.parameters);
          break;
        case 'execute_command':
          result = await this.executeCommand(execution.parameters);
          break;
        case 'query_database':
          result = await this.executeDatabaseQuery(execution.parameters);
          break;
        case 'send_email':
          result = await this.executeSendEmail(execution.parameters);
          break;
        case 'create_notification':
          result = await this.executeCreateNotification(execution.parameters, execution.workspaceId);
          break;
        default:
          throw new BadRequestException(`Action not implemented: ${execution.actionName}`);
      }

      const executionTime = Date.now() - startTime;

      // Log successful action
      await this.activityService.logAgentActivity(
        execution.agentId,
        execution.userId,
        'action_executed',
        {
          actionName: execution.actionName,
          parameters: execution.parameters,
          executionTime,
          success: true,
        },
        executionTime,
      );

      return {
        success: true,
        data: result,
        executionTime,
        metadata: {
          actionName: execution.actionName,
          category: actionDef.category,
        },
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Log failed action
      await this.activityService.logAgentActivity(
        execution.agentId,
        execution.userId,
        'action_failed',
        {
          actionName: execution.actionName,
          parameters: execution.parameters,
          error: error.message,
          executionTime,
        },
        executionTime,
      );

      return {
        success: false,
        error: error.message,
        executionTime,
        metadata: {
          actionName: execution.actionName,
        },
      };
    }
  }

  private async verifyAgentPermissions(agentId: string, userId: string, workspaceId: string) {
    // Check if user is a member of the workspace
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    // Check if agent exists and belongs to the workspace
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });
    if (!agent || agent.workspaceId !== workspaceId) {
      throw new ForbiddenException('Agent not found or access denied');
    }

    // Check if agent has action permissions
    const config = agent.config as any;
    if (config && config.capabilities && !config.capabilities.includes('actions')) {
      throw new ForbiddenException('Agent does not have action permissions');
    }
  }

  // Action implementations
  private async executeHttpRequest(parameters: any): Promise<any> {
    const { method, url, headers = {}, body } = parameters;
    
    const response = await axios({
      method: method.toLowerCase(),
      url,
      headers,
      data: body,
      timeout: 30000, // 30 second timeout
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    };
  }

  private async executeReadFile(parameters: any): Promise<any> {
    const { path: filePath, encoding = 'utf8' } = parameters;
    
    // Security check: ensure path is within allowed directories
    const allowedPaths = [
      process.cwd(),
      path.join(process.cwd(), 'uploads'),
      path.join(process.cwd(), 'data'),
    ];
    
    const resolvedPath = path.resolve(filePath);
    const isAllowed = allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      throw new Error('Access denied: File path not allowed');
    }

    const content = await fs.promises.readFile(filePath, encoding);
    return { content, path: filePath, encoding };
  }

  private async executeWriteFile(parameters: any): Promise<any> {
    const { path: filePath, content, encoding = 'utf8' } = parameters;
    
    // Security check: ensure path is within allowed directories
    const allowedPaths = [
      path.join(process.cwd(), 'uploads'),
      path.join(process.cwd(), 'data'),
    ];
    
    const resolvedPath = path.resolve(filePath);
    const isAllowed = allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      throw new Error('Access denied: File path not allowed');
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    await fs.promises.writeFile(filePath, content, encoding);
    return { success: true, path: filePath, size: content.length };
  }

  private async executeListFiles(parameters: any): Promise<any> {
    const { path: dirPath, pattern } = parameters;
    
    // Security check: ensure path is within allowed directories
    const allowedPaths = [
      process.cwd(),
      path.join(process.cwd(), 'uploads'),
      path.join(process.cwd(), 'data'),
    ];
    
    const resolvedPath = path.resolve(dirPath);
    const isAllowed = allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      throw new Error('Access denied: Directory path not allowed');
    }

    const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(dirPath, file.name),
    }));

    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return fileList.filter(file => regex.test(file.name));
    }

    return fileList;
  }

  private async executeWebScrape(parameters: any): Promise<any> {
    const { url, selector } = parameters;
    
    // For now, return a placeholder. In a real implementation, you'd use a library like Puppeteer
    return {
      url,
      content: `Scraped content from ${url}${selector ? ` using selector: ${selector}` : ''}`,
      note: 'Web scraping requires additional setup with Puppeteer or similar library',
    };
  }

  private async executeCommand(parameters: any): Promise<any> {
    const { command, cwd } = parameters;
    
    // Security check: only allow safe commands
    const allowedCommands = [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'sort', 'uniq',
      'npm', 'node', 'git', 'echo', 'pwd', 'whoami', 'date',
    ];
    
    const commandName = command.split(' ')[0];
    if (!allowedCommands.includes(commandName)) {
      throw new Error(`Command not allowed: ${commandName}`);
    }

    const { stdout, stderr } = await execAsync(command, { cwd });
    return { stdout, stderr, command };
  }

  private async executeDatabaseQuery(parameters: any): Promise<any> {
    const { query, params = [] } = parameters;
    
    // Security check: only allow SELECT queries for now
    if (!query.trim().toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for security reasons');
    }

    // Execute query using Prisma
    const result = await this.prisma.$queryRawUnsafe(query, ...params);
    return { result, query, params };
  }

  private async executeSendEmail(parameters: any): Promise<any> {
    const { to, subject, body, format = 'text' } = parameters;
    
    // For now, return a placeholder. In a real implementation, you'd integrate with an email service
    return {
      to,
      subject,
      body,
      format,
      status: 'queued',
      note: 'Email sending requires integration with email service (SendGrid, AWS SES, etc.)',
    };
  }

  private async executeCreateNotification(parameters: any, workspaceId: string): Promise<any> {
    const { title, message, type = 'info', userIds = [] } = parameters;
    
    // Create notification in database
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: userIds[0] || 'system', // Use first user or system
        workspaceId,
        title,
        message,
        type,
        priority: 'medium',
        deliveryChannels: ['in-app'],
        metadata: { createdBy: 'agent' },
      },
    });

    return {
      id: notification.id,
      title,
      message,
      type,
      createdAt: notification.createdAt,
    };
  }

  async getActionHistory(agentId: string, userId: string, page = 1, pageSize = 20) {
    // Get action history from activity logs
    const activities = await this.prisma.activityLog.findMany({
      where: {
        agentId,
        category: 'agent',
        action: { in: ['action_executed', 'action_failed'] },
        userId,
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return activities.map(activity => ({
      id: activity.id,
      actionName: (activity.metadata as any)?.actionName,
      success: activity.action === 'action_executed',
      executionTime: (activity.metadata as any)?.executionTime,
      timestamp: activity.timestamp,
      error: (activity.metadata as any)?.error,
    }));
  }

  // Custom Actions Methods
  async getCustomActions(userId: string) {
    const customActions = await this.prisma.customAction.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { isPublic: true }
        ]
      },
      orderBy: { createdAt: 'desc' },
    });

    return customActions.map(action => ({
      ...action,
      usageCount: action.usageCount || 0,
    }));
  }

  async createCustomAction(createActionDto: any, userId: string) {
    const { name, description, category, parameters, code, isPublic } = createActionDto;

    const customAction = await this.prisma.customAction.create({
      data: {
        name,
        description,
        category,
        parameters: parameters || [],
        code,
        isPublic: isPublic || false,
        createdBy: userId,
        usageCount: 0,
      },
    });

    return customAction;
  }

  async updateCustomAction(id: string, updateActionDto: any, userId: string) {
    // Verify ownership
    const existingAction = await this.prisma.customAction.findFirst({
      where: { id, createdBy: userId },
    });

    if (!existingAction) {
      throw new ForbiddenException('Action not found or access denied');
    }

    const customAction = await this.prisma.customAction.update({
      where: { id },
      data: updateActionDto,
    });

    return customAction;
  }

  async deleteCustomAction(id: string, userId: string) {
    // Verify ownership
    const existingAction = await this.prisma.customAction.findFirst({
      where: { id, createdBy: userId },
    });

    if (!existingAction) {
      throw new ForbiddenException('Action not found or access denied');
    }

    await this.prisma.customAction.delete({
      where: { id },
    });

    return { success: true };
  }

  // Workflow Methods
  async getWorkflows(userId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        createdBy: userId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map(workflow => ({
      ...workflow,
      executionCount: workflow.executionCount || 0,
    }));
  }

  async createWorkflow(createWorkflowDto: any, userId: string) {
    const { name, description, steps, triggers, isActive } = createWorkflowDto;

    const workflow = await this.prisma.workflow.create({
      data: {
        name,
        description,
        triggers: triggers || ['manual'],
        isActive: isActive !== undefined ? isActive : true,
        createdBy: userId,
        executionCount: 0,
        steps: {
          create: steps.map((step: any, index: number) => ({
            actionName: step.actionName,
            parameters: step.parameters || {},
            condition: step.condition,
            dependsOn: step.dependsOn || [],
            position: index,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return workflow;
  }

  async updateWorkflow(id: string, updateWorkflowDto: any, userId: string) {
    // Verify ownership
    const existingWorkflow = await this.prisma.workflow.findFirst({
      where: { id, createdBy: userId },
    });

    if (!existingWorkflow) {
      throw new ForbiddenException('Workflow not found or access denied');
    }

    const { steps, ...workflowData } = updateWorkflowDto;

    // Update workflow
    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: workflowData,
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Update steps if provided
    if (steps) {
      // Delete existing steps
      await this.prisma.workflowStep.deleteMany({
        where: { workflowId: id },
      });

      // Create new steps
      await this.prisma.workflowStep.createMany({
        data: steps.map((step: any, index: number) => ({
          workflowId: id,
          actionName: step.actionName,
          parameters: step.parameters || {},
          condition: step.condition,
          dependsOn: step.dependsOn || [],
          position: index,
        })),
      });

      // Return updated workflow with steps
      return this.prisma.workflow.findUnique({
        where: { id },
        include: {
          steps: {
            orderBy: { position: 'asc' },
          },
        },
      });
    }

    return workflow;
  }

  async deleteWorkflow(id: string, userId: string) {
    // Verify ownership
    const existingWorkflow = await this.prisma.workflow.findFirst({
      where: { id, createdBy: userId },
    });

    if (!existingWorkflow) {
      throw new ForbiddenException('Workflow not found or access denied');
    }

    // Delete steps first
    await this.prisma.workflowStep.deleteMany({
      where: { workflowId: id },
    });

    // Delete workflow
    await this.prisma.workflow.delete({
      where: { id },
    });

    return { success: true };
  }

  async executeWorkflow(id: string, userId: string) {
    // Verify ownership
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, createdBy: userId },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!workflow) {
      throw new ForbiddenException('Workflow not found or access denied');
    }

    if (!workflow.isActive) {
      throw new BadRequestException('Workflow is not active');
    }

    const startTime = Date.now();
    const results: any[] = [];

    try {
      // Execute each step in order
      for (const step of workflow.steps) {
        // Check condition if present
        if (step.condition) {
          // Simple condition evaluation (can be enhanced)
          const shouldExecute = this.evaluateCondition(step.condition, results);
          if (!shouldExecute) {
            results.push({
              stepId: step.id,
              actionName: step.actionName,
              skipped: true,
              reason: 'Condition not met',
            });
            continue;
          }
        }

        // Execute the action
        const result = await this.executeAction({
          actionName: step.actionName,
          parameters: step.parameters,
          agentId: 'workflow', // Special agent ID for workflows
          userId,
          workspaceId: workflow.workspaceId || 'default',
        });

        results.push({
          stepId: step.id,
          actionName: step.actionName,
          success: result.success,
          data: result.data,
          error: result.error,
          executionTime: result.executionTime,
        });

        // Stop execution if step failed and workflow should stop on error
        if (!result.success) {
          break;
        }
      }

      const totalExecutionTime = Date.now() - startTime;

      // Update workflow execution count and last executed time
      await this.prisma.workflow.update({
        where: { id },
        data: {
          executionCount: { increment: 1 },
          lastExecuted: new Date(),
        },
      });

      return {
        success: true,
        workflowId: id,
        workflowName: workflow.name,
        results,
        totalExecutionTime,
        stepsExecuted: results.length,
        stepsTotal: workflow.steps.length,
      };

    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      return {
        success: false,
        workflowId: id,
        workflowName: workflow.name,
        error: error.message,
        results,
        totalExecutionTime,
        stepsExecuted: results.length,
        stepsTotal: workflow.steps.length,
      };
    }
  }

  // Analytics Methods
  async getActionAnalytics(userId: string) {
    // Get action execution statistics
    const actionStats = await this.prisma.activityLog.groupBy({
      by: ['action'],
      where: {
        userId,
        category: 'agent',
        action: { in: ['action_executed', 'action_failed'] },
      },
      _count: {
        action: true,
      },
    });

    // Get recent activity
    const recentActivity = await this.prisma.activityLog.findMany({
      where: {
        userId,
        category: 'agent',
        action: { in: ['action_executed', 'action_failed'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    // Calculate success rate
    const totalExecutions = actionStats.reduce((sum, stat) => sum + stat._count.action, 0);
    const successfulExecutions = actionStats
      .filter(stat => stat.action === 'action_executed')
      .reduce((sum, stat) => sum + stat._count.action, 0);
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // Get workflow statistics
    const workflowStats = await this.prisma.workflow.aggregate({
      where: { createdBy: userId },
      _count: { id: true },
      _sum: { executionCount: true },
    });

    return {
      totalActions: totalExecutions,
      successRate: Math.round(successRate * 100) / 100,
      activeWorkflows: workflowStats._count.id,
      totalWorkflowExecutions: workflowStats._sum.executionCount || 0,
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        actionName: (activity.metadata as any)?.actionName,
        success: activity.action === 'action_executed',
        executionTime: (activity.metadata as any)?.executionTime,
        timestamp: activity.timestamp,
      })),
    };
  }

  async getActionResults(actionName: string, parameters: any, userId: string) {
    // Get recent action results for this specific action
    const results = await this.prisma.activityLog.findMany({
      where: {
        userId,
        category: 'agent',
        action: { in: ['action_executed', 'action_failed'] },
        metadata: {
          path: ['actionName'],
          equals: actionName,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    return results.map(activity => ({
      id: activity.id,
      actionName,
      success: activity.action === 'action_executed',
      executionTime: (activity.metadata as any)?.executionTime,
      timestamp: activity.timestamp,
      error: (activity.metadata as any)?.error,
      parameters: (activity.metadata as any)?.parameters,
    }));
  }

  private evaluateCondition(condition: string, results: any[]): boolean {
    // Simple condition evaluation - can be enhanced with a proper expression parser
    try {
      // For now, just check if condition contains basic logic
      if (condition.includes('success') && condition.includes('previous')) {
        const lastResult = results[results.length - 1];
        return lastResult && lastResult.success;
      }
      return true; // Default to true if condition can't be evaluated
    } catch (error) {
      return true; // Default to true on error
    }
  }
} 