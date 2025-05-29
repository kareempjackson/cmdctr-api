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

  // File Upload for Documents
  @Post('workspace/:workspaceId/entries/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @UploadedFile() file: any,
    @Body() metadata: { title?: string; description?: string; tags?: string },
  ): Promise<KnowledgeEntryResponseDto> {
    const tags = metadata.tags ? metadata.tags.split(',').map(tag => tag.trim()) : [];
    
    const createDto: CreateKnowledgeEntryDto = {
      type: 'document' as any,
      title: metadata.title || file.originalname,
      description: metadata.description,
      tags,
    };

    // TODO: Implement file storage logic (S3, local storage, etc.)
    // For now, we'll create the entry without the file
    return this.knowledgeService.createEntry(workspaceId, req.user.id, createDto);
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
} 