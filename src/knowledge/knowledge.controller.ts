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
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';
import {
  CreateKnowledgeEntryDto,
  UpdateKnowledgeEntryDto,
  KnowledgeQueryDto,
  CreateTagDto,
  UpdateAgentAccessDto,
  StartTrainingDto,
  BulkOperationDto,
  KnowledgeEntryResponseDto,
  KnowledgeListResponseDto,
  KnowledgeStatsDto,
  TrainingHistoryDto,
  BulkOperationResultDto,
} from './dto/knowledge.dto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Response } from 'express';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // Knowledge Entries
  @Post('workspace/:workspaceId/entries')
  async createEntry(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() createDto: CreateKnowledgeEntryDto,
  ): Promise<KnowledgeEntryResponseDto> {
    return this.knowledgeService.createEntry(workspaceId, req.user.id, createDto);
  }

  @Get('workspace/:workspaceId/entries')
  async getEntries(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Query() query: KnowledgeQueryDto,
  ): Promise<KnowledgeListResponseDto> {
    return this.knowledgeService.getEntries(workspaceId, req.user.id, query);
  }

  @Get('entries/:entryId')
  async getEntry(
    @Param('entryId') entryId: string,
    @Request() req: any,
  ): Promise<KnowledgeEntryResponseDto> {
    const entry = await this.knowledgeService.getEntryById(entryId);
    // The service method will handle access verification internally
    return entry;
  }

  @Put('entries/:entryId')
  async updateEntry(
    @Param('entryId') entryId: string,
    @Request() req: any,
    @Body() updateDto: UpdateKnowledgeEntryDto,
  ): Promise<KnowledgeEntryResponseDto> {
    return this.knowledgeService.updateEntry(entryId, req.user.id, updateDto);
  }

  @Delete('entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntry(
    @Param('entryId') entryId: string,
    @Request() req: any,
  ): Promise<void> {
    return this.knowledgeService.deleteEntry(entryId, req.user.id);
  }

  // S3 Presigned URL for Knowledge File Upload
  @Post('workspace/:workspaceId/entries/presigned-upload-url')
  async getPresignedUploadUrl(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() body: { fileType: string; fileName: string },
  ) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const Bucket = process.env.AWS_S3_BUCKET!;
    const Key = `knowledge/${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${body.fileName}`;
    const command = new PutObjectCommand({
      Bucket,
      Key,
      ContentType: body.fileType,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    return { url, key: Key, publicUrl: `https://${Bucket}.s3.amazonaws.com/${Key}` };
  }

  // File Upload for Documents (metadata only)
  @Post('workspace/:workspaceId/entries/upload')
  async uploadDocument(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() metadata: { title?: string; description?: string; tags?: string; fileUrl: string; fileName: string; fileSize: number; mimeType: string },
  ): Promise<KnowledgeEntryResponseDto> {
    console.log('uploadDocument req.user:', req.user);
    const userId = req.user?.id || req.user?.userId;
    if (!userId) throw new Error('User ID not found in request');
    const tags = metadata.tags ? metadata.tags.split(',').map(tag => tag.trim()) : [];
    const createDto: CreateKnowledgeEntryDto = {
      type: 'file' as any,
      title: metadata.title || metadata.fileName,
      description: metadata.description,
      tags,
      fileUrl: metadata.fileUrl,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
    };
    return this.knowledgeService.createEntry(workspaceId, userId, createDto);
  }

  // Tags
  @Get('workspace/:workspaceId/tags')
  async getWorkspaceTags(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ) {
    return this.knowledgeService.getWorkspaceTags(workspaceId, req.user.id);
  }

  @Post('workspace/:workspaceId/tags')
  async createTag(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() createTagDto: CreateTagDto,
  ) {
    return this.knowledgeService.createTag(workspaceId, req.user.id, createTagDto);
  }

  // Training
  @Post('entries/:entryId/training/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startTraining(
    @Param('entryId') entryId: string,
    @Request() req: any,
    @Body() startTrainingDto: StartTrainingDto,
  ): Promise<void> {
    return this.knowledgeService.startTraining(entryId, req.user.id, startTrainingDto);
  }

  @Get('entries/:entryId/training/history')
  async getTrainingHistory(
    @Param('entryId') entryId: string,
    @Request() req: any,
  ): Promise<TrainingHistoryDto[]> {
    return this.knowledgeService.getTrainingHistory(entryId, req.user.id);
  }

  // Bulk Operations
  @Post('workspace/:workspaceId/bulk-operation')
  async bulkOperation(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() bulkDto: BulkOperationDto,
  ): Promise<BulkOperationResultDto> {
    return this.knowledgeService.bulkOperation(workspaceId, req.user.id, bulkDto);
  }

  // Statistics
  @Get('workspace/:workspaceId/stats')
  async getWorkspaceStats(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ): Promise<KnowledgeStatsDto> {
    return this.knowledgeService.getWorkspaceStats(workspaceId, req.user.id);
  }

  // Search across all accessible knowledge entries
  @Get('search')
  async searchKnowledge(
    @Request() req: any,
    @Query() query: KnowledgeQueryDto & { workspaceIds?: string },
  ): Promise<KnowledgeListResponseDto> {
    // TODO: Implement cross-workspace search with proper access control
    // For now, require a specific workspace
    if (!query.workspaceIds) {
      throw new Error('Workspace ID is required for search');
    }
    
    const workspaceId = query.workspaceIds.split(',')[0];
    return this.knowledgeService.getEntries(workspaceId, req.user.id, query);
  }

  // Secure file download endpoint
  @Get('workspace/:workspaceId/files/*key')
  async downloadFile(
    @Param('workspaceId') workspaceId: string,
    @Param('key') key: string,
    @Query('inline') inline: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    // Debug logging
    console.log('Download endpoint hit');
    console.log('Raw key param:', key);
    const decodedKey = decodeURIComponent(key);
    console.log('Decoded key:', decodedKey);
    const Bucket = process.env.AWS_S3_BUCKET!;
    console.log('S3 Bucket:', Bucket);
    console.log('S3 Key:', decodedKey);
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const command = new GetObjectCommand({ Bucket, Key: decodedKey });
    try {
      const s3res = await s3.send(command);
      res.setHeader('Content-Type', s3res.ContentType || 'application/octet-stream');
      const dispositionType = inline === '1' ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${decodedKey.split('/').pop()}"`);
      (s3res.Body as any).pipe(res);
    } catch (err) {
      console.error('S3 download error:', err);
      res.status(404).json({ error: 'File not found' });
    }
  }
} 