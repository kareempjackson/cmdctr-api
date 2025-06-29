import { Controller, Get, Post, Body, Param, Query, Request, UseGuards, Delete, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ActionsService, ActionResult } from './actions.service';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Actions')
@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('definitions')
  @ApiOperation({ summary: 'Get available action definitions' })
  @ApiResponse({ status: 200, description: 'List of available action definitions' })
  async getActionDefinitions() {
    return this.actionsService.getAvailableActions();
  }

  @Get('custom')
  @ApiOperation({ summary: 'Get custom actions' })
  @ApiResponse({ status: 200, description: 'List of custom actions' })
  async getCustomActions(@Request() req: any) {
    return this.actionsService.getCustomActions(req.user.id);
  }

  @Post('custom')
  @ApiOperation({ summary: 'Create a custom action' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 201, description: 'Custom action created' })
  async createCustomAction(@Body() createActionDto: any, @Request() req: any) {
    return this.actionsService.createCustomAction(createActionDto, req.user.id);
  }

  @Put('custom/:id')
  @ApiOperation({ summary: 'Update a custom action' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 200, description: 'Custom action updated' })
  async updateCustomAction(
    @Param('id') id: string,
    @Body() updateActionDto: any,
    @Request() req: any,
  ) {
    return this.actionsService.updateCustomAction(id, updateActionDto, req.user.id);
  }

  @Delete('custom/:id')
  @ApiOperation({ summary: 'Delete a custom action' })
  @ApiResponse({ status: 200, description: 'Custom action deleted' })
  async deleteCustomAction(@Param('id') id: string, @Request() req: any) {
    return this.actionsService.deleteCustomAction(id, req.user.id);
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Get workflows' })
  @ApiResponse({ status: 200, description: 'List of workflows' })
  async getWorkflows(@Request() req: any) {
    return this.actionsService.getWorkflows(req.user.id);
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create a workflow' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 201, description: 'Workflow created' })
  async createWorkflow(@Body() createWorkflowDto: any, @Request() req: any) {
    return this.actionsService.createWorkflow(createWorkflowDto, req.user.id);
  }

  @Put('workflows/:id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 200, description: 'Workflow updated' })
  async updateWorkflow(
    @Param('id') id: string,
    @Body() updateWorkflowDto: any,
    @Request() req: any,
  ) {
    return this.actionsService.updateWorkflow(id, updateWorkflowDto, req.user.id);
  }

  @Delete('workflows/:id')
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow deleted' })
  async deleteWorkflow(@Param('id') id: string, @Request() req: any) {
    return this.actionsService.deleteWorkflow(id, req.user.id);
  }

  @Post('workflows/:id/execute')
  @ApiOperation({ summary: 'Execute a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow executed' })
  async executeWorkflow(@Param('id') id: string, @Request() req: any) {
    return this.actionsService.executeWorkflow(id, req.user.id);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get action analytics' })
  @ApiResponse({ status: 200, description: 'Action analytics data' })
  async getActionAnalytics(@Request() req: any) {
    return this.actionsService.getActionAnalytics(req.user.id);
  }

  @Get(':actionName/results')
  @ApiOperation({ summary: 'Get action results' })
  @ApiResponse({ status: 200, description: 'Action results' })
  async getActionResults(
    @Param('actionName') actionName: string,
    @Request() req: any,
    @Query('parameters') parameters?: string,
  ) {
    const parsedParams = parameters ? JSON.parse(parameters) : {};
    return this.actionsService.getActionResults(actionName, parsedParams, req.user.id);
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute an action' })
  @ApiBody({ type: ExecuteActionDto })
  @ApiResponse({ status: 200, description: 'Action execution result' })
  async executeAction(
    @Body() execution: ExecuteActionDto,
    @Request() req: any,
  ): Promise<ActionResult> {
    return this.actionsService.executeAction({
      ...execution,
      userId: req.user.id,
    });
  }

  @Get('history/:agentId')
  @ApiOperation({ summary: 'Get action history for an agent' })
  @ApiResponse({ status: 200, description: 'Action history' })
  async getActionHistory(
    @Param('agentId') agentId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Request() req: any,
  ) {
    return this.actionsService.getActionHistory(agentId, req.user.id, page, pageSize);
  }
} 