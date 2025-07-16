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
  displayName: string;
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
      displayName: 'Call External API',
      description: 'Connect to external websites, APIs, or web services to fetch or send data',
      parameters: [
        { type: 'string', description: 'Request type: GET (fetch data), POST (send data), PUT (update), or DELETE', required: true },
        { type: 'string', description: 'Web address (URL) to connect to', required: true },
        { type: 'object', description: 'Additional headers like authentication tokens', required: false },
        { type: 'object', description: 'Data to send (for POST/PUT requests)', required: false },
      ],
      examples: [
        'Get weather data from weather API',
        'Send user registration data to external service',
      ],
      category: 'api',
    });

    // File Actions
    this.registerAction({
      name: 'read_file',
      displayName: 'Read File Content',
      description: 'Open and read the contents of a text file, document, or data file',
      parameters: [
        { type: 'string', description: 'Full path to the file you want to read', required: true },
        { type: 'string', description: 'File encoding (usually utf8 for text files)', required: false },
      ],
      examples: [
        'Read a CSV file with customer data',
        'Open a configuration file to check settings',
      ],
      category: 'file',
    });

    this.registerAction({
      name: 'write_file',
      displayName: 'Save to File',
      description: 'Create a new file or update an existing file with new content',
      parameters: [
        { type: 'string', description: 'Where to save the file (full path and filename)', required: true },
        { type: 'string', description: 'The content you want to save in the file', required: true },
        { type: 'string', description: 'File encoding (usually utf8 for text files)', required: false },
      ],
      examples: [
        'Save processed results to a new report file',
        'Create a backup of important data',
      ],
      category: 'file',
    });

    this.registerAction({
      name: 'list_files',
      displayName: 'Browse Folder Contents',
      description: 'See what files and folders are inside a specific directory',
      parameters: [
        { type: 'string', description: 'Path to the folder you want to explore', required: true },
        { type: 'string', description: 'Filter for specific file types (e.g., *.pdf, *.csv)', required: false },
      ],
      examples: [
        'Find all spreadsheet files in the reports folder',
        'Check what documents are in the downloads directory',
      ],
      category: 'file',
    });

    // Web Actions
    this.registerAction({
      name: 'web_scrape',
      displayName: 'Extract Web Data',
      description: 'Automatically collect information from websites and web pages',
      parameters: [
        { type: 'string', description: 'Website address to extract data from', required: true },
        { type: 'string', description: 'Specific part of the page to focus on (CSS selector)', required: false },
      ],
      examples: [
        'Extract product prices from an e-commerce site',
        'Get news headlines from a news website',
      ],
      category: 'web',
    });

    // System Actions
    this.registerAction({
      name: 'execute_command',
      displayName: 'Run System Command',
      description: 'Execute terminal commands, scripts, or system operations',
      parameters: [
        { type: 'string', description: 'The command or script you want to run', required: true },
        { type: 'string', description: 'Folder location where the command should run', required: false },
      ],
      examples: [
        'Run a backup script automatically',
        'Install software packages or dependencies',
      ],
      category: 'system',
    });

    // Data Actions
    this.registerAction({
      name: 'query_database',
      displayName: 'Search Database',
      description: 'Find, filter, and retrieve information from your workspace database',
      parameters: [
        { type: 'string', description: 'Database search query (SQL format)', required: true },
        { type: 'object', description: 'Search filters and parameters', required: false },
      ],
      examples: [
        'Find all active users in the current workspace',
        'Count how many tasks were completed this month',
      ],
      category: 'data',
    });

    // Communication Actions
    this.registerAction({
      name: 'send_email',
      displayName: 'Send Email Message',
      description: 'Send automated email notifications, reports, or alerts to users',
      parameters: [
        { type: 'string', description: 'Email address of the person to send to', required: true },
        { type: 'string', description: 'Email subject line', required: true },
        { type: 'string', description: 'The message content to send', required: true },
        { type: 'string', description: 'Format: "text" for plain text or "html" for rich formatting', required: false },
      ],
      examples: [
        'Send daily reports to team members',
        'Alert administrators when issues occur',
      ],
      category: 'communication',
    });

    this.registerAction({
      name: 'create_notification',
      displayName: 'Send In-App Alert',
      description: 'Create notifications that appear inside the workspace for users to see',
      parameters: [
        { type: 'string', description: 'Short title for the notification', required: true },
        { type: 'string', description: 'Detailed message to show users', required: true },
        { type: 'string', description: 'Type: info, warning, error, or success', required: false },
        { type: 'array', description: 'Specific users to notify (leave empty for everyone)', required: false },
      ],
      examples: [
        'Notify team when automated tasks finish',
        'Alert users about important system updates',
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
    const { name, description, steps, triggers, isActive, nodes, edges } = createWorkflowDto;
    
    // Determine if this is a visual workflow
    const isVisualWorkflow = nodes && edges;
    const workflowType = isVisualWorkflow ? 'visual' : 'sequential';
    
       // For visual workflows, store the visual data and convert to steps
   let workflowSteps = steps || [];
   let visualData: any = null;
   
   if (isVisualWorkflow) {
     visualData = { nodes, edges };
     // Convert visual workflow to sequential steps for execution
     workflowSteps = this.convertVisualToSteps(nodes, edges);
   }

    const workflow = await this.prisma.workflow.create({
      data: {
        name,
        description,
        triggers: triggers || ['manual'],
        isActive: isActive !== undefined ? isActive : true,
               workflowType,
       visualData: visualData || undefined,
        createdBy: userId,
        executionCount: 0,
        steps: {
          create: workflowSteps.map((step: any, index: number) => ({
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

  // Helper to convert visual workflow nodes/edges to sequential steps
  private convertVisualToSteps(nodes: any[], edges: any[]): any[] {
    // Filter out trigger nodes - they don't become workflow steps
    const actionNodes = nodes.filter(node => node.type === 'action');
    
    // Build dependency map from edges
    const dependencies = new Map<string, string[]>();
    edges.forEach(edge => {
      if (!dependencies.has(edge.target)) {
        dependencies.set(edge.target, []);
      }
      dependencies.get(edge.target)?.push(edge.source);
    });
    
    // Convert action nodes to workflow steps
    const steps = actionNodes.map((node, index) => ({
      actionName: node.data.actionName,
      parameters: node.data.parameters || {},
      condition: node.data.condition || null,
      dependsOn: dependencies.get(node.id) || [],
      position: index,
    }));
    
    // Sort steps by dependencies (topological sort)
    return this.topologicalSort(steps, dependencies);
  }
 
  // Helper to sort workflow steps by dependencies
  private topologicalSort(steps: any[], dependencies: Map<string, string[]>): any[] {
    // For now, return steps in order. This can be enhanced with proper topological sorting
    // if complex dependency graphs need to be supported
    return steps;
  }
} 