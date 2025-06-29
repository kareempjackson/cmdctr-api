import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { ConfigService } from '../config/config.service';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeEntryStatus } from '../knowledge/dto/knowledge.dto';
import { SmartDetectionService, IntentAnalysis, DataPattern, BlockRecommendation } from './smart-detection.service';

export interface BlockInstruction {
  type: string;
  title?: string;
  config: any;
  data?: any;
  position: number;
}

export interface InterpretPromptResponse {
  intent: string;
  blocks: BlockInstruction[];
  description?: string;
  smartAnalysis?: {
    intent: IntentAnalysis;
    dataPattern?: DataPattern;
    recommendations: BlockRecommendation[];
  };
}

@Injectable()
export class PromptService {
  private llm: ChatOpenAI;

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly configService: ConfigService,
    private readonly knowledgeService: KnowledgeService,
    private readonly smartDetectionService: SmartDetectionService,
  ) {
    this.llm = new ChatOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      modelName: 'gpt-4-1106-preview',
      temperature: 0.3,
    });
  }

  async interpretPrompt(
    prompt: string,
    workspaceId: string,
    userId: string,
    opts?: { deterministic?: boolean }
  ): Promise<InterpretPromptResponse> {
    // Step 1: Smart Intent Analysis
    const intentAnalysis = this.smartDetectionService.analyzeIntent(prompt);
    console.log('[PromptService] Smart intent analysis:', intentAnalysis);

    // Step 2: Check if this is a long-form request
    const isLongFormRequest = this.isLongFormRequest(prompt);
    
    if (isLongFormRequest) {
      const longFormResult = await this.generateLongTextBlock(prompt, workspaceId, userId, opts);
      // Add smart analysis to long-form results
      longFormResult.smartAnalysis = {
        intent: intentAnalysis,
        recommendations: []
      };
      return longFormResult;
    }

    // Step 3: Extract structured data from prompt if present
    const extractedData = this.smartDetectionService.extractStructuredData(prompt);
    let dataPattern: DataPattern | undefined;
    let blockRecommendations: BlockRecommendation[] = [];

    if (extractedData) {
      console.log('[PromptService] Extracted structured data:', extractedData);
      dataPattern = this.smartDetectionService.analyzeDataStructure(extractedData);
      blockRecommendations = this.smartDetectionService.generateBlockRecommendations(
        intentAnalysis,
        dataPattern,
        extractedData
      );
      console.log('[PromptService] Smart block recommendations:', blockRecommendations);
    }

    // Step 4: Always call the LLM, do not use rule-based fallback
    // Fetch global knowledge base context using semantic search
    let globalContext = '';
    if (prompt && workspaceId) {
      await this.knowledgeService.weaviateService.initWorkspaceMemory(workspaceId);
      const queryEmbedding = await this.openaiService.generateEmbedding(prompt);
      const relevantChunks = await this.knowledgeService.weaviateService.searchWorkspaceMemory(workspaceId, queryEmbedding, 5);
      if (relevantChunks.length > 0) {
        globalContext = '\nGlobal Knowledge Base Context (semantic):';
        for (const chunk of relevantChunks) {
          globalContext += `\n- ${chunk.input?.slice(0, 500)}...`;
          if (chunk.metadata) {
            try {
              const meta = JSON.parse(chunk.metadata);
              if (meta.title) globalContext += `\n  [${meta.title}]`;
            } catch {}
          }
        }
      }
    }

    // Build comprehensive memory context for the user if userId is provided
    let memoryContext = '';
    if (userId) {
      try {
        // Use the user's ID as the agent ID for memory retrieval
        memoryContext = await this.knowledgeService.weaviateService.buildComprehensiveMemoryContext(userId, prompt);
        console.log(`[PromptService] Built comprehensive memory context for user ${userId} (${memoryContext.length} chars)`);
      } catch (error) {
        console.error(`[PromptService] Error building memory context for user ${userId}:`, error);
      }
    }

    // Step 5: Enhanced prompt template with smart detection insights
    const smartInsights = this.buildSmartInsights(intentAnalysis, dataPattern, blockRecommendations);
    
    // Print the context being sent to the LLM
    console.log('[PromptService] LLM globalContext:', globalContext);
    console.log('[PromptService] LLM memoryContext length:', memoryContext.length);
    console.log('[PromptService] Smart insights:', smartInsights);
    
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert assistant that generates actionable, visually organized dashboards from user prompts.

{smartInsights}

SMART DETECTION PRIORITY:
- When smart analysis detects "tabular" data requirements and "table" visualization needs, ALWAYS create a table block
- When smart analysis detects specific block recommendations with high confidence (>0.8), prioritize those recommendations
- Only use 'text' blocks for general explanations, summaries, or narrative content when no structured data is needed
- If the user explicitly requests a table, chart, timeline, or other structured visualization, create that specific block type

{globalContext}

{memoryContext}

User prompt: {prompt}

Generate a JSON response with the following structure:
{{
  "intent": "Brief description of what the user wants",
  "blocks": [
    {{
      "type": "text|chart|table|timeline|task-list|kanban|calendar|note|select|status|jot|agent",
      "title": "Block title",
      "config": {{}},
      "data": {{
        "content": "For text blocks, put the content here",
        "text": "For note blocks",
        "status": "For status blocks",
        "tasks": [{{"id": "1", "text": "Task description", "completed": false}}],
        "events": [{{"title": "Event", "description": "Description", "timestamp": "Date"}}],
        "instructions": "For agent blocks",
        "columns": [{{"key": "col1", "label": "Column 1", "type": "text"}}],
        "rows": [{{"col1": "Sample data"}}]
      }},
      "position": 0
    }}
  ]
}}
`);

    const chain = new LLMChain({
      llm: this.llm,
      prompt: promptTemplate,
    });

    try {
      const result = await chain.call({
        prompt,
        workspaceId,
        globalContext,
        memoryContext,
        smartInsights,
      });

      // Log the raw LLM response
      console.log('[PromptService] Raw LLM response:', result.text);

      // Parse the JSON response
      const content = result.text.trim();
      let parsedResponse: InterpretPromptResponse;

      try {
        // Try to extract JSON from code blocks if present
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i) || 
                         content.match(/```\s*([\s\S]*?)\s*```/i);
        const jsonString = jsonMatch ? jsonMatch[1].trim() : content;
        parsedResponse = JSON.parse(jsonString);
      } catch (parseError) {
        // Fallback: create a simple text block with the original prompt
        parsedResponse = {
          intent: 'Create a workspace based on user request',
          blocks: [
            {
              type: 'text',
              title: 'User Request',
              config: { markdown: true },
              data: { content: `# User Request\n\n${prompt}` },
              position: 0,
            },
          ],
        };
      }

      // Step 6: Apply smart detection enhancements
      const enhancedResponse = await this.applySmartDetectionEnhancements(
        parsedResponse,
        intentAnalysis,
        dataPattern,
        blockRecommendations,
        extractedData
      );

      // Validate and sanitize the response
      return this.validateAndSanitizeResponse(enhancedResponse);
    } catch (error) {
      console.error('Error interpreting prompt:', error);
      
      // Fallback response with smart analysis
      const fallbackResponse: InterpretPromptResponse = {
        intent: 'Create a basic workspace',
        blocks: [
          {
            type: 'text',
            title: 'Getting Started',
            config: { markdown: true },
            data: { content: `# Getting Started\n\n${prompt}` },
            position: 0,
          },
        ],
        smartAnalysis: {
          intent: intentAnalysis,
          dataPattern,
          recommendations: blockRecommendations
        }
      };
      
      return fallbackResponse;
    }
  }

  private isLongFormRequest(prompt: string): boolean {
    const longFormKeywords = [
      /\d+\s*words?/i,
      /\d+\s*word\s*breakdown/i,
      /\d+\s*word\s*explanation/i,
      /\d+\s*word\s*analysis/i,
      /detailed\s+breakdown/i,
      /comprehensive\s+analysis/i,
      /in\s+detail/i,
      /thorough\s+explanation/i,
    ];
    
    return longFormKeywords.some(keyword => keyword.test(prompt));
  }

  private async generateLongTextBlock(
    prompt: string,
    workspaceId: string,
    userId: string,
    opts?: { deterministic?: boolean }
  ): Promise<InterpretPromptResponse> {
    console.log('[PromptService] Generating long-form text block for prompt:', prompt);
    
    // Fetch global knowledge base context
    let globalContext = '';
    if (prompt && workspaceId) {
      await this.knowledgeService.weaviateService.initWorkspaceMemory(workspaceId);
      const queryEmbedding = await this.openaiService.generateEmbedding(prompt);
      const relevantChunks = await this.knowledgeService.weaviateService.searchWorkspaceMemory(workspaceId, queryEmbedding, 5);
      if (relevantChunks.length > 0) {
        globalContext = '\nGlobal Knowledge Base Context (semantic):';
        for (const chunk of relevantChunks) {
          globalContext += `\n- ${chunk.input?.slice(0, 500)}...`;
          if (chunk.metadata) {
            try {
              const meta = JSON.parse(chunk.metadata);
              if (meta.title) globalContext += `\n  [${meta.title}]`;
            } catch {}
          }
        }
      }
    }

    // Build comprehensive memory context for the user if userId is provided
    let memoryContext = '';
    if (userId) {
      try {
        // Use the user's ID as the agent ID for memory retrieval
        memoryContext = await this.knowledgeService.weaviateService.buildComprehensiveMemoryContext(userId, prompt);
        console.log(`[PromptService] Built comprehensive memory context for user ${userId} in long-form generation (${memoryContext.length} chars)`);
      } catch (error) {
        console.error(`[PromptService] Error building memory context for user ${userId} in long-form generation:`, error);
      }
    }

    const systemPrompt = `You are an expert assistant that generates comprehensive, detailed responses.${globalContext}${memoryContext}

When generating long-form content:
- Provide thorough, detailed explanations
- Use proper formatting with headers, bullet points, and paragraphs
- If your response is interrupted, continue from where you left off
- Do not repeat previous content
- Aim to provide the full requested length or detail level`;

    let allContent = '';
    let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    let maxLoops = 5;
    let lastResponse = '';

    do {
      console.log(`[PromptService] Long-form generation loop ${6 - maxLoops}/5`);
      
      try {
        // Use OpenAI chat completion directly for better control
        const completion = await this.openaiService['openai'].chat.completions.create({
          model: 'gpt-4-1106-preview',
          messages: messages,
          temperature: 0.3,
          max_tokens: 4096, // High token limit for long outputs
        });

        const content = completion.choices[0]?.message?.content || '';
        const finishReason = completion.choices[0]?.finish_reason;
        
        console.log(`[PromptService] Generated ${content.length} characters, finish_reason: ${finishReason}`);
        
        if (content) {
          allContent += (allContent ? '\n\n' : '') + content;
          lastResponse = content;
          
          // Add to conversation history for continuation
          messages.push({ role: 'assistant', content });
          messages.push({ 
            role: 'user', 
            content: 'Continue from where you left off. Do not repeat any previous content. Provide the next section of the detailed explanation.' 
          });
        }

        // Stop if the model indicates it's complete or we've reached the limit
        if (finishReason === 'stop' || content.length < 100) {
          console.log('[PromptService] Long-form generation complete');
          break;
        }

      } catch (error) {
        console.error('[PromptService] Error in long-form generation loop:', error);
        break;
      }

      maxLoops--;
    } while (maxLoops > 0);

    // Extract a title from the prompt or content
    const titleMatch = prompt.match(/(?:explain|breakdown|analysis|overview)\s+(?:of\s+)?(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Detailed Analysis';

    return {
      intent: `Provide a comprehensive ${title}`,
      blocks: [
        {
          type: 'text',
          title: title,
          config: { markdown: true },
          data: { content: allContent || 'No content generated' },
          position: 0,
        },
      ],
      description: undefined,
    };
  }

  // Helper to infer the best block type from block data
  private inferBlockTypeFromData(block: any): string {
    if (!block || !block.data) return block.type;
    const data = block.data;
    // Table: has rows (array of objects)
    if (Array.isArray(data.rows) && data.rows.length > 0 && typeof data.rows[0] === 'object') return 'table';
    // Chart: has rows and config.type is bar/line/pie
    if (Array.isArray(data.rows) && block.config && typeof block.config.type === 'string' && ['bar','line','pie'].includes(block.config.type)) return 'chart';
    // Kanban: has cards and columns
    if (Array.isArray(data.cards) && block.config && Array.isArray(block.config.columns)) return 'kanban';
    // Calendar: has events (array with date fields)
    if (Array.isArray(data.events) && data.events.some(e => e.date)) return 'calendar';
    // Timeline: has events (array with date fields) and block type is timeline
    if (Array.isArray(data.events) && block.type === 'timeline') return 'timeline';
    // Task-list: has tasks (array)
    if (Array.isArray(data.tasks)) return 'task-list';
    // Note: has text
    if (typeof data.text === 'string') return 'note';
    // Status: has status
    if (typeof data.status === 'string') return 'status';
    // Agent: has instructions
    if (typeof data.instructions === 'string') return 'agent';
    // Jot: has jot
    if (typeof data.jot === 'string') return 'jot';
    // Select: has options
    if (Array.isArray(data.options)) return 'select';
    // Default: text
    return block.type;
  }

  private validateAndSanitizeResponse(
    response: any,
  ): InterpretPromptResponse {
    // Ensure required fields exist
    if (!response.intent || !Array.isArray(response.blocks)) {
      throw new Error('Invalid response format');
    }
    // Validate and sanitize blocks
    const validBlockTypes = [
      'text', 'table', 'chart', 'task-list', 'kanban', 'calendar',
      'timeline', 'note', 'select', 'status', 'jot', 'agent'
    ];
    // Filter blocks to only include meaningful, non-empty blocks
    const filteredBlocks = response.blocks.filter((block: any) => {
      if (block.type === 'text') {
        return block.data && typeof block.data.content === 'string' && block.data.content.trim().length > 0;
      }
      if (block.type === 'table') {
        return block.data && 
               Array.isArray(block.data.columns) && 
               Array.isArray(block.data.rows) && 
               block.data.columns.length > 0 && 
               block.data.rows.length > 0;
      }
      if (block.type === 'chart') {
        return block.config && block.config.type && Array.isArray(block.config.labels) && Array.isArray(block.config.datasets) && block.config.datasets.length > 0;
      }
      if (block.type === 'timeline') {
        return block.data && Array.isArray(block.data.events) && block.data.events.length > 0;
      }
      if (block.type === 'task-list') {
        return block.data && Array.isArray(block.data.tasks) && block.data.tasks.length > 0;
      }
      if (block.type === 'kanban') {
        return block.data && Array.isArray(block.data.cards) && block.data.cards.length > 0;
      }
      if (block.type === 'calendar') {
        return block.data && Array.isArray(block.data.events) && block.data.events.length > 0;
      }
      if (block.type === 'note') {
        return block.data && typeof block.data.text === 'string' && block.data.text.trim().length > 0;
      }
      if (block.type === 'status') {
        return block.data && typeof block.data.status === 'string' && block.data.status.trim().length > 0;
      }
      if (block.type === 'agent') {
        return block.data && typeof block.data.instructions === 'string' && block.data.instructions.trim().length > 0;
      }
      return false;
    });
    // If only text blocks remain, and the prompt is a summary/explanation, only keep the first text block
    let finalBlocks = filteredBlocks;
    if (filteredBlocks.length > 1 && filteredBlocks.every(b => b.type === 'text')) {
      finalBlocks = [filteredBlocks[0]];
    }
    response.blocks = finalBlocks;
    return {
      intent: response.intent,
      blocks: response.blocks,
      description: response.description,
    };
  }

  async generateBlockSuggestions(
    existingBlocks: BlockInstruction[],
    context: string,
  ): Promise<BlockInstruction[]> {
    const promptTemplate = PromptTemplate.fromTemplate(`
Based on the existing blocks in a workspace, suggest 3-5 additional blocks that would complement the current setup.

Existing blocks:
{existingBlocks}

Context: {context}

Suggest blocks that would enhance the workspace functionality. Respond with a JSON array of block objects.
Each block should have: type, title, config, data (optional), and position.

Available block types: text, table, chart, task-list, kanban, calendar, timeline, note, select, status, jot, agent
`);

    const chain = new LLMChain({
      llm: this.llm,
      prompt: promptTemplate,
    });

    try {
      const result = await chain.call({
        existingBlocks: JSON.stringify(existingBlocks, null, 2),
        context,
      });

      const content = result.text.trim();
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i) || 
                       content.match(/\[([\s\S]*?)\]/);
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      
      const suggestions = JSON.parse(jsonString);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Error generating block suggestions:', error);
      return [];
    }
  }

  private ruleBasedParse(prompt: string): InterpretPromptResponse {
    const layoutType = this.detectLayoutType(prompt);
    const blocks = this.buildBlocksForLayout(layoutType, prompt);
    return {
      intent: `Rule-based: ${layoutType} layout`,
      blocks,
    };
  }

  private detectLayoutType(prompt: string): string {
    const p = prompt.toLowerCase();
    if (p.includes('crm')) return 'crm';
    if (p.includes('project')) return 'project';
    if (p.includes('calendar')) return 'calendar';
    if (p.includes('analytics') || p.includes('chart')) return 'analytics';
    if (p.includes('finance')) return 'finance';
    if (p.includes('note')) return 'notes';
    if (p.includes('form')) return 'form';
    if (p.includes('timeline')) return 'timeline';
    if (p.includes('kanban')) return 'kanban';
    return 'dashboard';
  }

  private buildBlocksForLayout(type: string, prompt: string): BlockInstruction[] {
    switch (type) {
      case 'crm':
        return [
          { type: 'text', title: 'CRM Dashboard', config: { markdown: true }, data: { content: '# CRM Dashboard\nWelcome to your CRM workspace!' }, position: 0 },
          { type: 'table', title: 'Contacts', config: { columns: [ { key: 'name', label: 'Name', type: 'text' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'company', label: 'Company', type: 'text' }, { key: 'status', label: 'Status', type: 'select', options: ['Lead', 'Prospect', 'Customer'] } ], sortable: true, filterable: true }, data: { rows: [ { name: 'John Doe', email: 'john@example.com', company: 'Acme Corp', status: 'Customer' }, { name: 'Jane Smith', email: 'jane@globex.com', company: 'Globex', status: 'Lead' } ] }, position: 1 },
          { type: 'kanban', title: 'Sales Pipeline', config: { columns: [ { id: 'leads', title: 'Leads', color: '#e3f2fd' }, { id: 'qualified', title: 'Qualified', color: '#f3e5f5' }, { id: 'proposal', title: 'Proposal', color: '#fff3e0' }, { id: 'closed', title: 'Closed', color: '#e8f5e8' } ] }, data: { cards: [ { id: '1', title: 'Acme Corp Deal', column: 'qualified', value: '$50,000' }, { id: '2', title: 'Globex Deal', column: 'leads', value: '$10,000' } ] }, position: 2 },
          { type: 'calendar', title: 'Upcoming Events', config: {}, data: { events: [ { title: 'Sprint Planning', date: '2024-06-10' }, { title: 'Demo Day', date: '2024-06-20' } ] }, position: 3 },
          { type: 'chart', title: 'Revenue by Month', config: { type: 'bar', xKey: 'month', yKey: 'revenue' }, data: { rows: [ { month: 'Jan', revenue: 10000 }, { month: 'Feb', revenue: 12000 } ] }, position: 4 },
          { type: 'task-list', title: 'To-Do List', config: {}, data: { tasks: [ { id: '1', text: 'Follow up with Acme Corp', completed: false }, { id: '2', text: 'Prepare proposal for Globex', completed: true } ] }, position: 5 },
          { type: 'note', title: 'Quick Note', config: {}, data: { text: 'Remember to check in with the sales team.' }, position: 6 },
          { type: 'status', title: 'Current Status', config: {}, data: { status: 'Active' }, position: 7 },
          { type: 'agent', title: 'AI Assistant', config: {}, data: { instructions: 'Ask me anything about your CRM data.' }, position: 8 },
        ];
      case 'project':
        return [
          { type: 'project', title: 'Project Dashboard', config: {}, data: {}, position: 0 },
          { type: 'kanban', title: 'Project Tasks', config: { columns: [ { title: 'Backlog' }, { title: 'In Progress' }, { title: 'Review' }, { title: 'Done' } ] }, data: { cards: [ { id: '1', title: 'Design UI', column: 'Backlog' }, { id: '2', title: 'API Integration', column: 'In Progress' } ] }, position: 1 },
          { type: 'timeline', title: 'Project Timeline', config: {}, data: { events: [ { title: 'Kickoff', date: '2024-06-01' }, { title: 'Launch', date: '2024-07-01' } ] }, position: 2 },
        ];
      case 'calendar':
        return [
          { type: 'calendar', title: 'Team Calendar', config: {}, data: { events: [ { title: 'Sprint Planning', date: '2024-06-10' }, { title: 'Demo Day', date: '2024-06-20' } ] }, position: 0 },
        ];
      case 'analytics':
        return [
          { type: 'analytics', title: 'Executive Analytics', config: {}, data: {}, position: 0 },
          { type: 'chart', title: 'Website Traffic', config: { type: 'line', xKey: 'date', yKey: 'visits' }, data: { rows: [ { date: '2024-06-01', visits: 120 }, { date: '2024-06-02', visits: 150 } ] }, position: 1 },
          { type: 'table', title: 'Top Pages', config: { columns: [ { key: 'page', label: 'Page', type: 'text' }, { key: 'views', label: 'Views', type: 'number' } ] }, data: { rows: [ { page: '/home', views: 1000 }, { page: '/pricing', views: 800 } ] }, position: 2 },
        ];
      case 'finance':
        return [
          { type: 'finance', title: 'Finance Hub', config: {}, data: {}, position: 0 },
          { type: 'chart', title: 'Revenue Over Time', config: { type: 'bar', xKey: 'month', yKey: 'revenue' }, data: { rows: [ { month: 'Jan', revenue: 10000 }, { month: 'Feb', revenue: 12000 } ] }, position: 1 },
          { type: 'table', title: 'Expenses', config: { columns: [ { key: 'category', label: 'Category', type: 'text' }, { key: 'amount', label: 'Amount', type: 'text' } ] }, data: { rows: [ { category: 'Salaries', amount: '$8,000' }, { category: 'Marketing', amount: '$2,000' } ] }, position: 2 },
        ];
      case 'hr':
        return [
          { type: 'hr', title: 'HR Workspace', config: {}, data: {}, position: 0 },
          { type: 'table', title: 'Employee Directory', config: { columns: [ { key: 'name', label: 'Name', type: 'text' }, { key: 'role', label: 'Role', type: 'text' }, { key: 'status', label: 'Status', type: 'text' } ] }, data: { rows: [ { name: 'Sarah Chen', role: 'Designer', status: 'Active' }, { name: 'Alex Rivera', role: 'Developer', status: 'Away' } ] }, position: 1 },
        ];
      case 'revenue':
        return [
          { type: 'revenue', title: 'Revenue Forecast', config: {}, data: {}, position: 0 },
          { type: 'chart', title: 'Revenue Growth', config: { type: 'line', xKey: 'month', yKey: 'revenue' }, data: { rows: [ { month: 'Jan', revenue: 10000 }, { month: 'Feb', revenue: 12000 } ] }, position: 1 },
        ];
      case 'agent':
        return [
          { type: 'agent', title: 'Agent Activity Feed', config: {}, data: {}, position: 0 },
        ];
      case 'marketing':
        return [
          { type: 'marketing', title: 'Marketing Dashboard', config: {}, data: {}, position: 0 },
        ];
      case 'sales':
        return [
          { type: 'sales', title: 'Sales Pipeline Tracker', config: {}, data: {}, position: 0 },
        ];
      case 'support':
        return [
          { type: 'support', title: 'Customer Support Inbox', config: {}, data: {}, position: 0 },
        ];
      case 'product':
        return [
          { type: 'product', title: 'Product Management Hub', config: {}, data: {}, position: 0 },
        ];
      case 'timeline':
        return [
          { type: 'timeline', title: 'Project Timeline', config: {}, data: { events: [ { title: 'Kickoff', date: '2024-06-01' }, { title: 'Launch', date: '2024-07-01' } ] }, position: 0 },
        ];
      case 'kanban':
        return [
          { type: 'kanban', title: 'Kanban Board', config: { columns: [ { title: 'Todo' }, { title: 'Doing' }, { title: 'Done' } ] }, data: { cards: [ { id: '1', title: 'Design', column: 'Todo' }, { id: '2', title: 'Build', column: 'Doing' } ] }, position: 0 },
        ];
      case 'task-list':
        return [
          { type: 'task-list', title: 'Task List', config: {}, data: { tasks: [ { id: '1', text: 'First Task', completed: false }, { id: '2', text: 'Second Task', completed: true } ] }, position: 0 },
        ];
      case 'status':
        return [
          { type: 'status', title: 'Status Block', config: {}, data: { status: 'Active' }, position: 0 },
        ];
      case 'notes':
        return [
          { type: 'note', title: 'Quick Notes', config: {}, data: { text: 'Remember to follow up with Acme Inc.' }, position: 0 },
        ];
      case 'text':
        return [
          { type: 'text', title: 'Text Block', config: { markdown: true }, data: { content: 'This is a text block.' }, position: 0 },
        ];
      default:
        return [
          { type: 'text', title: 'Welcome', config: { markdown: true }, data: { content: 'This is your smart canvas. Start building!' }, position: 0 },
        ];
    }
  }

  private buildSmartInsights(
    intentAnalysis: IntentAnalysis,
    dataPattern?: DataPattern,
    blockRecommendations: BlockRecommendation[] = []
  ): string {
    let insights = `Based on the smart analysis:

1. **Primary Intent**: ${intentAnalysis.primaryIntent}
2. **Data Requirements**: ${intentAnalysis.dataRequirements.join(', ') || 'None detected'}
3. **Visualization Needs**: ${intentAnalysis.visualizationNeeds.join(', ') || 'None detected'}
4. **Data Pattern**: ${dataPattern ? `${dataPattern.type} (confidence: ${dataPattern.confidence})` : 'No specific data pattern detected'}
5. **Block Recommendations**: ${blockRecommendations.map(b => `${b.type} (${b.confidence})`).join(', ') || 'None'}

Use these insights to guide your block generation decisions.`;

    return insights;
  }

  private async applySmartDetectionEnhancements(
    response: InterpretPromptResponse,
    intentAnalysis: IntentAnalysis,
    dataPattern: DataPattern | undefined,
    blockRecommendations: BlockRecommendation[],
    extractedData: any
  ): Promise<InterpretPromptResponse> {
    // Add smart analysis to the response
    response.smartAnalysis = {
      intent: intentAnalysis,
      dataPattern,
      recommendations: blockRecommendations
    };

    // If we have high-confidence recommendations and no blocks were generated,
    // or if the LLM generated blocks that don't match our recommendations well,
    // we can enhance the response
    if (blockRecommendations.length > 0 && response.blocks.length === 0) {
      // Use the highest confidence recommendation
      const bestRecommendation = blockRecommendations[0];
      if (bestRecommendation.confidence > 0.8) {
        response.blocks.push({
          type: bestRecommendation.type,
          title: `Smart ${bestRecommendation.type.charAt(0).toUpperCase() + bestRecommendation.type.slice(1)}`,
          config: bestRecommendation.config,
          data: bestRecommendation.suggestedData,
          position: 0
        });
      }
    }

    // Special handling for table requests that weren't fulfilled
    if (intentAnalysis.visualizationNeeds.includes('table') && 
        intentAnalysis.dataRequirements.includes('tabular') &&
        !response.blocks.some(block => block.type === 'table')) {
      
      // Force create a table block for high-confidence table requests
      const tableRecommendation = blockRecommendations.find(rec => rec.type === 'table');
      if (tableRecommendation && tableRecommendation.confidence > 0.7) {
        // Remove any text blocks that might have been created instead
        response.blocks = response.blocks.filter(block => block.type !== 'text');
        
        // Add the table block
        response.blocks.push({
          type: 'table',
          title: 'Data Table',
          config: { sortable: true, filterable: true },
          data: tableRecommendation.suggestedData || {
            columns: [
              { key: 'item', label: 'Item', type: 'text' },
              { key: 'description', label: 'Description', type: 'text' },
              { key: 'category', label: 'Category', type: 'select' }
            ],
            rows: [
              { item: 'Sample Item', description: 'Sample description', category: 'General' }
            ]
          },
          position: 0
        });
      }
    }

    // Transform data for existing blocks if we have extracted data
    if (extractedData && response.blocks.length > 0) {
      for (const block of response.blocks) {
        if (block.data && typeof block.data === 'object') {
          // Try to enhance the block data using smart detection
          const enhancedData = this.smartDetectionService.transformDataForBlock(
            extractedData,
            block.type
          );
          if (enhancedData) {
            block.data = { ...block.data, ...enhancedData };
          }
        }
      }
    }

    return response;
  }
} 