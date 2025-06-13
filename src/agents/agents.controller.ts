import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, Delete, Res, Request } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto, UpdateAgentKnowledgeAccessDto } from './dto/update-agent.dto';
import { ExecuteAgentDto } from './dto/execute-agent.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { CloneAgentDto } from './dto/clone-agent.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@ApiTags('agents')
@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @ApiOperation({ summary: 'Get agents for user or workspace' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'workspaceId', required: false })
  @ApiResponse({ status: 200, description: 'List of agents' })
  @Get()
  async getAgents(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('workspaceId') workspaceId?: string,
  ) {
    const userId = req.user.userId;
    if (workspaceId) {
      return this.agentsService.getAgentsByWorkspace(workspaceId, userId);
    }
    return this.agentsService.getAgentsForUser(
      userId,
      parseInt(page),
      parseInt(pageSize),
    );
  }

  @ApiOperation({ summary: 'Create a new agent' })
  @ApiBody({ type: CreateAgentDto })
  @ApiResponse({ status: 201, description: 'Agent created' })
  @Post()
  async createAgent(@Body() dto: CreateAgentDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.agentsService.createAgent(dto, userId);
  }

  @ApiOperation({ summary: 'Get agent by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Agent details' })
  @Get(':id')
  async getAgentById(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.agentsService.getAgentById(id, userId);
  }

  @ApiOperation({ summary: 'Update agent' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateAgentDto })
  @ApiResponse({ status: 200, description: 'Agent updated' })
  @Patch(':id')
  async updateAgent(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.updateAgent(id, dto, userId);
  }

  @ApiOperation({ summary: 'Execute agent logic' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ExecuteAgentDto })
  @ApiResponse({ status: 200, description: 'Agent execution result' })
  @Post(':id/execute')
  async executeAgent(
    @Param('id') id: string,
    @Body() dto: ExecuteAgentDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.executeAgent(id, dto, userId);
  }

  @ApiOperation({ summary: 'Upload training file for agent' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  @Post(':id/files')
  async uploadTrainingFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    if (!file) {
      throw new Error('No file uploaded or invalid file type');
    }
    return this.agentsService.uploadTrainingFile(id, file, userId);
  }

  @ApiOperation({ summary: 'List training files for agent' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'List of training files' })
  @Get(':id/files')
  async listTrainingFiles(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.agentsService.listTrainingFiles(id, userId);
  }

  @ApiOperation({ summary: 'Delete training file' })
  @ApiParam({ name: 'agentId' })
  @ApiParam({ name: 'fileId' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @Delete(':agentId/files/:fileId')
  async deleteTrainingFile(
    @Param('agentId') agentId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.deleteTrainingFile(agentId, fileId, userId);
  }

  @ApiOperation({ summary: 'Download training file' })
  @ApiParam({ name: 'agentId' })
  @ApiParam({ name: 'fileId' })
  @ApiResponse({ status: 200, description: 'File download' })
  @Get(':agentId/files/:fileId/download')
  async downloadTrainingFile(
    @Param('agentId') agentId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const file = await this.agentsService.downloadTrainingFile(agentId, fileId, userId);
    res.setHeader('Content-Type', file.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.sendFile(file.storagePath);
  }

  // Memory Management Endpoints
  @ApiOperation({ summary: 'Get agent memory chunks' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiResponse({ status: 200, description: 'List of memory chunks' })
  @Get(':id/memory')
  async getAgentMemory(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.getAgentMemory(id, userId, parseInt(page), parseInt(pageSize));
  }

  @ApiOperation({ summary: 'Search agent memory' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SearchMemoryDto })
  @ApiResponse({ status: 200, description: 'Search results' })
  @Post(':id/memory/search')
  async searchAgentMemory(
    @Param('id') id: string,
    @Body() dto: SearchMemoryDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.searchAgentMemory(id, dto.query, userId, dto.limit);
  }

  @ApiOperation({ summary: 'Delete specific memory chunk' })
  @ApiParam({ name: 'agentId' })
  @ApiParam({ name: 'memoryId' })
  @ApiResponse({ status: 200, description: 'Memory deleted' })
  @Delete(':agentId/memory/:memoryId')
  async deleteAgentMemory(
    @Param('agentId') agentId: string,
    @Param('memoryId') memoryId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.deleteAgentMemory(agentId, memoryId, userId);
  }

  // File Retraining Endpoints
  @ApiOperation({ summary: 'Retrain specific file' })
  @ApiParam({ name: 'agentId' })
  @ApiParam({ name: 'fileId' })
  @ApiResponse({ status: 200, description: 'File retrained' })
  @Post(':agentId/files/:fileId/retrain')
  async retrainFile(
    @Param('agentId') agentId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.retrainFile(agentId, fileId, userId);
  }

  @ApiOperation({ summary: 'Retrain all files for agent' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'All files retrained' })
  @Post(':id/files/retrain')
  async retrainAllFiles(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.retrainAllFiles(id, userId);
  }

  // Interaction History Endpoints
  @ApiOperation({ summary: 'Get agent interaction history' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiResponse({ status: 200, description: 'List of interactions' })
  @Get(':id/interactions')
  async getAgentInteractions(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.getAgentInteractions(id, userId, parseInt(page), parseInt(pageSize));
  }

  @ApiOperation({ summary: 'Export agent interaction history' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Exported interactions' })
  @Get(':id/interactions/export')
  async exportAgentInteractions(
    @Param('id') id: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const data = await this.agentsService.exportAgentInteractions(id, userId, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agent-${id}-interactions.csv"`);
      return res.send(data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="agent-${id}-interactions.json"`);
      return res.json(data);
    }
  }

  // Agent Management Endpoints
  @ApiOperation({ summary: 'Delete agent and all associated data' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Agent deleted' })
  @Delete(':id')
  async deleteAgent(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.deleteAgent(id, userId);
  }

  @ApiOperation({ summary: 'Clone an agent' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CloneAgentDto })
  @ApiResponse({ status: 201, description: 'Agent cloned' })
  @Post(':id/clone')
  async cloneAgent(
    @Param('id') id: string,
    @Body() dto: CloneAgentDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.cloneAgent(id, dto.name, userId);
  }

  @ApiOperation({ summary: 'Update agent knowledge access' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateAgentKnowledgeAccessDto })
  @ApiResponse({ status: 200, description: 'Agent knowledge access updated' })
  @Patch(':id/knowledge-access')
  async updateAgentKnowledgeAccess(
    @Param('id') id: string,
    @Body() dto: UpdateAgentKnowledgeAccessDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.updateAgentKnowledgeAccess(id, dto.knowledgeEntryIds, userId, dto.accessLevel);
  }

  @ApiOperation({ summary: 'Get agent knowledge access' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Agent knowledge access retrieved' })
  @Get(':id/knowledge-access')
  async getAgentKnowledgeAccess(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.agentsService.getAgentKnowledgeAccess(id, userId);
  }

  // S3 Presigned URL for Agent Training File Upload
  @Post(':id/training-files/presigned-upload-url')
  async getAgentTrainingPresignedUrl(
    @Param('id') agentId: string,
    @Request() req: any,
    @Body() body: { fileType: string; fileName: string }
  ) {
    // (Optional: check user permissions here)
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const Bucket = process.env.AWS_S3_BUCKET!;
    const Key = `agent-training/${agentId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${body.fileName}`;
    const command = new PutObjectCommand({
      Bucket,
      Key,
      ContentType: body.fileType,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    return { url, key: Key, publicUrl: `https://${Bucket}.s3.amazonaws.com/${Key}` };
  }

  // Save Agent Training File Metadata after S3 upload
  @Post(':id/training-files/upload')
  async uploadAgentTrainingFileMetadata(
    @Param('id') agentId: string,
    @Request() req: any,
    @Body() metadata: { fileUrl: string; fileName: string; fileSize: number; mimeType: string }
  ) {
    const userId = req.user.userId;
    return this.agentsService.saveTrainingFileMetadata(agentId, metadata, userId);
  }

  // Secure download endpoint for agent training files
  @Get(':agentId/training-files/:fileId/download')
  async downloadAgentTrainingFile(
    @Param('agentId') agentId: string,
    @Param('fileId') fileId: string,
    @Request() req: any,
    @Res() res: Response,
    @Query('inline') inline: string,
  ) {
    const userId = req.user.userId;
    const file = await this.agentsService.downloadTrainingFile(agentId, fileId, userId);
    // file.storagePath is the S3 URL
    const Bucket = process.env.AWS_S3_BUCKET!;
    // Extract S3 key from URL (remove https://.../)
    let Key = file.storagePath;
    if (Key.startsWith('https://')) {
      Key = Key.split('.amazonaws.com/')[1];
    }
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const command = new GetObjectCommand({ Bucket, Key });
    try {
      const s3res = await s3.send(command);
      res.setHeader('Content-Type', s3res.ContentType || file.fileType || 'application/octet-stream');
      const dispositionType = inline === '1' ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${file.fileName}"`);
      (s3res.Body as any).pipe(res);
    } catch (err) {
      res.status(404).json({ error: 'File not found' });
    }
  }
}
