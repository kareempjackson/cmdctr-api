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
import { ActionsService } from '../actions/actions.service';
import * as fs from 'fs';
import * as path from 'path';
import { unlinkSync, existsSync } from 'fs';
const pdfParse = require('pdf-parse');
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { UnstructuredLoader } from "@langchain/community/document_loaders/fs/unstructured";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import * as textract from "textract";
import * as Tesseract from "tesseract.js";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import * as PNG from 'pngjs';
import { KnowledgeEntryStatus } from '../knowledge/dto/knowledge.dto';
import { v4 as uuidv4 } from 'uuid';
import { CreateAgentTaskDto, QueryAgentTasksDto, UpdateAgentTaskDto } from './dto';

@Injectable()
export class AgentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenaiService) private readonly openai: OpenaiService,
    @Inject(WeaviateService) private readonly weaviate: WeaviateService,
    @Inject(ActivityService) private readonly activityService: ActivityService,
    @Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService,
    @Inject(ActionsService) private readonly actionsService: ActionsService,
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
    if (!dto.input || dto.input.trim().length === 0) {
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
      // 2. Build comprehensive memory context using the new method
      const memoryContext = await this.weaviate.buildComprehensiveMemoryContext(agentId, dto.input);
      console.log(`[Agent][${agentId}] Built comprehensive memory context (${memoryContext.length} chars)`);

      // 3. Retrieve relevant knowledge base entries
      const knowledgeEntries = await this.getRelevantKnowledgeEntries(agentId, dto.input, userId);
      console.log(`[Agent][${agentId}] Found ${knowledgeEntries.length} relevant knowledge entries for agent execution`);

      // 4. Build knowledge context
      let knowledgeContext = '';
      if (knowledgeEntries.length > 0) {
        knowledgeContext = '\nRelevant knowledge base:';
        for (const entry of knowledgeEntries) {
          knowledgeContext += `\n- ${entry.title}: ${entry.description}`;
        }
      }

      // 5. Get available actions if agent has action permissions
      let actionsContext = '';
      const config = agent.config as any;
      if (config && config.capabilities && config.capabilities.includes('actions')) {
        const availableActions = await this.actionsService.getAvailableActions();
        actionsContext = '\nAvailable Actions:';
        for (const action of availableActions) {
          actionsContext += `\n- ${action.name}: ${action.description}`;
          if (action.examples.length > 0) {
            actionsContext += `\n  Example: ${action.examples[0]}`;
          }
        }
      }

      // 6. Build system prompt with agent purpose, memory, knowledge, and actions
      let globalContext = '';
      if (agent.workspaceId) {
        const knowledgeList = await this.knowledgeService.getEntries(
          agent.workspaceId,
          userId,
          { status: KnowledgeEntryStatus.PUBLISHED, limit: 100 }
        );
        if (knowledgeList.entries.length > 0) {
          globalContext = '\nGlobal Knowledge Base Context:';
          for (const entry of knowledgeList.entries) {
            globalContext += `\n- ${entry.title}: ${entry.description || ''}`;
            if (entry.content) {
              globalContext += `\n  ${entry.content.substring(0, 500)}...`;
            }
          }
        }
      }
      let systemPrompt = '';
      if (agent.config && typeof agent.config === 'object' && 'systemPrompt' in agent.config) {
        systemPrompt = (agent.config as any).systemPrompt;
      } else {
        systemPrompt = agent.purpose || '';
      }
      // Add global knowledge base context first
      if (globalContext) {
        systemPrompt = `${systemPrompt}\n${globalContext}`;
      }
      // Add knowledge base context (agent-specific)
      if (knowledgeContext) {
        systemPrompt += knowledgeContext;
      }
      // Add comprehensive memory context
      if (memoryContext) {
        systemPrompt += memoryContext;
      }
      // Add actions context
      if (actionsContext) {
        systemPrompt += actionsContext;
        systemPrompt += '\n\nYou can execute actions by responding with a JSON object containing an "action" field. For example: {"action": {"name": "http_request", "parameters": {"method": "GET", "url": "https://api.example.com/data"}}}';
      }
      
      // Add detailed logging for context and user input
      console.log(`[Agent][${agentId}]\n--- CONTEXT SENT TO LLM ---\nSystem Prompt: ${systemPrompt}\nMemory Context Length: ${memoryContext.length}\nKnowledge Context: ${knowledgeContext}\nActions Available: ${actionsContext ? 'Yes' : 'No'}\nUser Input: ${dto.input}\n--------------------------`);

      // 7. Use OpenAI to generate a response
      const completion = await this.openai['openai'].chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dto.input },
        ],
        temperature: 0.7,
        max_tokens: 1024, // Increased for action responses
      });
      const output = completion.choices[0]?.message?.content || '';

      // 8. Check if the response contains an action to execute
      let actionResult: any = null;
      let finalOutput = output;
      
      try {
        // Try to parse the response as JSON to check for actions
        const responseMatch = output.match(/\{[\s\S]*\}/);
        if (responseMatch) {
          const parsedResponse = JSON.parse(responseMatch[0]);
          if (parsedResponse.action && typeof parsedResponse.action === 'object') {
            console.log(`[Agent][${agentId}] Executing action: ${parsedResponse.action.name}`);
            
            // Execute the action
            actionResult = await this.actionsService.executeAction({
              actionName: parsedResponse.action.name,
              parameters: parsedResponse.action.parameters || {},
              agentId,
              userId,
              workspaceId: agent.workspaceId,
            });

            // Update the output to include action results
            if (actionResult && actionResult.success) {
              finalOutput = `${output}\n\nAction executed successfully:\n${JSON.stringify(actionResult.data, null, 2)}`;
            } else if (actionResult) {
              finalOutput = `${output}\n\nAction failed: ${actionResult.error}`;
            }
          }
        }
      } catch (parseError) {
        // Not a JSON response, use as-is
        console.log(`[Agent][${agentId}] Response is not JSON, using as text`);
      }

      // 9. Generate embedding for the response
      const outputEmbedding = await this.openai.generateEmbedding(finalOutput);

      // 10. Store the interaction in Weaviate
      await this.weaviate.storeMemory(
        agentId,
        dto.input,
        finalOutput,
        outputEmbedding,
        new Date().toISOString(),
        { 
          ...dto.metadata || {},
          knowledgeEntriesUsed: knowledgeEntries.map(e => e.id),
          actionExecuted: actionResult ? actionResult.metadata?.actionName : null,
          actionSuccess: actionResult ? actionResult.success : null,
        },
      );

      const duration = Date.now() - startTime;

      // 11. Log successful execution
      await this.activityService.logAgentActivity(
        agentId,
        userId,
        'execute',
        {
          inputLength: dto.input.length,
          outputLength: finalOutput.length,
          memoryContextLength: memoryContext.length,
          knowledgeEntriesUsed: knowledgeEntries.length,
          actionExecuted: actionResult ? actionResult.metadata?.actionName : null,
          actionSuccess: actionResult ? actionResult.success : null,
          model: 'gpt-4-1106-preview',
        },
        duration,
      );

      // 12. Return the response and context used
      return {
        output: finalOutput,
        memoryContextLength: memoryContext.length,
        knowledgeUsed: knowledgeEntries.map(entry => ({
          id: entry.id,
          title: entry.title,
          type: entry.type,
          description: entry.description,
        })),
        actionResult,
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

  private async extractTextFromFile(filePathOrUrl: string, type: string): Promise<string> {
    let dataBuffer: Buffer;
    let localPath = filePathOrUrl;
    // Download from S3 if needed
    if (filePathOrUrl.startsWith('http')) {
      const match = filePathOrUrl.match(/https:\/\/([^\.]+)\.s3\.amazonaws\.com\/(.+)/);
      if (!match) throw new Error('Invalid S3 URL');
      const Bucket = match[1];
      const Key = match[2];
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      const command = new GetObjectCommand({ Bucket, Key });
      const { Body } = await s3.send(command);
      if (!Body) throw new Error('S3 file Body is undefined');
      dataBuffer = Buffer.from(await Body.transformToByteArray());
      // Save to temp file for loaders that require a path
      const tmp = require('tmp');
      const tmpFile = tmp.fileSync();
      require('fs').writeFileSync(tmpFile.name, dataBuffer);
      localPath = tmpFile.name;
    } else {
      dataBuffer = fs.readFileSync(filePathOrUrl);
    }

    // PDF
    if (type === 'pdf' || type === 'pdfa') {
      // Try LangChain PDFLoader first
      let text = '';
      try {
        const loader = new PDFLoader(localPath);
        const docs = await loader.load();
        text = docs.map(d => d.pageContent).join('\n\n');
      } catch (e) {
        // fallback to pdf-parse
        const data = await pdfParse(dataBuffer);
        text = data.text;
      }
      // If text is empty or just watermark, try OCR
      if (!text.trim() || text.trim().toLowerCase().includes('scanned by tapscanner')) {
        try {
          // Convert Buffer to Uint8Array for pdfjs-dist
          const pdfData = dataBuffer instanceof Uint8Array ? dataBuffer : new Uint8Array(dataBuffer);
          // Use pdfjs-dist to extract images from each page
          const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
          let ocrText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const ops = await page.getOperatorList();
            for (let j = 0; j < ops.fnArray.length; j++) {
              if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                const imgName = ops.argsArray[j][0];
                const img = await page.objs.get(imgName);
                if (img && img.data) {
                  // Convert image data to buffer
                  const { width, height, data } = img;
                  const png = require('pngjs').PNG;
                  const pngImage = new png({ width, height });
                  pngImage.data = Buffer.from(data);
                  const buffer = PNG.sync.write(pngImage);
                  const { data: { text: ocrResult } } = await Tesseract.recognize(buffer, 'eng');
                  ocrText += ocrResult + '\n';
                }
              }
            }
          }
          if (ocrText.trim()) {
            text = ocrText;
          }
        } catch (ocrErr) {
          console.error('[Extract][PDF][OCR] Error extracting OCR from scanned PDF:', ocrErr);
        }
      }
      return text;
    }
    // DOCX
    if (type === 'docx' || type === 'doc') {
      try {
        const loader = new DocxLoader(localPath);
        const docs = await loader.load();
        return docs.map(d => d.pageContent).join('\n\n');
      } catch (e) {
        // fallback to mammoth
        const { value } = await mammoth.extractRawText({ buffer: dataBuffer });
        return value;
      }
    }
    // XLS/XLSX
    if (type === 'xls' || type === 'xlsx') {
      try {
        const workbook = XLSX.read(dataBuffer, { type: 'buffer' });
        let text = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          text += `Sheet: ${sheetName}\n${csv}\n`;
        });
        return text;
      } catch (e) {
        // fallback to textract
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      }
    }
    // PPT/PPTX
    if (type === 'ppt' || type === 'pptx') {
      try {
        // Use textract for ppt/pptx
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/vnd.openxmlformats-officedocument.presentationml.presentation', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      } catch (e) {
        return '';
      }
    }
    // Images (jpg, jpeg, png, gif, bmp, tiff)
    if (["jpg", "jpeg", "png", "gif", "bmp", "tiff"].includes(type)) {
      try {
        // Use Tesseract directly for OCR
        const { data: { text } } = await Tesseract.recognize(dataBuffer, 'eng');
        return text;
      } catch (e) {
        return '';
      }
    }
    // ODT
    if (type === 'odt') {
      try {
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/vnd.oasis.opendocument.text', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      } catch (e) {
        console.error('[Extract][ODT] Error extracting ODT:', e);
        return '';
      }
    }
    // RTF
    if (type === 'rtf') {
      try {
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/rtf', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      } catch (e) {
        console.error('[Extract][RTF] Error extracting RTF:', e);
        return '';
      }
    }
    // TXT, MD, CSV
    if (["md", "txt", "csv"].includes(type)) {
      return dataBuffer.toString('utf-8');
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
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    const queryEmbedding = await this.openai.generateEmbedding(query);
    const memories = await this.weaviate.searchMemory(agentId, queryEmbedding, limit);
    return memories;
  }

  async summarizeAgentMemory(agentId: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    const summary = await this.weaviate.generateMemorySummary(agentId);
    return { summary, agentId };
  }

  async getAgentMemoryContext(agentId: string, query: string, userId: string) {
    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    const memoryContext = await this.weaviate.buildComprehensiveMemoryContext(agentId, query);
    return { memoryContext, agentId, query };
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
    // Validate input parameters
    if (!knowledgeEntryIds || !Array.isArray(knowledgeEntryIds)) {
      knowledgeEntryIds = [];
    }

    console.log(`[DEBUG] updateAgentKnowledgeAccess called with agentId=${agentId}, knowledgeEntryIds=${JSON.stringify(knowledgeEntryIds)}, userId=${userId}, accessLevel=${accessLevel}`);

    // Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // Verify all knowledge entries belong to the same workspace (only if we have IDs to check)
    if (knowledgeEntryIds.length > 0) {
      const knowledgeEntries = await this.prisma.knowledgeEntry.findMany({
        where: { 
          id: { in: knowledgeEntryIds },
          workspaceId: agent.workspaceId 
        }
      });

      if (knowledgeEntries.length !== knowledgeEntryIds.length) {
        throw new BadRequestException('Some knowledge entries not found or not in the same workspace');
      }
    }

    // Use transaction to ensure atomic operation
    try {
      await this.prisma.$transaction(async (tx) => {
        // Remove existing access
        console.log(`[DEBUG] Deleting existing access for agent ${agentId}`);
        const deleteResult = await tx.knowledgeAgentAccess.deleteMany({
          where: { agentId }
        });
        console.log(`[DEBUG] Deleted ${deleteResult.count} existing access records`);

        // Add new access
        if (knowledgeEntryIds.length > 0) {
          console.log(`[DEBUG] Creating ${knowledgeEntryIds.length} new access records`);
          const createResult = await tx.knowledgeAgentAccess.createMany({
            data: knowledgeEntryIds.map(entryId => ({
              agentId,
              knowledgeEntryId: entryId,
              accessLevel
            }))
          });
          console.log(`[DEBUG] Created ${createResult.count} new access records`);
        }
      });

      console.log(`[DEBUG] Transaction completed successfully`);

      // Log activity (don't let this fail the whole operation)
      try {
        await this.activityService.logActivity({
          category: 'agent',
          action: 'knowledge-access-update',
          description: `Updated knowledge access for agent ${agent.name}`,
          userId,
          workspaceId: agent.workspaceId,
          agentId,
          resource: agentId,
          metadata: {
            knowledgeEntriesCount: knowledgeEntryIds.length,
            accessLevel,
            entryIds: knowledgeEntryIds,
          },
          status: 'success',
        });
      } catch (loggingError) {
        console.error(`[ERROR] Failed to log activity for agent knowledge access update:`, loggingError);
        // Don't throw - logging failures shouldn't break the main operation
      }

      // Verify the changes were saved by checking the current state
      const finalAccessCount = await this.prisma.knowledgeAgentAccess.count({
        where: { agentId }
      });
      console.log(`[DEBUG] Final access count for agent ${agentId}: ${finalAccessCount}, expected: ${knowledgeEntryIds.length}`);

      return { 
        success: true, 
        message: `Agent knowledge access updated successfully. ${finalAccessCount} entries now accessible.`,
        accessCount: finalAccessCount 
      };
    } catch (error) {
      console.error(`[ERROR] Failed to update agent knowledge access:`, error);
      throw error;
    }
  }

  async trainAgentOnKnowledge(agentId: string, knowledgeEntryId: string, workspaceId: string) {
    // TODO: Implement actual training logic here
    // For now, just log
    console.log(`[STUB] Training agent ${agentId} on knowledge entry ${knowledgeEntryId} in workspace ${workspaceId}`);
  }

  async saveTrainingFileMetadata(agentId: string, metadata: { fileUrl: string; fileName: string; fileSize: number; mimeType: string }, userId: string) {
    // 1. Ensure user is a member of the agent's workspace
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: agent.workspaceId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    // 2. Store file metadata in DB (set status to 'processing')
    let trainingFile = await this.prisma.agentTrainingFile.create({
      data: {
        agentId,
        fileName: metadata.fileName,
        fileType: metadata.mimeType,
        fileSize: metadata.fileSize,
        storagePath: metadata.fileUrl, // S3 URL
        status: 'processing',
      },
    });

    try {
      console.log(`[Train] Processing file for agent ${agentId}: fileId=${trainingFile.id}, fileName=${metadata.fileName}`);
      let text = '';
      if (metadata.mimeType === 'application/pdf') {
        text = await this.extractTextFromFile(metadata.fileUrl, 'pdf');
      } else if (metadata.mimeType === 'text/markdown' || metadata.fileName.endsWith('.md')) {
        text = await this.extractTextFromFile(metadata.fileUrl, 'md');
      } else if (metadata.mimeType === 'text/plain' || metadata.fileName.endsWith('.txt')) {
        text = await this.extractTextFromFile(metadata.fileUrl, 'txt');
      } else if (metadata.mimeType === 'text/csv' || metadata.fileName.endsWith('.csv')) {
        text = await this.extractTextFromFile(metadata.fileUrl, 'csv');
      } else {
        throw new Error('Only PDF, Markdown, TXT, and CSV files are supported for now');
      }
      const chunks = text.split(/\n\n+/).filter(Boolean);
      console.log(`[Train] File chunked into ${chunks.length} chunks.`);
      for (const [i, chunk] of chunks.entries()) {
        const embedding = await this.openai.generateEmbedding(chunk);
        console.log(`[Embed] Chunk ${i + 1}/${chunks.length} (length: ${chunk.length}) embedding length: ${embedding.length}`);
        await this.weaviate.storeMemory(
          agentId,
          chunk,
          '[TRAINING FILE]',
          embedding,
          new Date().toISOString(),
          { fileId: trainingFile.id, fileName: metadata.fileName },
        );
      }
      await this.prisma.agentTrainingFile.update({ where: { id: trainingFile.id }, data: { status: 'ready' } });
      console.log(`[Train] Finished processing file for agent ${agentId}: fileId=${trainingFile.id}`);
      return { success: true, fileId: trainingFile.id };
    } catch (err) {
      await this.prisma.agentTrainingFile.update({ where: { id: trainingFile.id }, data: { status: 'error' } });
      console.error(`[Train][Error] Failed processing file for agent ${agentId}: fileId=${trainingFile.id}, error:`, err);
      throw err;
    }
  }

  // Agent Task Management Methods
  async createAgentTask(createTaskDto: CreateAgentTaskDto, userId: string) {
    const { agentId, type, parameters, scheduledFor, priority, tags, maxRetries } = createTaskDto;

    // Verify agent exists and user has access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { workspace: true }
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // TODO: Add workspace access validation
    // const hasAccess = await this.validateWorkspaceAccess(userId, agent.workspaceId);

    const task = await this.prisma.agentTask.create({
      data: {
        agentId,
        type,
        parameters,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        priority: priority || 'medium',
        tags: tags || [],
        maxRetries: maxRetries || 3,
        createdBy: userId,
        status: 'pending'
      },
      include: {
        agent: true,
        creator: true
      }
    });

    return task;
  }

  async analyzeTask(agentId: string, instruction: string, userId: string) {
    // Verify agent exists and user has access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { workspace: true }
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // For now, provide intelligent analysis based on instruction content
    // TODO: Integrate with OpenAI for more sophisticated analysis
    const analysisKeywords = instruction.toLowerCase();
    let estimatedDuration = '5-10 minutes';
    let approach = ['Analyze task requirements', 'Execute the task', 'Provide results'];
    let requiredResources = ['Agent reasoning'];

    if (analysisKeywords.includes('research') || analysisKeywords.includes('analyze')) {
      estimatedDuration = '10-15 minutes';
      approach = ['Research topic thoroughly', 'Analyze findings', 'Compile comprehensive summary'];
      requiredResources = ['Knowledge base access', 'Research capabilities', 'Analysis tools'];
    } else if (analysisKeywords.includes('email') || analysisKeywords.includes('message')) {
      estimatedDuration = '2-5 minutes';
      approach = ['Review context and recipients', 'Draft message content', 'Send communication'];
      requiredResources = ['Communication access', 'Context awareness'];
    } else if (analysisKeywords.includes('schedule') || analysisKeywords.includes('meeting')) {
      estimatedDuration = '3-7 minutes';
      approach = ['Check availability', 'Coordinate with participants', 'Create calendar entry'];
      requiredResources = ['Calendar access', 'Scheduling tools'];
    }

    return {
      understanding: `I understand you want me to ${instruction}. I'll handle this intelligently by breaking it down into manageable steps and leveraging the appropriate resources.`,
      approach,
      estimatedDuration,
      requiredResources
    };
  }

  async getAgentTasks(query: QueryAgentTasksDto, userId: string) {
    const {
      agentId,
      type,
      status,
      priority,
      tags,
      scheduledForAfter,
      scheduledForBefore,
      createdAtAfter,
      createdAtBefore,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (agentId) where.agentId = agentId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }
    if (scheduledForAfter || scheduledForBefore) {
      where.scheduledFor = {};
      if (scheduledForAfter) where.scheduledFor.gte = new Date(scheduledForAfter);
      if (scheduledForBefore) where.scheduledFor.lte = new Date(scheduledForBefore);
    }
    if (createdAtAfter || createdAtBefore) {
      where.createdAt = {};
      if (createdAtAfter) where.createdAt.gte = new Date(createdAtAfter);
      if (createdAtBefore) where.createdAt.lte = new Date(createdAtBefore);
    }

    // TODO: Add workspace access filtering
    // where.agent = { workspaceId: { in: userWorkspaceIds } };

    const [tasks, total] = await Promise.all([
      this.prisma.agentTask.findMany({
        where,
        include: {
          agent: true,
          creator: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit
      }),
      this.prisma.agentTask.count({ where })
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getAgentTask(taskId: string, userId: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id: taskId },
      include: {
        agent: {
          include: {
            workspace: true
          }
        },
        creator: true
      }
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // TODO: Add workspace access validation
    // const hasAccess = await this.validateWorkspaceAccess(userId, task.agent.workspaceId);

    return task;
  }

  async updateAgentTask(taskId: string, updateTaskDto: UpdateAgentTaskDto, userId: string) {
    const task = await this.getAgentTask(taskId, userId);

    // Only allow updates if task is not completed or cancelled
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new BadRequestException(`Cannot update task in status: ${task.status}`);
    }

    const updatedTask = await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        ...updateTaskDto,
        scheduledFor: updateTaskDto.scheduledFor ? new Date(updateTaskDto.scheduledFor) : undefined,
        completedAt: updateTaskDto.completedAt ? new Date(updateTaskDto.completedAt) : undefined
      },
      include: {
        agent: true,
        creator: true
      }
    });

    return updatedTask;
  }

  async deleteAgentTask(taskId: string, userId: string) {
    const task = await this.getAgentTask(taskId, userId);

    // Only allow deletion if task is not in progress
    if (task.status === 'in_progress') {
      throw new BadRequestException('Cannot delete task that is currently in progress');
    }

    await this.prisma.agentTask.delete({
      where: { id: taskId }
    });

    return { message: 'Task deleted successfully' };
  }

  async getAgentTaskStats(agentId?: string, userId?: string) {
    const where: any = {};
    
    if (agentId) where.agentId = agentId;
    // TODO: Add workspace access filtering

    const stats = await this.prisma.agentTask.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true
      }
    });

    const totalTasks = await this.prisma.agentTask.count({ where });
    const pendingTasks = await this.prisma.agentTask.count({
      where: {
        ...where,
        status: 'pending',
        scheduledFor: null
      }
    });

    const scheduledTasks = await this.prisma.agentTask.count({
      where: {
        ...where,
        status: 'pending',
        scheduledFor: {
          not: null
        }
      }
    });

    return {
      total: totalTasks,
      pending: pendingTasks,
      scheduled: scheduledTasks,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  async retryAgentTask(taskId: string, userId: string) {
    const task = await this.getAgentTask(taskId, userId);

    if (task.status === 'in_progress') {
      throw new BadRequestException('Cannot retry task that is currently in progress');
    }

    if (task.status === 'completed') {
      throw new BadRequestException('Cannot retry completed task');
    }

    // Reset task for retry
    const currentLogs = (task.logs as Record<string, any>) || {};
    
    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        retryCount: 0,
        logs: {
          ...currentLogs,
          [`${new Date().toISOString()}`]: {
            action: 'manual_retry',
            message: 'Task manually retried by user'
          }
        }
      }
    });

    return { message: 'Task queued for retry' };
  }

  async cancelAgentTask(taskId: string, userId: string) {
    const task = await this.getAgentTask(taskId, userId);

    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel task in status: ${task.status}`);
    }

    const currentLogs = (task.logs as Record<string, any>) || {};

    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        logs: {
          ...currentLogs,
          [`${new Date().toISOString()}`]: {
            action: 'cancelled',
            message: 'Task cancelled by user'
          }
        }
      }
    });

    return { message: 'Task cancelled successfully' };
  }

  // Agent Workflow Methods
  async getAgentWorkflows(agentId: string, userId: string) {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { workspace: true }
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // For now, return workflows created by user in the same workspace
    // This could be enhanced to have explicit agent-workflow relationships
    const workflows = await this.prisma.workflow.findMany({
      where: {
        createdBy: userId,
        workspaceId: agent.workspaceId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workflows;
  }

  async createAgentWorkflow(agentId: string, workflowData: any, userId: string) {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Create workflow with agent's workspace
    const { name, description, steps, triggers, isActive, nodes, edges } = workflowData;
    
    const isVisualWorkflow = nodes && edges;
    const workflowType = isVisualWorkflow ? 'visual' : 'sequential';
    
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
        workspaceId: agent.workspaceId,
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

  async analyzeWorkflow(agentId: string, description: string, userId: string) {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    try {
      // Use OpenAI to analyze the workflow description
      const prompt = `Analyze the following workflow description and provide structured output:

Description: "${description}"

Please respond with a JSON object containing:
{
  "understanding": "Brief summary of what this workflow accomplishes",
  "suggestedName": "A concise name for this workflow",
  "trigger": {
    "type": "string (e.g., 'form_submission', 'schedule', 'webhook', 'manual')",
    "description": "Description of when this workflow should trigger"
  },
  "steps": [
    {
      "action": "Action name (e.g., 'Send Email', 'Create Lead', 'Notify Team')",
      "description": "Description of what this step does"
    }
  ],
  "complexity": "Simple | Moderate | Complex",
  "estimatedTime": "Estimated setup time (e.g., '5-10 minutes')"
}

Focus on identifying:
- Trigger events (when something happens)
- Actions to take (send, create, notify, update)
- Integration points (email, CRM, Slack, etc.)`;

      const response = await this.openai.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a workflow analysis expert. Analyze workflow descriptions and return structured JSON responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      let analysisResult;
      try {
        // Try to parse the JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback analysis if JSON parsing fails
        analysisResult = this.generateFallbackAnalysis(description);
      }

      return analysisResult;
    } catch (error) {
      console.error('Workflow analysis error:', error);
      // Return fallback analysis on any error
      return this.generateFallbackAnalysis(description);
    }
  }

  private generateFallbackAnalysis(description: string) {
    const triggerKeywords = ['when', 'if', 'whenever', 'on'];
    const actionKeywords = ['send', 'create', 'notify', 'update', 'schedule', 'generate'];
    
    const hasTrigger = triggerKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    const detectedActions = actionKeywords
      .filter(keyword => description.toLowerCase().includes(keyword))
      .map(keyword => ({
        action: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        description: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} action based on description`
      }));

    const trigger = hasTrigger ? {
      type: 'manual',
      description: 'Manual trigger based on description'
    } : null;

    return {
      understanding: `This workflow ${hasTrigger ? 'triggers when specific conditions are met' : 'performs a series of actions'} and includes ${detectedActions.length} main steps.`,
      suggestedName: 'Custom Workflow',
      trigger,
      steps: detectedActions.length > 0 ? detectedActions : [{
        action: 'Custom Action',
        description: 'Perform actions as described'
      }],
      complexity: detectedActions.length <= 2 ? 'Simple' : detectedActions.length <= 4 ? 'Moderate' : 'Complex',
      estimatedTime: detectedActions.length <= 2 ? '2-5 minutes' : detectedActions.length <= 4 ? '5-10 minutes' : '10-15 minutes'
    };
  }

  async updateAgentWorkflow(agentId: string, workflowId: string, workflowData: any, userId: string) {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Verify workflow ownership and update
    const workflow = await this.prisma.workflow.findFirst({
      where: { 
        id: workflowId, 
        createdBy: userId,
        workspaceId: agent.workspaceId,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found or access denied');
    }

    const updatedWorkflow = await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        name: workflowData.name,
        description: workflowData.description,
        isActive: workflowData.isActive,
        triggers: workflowData.triggers,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return updatedWorkflow;
  }

  async deleteAgentWorkflow(agentId: string, workflowId: string, userId: string) {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Verify workflow ownership and delete
    const workflow = await this.prisma.workflow.findFirst({
      where: { 
        id: workflowId, 
        createdBy: userId,
        workspaceId: agent.workspaceId,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found or access denied');
    }

    await this.prisma.workflow.delete({
      where: { id: workflowId },
    });

    return { message: 'Workflow deleted successfully' };
  }

  async executeAgentWorkflow(agentId: string, workflowId: string, userId: string) {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Verify workflow access
    const workflow = await this.prisma.workflow.findFirst({
      where: { 
        id: workflowId, 
        createdBy: userId,
        workspaceId: agent.workspaceId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found or access denied');
    }

    if (!workflow.isActive) {
      throw new BadRequestException('Workflow is not active');
    }

    // Use the ActionsService to execute the workflow
    // For now, delegate to a placeholder implementation
    // In a real implementation, you'd call the ActionsService.executeWorkflow method
    
    const startTime = Date.now();
    const results: any[] = [];

    // Update execution count
    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: { 
        executionCount: { increment: 1 },
        lastExecuted: new Date(),
      },
    });

    return {
      success: true,
      workflowId,
      agentId,
      executionTime: Date.now() - startTime,
      steps: workflow.steps.length,
      message: `Workflow executed successfully for agent ${agent.name}`,
    };
  }

  // Helper method for converting visual workflows to steps
  private convertVisualToSteps(nodes: any[], edges: any[]): any[] {
    // Simple implementation - in a real system, this would be more sophisticated
    const actionNodes = nodes.filter(node => node.type === 'action');
    return actionNodes.map((node, index) => ({
      actionName: node.data.actionName,
      parameters: node.data.parameters || {},
      condition: node.data.condition,
      dependsOn: [],
    }));
  }
}

@Processor('agent-training')
export class AgentTrainingProcessor {
  constructor(private agentsService: AgentsService) {}

  @Process('train-agent-on-knowledge')
  async handleTrainAgentOnKnowledge(job: Job) {
    const { agentId, knowledgeEntryId, workspaceId } = job.data;
    try {
      await this.agentsService.trainAgentOnKnowledge(agentId, knowledgeEntryId, workspaceId);
      console.log(`Successfully trained agent ${agentId} on knowledge entry ${knowledgeEntryId}`);
    } catch (err) {
      console.error(`Failed to train agent ${agentId} on knowledge entry ${knowledgeEntryId}:`, err);
    }
  }
}
