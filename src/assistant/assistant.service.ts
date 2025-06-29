import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { PrismaClient } from '@prisma/client';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeEntryStatus } from '../knowledge/dto/knowledge.dto';

@Injectable()
export class AssistantService {
  constructor(
    private readonly openaiService: OpenaiService,
    private readonly knowledgeService: KnowledgeService,
  ) {}
  private prisma = new PrismaClient();

  async chat(message: string, context?: any) {
    let systemPrompt = 'You are a helpful assistant for the cmdctr dashboard.';
    let globalContext = '';
    // If workspace context is present, fetch global knowledge base context
    if (context?.workspace?.id) {
      const workspaceId = context.workspace.id;
      const userId = context.user?.id || undefined;
      const knowledgeList = await this.knowledgeService.getEntries(
        workspaceId,
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
    if (context) {
      const user = context.user ? `User: ${context.user.name || ''} (${context.user.email || ''}, role: ${context.user.role || ''})` : '';
      const page = context.page ? `Current page: ${context.page}` : '';
      const workspace = context.workspace ? `Workspace: ${context.workspace.name || ''} (role: ${context.workspace.role || ''})` : '';
      systemPrompt = [
        'You are a helpful assistant for the cmdctr dashboard.',
        globalContext,
        user,
        page,
        workspace,
        'Use this context to provide more relevant and personalized answers.'
      ].filter(Boolean).join('\n');
    } else if (globalContext) {
      systemPrompt += `\n${globalContext}`;
    }
    const reply = await this.openaiService.chatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 512,
      temperature: 0.7,
    });
    // Save user message
    if (context?.user?.id && context?.workspace?.id) {
      await this.saveMessage({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        role: 'user',
        content: message,
      });
      await this.saveMessage({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        role: 'assistant',
        content: reply,
      });
    }
    return { reply };
  }

  async saveMessage({ userId, workspaceId, role, content }: { userId: string; workspaceId: string; role: string; content: string }) {
    return this.prisma.assistantMessage.create({
      data: {
        userId,
        workspaceId,
        role,
        content,
      },
    });
  }

  async getHistory(userId: string, workspaceId: string, limit = 50) {
    return this.prisma.assistantMessage.findMany({
      where: { userId, workspaceId },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });
  }
} 