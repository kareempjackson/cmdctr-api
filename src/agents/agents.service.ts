import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ExecuteAgentDto } from './dto/execute-agent.dto';
import { OpenaiService } from '../openai/openai.service';
import { WeaviateService } from '../vector/weaviate.service';
import { ActivityService } from '../activity/activity.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as fs from 'fs';
import * as path from 'path';
import { unlinkSync, existsSync } from 'fs';
const pdfParse = require('pdf-parse');

@Injectable()
export class AgentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenaiService) private readonly openai: OpenaiService,
    @Inject(WeaviateService) private readonly weaviate: WeaviateService,
    @Inject(ActivityService) private readonly activityService: ActivityService,
    @Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService,
  ) {}

  async getAgentsForUser(userId: string, page = 1, pageSize = 10) {
    // Find all workspace IDs for this user
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);
    // Get total count
    const total = await this.prisma.agent.count({
      where: { workspaceId: { in: workspaceIds } },
    });
    // Get paginated agents
    const agents = await this.prisma.agent.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      agents,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createAgent(dto: CreateAgentDto, userId: string) {
    // Check user is member of workspace
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: dto.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    
    // Generate agent config
    const config = await this.openai.generateAgentConfig(dto.name, dto.purpose);
    
    // Create agent
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        purpose: dto.purpose,
        config,
        workspaceId: dto.workspaceId,
      },
    });
    
    // Initialize Weaviate namespace
    await this.weaviate.initAgentMemory(agent.id);
    
    // Log activity
    await this.activityService.logAgentActivity(
      agent.id,
      userId,
      'create',
      { agentName: dto.name, purpose: dto.purpose },
    );
    
    // Log audit trail
    await this.activityService.logEntityCreation(
      'agent',
      agent.id,
      userId,
      dto.workspaceId,
      { name: dto.name, purpose: dto.purpose },
    );
    
    return agent;
  }

  async getAgentById(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    // Check user is member of workspace
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return agent;
  }

  async getAgentsByWorkspace(workspaceId: string, userId: string) {
    // Check user is member of workspace
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return this.prisma.agent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAgent(agentId: string, dto: UpdateAgentDto, userId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    // Check user is member of workspace
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return this.prisma.agent.update({
      where: { id: agentId },
      data: dto,
    });
  }

  async executeAgent(agentId: string, dto: ExecuteAgentDto, userId: string) {
    const startTime = Date.now();
    // Validate input
    if (!dto.input || typeof dto.input !== 'string' || dto.input.trim().length === 0) {
      throw new BadRequestException('Input is required and cannot be empty');
    }
    // 1. Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    try {
      // 2. Generate embedding for user input
      const inputEmbedding = await this.openai.generateEmbedding(dto.input.trim());

      // 3. Retrieve relevant memory from Weaviate
      const relevantMemories = await this.weaviate.searchMemory(agentId, inputEmbedding, 5);

      // 4. Retrieve relevant knowledge base entries
      const knowledgeEntries = await this.getRelevantKnowledgeEntries(agentId, dto.input, userId);
      console.log(`Found ${knowledgeEntries.length} relevant knowledge entries for agent execution`);

      // 5. Build context from memory and knowledge base
      let memoryContext = '';
      if (relevantMemories.length > 0) {
        memoryContext = '\nRelevant past interactions:';
        for (const mem of relevantMemories) {
          memoryContext += `\n- Q: ${mem.input}\n  A: ${mem.output}`;
        }
      }

      let knowledgeContext = '';
      if (knowledgeEntries.length > 0) {
        knowledgeContext = '\nRelevant knowledge base entries:';
        for (const entry of knowledgeEntries) {
          knowledgeContext += `\n- Title: ${entry.title}`;
          if (entry.description) {
            knowledgeContext += `\n  Description: ${entry.description}`;
          }
          if (entry.content) {
            // Limit content length to avoid token overflow
            const truncatedContent = entry.content.length > 500 
              ? entry.content.substring(0, 500) + '...' 
              : entry.content;
            knowledgeContext += `\n  Content: ${truncatedContent}`;
          }
          knowledgeContext += '\n';
        }
      }

      // 6. Build system prompt with agent purpose, memory, and knowledge
      let systemPrompt = '';
      if (agent.config && typeof agent.config === 'object' && 'systemPrompt' in agent.config) {
        systemPrompt = (agent.config as any).systemPrompt;
      } else {
        systemPrompt = agent.purpose || '';
      }
      
      // Add knowledge base context first (more authoritative)
      if (knowledgeContext) {
        systemPrompt += knowledgeContext;
      }
      
      // Add memory context
      if (memoryContext) {
        systemPrompt += memoryContext;
      }

      // 7. Use OpenAI to generate a response
      const completion = await this.openai['openai'].chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dto.input },
        ],
        temperature: 0.7,
        max_tokens: 512,
      });
      const output = completion.choices[0]?.message?.content || '';

      // 8. Generate embedding for the response
      const outputEmbedding = await this.openai.generateEmbedding(output);

      // 9. Store the interaction in Weaviate
      await this.weaviate.storeMemory(
        agentId,
        dto.input,
        output,
        outputEmbedding,
        new Date().toISOString(),
        { 
          ...dto.metadata || {},
          knowledgeEntriesUsed: knowledgeEntries.map(e => e.id),
        },
      );

      const duration = Date.now() - startTime;

      // 10. Log successful execution
      await this.activityService.logAgentActivity(
        agentId,
        userId,
        'execute',
        {
          inputLength: dto.input.length,
          outputLength: output.length,
          memoriesUsed: relevantMemories.length,
          knowledgeEntriesUsed: knowledgeEntries.length,
          model: 'gpt-4-1106-preview',
        },
        duration,
      );

      // 11. Return the response and context used
      return {
        output,
        memoryUsed: relevantMemories,
        knowledgeUsed: knowledgeEntries.map(entry => ({
          id: entry.id,
          title: entry.title,
          type: entry.type,
          description: entry.description,
        })),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed execution
      await this.activityService.logError(
        'agent',
        'execute',
        error,
        userId,
        agent.workspaceId,
        agentId,
      );
      
      throw error;
    }
  }

  async uploadTrainingFile(agentId: string, file: any, userId: string) {
    // 1. Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // 2. Store file on disk
    const uploadDir = path.join(process.cwd(), 'uploads', 'agents', agentId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, file.originalname);
    fs.writeFileSync(filePath, file.buffer);

    // 3. Store file metadata in DB (set status to 'processing')
    let trainingFile = await this.prisma.agentTrainingFile.create({
      data: {
        agentId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        storagePath: filePath,
        status: 'processing',
      },
    });

    try {
      // 4. Extract text from file (support PDF, MD, TXT, CSV)
      let text = '';
      if (file.mimetype === 'application/pdf') {
        text = await this.extractTextFromFile(filePath, 'pdf');
      } else if (file.mimetype === 'text/markdown' || file.originalname.endsWith('.md')) {
        text = await this.extractTextFromFile(filePath, 'md');
      } else if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
        text = await this.extractTextFromFile(filePath, 'txt');
      } else if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        text = await this.extractTextFromFile(filePath, 'csv');
      } else {
        throw new Error('Only PDF, Markdown, TXT, and CSV files are supported for now');
      }

      // 5. Chunk text (simple split by paragraphs for now)
      const chunks = text.split(/\n\n+/).filter(Boolean);

      // 6. For each chunk, generate embedding and store in Weaviate
      for (const chunk of chunks) {
        const embedding = await this.openai.generateEmbedding(chunk);
        await this.weaviate.storeMemory(
          agentId,
          chunk,
          '[TRAINING FILE]',
          embedding,
          new Date().toISOString(),
          { fileId: trainingFile.id, fileName: file.originalname },
        );
      }

      // 7. Set status to 'ready'
      await this.prisma.agentTrainingFile.update({ where: { id: trainingFile.id }, data: { status: 'ready' } });
      return { success: true, fileId: trainingFile.id };
    } catch (err) {
      // Set status to 'error'
      await this.prisma.agentTrainingFile.update({ where: { id: trainingFile.id }, data: { status: 'error' } });
      throw err;
    }
  }

  private async extractTextFromFile(filePath: string, type: string): Promise<string> {
    if (type === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (type === 'md' || type === 'txt' || type === 'csv') {
      return fs.readFileSync(filePath, 'utf-8');
    }
    throw new Error('Unsupported file type');
  }

  async listTrainingFiles(agentId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return this.prisma.agentTrainingFile.findMany({
      where: { agentId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async deleteTrainingFile(agentId: string, fileId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    // Find file
    const file = await this.prisma.agentTrainingFile.findUnique({ where: { id: fileId } });
    if (!file || file.agentId !== agentId) throw new NotFoundException('File not found');
    // Remove file from disk
    if (file.storagePath && existsSync(file.storagePath)) {
      unlinkSync(file.storagePath);
    }
    // Delete DB record
    await this.prisma.agentTrainingFile.delete({ where: { id: fileId } });
    // TODO: Remove related Weaviate memory (if needed)
    return { success: true };
  }

  async downloadTrainingFile(agentId: string, fileId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    // Find file
    const file = await this.prisma.agentTrainingFile.findUnique({ where: { id: fileId } });
    if (!file || file.agentId !== agentId) throw new NotFoundException('File not found');
    return file;
  }

  // TODO: Implement agent management logic
  
  // Memory Management
  async getAgentMemory(agentId: string, userId: string, page = 1, pageSize = 20) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Get memory from Weaviate
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      const result = await this.weaviate['client'].graphql.get()
        .withClassName(className)
        .withFields('input output timestamp metadata _additional { id }')
        .withLimit(pageSize)
        .withOffset((page - 1) * pageSize)
        .do();
      
      const memories = result?.data?.Get?.[className] || [];
      return {
        memories: memories.map(mem => ({
          id: mem._additional.id,
          input: mem.input,
          output: mem.output,
          timestamp: mem.timestamp,
          metadata: mem.metadata ? JSON.parse(mem.metadata) : {},
        })),
        page,
        pageSize,
        total: memories.length, // Note: Weaviate doesn't provide total count easily
      };
    } catch (err) {
      return { memories: [], page, pageSize, total: 0 };
    }
  }

  async searchAgentMemory(agentId: string, query: string, userId: string, limit = 10) {
    // Validate query input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new BadRequestException('Query is required and cannot be empty');
    }
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Generate embedding for search query
    const queryEmbedding = await this.openai.generateEmbedding(query.trim());
    
    // Search memory
    const memories = await this.weaviate.searchMemory(agentId, queryEmbedding, limit);
    return {
      query,
      memories: memories.map(mem => ({
        input: mem.input,
        output: mem.output,
        timestamp: mem.timestamp,
        metadata: mem.metadata ? JSON.parse(mem.metadata) : {},
      })),
    };
  }

  async deleteAgentMemory(agentId: string, memoryId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Delete from Weaviate
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      await this.weaviate['client'].data.deleter()
        .withClassName(className)
        .withId(memoryId)
        .do();
      return { success: true };
    } catch (err) {
      throw new NotFoundException('Memory not found or could not be deleted');
    }
  }

  // File Retraining
  async retrainFile(agentId: string, fileId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Find the file
    const file = await this.prisma.agentTrainingFile.findUnique({ where: { id: fileId } });
    if (!file || file.agentId !== agentId) throw new NotFoundException('File not found');

    // Set status to processing
    await this.prisma.agentTrainingFile.update({ 
      where: { id: fileId }, 
      data: { status: 'processing' } 
    });

    try {
      // Delete existing memory chunks for this file from Weaviate
      const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
      try {
        await this.weaviate['client'].batch.objectsBatchDeleter()
          .withClassName(className)
          .withWhere({
            path: ['metadata'],
            operator: 'Like',
            valueText: `*"fileId":"${fileId}"*`
          })
          .do();
      } catch (err) {
        // Continue even if deletion fails
      }

      // Re-extract and re-embed the file
      const text = await this.extractTextFromFile(file.storagePath, file.fileType.includes('pdf') ? 'pdf' : 
        file.fileName.endsWith('.md') ? 'md' : 
        file.fileName.endsWith('.csv') ? 'csv' : 'txt');

      // Chunk text
      const chunks = text.split(/\n\n+/).filter(Boolean);

      // Re-embed each chunk
      for (const chunk of chunks) {
        const embedding = await this.openai.generateEmbedding(chunk);
        await this.weaviate.storeMemory(
          agentId,
          chunk,
          '[TRAINING FILE]',
          embedding,
          new Date().toISOString(),
          { fileId: file.id, fileName: file.fileName },
        );
      }

      // Set status to ready
      await this.prisma.agentTrainingFile.update({ 
        where: { id: fileId }, 
        data: { status: 'ready' } 
      });

      return { success: true, message: 'File retrained successfully' };
    } catch (err) {
      // Set status to error
      await this.prisma.agentTrainingFile.update({ 
        where: { id: fileId }, 
        data: { status: 'error' } 
      });
      throw err;
    }
  }

  async retrainAllFiles(agentId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Get all files for this agent
    const files = await this.prisma.agentTrainingFile.findMany({
      where: { agentId },
    });

    // Retrain each file
    const results: Array<{ fileId: string; fileName: string; success: boolean; error?: string }> = [];
    for (const file of files) {
      try {
        await this.retrainFile(agentId, file.id, userId);
        results.push({ fileId: file.id, fileName: file.fileName, success: true });
      } catch (err) {
        results.push({ fileId: file.id, fileName: file.fileName, success: false, error: (err as Error).message });
      }
    }

    return { 
      success: true, 
      message: `Retrained ${results.filter(r => r.success).length}/${results.length} files`,
      results 
    };
  }

  // Interaction History
  async getAgentInteractions(agentId: string, userId: string, page = 1, pageSize = 20) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Get interactions from Weaviate (filter out training file entries)
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      // First, get total count
      const totalResult = await this.weaviate['client'].graphql.aggregate()
        .withClassName(className)
        .withWhere({
          path: ['output'],
          operator: 'NotEqual',
          valueText: '[TRAINING FILE]'
        })
        .withFields('meta { count }')
        .do();
      
      const total = totalResult?.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;

      // Then get paginated results
      const result = await this.weaviate['client'].graphql.get()
        .withClassName(className)
        .withFields('input output timestamp metadata _additional { id }')
        .withWhere({
          path: ['output'],
          operator: 'NotEqual',
          valueText: '[TRAINING FILE]'
        })
        .withLimit(pageSize)
        .withOffset((page - 1) * pageSize)
        .do();
      
      const interactions = result?.data?.Get?.[className] || [];
      return {
        interactions: interactions.map(interaction => ({
          id: interaction._additional.id,
          input: interaction.input,
          output: interaction.output,
          timestamp: interaction.timestamp,
          metadata: interaction.metadata ? JSON.parse(interaction.metadata) : {},
        })),
        page,
        pageSize,
        total,
      };
    } catch (err) {
      return { interactions: [], page, pageSize, total: 0 };
    }
  }

  async exportAgentInteractions(agentId: string, userId: string, format: 'json' | 'csv' = 'json') {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Get all interactions (not training files)
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      const result = await this.weaviate['client'].graphql.get()
        .withClassName(className)
        .withFields('input output timestamp metadata')
        .withWhere({
          path: ['output'],
          operator: 'NotEqual',
          valueText: '[TRAINING FILE]'
        })
        .withLimit(1000) // Large limit for export
        .do();
      
      const interactions = result?.data?.Get?.[className] || [];
      const data = interactions.map(interaction => ({
        input: interaction.input,
        output: interaction.output,
        timestamp: interaction.timestamp,
        metadata: interaction.metadata ? JSON.parse(interaction.metadata) : {},
      }));

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeader = 'timestamp,input,output,metadata\n';
        const csvRows = data.map(row => 
          `"${row.timestamp}","${row.input.replace(/"/g, '""')}","${row.output.replace(/"/g, '""')}","${JSON.stringify(row.metadata).replace(/"/g, '""')}"`
        ).join('\n');
        return csvHeader + csvRows;
      }

      return data;
    } catch (err) {
      return format === 'csv' ? 'timestamp,input,output,metadata\n' : [];
    }
  }

  // Agent Deletion
  async deleteAgent(agentId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Delete all training files from disk
    const files = await this.prisma.agentTrainingFile.findMany({
      where: { agentId },
    });

    for (const file of files) {
      if (file.storagePath && existsSync(file.storagePath)) {
        try {
          unlinkSync(file.storagePath);
        } catch (err) {
          // Continue even if file deletion fails
        }
      }
    }

    // Delete training files from database
    await this.prisma.agentTrainingFile.deleteMany({
      where: { agentId },
    });

    // Delete agent memory from database
    await this.prisma.agentMemory.deleteMany({
      where: { agentId },
    });

    // Delete Weaviate class/namespace
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      await this.weaviate['client'].schema.classDeleter()
        .withClassName(className)
        .do();
    } catch (err) {
      // Continue even if Weaviate deletion fails
    }

    // Delete the agent
    await this.prisma.agent.delete({
      where: { id: agentId },
    });

    return { success: true, message: 'Agent and all associated data deleted successfully' };
  }

  // Agent Cloning
  async cloneAgent(agentId: string, newName: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Create new agent with same config
    const newAgent = await this.prisma.agent.create({
      data: {
        name: newName,
        purpose: agent.purpose,
        config: agent.config as any,
        workspaceId: agent.workspaceId,
      },
    });

    // Initialize Weaviate namespace for new agent
    await this.weaviate.initAgentMemory(newAgent.id);

    // Copy training files
    const files = await this.prisma.agentTrainingFile.findMany({
      where: { agentId },
    });

    for (const file of files) {
      // Copy file to new location
      const newUploadDir = path.join(process.cwd(), 'uploads', 'agents', newAgent.id);
      fs.mkdirSync(newUploadDir, { recursive: true });
      const newFilePath = path.join(newUploadDir, file.fileName);
      
      if (existsSync(file.storagePath)) {
        fs.copyFileSync(file.storagePath, newFilePath);
        
        // Create new training file record
        const newFile = await this.prisma.agentTrainingFile.create({
          data: {
            agentId: newAgent.id,
            fileName: file.fileName,
            fileType: file.fileType,
            fileSize: file.fileSize,
            storagePath: newFilePath,
            status: 'processing',
          },
        });

        // Re-embed the file for the new agent
        try {
          const text = await this.extractTextFromFile(newFilePath, file.fileType.includes('pdf') ? 'pdf' : 
            file.fileName.endsWith('.md') ? 'md' : 
            file.fileName.endsWith('.csv') ? 'csv' : 'txt');

          const chunks = text.split(/\n\n+/).filter(Boolean);

          for (const chunk of chunks) {
            const embedding = await this.openai.generateEmbedding(chunk);
            await this.weaviate.storeMemory(
              newAgent.id,
              chunk,
              '[TRAINING FILE]',
              embedding,
              new Date().toISOString(),
              { fileId: newFile.id, fileName: file.fileName },
            );
          }

          await this.prisma.agentTrainingFile.update({ 
            where: { id: newFile.id }, 
            data: { status: 'ready' } 
          });
        } catch (err) {
          await this.prisma.agentTrainingFile.update({ 
            where: { id: newFile.id }, 
            data: { status: 'error' } 
          });
        }
      }
    }

    return { 
      success: true, 
      message: 'Agent cloned successfully',
      newAgent: {
        id: newAgent.id,
        name: newAgent.name,
        purpose: newAgent.purpose,
      }
    };
  }

  /**
   * Retrieve relevant knowledge base entries that the agent has access to
   */
  private async getRelevantKnowledgeEntries(agentId: string, userInput: string, userId: string) {
    try {
      // Get the agent to find its workspace
      const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) return [];

      // Get knowledge entries that this agent has access to
      const agentKnowledgeAccess = await this.prisma.knowledgeAgentAccess.findMany({
        where: { agentId },
        include: {
          knowledgeEntry: {
            include: {
              tags: true,
              creator: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (agentKnowledgeAccess.length === 0) return [];

      // Extract knowledge entries
      const knowledgeEntries = agentKnowledgeAccess
        .map(access => access.knowledgeEntry)
        .filter(entry => entry.status === 'published'); // Only use published entries

      if (knowledgeEntries.length === 0) return [];

      // Simple relevance scoring based on text similarity
      const relevantEntries: Array<any> = [];
      const inputLower = userInput.toLowerCase();

      for (const entry of knowledgeEntries) {
        let relevanceScore = 0;
        
        // Check title relevance
        if (entry.title.toLowerCase().includes(inputLower)) {
          relevanceScore += 3;
        }
        
        // Check description relevance
        if (entry.description && entry.description.toLowerCase().includes(inputLower)) {
          relevanceScore += 2;
        }
        
        // Check content relevance (basic keyword matching)
        if (entry.content) {
          const contentLower = entry.content.toLowerCase();
          const inputWords = inputLower.split(/\s+/).filter(word => word.length > 3);
          
          for (const word of inputWords) {
            if (contentLower.includes(word)) {
              relevanceScore += 1;
            }
          }
        }
        
        // Check tag relevance
        for (const tag of entry.tags) {
          if (tag.name.toLowerCase().includes(inputLower)) {
            relevanceScore += 2;
          }
        }

        if (relevanceScore > 0) {
          relevantEntries.push({
            ...entry,
            relevanceScore
          });
        }
      }

      // Sort by relevance score and return top 3
      return relevantEntries
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3)
        .map(({ relevanceScore, ...entry }) => entry);

    } catch (error) {
      console.error('Error retrieving knowledge entries:', error);
      return [];
    }
  }

  /**
   * Get knowledge entries that an agent has access to
   */
  async getAgentKnowledgeAccess(agentId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    const knowledgeAccess = await this.prisma.knowledgeAgentAccess.findMany({
      where: { agentId },
      include: {
        knowledgeEntry: {
          include: {
            tags: true,
            creator: {
              select: { name: true }
            }
          }
        }
      }
    });

    return knowledgeAccess.map(access => ({
      id: access.id,
      accessLevel: access.accessLevel,
      createdAt: access.createdAt,
      knowledgeEntry: {
        id: access.knowledgeEntry.id,
        title: access.knowledgeEntry.title,
        description: access.knowledgeEntry.description,
        type: access.knowledgeEntry.type,
        status: access.knowledgeEntry.status,
        tags: access.knowledgeEntry.tags,
        createdBy: access.knowledgeEntry.creator.name,
        createdAt: access.knowledgeEntry.createdAt,
        updatedAt: access.knowledgeEntry.updatedAt,
      }
    }));
  }

  /**
   * Update agent knowledge access
   */
  async updateAgentKnowledgeAccess(agentId: string, knowledgeEntryIds: string[], userId: string, accessLevel: 'read' | 'write' = 'read') {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Verify all knowledge entries belong to the same workspace
    const knowledgeEntries = await this.prisma.knowledgeEntry.findMany({
      where: { 
        id: { in: knowledgeEntryIds },
        workspaceId: agent.workspaceId 
      }
    });

    if (knowledgeEntries.length !== knowledgeEntryIds.length) {
      throw new BadRequestException('Some knowledge entries not found or not in the same workspace');
    }

    // Remove existing access
    await this.prisma.knowledgeAgentAccess.deleteMany({
      where: { agentId }
    });

    // Add new access
    if (knowledgeEntryIds.length > 0) {
      await this.prisma.knowledgeAgentAccess.createMany({
        data: knowledgeEntryIds.map(entryId => ({
          agentId,
          knowledgeEntryId: entryId,
          accessLevel
        }))
      });
    }

    // Log activity
    await this.activityService.logAgentActivity(
      agentId,
      userId,
      'knowledge-access-update',
      {
        knowledgeEntriesCount: knowledgeEntryIds.length,
        accessLevel,
        entryIds: knowledgeEntryIds,
      },
    );

    return { success: true, message: 'Agent knowledge access updated successfully' };
  }
}
