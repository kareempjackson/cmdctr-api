import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
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
  KnowledgeEntryType,
  KnowledgeEntryStatus,
  TrainingStatus,
  AccessLevel,
} from './dto/knowledge.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WeaviateService } from '../vector/weaviate.service';
import { OpenaiService } from '../openai/openai.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { FileExtractionService } from '../utils/file-extraction.service';

@Injectable()
export class KnowledgeService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    @InjectQueue('agent-training') private agentTrainingQueue: Queue,
    public weaviateService: WeaviateService,
    private openaiService: OpenaiService,
  ) {}

  async createEntry(
    workspaceId: string,
    userId: string,
    createDto: CreateKnowledgeEntryDto,
  ): Promise<KnowledgeEntryResponseDto> {
    // Verify workspace access
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const entry = await this.prisma.knowledgeEntry.create({
      data: {
        workspaceId,
        createdBy: userId,
        type: createDto.type || KnowledgeEntryType.DOCUMENT,
        title: createDto.title,
        description: createDto.description,
        content: createDto.content,
        status: createDto.status || KnowledgeEntryStatus.DRAFT,
        fileUrl: createDto.fileUrl,
        fileName: createDto.fileName,
        fileSize: createDto.fileSize,
        mimeType: createDto.mimeType,
      },
      include: this.getIncludeOptions(),
    });

    // Handle tags
    if (createDto.tags && createDto.tags.length > 0) {
      await this.updateEntryTags(entry.id, workspaceId, createDto.tags);
    }

    // Handle agent access
    if (createDto.agentIds && createDto.agentIds.length > 0) {
      await this.updateAgentAccess(entry.id, workspaceId, {
        agentIds: createDto.agentIds,
        accessLevel: AccessLevel.READ,
      });
    }

    // After creating the entry, enqueue training jobs for all agents in the workspace (async)
    const agents = await this.prisma.agent.findMany({ where: { workspaceId } });
    for (const agent of agents) {
      this.agentTrainingQueue.add('train-agent-on-knowledge', {
        agentId: agent.id,
        knowledgeEntryId: entry.id,
        workspaceId,
      });
    }

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId,
      category: 'knowledge',
      action: 'create',
      resource: entry.id,
      description: `Created knowledge entry: ${entry.title}`,
      metadata: { type: entry.type, status: entry.status },
      status: 'success',
    });

    return this.transformToResponseDto(await this.getEntryById(entry.id));
  }

  async updateEntry(
    entryId: string,
    userId: string,
    updateDto: UpdateKnowledgeEntryDto,
  ): Promise<KnowledgeEntryResponseDto> {
    const entry = await this.getEntryById(entryId);
    await this.verifyWorkspaceAccess(entry.workspaceId, userId);

    // Extract tags and agentIds from updateDto to handle separately
    const { tags, agentIds, ...updateData } = updateDto;

    const updatedEntry = await this.prisma.knowledgeEntry.update({
      where: { id: entryId },
      data: {
        ...updateData,
        lastModifiedBy: userId,
        version: { increment: 1 },
      },
      include: this.getIncludeOptions(),
    });

    // Handle tags update
    if (tags !== undefined) {
      await this.updateEntryTags(entryId, entry.workspaceId, tags);
    }

    // Handle agent access update
    if (agentIds !== undefined) {
      await this.updateAgentAccess(entryId, entry.workspaceId, {
        agentIds: agentIds,
        accessLevel: AccessLevel.READ,
      });
    }

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: entry.workspaceId,
      category: 'knowledge',
      action: 'update',
      resource: entryId,
      description: `Updated knowledge entry: ${updatedEntry.title}`,
      metadata: { changes: updateDto },
      status: 'success',
    });

    return this.transformToResponseDto(await this.getEntryById(entryId));
  }

  async getEntries(
    workspaceId: string,
    userId: string,
    query: KnowledgeQueryDto,
  ): Promise<KnowledgeListResponseDto> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const where: any = { workspaceId };

    // Apply filters
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.trainingStatus) where.trainingStatus = query.trainingStatus;

    if (query.tags && query.tags.length > 0) {
      where.tags = {
        some: {
          name: { in: query.tags },
        },
      };
    }

    if (query.agentId) {
      where.agentAccess = {
        some: {
          agentId: query.agentId,
        },
      };
    }

    // Calculate pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const orderBy = query.sortBy ? { [query.sortBy]: query.sortOrder as 'asc' | 'desc' } : { updatedAt: 'desc' as const };

    const [entries, total] = await Promise.all([
      this.prisma.knowledgeEntry.findMany({
        where,
        include: this.getIncludeOptions(),
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.knowledgeEntry.count({ where }),
    ]);

    return {
      entries: entries.map(entry => this.transformToResponseDto(entry)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntryById(entryId: string): Promise<any> {
    const entry = await this.prisma.knowledgeEntry.findUnique({
      where: { id: entryId },
      include: this.getIncludeOptions(),
    });

    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }

    return entry;
  }

  async deleteEntry(entryId: string, userId: string): Promise<void> {
    const entry = await this.getEntryById(entryId);
    await this.verifyWorkspaceAccess(entry.workspaceId, userId);

    await this.prisma.knowledgeEntry.delete({
      where: { id: entryId },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: entry.workspaceId,
      category: 'knowledge',
      action: 'delete',
      resource: entryId,
      description: `Deleted knowledge entry: ${entry.title}`,
      status: 'success',
    });
  }

  async getWorkspaceStats(workspaceId: string, userId: string): Promise<KnowledgeStatsDto> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const [
      totalEntries,
      entriesByType,
      entriesByStatus,
      entriesByTrainingStatus,
      totalTags,
      recentEntries,
      trainingInProgress,
    ] = await Promise.all([
      this.prisma.knowledgeEntry.count({ where: { workspaceId } }),
      this.getCountByField(workspaceId, 'type'),
      this.getCountByField(workspaceId, 'status'),
      this.getCountByField(workspaceId, 'trainingStatus'),
      this.prisma.knowledgeTag.count({ where: { workspaceId } }),
      this.prisma.knowledgeEntry.count({
        where: {
          workspaceId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.knowledgeEntry.count({
        where: { workspaceId, trainingStatus: TrainingStatus.TRAINING },
      }),
    ]);

    return {
      totalEntries,
      entriesByType,
      entriesByStatus,
      entriesByTrainingStatus,
      totalTags,
      recentEntries,
      trainingInProgress,
    };
  }

  async createTag(
    workspaceId: string,
    userId: string,
    createTagDto: CreateTagDto,
  ): Promise<any> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const tag = await this.prisma.knowledgeTag.create({
      data: {
        workspaceId,
        name: createTagDto.name,
        color: createTagDto.color,
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId,
      category: 'knowledge',
      action: 'create_tag',
      resource: tag.id,
      description: `Created tag: ${tag.name}`,
      status: 'success',
    });

    return tag;
  }

  async getWorkspaceTags(workspaceId: string, userId: string): Promise<any[]> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    return this.prisma.knowledgeTag.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async startTraining(
    entryId: string,
    userId: string,
    startTrainingDto: StartTrainingDto,
  ): Promise<void> {
    if (!userId) {
      throw new Error('userId is required to start training');
    }

    const entry = await this.getEntryById(entryId);
    await this.verifyWorkspaceAccess(entry.workspaceId, userId);

    console.log(`[Train] Starting training for entryId=${entryId}, title="${entry.title}", fileUrl=${entry.fileUrl}, contentLength=${entry.content?.length || 0}`);

    // Update entry training status
    await this.prisma.knowledgeEntry.update({
      where: { id: entryId },
      data: { trainingStatus: TrainingStatus.TRAINING },
    });

    // Create training record
    await this.prisma.knowledgeTraining.create({
      data: {
        knowledgeEntryId: entryId,
        status: 'started',
        triggeredBy: userId,
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: entry.workspaceId,
      category: 'knowledge',
      action: 'start_training',
      resource: entryId,
      description: `Started training for: ${entry.title}`,
      metadata: { reason: startTrainingDto.reason },
      status: 'success',
    });

    try {
      await this.weaviateService.initWorkspaceMemory(entry.workspaceId);
      let text = '';
      if (entry.fileUrl) {
        const fileType = this.getFileTypeForExtraction(entry.mimeType, entry.fileName);
        console.log(`[Train] Extracting text from file: fileUrl=${entry.fileUrl}, fileType=${fileType}`);
        if (!fileType) throw new Error('Unsupported file type for extraction');
        text = await FileExtractionService.extractTextFromFile(entry.fileUrl, fileType);
        console.log(`[Train] Extracted text length: ${text.length}`);
      } else {
        text = entry.content || '';
        console.log(`[Train] Using entry content, length: ${text.length}`);
      }
      if (!text || text.trim().length === 0) throw new Error('No text content found for training');
      const chunks = this.chunkText(text, 1000); // 1000 chars per chunk
      console.log(`[Train] File chunked into ${chunks.length} chunks.`);
      let chunkCount = 0;
      for (const [i, chunk] of chunks.entries()) {
        const embedding = await this.openaiService.generateEmbedding(chunk);
        console.log(`[Embed] Chunk ${i + 1}/${chunks.length} (length: ${chunk.length}) embedding length: ${embedding.length}`);
        // Log chunk info
        console.log(`[KnowledgeService][Training] Chunk ${i + 1}/${chunks.length} (length: ${chunk.length}):`, chunk.slice(0, 200).replace(/\n/g, ' ') + (chunk.length > 200 ? '...' : ''));
        await this.weaviateService.storeWorkspaceMemory(
          entry.workspaceId,
          chunk,
          '[KNOWLEDGE BASE]',
          embedding,
          new Date().toISOString(),
          { entryId: entry.id, title: entry.title }
        );
        chunkCount++;
      }
      console.log(`[Train] Finished training entryId=${entryId}, totalChunks=${chunkCount}`);
      await this.prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { trainingStatus: TrainingStatus.TRAINED, lastTrainedAt: new Date(), trainingMetrics: { chunkCount } },
      });
    } catch (err) {
      console.error(`[Train][Error] Training failed for entryId=${entryId}:`, err);
      await this.prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { trainingStatus: TrainingStatus.FAILED, trainingMetrics: { error: err.message } },
      });
      throw err;
    }
  }

  private chunkText(text: string, maxLen: number): string[] {
    // Simple chunking by paragraphs, fallback to maxLen
    const paras = text.split(/\n\n+/).filter(Boolean);
    const chunks: string[] = [];
    let current = '';
    for (const para of paras) {
      if ((current + para).length > maxLen) {
        if (current) chunks.push(current);
        current = para;
      } else {
        current += (current ? '\n\n' : '') + para;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  async getTrainingHistory(entryId: string, userId: string): Promise<TrainingHistoryDto[]> {
    const entry = await this.getEntryById(entryId);
    await this.verifyWorkspaceAccess(entry.workspaceId, userId);

    const history = await this.prisma.knowledgeTraining.findMany({
      where: { knowledgeEntryId: entryId },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return history.map(record => ({
      id: record.id,
      status: record.status,
      startedAt: record.startedAt,
      completedAt: record.completedAt || undefined,
      metrics: record.metrics as any,
      errorMessage: record.errorMessage || undefined,
      triggeredByName: record.user.name || undefined,
    }));
  }

  async bulkOperation(
    workspaceId: string,
    userId: string,
    bulkDto: BulkOperationDto,
  ): Promise<BulkOperationResultDto> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const result: BulkOperationResultDto = {
      successful: [],
      failed: [],
      total: bulkDto.entryIds.length,
      successCount: 0,
      failureCount: 0,
    };

    for (const entryId of bulkDto.entryIds) {
      try {
        switch (bulkDto.operation) {
          case 'delete':
            await this.deleteEntry(entryId, userId);
            break;
          case 'archive':
            await this.updateEntry(entryId, userId, { status: KnowledgeEntryStatus.ARCHIVED });
            break;
          case 'publish':
            await this.updateEntry(entryId, userId, { status: KnowledgeEntryStatus.PUBLISHED });
            break;
          case 'train':
            await this.startTraining(entryId, userId, { reason: bulkDto.reason });
            break;
        }
        result.successful.push(entryId);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          id: entryId,
          error: error.message,
        });
        result.failureCount++;
      }
    }

    // Log bulk operation
    await this.activityService.logActivity({
      userId,
      workspaceId,
      category: 'knowledge',
      action: 'bulk_operation',
      description: `Bulk ${bulkDto.operation} operation completed`,
      metadata: {
        operation: bulkDto.operation,
        total: result.total,
        successful: result.successCount,
        failed: result.failureCount,
      },
      status: result.failureCount === 0 ? 'success' : 'warning',
    });

    return result;
  }

  // Add missing private helper methods
  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) {
      throw new ForbiddenException('Access denied to workspace');
    }
  }

  private getIncludeOptions() {
    return {
      creator: { select: { name: true } },
      lastModifier: { select: { name: true } },
      tags: true,
      agentAccess: {
        include: {
          agent: { select: { name: true } },
        },
      },
    };
  }

  private async updateEntryTags(entryId: string, workspaceId: string, tagNames: string[]): Promise<void> {
    // Remove existing tags
    await this.prisma.knowledgeEntry.update({
      where: { id: entryId },
      data: { tags: { set: [] } },
    });
    if (tagNames.length === 0) return;
    // Create tags if they don't exist
    for (const tagName of tagNames) {
      await this.prisma.knowledgeTag.upsert({
        where: { name_workspaceId: { name: tagName, workspaceId } },
        create: { name: tagName, workspaceId },
        update: {},
      });
    }
    // Connect tags to entry
    const tags = await this.prisma.knowledgeTag.findMany({
      where: { name: { in: tagNames }, workspaceId },
    });
    await this.prisma.knowledgeEntry.update({
      where: { id: entryId },
      data: {
        tags: {
          connect: tags.map(tag => ({ id: tag.id })),
        },
      },
    });
  }

  public async updateAgentAccess(entryId: string, workspaceId: string, updateDto: UpdateAgentAccessDto): Promise<void> {
    // Remove existing access
    await this.prisma.knowledgeAgentAccess.deleteMany({
      where: { knowledgeEntryId: entryId },
    });
    if (updateDto.agentIds.length === 0) return;
    // Verify agents belong to workspace
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: updateDto.agentIds }, workspaceId },
    });
    if (agents.length !== updateDto.agentIds.length) {
      throw new BadRequestException('Some agents do not belong to this workspace');
    }
    // Create new access records
    await this.prisma.knowledgeAgentAccess.createMany({
      data: updateDto.agentIds.map(agentId => ({
        knowledgeEntryId: entryId,
        agentId,
        accessLevel: updateDto.accessLevel || AccessLevel.READ,
      })),
    });
  }

  public transformToResponseDto(entry: any): KnowledgeEntryResponseDto {
    return {
      id: entry.id,
      workspaceId: entry.workspaceId,
      type: entry.type,
      title: entry.title,
      description: entry.description,
      content: entry.content,
      fileUrl: entry.fileUrl,
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      mimeType: entry.mimeType,
      status: entry.status,
      version: entry.version,
      createdBy: entry.createdBy,
      createdByName: entry.creator?.name,
      lastModifiedBy: entry.lastModifiedBy,
      lastModifiedByName: entry.lastModifier?.name,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      trainingStatus: entry.trainingStatus,
      lastTrainedAt: entry.lastTrainedAt,
      trainingMetrics: entry.trainingMetrics,
      tags: entry.tags || [],
      agentAccess: entry.agentAccess?.map(access => ({
        id: access.id,
        agentId: access.agentId,
        agentName: access.agent.name,
        accessLevel: access.accessLevel,
        createdAt: access.createdAt,
      })) || [],
    };
  }

  private async getCountByField(workspaceId: string, field: string): Promise<Record<string, number>> {
    const results = await this.prisma.knowledgeEntry.groupBy({
      by: [field as any],
      where: { workspaceId },
      _count: true,
    });
    return results.reduce((acc, result) => {
      acc[result[field]] = result._count;
      return acc;
    }, {});
  }

  private getFileTypeForExtraction(mimeType: string | undefined, fileName: string | undefined): string {
    if (mimeType === 'application/pdf' || (fileName && fileName.toLowerCase().endsWith('.pdf'))) return 'pdf';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (fileName && fileName.toLowerCase().endsWith('.docx'))) return 'docx';
    if (mimeType === 'application/msword' || (fileName && fileName.toLowerCase().endsWith('.doc'))) return 'doc';
    if (mimeType === 'text/markdown' || (fileName && fileName.toLowerCase().endsWith('.md'))) return 'md';
    if (mimeType === 'text/plain' || (fileName && fileName.toLowerCase().endsWith('.txt'))) return 'txt';
    if (mimeType === 'text/csv' || (fileName && fileName.toLowerCase().endsWith('.csv'))) return 'csv';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || (fileName && fileName.toLowerCase().endsWith('.xlsx'))) return 'xlsx';
    if (mimeType === 'application/vnd.ms-excel' || (fileName && fileName.toLowerCase().endsWith('.xls'))) return 'xls';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || (fileName && fileName.toLowerCase().endsWith('.pptx'))) return 'pptx';
    if (mimeType === 'application/vnd.ms-powerpoint' || (fileName && fileName.toLowerCase().endsWith('.ppt'))) return 'ppt';
    // Add more as needed
    return '';
  }
}