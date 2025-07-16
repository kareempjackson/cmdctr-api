import { Injectable, Logger } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { ConfigService } from '../config/config.service';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeEntryStatus } from '../knowledge/dto/knowledge.dto';
import { SmartDetectionService, IntentAnalysis, DataPattern, BlockRecommendation, EnhancedBlockRecommendation, SmartCanvasContext } from './smart-detection.service';
import { EnhancedKnowledgeIntegrationService, KnowledgeContext } from '../knowledge/enhanced-knowledge-integration.service';
import { PatternInferenceService } from '../knowledge/pattern-inference.service';
import { PredictiveAnalyticsService, ForecastResult, PredictiveInsight } from '../analytics/predictive-analytics.service';
import { NaturalLanguageQueryService } from '../analytics/natural-language-query.service';
import { AIInsightsService } from '../analytics/ai-insights.service';
import { DashboardOptimizationService } from '../analytics/dashboard-optimization.service';
import { jsonrepair } from 'jsonrepair';

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
    knowledgeContext?: {
      relevantEntries: number;
      structuredData: number;
      insights: any;
    };
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
    private readonly enhancedKnowledgeService: EnhancedKnowledgeIntegrationService,
    private readonly patternInferenceService: PatternInferenceService,
    private readonly predictiveAnalyticsService: PredictiveAnalyticsService,
    private readonly naturalLanguageQueryService: NaturalLanguageQueryService,
    private readonly aiInsightsService: AIInsightsService,
    private readonly dashboardOptimizationService: DashboardOptimizationService,
  ) {
    this.llm = new ChatOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      modelName: 'gpt-4o',
      temperature: 0.3,
    });
  }

  async interpretPrompt(
    prompt: string,
    workspaceId: string,
    userId: string,
    opts?: { deterministic?: boolean }
  ): Promise<InterpretPromptResponse> {
    // --- A. Prompt Engineering ---
    let engineeredPrompt = prompt;
    if (/table|breakdown|list|rows|columns|spreadsheet|csv/i.test(prompt)) {
      engineeredPrompt = `IMPORTANT: Output valid JSON only. Limit the table to 5 rows for preview. If the output is too long, stop after 5 rows and add a field "truncated": true at the root. Do not include any explanation or markdown, just the JSON.` + '\n' + prompt;
    }
    // ... rest of method, replace 'prompt' with 'engineeredPrompt' in LLM calls ...

    // Step 1: Smart Intent Analysis
    const intentAnalysis = this.smartDetectionService.analyzeIntent(engineeredPrompt);
    console.log('[PromptService] Smart intent analysis:', intentAnalysis);

    // Step 2: Check if this is a long-form request
    const isLongFormRequest = this.isLongFormRequest(engineeredPrompt);
    
    if (isLongFormRequest) {
      const longFormResult = await this.generateLongTextBlock(engineeredPrompt, workspaceId, userId, opts);
      // Add smart analysis to long-form results
      longFormResult.smartAnalysis = {
        intent: intentAnalysis,
        recommendations: []
      };
      return longFormResult;
    }

    // Step 3: Extract structured data from prompt if present
    const extractedData = this.smartDetectionService.extractStructuredData(engineeredPrompt);
    let dataPattern: DataPattern | undefined;
    let blockRecommendations: EnhancedBlockRecommendation[] = [];

    // Create smart canvas context for enhanced recommendations
    const smartContext: SmartCanvasContext = {
      workspaceId,
      userId,
      collaborationLevel: this.detectCollaborationLevel(engineeredPrompt),
      workspaceType: this.detectWorkspaceType(engineeredPrompt, intentAnalysis)
    };

    if (extractedData) {
      console.log('[PromptService] Extracted structured data:', extractedData);
      dataPattern = this.smartDetectionService.analyzeDataStructure(extractedData);
      
      // Enhanced data quality assessment
      const dataQuality = this.smartDetectionService['assessDataQuality'](extractedData);
      dataPattern.metadata.dataQuality = dataQuality;
      
      blockRecommendations = this.smartDetectionService.generateBlockRecommendations(
        intentAnalysis,
        dataPattern,
        extractedData,
        smartContext
      );
      console.log('[PromptService] Enhanced smart block recommendations:', blockRecommendations);
    } else {
      // Generate recommendations even without extracted data
      blockRecommendations = this.smartDetectionService.generateBlockRecommendations(
        intentAnalysis,
        { type: 'textual', confidence: 0.3, structure: null, metadata: { complexity: 'simple', dataQuality: 'low' } },
        undefined,
        smartContext
      );
    }

    // Generate smart block combinations for complex requests
    const smartCombinations = this.smartDetectionService['generateSmartBlockCombinations'](intentAnalysis, dataPattern || { type: 'textual', confidence: 0.3, structure: null, metadata: {} });
    console.log('[PromptService] Smart block combinations:', smartCombinations);

    // Extract contextual insights
    const contextualInsights = this.smartDetectionService['extractContextualInsights'](engineeredPrompt, intentAnalysis);
    console.log('[PromptService] Contextual insights:', contextualInsights);

    // Step 4: Enhanced knowledge base context with structured data extraction
    let globalContext = '';
    let knowledgeContext: KnowledgeContext | undefined;
    
    if (engineeredPrompt && workspaceId) {
      try {
        // Use enhanced knowledge integration service
        knowledgeContext = await this.enhancedKnowledgeService.getEnhancedKnowledgeContext(
          engineeredPrompt,
          workspaceId,
          5 // Get top 5 most relevant entries
        );
        
        if (knowledgeContext.relevantEntries.length > 0) {
          globalContext = '\nEnhanced Knowledge Base Context:';
          
          // Add relevant entries
          for (const entry of knowledgeContext.relevantEntries) {
            globalContext += `\n- ${entry.title} (relevance: ${entry.relevanceScore.toFixed(2)})`;
            if (entry.content) {
              globalContext += `\n  Content: ${entry.content.slice(0, 300)}...`;
            }
          }
          
          // Add structured data insights
          if (knowledgeContext.structuredData.length > 0) {
            globalContext += '\n\nStructured Data Available:';
            for (const data of knowledgeContext.structuredData) {
              globalContext += `\n- ${data.type} data (confidence: ${data.confidence.toFixed(2)})`;
              if (data.metadata.rowCount) {
                globalContext += ` with ${data.metadata.rowCount} rows, ${data.metadata.columnCount} columns`;
              }
              if (data.suggestions.blockTypes.length > 0) {
                globalContext += `\n  Suggested blocks: ${data.suggestions.blockTypes.join(', ')}`;
              }
            }
          }
          
          // Add insights
          if (knowledgeContext.insights.dataPatterns.length > 0) {
            globalContext += '\n\nData Patterns: ' + knowledgeContext.insights.dataPatterns.join(', ');
          }
          if (knowledgeContext.insights.recommendations.length > 0) {
            globalContext += '\nRecommendations: ' + knowledgeContext.insights.recommendations.join(', ');
          }
        }
      } catch (error) {
        console.error('[PromptService] Error getting enhanced knowledge context:', error);
        // Fallback to basic knowledge search
        await this.knowledgeService.weaviateService.initWorkspaceMemory(workspaceId);
        const queryEmbedding = await this.openaiService.generateEmbedding(engineeredPrompt);
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
    }

    // Build comprehensive memory context for the user if userId is provided
    let memoryContext = '';
    if (userId) {
      try {
        // Use the user's ID as the agent ID for memory retrieval
        memoryContext = await this.knowledgeService.weaviateService.buildComprehensiveMemoryContext(userId, engineeredPrompt);
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
- For implementation plans, progress tracking, or "practice/apply" scenarios, ALWAYS use a Kanban board as the primary block
- For planning scenarios, prefer Kanban boards over tables when progress tracking is involved
- Only use 'text' blocks for general explanations, summaries, or narrative content when no structured data is needed
- If the user explicitly requests a table, chart, timeline, or other structured visualization, create that specific block type

BLOCK TYPE SELECTION GUIDELINES:
- Kanban boards: Use ONLY for actual project management, task tracking, implementation plans, or workflow management where items move through stages. DO NOT use for informational requests about workflows, processes, or general explanations.
- Tables: Use for data display, analysis, reference information, and structured data presentation
- Charts: Use for numerical analysis and data visualization
- Task lists: Use for actionable items and to-do lists
- Timelines: Use for chronological planning and event sequences
- Text blocks: Use for explanations, context, narrative content, and informational responses

KANBAN USAGE RULES:
- Use Kanban ONLY when the user wants to track progress, manage tasks, or implement a plan
- DO NOT use Kanban for informational requests like "what are the technical workflows?" or "explain the process"
- For informational requests about workflows, processes, or systems, use text blocks or tables instead
- Kanban is for ACTION, not INFORMATION

{globalContext}

{memoryContext}

User prompt: {prompt}

Generate a JSON response with the following structure:
{{
  "intent": "Brief description of what the user wants",
  "blocks": [
    {{
      "type": "text|chart|table|timeline|task-list|kanban|calendar|note|select|status|jot|agent|embed",
      "title": "Block title",
      "config": {{}},
      "data": {{
        "content": "For text blocks, put the content here",
        "text": "For note blocks",
        "status": "For status blocks",
        "tasks": [{{"id": "1", "text": "Task description", "completed": false}}],
        "events": [{{"title": "Event", "description": "Description", "timestamp": "Date"}}],
        "instructions": "For agent blocks",
        "url": "For embed blocks, the URL to embed",
        "embedType": "For embed blocks, the type (youtube|vimeo|twitter|instagram|iframe|video)",
        "columns": [{{"key": "col1", "label": "Column 1", "type": "text"}}],
        "rows": [{{"col1": "Sample data"}}],
        "columns": [
          {{
            "id": "backlog",
            "title": "Backlog",
            "color": "#e3f2fd",
            "items": [
              {{
                "id": "1",
                "title": "Task title",
                "description": "Task description",
                "tag": "Feature",
                "assignee": "John Doe",
                "priority": "medium",
                "dueDate": "2024-01-15"
              }}
            ]
          }}
        ]
      }},
      "position": 0
    }}
  ]
}}

IMPORTANT: When creating tables, charts, or other data blocks, generate ACTUAL data that matches the user's request. Do not use placeholder text like "Sample data" or comments like "// ... Additional rows". Instead, create realistic, complete data that the user can immediately use. For example, if asked for "48 laws of power", create a table with all 48 laws with real titles and descriptions.

For implementation plans and project management ONLY, use a Kanban board with appropriate columns like "Not Started", "In Progress", "Completed", etc. For informational requests about workflows, processes, or systems, use text blocks or tables instead.
`);

    const chain = new LLMChain({
      llm: this.llm,
      prompt: promptTemplate,
    });

    try {
      const result = await chain.call({
        prompt: engineeredPrompt,
        workspaceId,
        globalContext,
        memoryContext,
        smartInsights,
      });

      // Log the raw LLM response
      console.log('[PromptService] Raw LLM response:', result.text);

      // Parse the JSON response
      const content = result.text.trim();
      let parsedResponse: InterpretPromptResponse | null = null;
      let jsonString: string = '';

      try {
        // Robust JSON extraction from LLM response
        jsonString = this.extractJSONFromLLMResponse(content);
        
        // Clean the JSON string to handle common LLM formatting issues
        jsonString = this.cleanJSONString(jsonString);
        
        console.log('[PromptService] Cleaned JSON string:', jsonString);
        
        parsedResponse = JSON.parse(jsonString);
        console.log('[PromptService] Successfully parsed JSON response:', JSON.stringify(parsedResponse, null, 2));
      } catch (parseError) {
        console.error('[PromptService] JSON parsing failed:', parseError);
        console.error('[PromptService] Failed JSON string:', jsonString);
        
        // 1) Balance braces/brackets
        if (!parsedResponse) {
          const repairedStr = this.repairJsonString(jsonString || content);
          if (repairedStr) {
            try {
              parsedResponse = JSON.parse(repairedStr);
              console.log('[PromptService] Parsed after brace-balance repair');
            } catch {}
          }
        }

        // 2) jsonrepair library
        if (!parsedResponse) {
          try {
            const repaired = jsonrepair(jsonString || content);
            parsedResponse = JSON.parse(repaired);
            console.log('[PromptService] Parsed after jsonrepair');
          } catch (jrErr) {
            console.error('[PromptService] jsonrepair failed:', jrErr.message);
          }
        }

        // 3) Truncation strategy (remove tail after last closing brace)
        if (!parsedResponse) {
          const truncParsed = this.tryParseWithTruncation(jsonString || content);
          if (truncParsed) {
            parsedResponse = truncParsed;
            console.log('[PromptService] Parsed after truncation strategy');
          }
        }

        // 4) Aggressive extraction of any valid inner object
        if (!parsedResponse) {
          try {
            const aggressiveExtraction = this.extractJSONAggressively(content);
            if (aggressiveExtraction) {
              parsedResponse = aggressiveExtraction;
              console.log('[PromptService] Parsed with aggressive extraction');
            }
          } catch (aggressiveError) {
            console.error('[PromptService] Aggressive extraction failed:', aggressiveError);
          }
        }

        // 5) Absolute fallback – single text block
        if (!parsedResponse) {
          parsedResponse = {
            intent: 'Create a workspace based on user request',
            blocks: [
              {
                type: 'text',
                title: 'User Request',
                config: { markdown: true },
                data: { content: `# User Request\n\n${engineeredPrompt}` },
                position: 0,
              },
            ],
          };
          console.log('[PromptService] Falling back to single text block');
        }
      }

      // Step 6: Apply smart detection enhancements
      const enhancedResponse = await this.applySmartDetectionEnhancements(
        parsedResponse!,
        intentAnalysis,
        dataPattern,
        blockRecommendations,
        extractedData,
        knowledgeContext
      );

      // Validate and sanitize the response
      return await this.validateAndSanitizeResponse(enhancedResponse);
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
            data: { content: `# Getting Started\n\n${engineeredPrompt}` },
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

  /**
   * Detect whether the user explicitly requests a very long / high-word-count answer.
   * We intentionally keep this detector conservative so that ordinary prompts such as
   * "give me a detailed breakdown of Q3 revenue" are processed through the normal
   * multi-block workflow.  Only when the prompt contains an explicit *length* signal
   * (e.g. "Write 2,000 words…", "at least 10 pages…", "very long essay…") do we
   * treat it as long-form.
   */
  private isLongFormRequest(prompt: string): boolean {
    if (!prompt) return false;

    const explicitWordCount = /\b(?:\d{3,})\s*words?\b/i; // e.g. 500 words, 2000 words
    const explicitPageCount = /\b(?:\d+)\s*pages?\b/i;   // e.g. 3 pages
    const longEssayPhrases = /\b(?:very\s+long|extensive|in-depth|full-length)\s+(?:essay|response|answer|explanation)\b/i;

    return (
      explicitWordCount.test(prompt) ||
      explicitPageCount.test(prompt) ||
      longEssayPhrases.test(prompt)
    );
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
          model: 'gpt-4o',
          messages: messages,
          temperature: 0.3,
          max_tokens: 8192, // Increased token limit for 4o
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

  private async validateAndSanitizeResponse(
    response: any,
  ): Promise<InterpretPromptResponse> {
    // Ensure required fields exist
    if (!response.intent || !Array.isArray(response.blocks)) {
      throw new Error('Invalid response format');
    }
    
    console.log('[PromptService] Validating blocks:', JSON.stringify(response.blocks, null, 2));
    
    // Validate and sanitize blocks
    const validBlockTypes = [
      'text', 'table', 'chart', 'task-list', 'kanban', 'calendar',
      'timeline', 'note', 'select', 'status', 'jot', 'agent', 'embed',
      'image', 'list', 'column', 'smart-notes-sticky', 'custom'
    ];
    
    // Filter blocks to only include meaningful, non-empty blocks
    const filteredBlocks = response.blocks.filter((block: any) => {
      console.log(`[PromptService] Validating block type: ${block.type}`);
      
      if (block.type === 'text') {
        const isValid = block.data && typeof block.data.content === 'string' && block.data.content.trim().length > 0;
        console.log(`[PromptService] Text block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'table') {
        const hasColumns = (block.data && Array.isArray(block.data.columns) && block.data.columns.length > 0) ||
                          (block.config && Array.isArray(block.config.columns) && block.config.columns.length > 0);
        if (hasColumns) {
          if (!block.data) block.data = {};
          if (!Array.isArray(block.data.rows)) block.data.rows = [];
          return true;
        }
        return false;
      }
      if (block.type === 'chart') {
        // Check multiple possible chart data formats
        const hasDataInData = block.data && 
                             Array.isArray(block.data.labels) && 
                             Array.isArray(block.data.datasets) && 
                             block.data.datasets.length > 0;
        const hasDataInConfig = block.config && 
                               block.config.type && 
                               Array.isArray(block.config.labels) && 
                               Array.isArray(block.config.datasets) && 
                               block.config.datasets.length > 0;
        const hasSimpleData = block.data && 
                             Array.isArray(block.data.labels) && 
                             Array.isArray(block.data.data) && 
                             block.data.data.length > 0;
        const hasTypeAndData = block.data && 
                              block.data.type && 
                              Array.isArray(block.data.labels) && 
                              Array.isArray(block.data.data);
        
        const isValid = hasDataInData || hasDataInConfig || hasSimpleData || hasTypeAndData;
        console.log(`[PromptService] Chart block validation: ${isValid} (data: ${!!block.data}, config: ${!!block.config})`);
        return isValid;
      }
      if (block.type === 'timeline') {
        const isValid = block.data && Array.isArray(block.data.events) && block.data.events.length > 0;
        console.log(`[PromptService] Timeline block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'task-list') {
        const isValid = block.data && Array.isArray(block.data.tasks) && block.data.tasks.length > 0;
        console.log(`[PromptService] Task-list block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'kanban') {
        const isValid = block.data && 
               Array.isArray(block.data.columns) && 
               block.data.columns.length > 0 &&
               block.data.columns.some((col: any) => 
                 Array.isArray(col.items) && col.items.length > 0
               );
        console.log(`[PromptService] Kanban block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'calendar') {
        const isValid = block.data && Array.isArray(block.data.events) && block.data.events.length > 0;
        console.log(`[PromptService] Calendar block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'note') {
        const isValid = block.data && typeof block.data.text === 'string' && block.data.text.trim().length > 0;
        console.log(`[PromptService] Note block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'status') {
        const isValid = block.data && typeof block.data.status === 'string' && block.data.status.trim().length > 0;
        console.log(`[PromptService] Status block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'agent') {
        const isValid = block.data && typeof block.data.instructions === 'string' && block.data.instructions.trim().length > 0;
        console.log(`[PromptService] Agent block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'embed') {
        const isValid = block.data && 
               typeof block.data.url === 'string' && 
               block.data.url.trim().length > 0 &&
               typeof block.data.embedType === 'string' &&
               block.data.embedType.trim().length > 0;
        console.log(`[PromptService] Embed block validation: ${isValid}`);
        return isValid;
      }
      // For newly supported or custom block types, perform a light validation:
      if (['image'].includes(block.type)) {
        const isValid = (block.data && typeof block.data.url === 'string' && block.data.url.trim().length > 0) ||
                        (block.content && typeof block.content.url === 'string' && block.content.url.trim().length > 0);
        console.log(`[PromptService] Image block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'list') {
        const isValid = block.data && Array.isArray(block.data.items) && block.data.items.length > 0;
        console.log(`[PromptService] List block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'column') {
        const isValid = block.content && Array.isArray(block.content.columns) && block.content.columns.length > 0;
        console.log(`[PromptService] Column block validation: ${isValid}`);
        return isValid;
      }
      if (block.type === 'smart-notes-sticky') {
        const isValid = true; // Assume sticky notes are valid; frontend handles empty state
        return isValid;
      }
      if (block.type === 'custom') {
        const isValid = true;
        return isValid;
      }
      console.log(`[PromptService] Unknown block type: ${block.type}`);
      return false;
    });

    console.log(`[PromptService] Filtered blocks count: ${filteredBlocks.length}`);

    // Transform blocks to match frontend component expectations
    const transformedBlocks = filteredBlocks.map((block: any) => {
      // Transform chart blocks to match ChartBlock component expectations
      if (block.type === 'chart') {
        return this.transformChartBlock(block);
      }
      
      // Transform table blocks
      if (block.type === 'table') {
        return this.transformTableBlock(block);
      }
      
      // Transform kanban blocks
      if (block.type === 'kanban') {
        return this.transformKanbanBlock(block);
      }
      
      // Transform task-list blocks
      if (block.type === 'task-list') {
        return this.transformTaskListBlock(block);
      }
      
      // Transform calendar blocks
      if (block.type === 'calendar') {
        return this.transformCalendarBlock(block);
      }
      
      // Transform timeline blocks
      if (block.type === 'timeline') {
        return this.transformTimelineBlock(block);
      }
      
      // Transform note blocks
      if (block.type === 'note') {
        return this.transformNoteBlock(block);
      }
      
      // Transform status blocks
      if (block.type === 'status') {
        return this.transformStatusBlock(block);
      }
      
      // Transform agent blocks
      if (block.type === 'agent') {
        return this.transformAgentBlock(block);
      }
      
      // Transform embed blocks
      if (block.type === 'embed') {
        return this.transformEmbedBlock(block);
      }
      
      // For other block types, return as is
      return block;
    });

    // If only text blocks remain, and the prompt is a summary/explanation, only keep the first text block
    let finalBlocks = transformedBlocks;
    if (transformedBlocks.length > 1 && transformedBlocks.every(b => b.type === 'text')) {
      finalBlocks = [transformedBlocks[0]];
    }

    // --- E. Retry/Continue on Truncation ---
    const tableBlock = response.blocks.find((b: any) => b.type === 'table');
    if (tableBlock && (tableBlock.truncated || (tableBlock.data && tableBlock.data.truncated))) {
      try {
        const continuePrompt = `Continue the table rows in valid JSON array format, starting from row ${tableBlock.data?.rows?.length + 1 || 6}. Output only the next 10 rows as JSON array.`;
        // Use the same LLMChain as above for consistency
        const continuationResult = await new LLMChain({ llm: this.llm, prompt: PromptTemplate.fromTemplate('{prompt}') }).call({ prompt: continuePrompt });
        const moreRows = this.salvageRowsFromTruncatedArray(continuationResult.text);
        if (moreRows.length && tableBlock.data && Array.isArray(tableBlock.data.rows)) {
          tableBlock.data.rows.push(...moreRows);
          tableBlock.warning = 'Table was auto-continued from multiple LLM calls.';
          console.log('[PromptService] Appended rows from continuation:', moreRows.length);
        }
      } catch (err) {
        console.error('[PromptService] Error during LLM continuation for table rows:', err);
      }
    }

    // --- F. Fallback to Markdown Table if no valid table block ---
    if (finalBlocks.length === 0 && response.blocks.some((b: any) => b.type === 'table')) {
      // Try to salvage columns and rows for markdown
      const tableBlock = response.blocks.find((b: any) => b.type === 'table');
      const cols = tableBlock?.data?.columns || tableBlock?.config?.columns || [];
      const rows = tableBlock?.data?.rows || [];
      let md = '';
      if (cols.length) {
        md += '| ' + cols.map((c: any) => c.label).join(' | ') + ' |\n';
        md += '| ' + cols.map(() => '---').join(' | ') + ' |\n';
        for (const row of rows) {
          md += '| ' + cols.map((c: any) => row[c.key] ?? '').join(' | ') + ' |\n';
        }
      } else {
        md = 'Table could not be rendered.';
      }
      finalBlocks.push({
        type: 'text',
        title: 'Table (Markdown Fallback)',
        config: { markdown: true },
        data: { content: md },
        position: 0
      });
      console.log('[PromptService] Fallback to markdown table block.');
    }
    
    console.log(`[PromptService] Final blocks count: ${finalBlocks.length}`);
    console.log('[PromptService] Final blocks:', JSON.stringify(finalBlocks, null, 2));
    // --- G. Logging & Monitoring already present ---
    
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

Available block types: text, table, chart, task-list, kanban, calendar, timeline, note, select, status, jot, agent, embed
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
    extractedData: any,
    knowledgeContext?: KnowledgeContext
  ): Promise<InterpretPromptResponse> {
    console.log('[PromptService] Applying smart detection enhancements...');
    
    // Enhanced response with knowledge base structured data
    const enhancedBlocks = response.blocks.map(block => {
      let enhancedBlock = { ...block };
      
      // If we have knowledge base structured data, try to enhance the block
      if (knowledgeContext && knowledgeContext.structuredData.length > 0) {
        enhancedBlock = this.enhanceBlockWithKnowledgeData(enhancedBlock, knowledgeContext);
      }
      
      // Apply existing enhancements based on block type
      switch (block.type) {
        case 'table':
          enhancedBlock = this.enhanceTableData(enhancedBlock);
          break;
        case 'kanban':
          enhancedBlock = this.enhanceKanbanData(enhancedBlock);
          break;
        case 'chart':
          enhancedBlock = this.transformChartBlock(enhancedBlock);
          break;
        case 'task-list':
          enhancedBlock = this.transformTaskListBlock(enhancedBlock);
          break;
        case 'timeline':
          enhancedBlock = this.transformTimelineBlock(enhancedBlock);
          break;
        case 'calendar':
          enhancedBlock = this.transformCalendarBlock(enhancedBlock);
          break;
        case 'note':
          enhancedBlock = this.transformNoteBlock(enhancedBlock);
          break;
        case 'status':
          enhancedBlock = this.transformStatusBlock(enhancedBlock);
          break;
        case 'agent':
          enhancedBlock = this.transformAgentBlock(enhancedBlock);
          break;
        case 'embed':
          enhancedBlock = this.transformEmbedBlock(enhancedBlock);
          break;
      }
      
      return enhancedBlock;
    });

    return {
      ...response,
      blocks: enhancedBlocks,
      smartAnalysis: {
        intent: intentAnalysis,
        dataPattern,
        recommendations: blockRecommendations,
        knowledgeContext: knowledgeContext ? {
          relevantEntries: knowledgeContext.relevantEntries.length,
          structuredData: knowledgeContext.structuredData.length,
          insights: knowledgeContext.insights
        } : undefined
      }
    };
  }

  /**
   * Enhance block with knowledge base structured data
   */
  private enhanceBlockWithKnowledgeData(block: BlockInstruction, knowledgeContext: KnowledgeContext): BlockInstruction {
    // Find the most relevant structured data for this block type
    const relevantData = knowledgeContext.structuredData.find(data => 
      data.suggestions.blockTypes.includes(block.type)
    );
    
    if (!relevantData) return block;
    
    console.log(`[PromptService] Enhancing ${block.type} block with knowledge data:`, relevantData.type);
    
    switch (block.type) {
      case 'table':
        return this.enhanceTableWithKnowledgeData(block, relevantData);
      case 'chart':
        return this.enhanceChartWithKnowledgeData(block, relevantData);
      case 'kanban':
        return this.enhanceKanbanWithKnowledgeData(block, relevantData);
      default:
        return block;
    }
  }

  /**
   * Enhance table block with knowledge base data
   */
  private enhanceTableWithKnowledgeData(block: BlockInstruction, knowledgeData: any): BlockInstruction {
    if (knowledgeData.type === 'table' && knowledgeData.data.headers && knowledgeData.data.rows) {
      return {
        ...block,
        data: {
          ...block.data,
          columns: knowledgeData.data.headers.map((header: string, index: number) => ({
            key: `col_${index}`,
            label: header,
            type: knowledgeData.metadata.dataTypes[header] || 'text'
          })),
          rows: knowledgeData.data.rows.map((row: any) => {
            const enhancedRow: any = {};
            knowledgeData.data.headers.forEach((header: string, index: number) => {
              enhancedRow[`col_${index}`] = row[header] || '';
            });
            return enhancedRow;
          })
        },
        config: {
          ...block.config,
          sortable: true,
          filterable: true,
          source: `knowledge:${knowledgeData.metadata.source}`
        }
      };
    }
    return block;
  }

  /**
   * Enhance chart block with knowledge base data
   */
  private enhanceChartWithKnowledgeData(block: BlockInstruction, knowledgeData: any): BlockInstruction {
    if (knowledgeData.type === 'table' && knowledgeData.metadata.numericColumns && knowledgeData.metadata.numericColumns.length > 0) {
      const numericCol = knowledgeData.metadata.numericColumns[0];
      const labelCol = knowledgeData.data.headers.find((h: string) => h !== numericCol) || knowledgeData.data.headers[0];
      
      const labels = knowledgeData.data.rows.map((row: any) => row[labelCol]).slice(0, 10); // Limit to 10 items
      const data = knowledgeData.data.rows.map((row: any) => parseFloat(row[numericCol]) || 0).slice(0, 10);
      
      return {
        ...block,
        data: {
          ...block.data,
          labels,
          data,
          source: `knowledge:${knowledgeData.metadata.source}`
        },
        config: {
          ...block.config,
          type: 'bar',
          title: `Chart from ${knowledgeData.metadata.source}`,
          xAxisName: labelCol,
          yAxisName: numericCol
        }
      };
    }
    return block;
  }

  /**
   * Enhance kanban block with knowledge base data
   */
  private enhanceKanbanWithKnowledgeData(block: BlockInstruction, knowledgeData: any): BlockInstruction {
    if (knowledgeData.type === 'table' && knowledgeData.data.rows) {
      // Convert table data to kanban format
      const items = knowledgeData.data.rows.slice(0, 20).map((row: any, index: number) => ({
        id: `item_${index}`,
        title: Object.values(row)[0] || `Item ${index + 1}`,
        description: Object.values(row).slice(1).join(' - ') || '',
        tag: 'Knowledge',
        assignee: 'System',
        priority: 'medium',
        dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }));
      
      return {
        ...block,
        data: {
          ...block.data,
          columns: [
            {
              id: 'backlog',
              title: 'Backlog',
              color: '#e3f2fd',
              items: items.slice(0, Math.floor(items.length / 3))
            },
            {
              id: 'in-progress',
              title: 'In Progress',
              color: '#fff3e0',
              items: items.slice(Math.floor(items.length / 3), Math.floor(items.length * 2 / 3))
            },
            {
              id: 'completed',
              title: 'Completed',
              color: '#e8f5e8',
              items: items.slice(Math.floor(items.length * 2 / 3))
            }
          ]
        },
        config: {
          ...block.config,
          source: `knowledge:${knowledgeData.metadata.source}`
        }
      };
    }
    return block;
  }

  private enhanceTableData(block: BlockInstruction): BlockInstruction {
    if (!block.data || !block.data.rows || !block.data.columns) return block;

    const rows = block.data.rows;
    const columns = block.data.columns;
    
    // Check if this is a 48 laws of power table
    const is48LawsTable = block.title?.toLowerCase().includes('48 laws') || 
                         block.title?.toLowerCase().includes('laws of power') ||
                         (columns.length > 0 && columns.some(col => 
                           col.label?.toLowerCase().includes('law') || 
                           col.key?.toLowerCase().includes('law')
                         ));

    // Only enhance if we have NO data or completely empty data
    // Don't override valid LLM-generated data that might be a subset (like manipulation-related laws)
    const hasValidData = rows.length > 0 && rows.some(row => {
      return Object.values(row).some(value => 
        value && typeof value === 'string' && value.trim().length > 0
      );
    });

    if (is48LawsTable && !hasValidData) {
      console.log('[PromptService] Detected 48 laws table with no valid data, enhancing...');
      
      // Generate the 48 laws of power data
      const lawsOfPower = [
        { number: 1, title: "Never Outshine the Master", description: "Make those above you feel comfortably superior" },
        { number: 2, title: "Never Put Too Much Trust in Friends", description: "Learn how to use enemies" },
        { number: 3, title: "Conceal Your Intentions", description: "Keep people off-balance and in the dark" },
        { number: 4, title: "Always Say Less Than Necessary", description: "When you are trying to impress people with words" },
        { number: 5, title: "So Much Depends on Reputation", description: "Guard it with your life" },
        { number: 6, title: "Court Attention at All Cost", description: "Everything is judged by its appearance" },
        { number: 7, title: "Get Others to Do the Work for You", description: "But always take the credit" },
        { number: 8, title: "Make Other People Come to You", description: "Use bait if necessary" },
        { number: 9, title: "Win Through Your Actions", description: "Never through argument" },
        { number: 10, title: "Infection: Avoid the Unhappy and Unlucky", description: "You can die from someone else's misery" },
        { number: 11, title: "Learn to Keep People Dependent on You", description: "To maintain your independence" },
        { number: 12, title: "Use Selective Honesty and Generosity", description: "To disarm your victim" },
        { number: 13, title: "When Asking for Help", description: "Appeal to people's self-interest" },
        { number: 14, title: "Pose as a Friend", description: "Work as a spy" },
        { number: 15, title: "Crush Your Enemy Totally", description: "All great leaders since Moses have known" },
        { number: 16, title: "Use Absence to Increase Respect and Honor", description: "Too much circulation makes the price go down" },
        { number: 17, title: "Keep Others in Suspended Terror", description: "Cultivate an air of unpredictability" },
        { number: 18, title: "Do Not Build Fortresses to Protect Yourself", description: "Isolation is dangerous" },
        { number: 19, title: "Know Who You're Dealing With", description: "Do not offend the wrong person" },
        { number: 20, title: "Do Not Commit to Anyone", description: "It is the fool who always rushes to take sides" },
        { number: 21, title: "Play a Sucker to Catch a Sucker", description: "Seem dumber than your mark" },
        { number: 22, title: "Use the Surrender Tactic", description: "Transform weakness into power" },
        { number: 23, title: "Concentrate Your Forces", description: "Conserve your forces and energies" },
        { number: 24, title: "Play the Perfect Courtier", description: "The perfect courtier thrives in a world where everything revolves around power" },
        { number: 25, title: "Re-Create Yourself", description: "Do not accept the roles that society foists on you" },
        { number: 26, title: "Keep Your Hands Clean", description: "You must seem a paragon of civility and efficiency" },
        { number: 27, title: "Play on People's Need to Believe", description: "To create a cultlike following" },
        { number: 28, title: "Enter Action with Boldness", description: "If you are unsure of a course of action" },
        { number: 29, title: "Plan All the Way to the End", description: "The ending is everything" },
        { number: 30, title: "Make Your Accomplishments Seem Effortless", description: "Your actions must seem natural and executed with ease" },
        { number: 31, title: "Control the Options", description: "Get others to play with the cards you deal" },
        { number: 32, title: "Play to People's Fantasies", description: "The truth is often avoided because it is ugly and unpleasant" },
        { number: 33, title: "Discover Each Man's Thumbscrew", description: "Everyone has a weakness" },
        { number: 34, title: "Be Royal in Your Own Fashion", description: "Act like a king to be treated like one" },
        { number: 35, title: "Master the Art of Timing", description: "Never seem to be in a hurry" },
        { number: 36, title: "Disdain Things You Cannot Have", description: "Ignoring them is the best revenge" },
        { number: 37, title: "Create Compelling Spectacles", description: "Striking imagery and grand symbolic gestures" },
        { number: 38, title: "Think as You Like But Behave Like Others", description: "If you make a show of going against the times" },
        { number: 39, title: "Stir Up Waters to Catch Fish", description: "Anger and emotion are strategically counterproductive" },
        { number: 40, title: "Despise the Free Lunch", description: "What is offered for free is dangerous" },
        { number: 41, title: "Avoid Stepping into a Great Man's Shoes", description: "What happens first always appears better and more original" },
        { number: 42, title: "Strike the Shepherd and the Sheep Will Scatter", description: "Trouble can often be traced to a single strong individual" },
        { number: 43, title: "Work on the Hearts and Minds of Others", description: "Coercion creates a reaction that will eventually work against you" },
        { number: 44, title: "Disarm and Infuriate with the Mirror Effect", description: "The mirror reflects reality, but it is also the perfect tool for deception" },
        { number: 45, title: "Preach the Need for Change", description: "But Never Reform Too Much at Once" },
        { number: 46, title: "Never Appear Too Perfect", description: "Only gods and the dead can seem perfect with impunity" },
        { number: 47, title: "Do Not Go Past the Mark You Aimed For", description: "In victory, learn when to stop" },
        { number: 48, title: "Assume Formlessness", description: "By taking a shape, by having a visible plan" }
      ];

      // Map the laws to the table structure
      const enhancedRows = lawsOfPower.map(law => {
        const row: any = {};
        columns.forEach(col => {
          const key = col.key || col.label?.toLowerCase().replace(/\s+/g, '_');
          if (key?.includes('law_number') || key?.includes('number')) {
            row[key] = law.number.toString();
          } else if (key?.includes('law_title') || key?.includes('title')) {
            row[key] = law.title;
          } else if (key?.includes('description')) {
            row[key] = law.description;
          } else if (key?.includes('implementation_action')) {
            row[key] = `Study and practice ${law.title.toLowerCase()}`;
          } else if (key?.includes('start_date')) {
            row[key] = '2024-01-01';
          } else if (key?.includes('end_date')) {
            row[key] = '2024-12-31';
          } else if (key?.includes('progress')) {
            row[key] = 'Not Started';
          } else {
            row[key] = '';
          }
        });
        return row;
      });

      return {
        ...block,
        data: {
          ...block.data,
          rows: enhancedRows
        }
      };
    }

    return block;
  }

  private enhanceKanbanData(block: BlockInstruction): BlockInstruction {
    if (!block.data || !block.data.columns) return block;

    const columns = block.data.columns;
    
    // Check if this is a 48 laws of power Kanban - more flexible detection
    const is48LawsKanban = block.title?.toLowerCase().includes('48 laws') || 
                          block.title?.toLowerCase().includes('laws of power') ||
                          block.title?.toLowerCase().includes('implementation plan') ||
                          (columns.length > 0 && columns.some(col => 
                            col.title?.toLowerCase().includes('law') || 
                            col.id?.toLowerCase().includes('law') ||
                            col.title?.toLowerCase().includes('not started') ||
                            col.id?.toLowerCase().includes('not_started')
                          ));

    // Check if we have incomplete data (less than 48 items total across all columns)
    const totalItems = columns.reduce((sum, col) => sum + (col.items?.length || 0), 0);
    
    // Only enhance if we have NO data or completely empty data
    // Don't override valid LLM-generated data that might be a subset (like manipulation-related laws)
    const hasValidData = totalItems > 0 && columns.some(col => {
      return col.items && col.items.length > 0 && col.items.some(item => 
        item.title && typeof item.title === 'string' && item.title.trim().length > 0
      );
    });
    
    console.log('[PromptService] Kanban enhancement check:', {
      title: block.title,
      is48LawsKanban,
      totalItems,
      hasValidData,
      shouldEnhance: !hasValidData
    });
    
    if (is48LawsKanban && !hasValidData) {
      console.log('[PromptService] Detected 48 laws Kanban with no valid data, enhancing...');
      
      // Generate the 48 laws of power data
      const lawsOfPower = [
        { number: 1, title: "Never Outshine the Master", description: "Make those above you feel comfortably superior" },
        { number: 2, title: "Never Put Too Much Trust in Friends", description: "Learn how to use enemies" },
        { number: 3, title: "Conceal Your Intentions", description: "Keep people off-balance and in the dark" },
        { number: 4, title: "Always Say Less Than Necessary", description: "When you are trying to impress people with words" },
        { number: 5, title: "So Much Depends on Reputation", description: "Guard it with your life" },
        { number: 6, title: "Court Attention at All Cost", description: "Everything is judged by its appearance" },
        { number: 7, title: "Get Others to Do the Work for You", description: "But always take the credit" },
        { number: 8, title: "Make Other People Come to You", description: "Use bait if necessary" },
        { number: 9, title: "Win Through Your Actions", description: "Never through argument" },
        { number: 10, title: "Infection: Avoid the Unhappy and Unlucky", description: "You can die from someone else's misery" },
        { number: 11, title: "Learn to Keep People Dependent on You", description: "To maintain your independence" },
        { number: 12, title: "Use Selective Honesty and Generosity", description: "To disarm your victim" },
        { number: 13, title: "When Asking for Help", description: "Appeal to people's self-interest" },
        { number: 14, title: "Pose as a Friend", description: "Work as a spy" },
        { number: 15, title: "Crush Your Enemy Totally", description: "All great leaders since Moses have known" },
        { number: 16, title: "Use Absence to Increase Respect and Honor", description: "Too much circulation makes the price go down" },
        { number: 17, title: "Keep Others in Suspended Terror", description: "Cultivate an air of unpredictability" },
        { number: 18, title: "Do Not Build Fortresses to Protect Yourself", description: "Isolation is dangerous" },
        { number: 19, title: "Know Who You're Dealing With", description: "Do not offend the wrong person" },
        { number: 20, title: "Do Not Commit to Anyone", description: "It is the fool who always rushes to take sides" },
        { number: 21, title: "Play a Sucker to Catch a Sucker", description: "Seem dumber than your mark" },
        { number: 22, title: "Use the Surrender Tactic", description: "Transform weakness into power" },
        { number: 23, title: "Concentrate Your Forces", description: "Conserve your forces and energies" },
        { number: 24, title: "Play the Perfect Courtier", description: "The perfect courtier thrives in a world where everything revolves around power" },
        { number: 25, title: "Re-Create Yourself", description: "Do not accept the roles that society foists on you" },
        { number: 26, title: "Keep Your Hands Clean", description: "You must seem a paragon of civility and efficiency" },
        { number: 27, title: "Play on People's Need to Believe", description: "To create a cultlike following" },
        { number: 28, title: "Enter Action with Boldness", description: "If you are unsure of a course of action" },
        { number: 29, title: "Plan All the Way to the End", description: "The ending is everything" },
        { number: 30, title: "Make Your Accomplishments Seem Effortless", description: "Your actions must seem natural and executed with ease" },
        { number: 31, title: "Control the Options", description: "Get others to play with the cards you deal" },
        { number: 32, title: "Play to People's Fantasies", description: "The truth is often avoided because it is ugly and unpleasant" },
        { number: 33, title: "Discover Each Man's Thumbscrew", description: "Everyone has a weakness" },
        { number: 34, title: "Be Royal in Your Own Fashion", description: "Act like a king to be treated like one" },
        { number: 35, title: "Master the Art of Timing", description: "Never seem to be in a hurry" },
        { number: 36, title: "Disdain Things You Cannot Have", description: "Ignoring them is the best revenge" },
        { number: 37, title: "Create Compelling Spectacles", description: "Striking imagery and grand symbolic gestures" },
        { number: 38, title: "Think as You Like But Behave Like Others", description: "If you make a show of going against the times" },
        { number: 39, title: "Stir Up Waters to Catch Fish", description: "Anger and emotion are strategically counterproductive" },
        { number: 40, title: "Despise the Free Lunch", description: "What is offered for free is dangerous" },
        { number: 41, title: "Avoid Stepping into a Great Man's Shoes", description: "What happens first always appears better and more original" },
        { number: 42, title: "Strike the Shepherd and the Sheep Will Scatter", description: "Trouble can often be traced to a single strong individual" },
        { number: 43, title: "Work on the Hearts and Minds of Others", description: "Coercion creates a reaction that will eventually work against you" },
        { number: 44, title: "Disarm and Infuriate with the Mirror Effect", description: "The mirror reflects reality, but it is also the perfect tool for deception" },
        { number: 45, title: "Preach the Need for Change", description: "But Never Reform Too Much at Once" },
        { number: 46, title: "Never Appear Too Perfect", description: "Only gods and the dead can seem perfect with impunity" },
        { number: 47, title: "Do Not Go Past the Mark You Aimed For", description: "In victory, learn when to stop" },
        { number: 48, title: "Assume Formlessness", description: "By taking a shape, by having a visible plan" }
      ];

      // Find the "Not Started" or first column to populate with all laws
      const notStartedColumn = columns.find(col => 
        col.id?.toLowerCase().includes('not') || 
        col.title?.toLowerCase().includes('not') ||
        col.id?.toLowerCase().includes('backlog') ||
        col.title?.toLowerCase().includes('backlog')
      ) || columns[0];

      // Create enhanced items for all 48 laws
      const enhancedItems = lawsOfPower.map((law, index) => ({
        id: law.number.toString(),
        title: `Law ${law.number}: ${law.title}`,
        description: law.description,
        tag: 'Implementation',
        assignee: 'Self',
        priority: 'high',
        dueDate: '2024-12-31',
        comments: 0,
        attachments: 0
      }));

      console.log('[PromptService] Created enhanced items:', enhancedItems.length);

      // Update the columns with enhanced data
      const enhancedColumns = columns.map(col => {
        if (col.id === notStartedColumn.id) {
          return {
            ...col,
            items: enhancedItems
          };
        } else {
          return {
            ...col,
            items: col.items || []
          };
        }
      });

      console.log('[PromptService] Enhanced columns:', enhancedColumns.map(col => ({ id: col.id, title: col.title, itemCount: col.items.length })));

      return {
        ...block,
        data: {
          ...block.data,
          columns: enhancedColumns
        }
      };
    }

    return block;
  }

  private suggestApproach(intent: IntentAnalysis, prompt: string): string {
    if (intent.complexity === 'complex') {
      return 'multi-block';
    } else if (intent.primaryIntent === 'track' && intent.useCase === 'project-management') {
      return 'kanban-focused';
    } else if (intent.primaryIntent === 'analyze') {
      return 'data-visualization';
    } else if (intent.primaryIntent === 'collaborate') {
      return 'collaborative';
    } else {
      return 'simple';
    }
  }

  /**
   * Detect collaboration level from prompt
   */
  private detectCollaborationLevel(prompt: string): 'individual' | 'team' | 'organization' {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('organization') || lowerPrompt.includes('company') || lowerPrompt.includes('enterprise')) {
      return 'organization';
    } else if (lowerPrompt.includes('team') || lowerPrompt.includes('group') || lowerPrompt.includes('collaborate') || lowerPrompt.includes('share')) {
      return 'team';
    } else {
      return 'individual';
    }
  }

  /**
   * Detect workspace type from prompt and intent
   */
  private detectWorkspaceType(prompt: string, intent: IntentAnalysis): string | undefined {
    const lowerPrompt = prompt.toLowerCase();
    
    if (intent.useCase === 'project-management' || lowerPrompt.includes('project')) {
      return 'project';
    } else if (intent.useCase === 'data-analysis' || lowerPrompt.includes('data') || lowerPrompt.includes('analytics')) {
      return 'analytics';
    } else if (intent.useCase === 'planning' || lowerPrompt.includes('plan')) {
      return 'planning';
    } else if (intent.useCase === 'tracking' || lowerPrompt.includes('track')) {
      return 'tracking';
    } else if (intent.useCase === 'reporting' || lowerPrompt.includes('report')) {
      return 'reporting';
    } else if (intent.useCase === 'learning' || lowerPrompt.includes('learn') || lowerPrompt.includes('study')) {
      return 'learning';
    } else if (intent.primaryIntent === 'collaborate') {
      return 'collaboration';
    }
    
    return undefined;
  }

  private getDefaultDataForBlockType(type: string): any {
    switch (type) {
      case 'chart':
        return {
          type: 'bar',
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          data: [65, 85, 70, 90],
          title: 'Sample Chart',
          colorPalette: 'default'
        };
      case 'table':
        return {
          columns: [
            { key: 'col_0', label: 'Name', type: 'text' },
            { key: 'col_1', label: 'Description', type: 'text' },
            { key: 'col_2', label: 'Status', type: 'select' }
          ],
          rows: [
            { col_0: 'Sample Item', col_1: 'Sample description', col_2: 'Active' },
            { col_0: 'Another Item', col_1: 'Another description', col_2: 'Pending' }
          ]
        };
      case 'text':
        return { content: 'Sample text content. Click to edit.' };
      case 'kanban':
        return {
          columns: [
            { id: 'todo', title: 'To Do', items: [] },
            { id: 'in-progress', title: 'In Progress', items: [] },
            { id: 'done', title: 'Done', items: [] }
          ]
        };
      case 'list':
        return { items: [{ id: '1', text: 'Sample item', completed: false }] };
      case 'timeline':
        return { events: [{ title: 'Sample Event', description: 'Sample description', timestamp: new Date().toISOString() }] };
      default:
        return { content: 'No data available for this block type.' };
    }
  }

  private extractJSONFromLLMResponse(response: string): string {
    // Try multiple extraction strategies
    let jsonString = '';
    
    // Strategy 1: Extract from JSON code blocks
    const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1];
      console.log('[PromptService] Extracted JSON from code block');
      return jsonString;
    }
    
    // Strategy 2: Extract from generic code blocks
    const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
      console.log('[PromptService] Extracted JSON from generic code block');
      return jsonString;
    }
    
    // Strategy 3: Find the first complete JSON object
    const jsonObjectMatch = response.match(/\{[\s\S]*?\}/);
    if (jsonObjectMatch) {
      jsonString = jsonObjectMatch[0];
      console.log('[PromptService] Extracted JSON object from response');
      return jsonString;
    }
    
    // Strategy 4: Find JSON array
    const jsonArrayMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonArrayMatch) {
      jsonString = jsonArrayMatch[0];
      console.log('[PromptService] Extracted JSON array from response');
      return jsonString;
    }
    
    // Strategy 5: Return the entire response if no patterns found
    console.log('[PromptService] No JSON patterns found, using full response');
    return response;
  }

  private cleanJSONString(jsonString: string): string {
    return jsonString
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/,\s*,/g, ',') // Remove double commas
      .replace(/\[\s*,/g, '[') // Remove leading commas in arrays
      .replace(/,\s*\]/g, ']') // Remove trailing commas in arrays
      .replace(/,\s*,/g, ',') // Remove multiple consecutive commas
      .replace(/,\s*}/g, '}') // Remove trailing commas in objects
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/,\s*,/g, ',') // Remove multiple consecutive commas again
      .trim();
  }

  private extractJSONAggressively(response: string): any | null {
    // Try to find and extract JSON even if it's embedded in text
    try {
      // Look for JSON-like structures and try to parse them
      const patterns = [
        /\{[\s\S]*?\}/, // JSON object
        /\[[\s\S]*?\]/, // JSON array
        /\{[\s\S]*"intent"[\s\S]*\}/, // Response with intent
        /\{[\s\S]*"blocks"[\s\S]*\}/, // Response with blocks
      ];
      
      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
          try {
            const cleaned = this.cleanJSONString(match[0]);
            const parsed = JSON.parse(cleaned);
            console.log('[PromptService] Aggressive extraction succeeded with pattern');
            return parsed;
          } catch (e) {
            // Continue to next pattern
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('[PromptService] Aggressive extraction error:', error);
      return null;
    }
  }

  // Block transformation methods
  private transformChartBlock(block: any): any {
    console.log('[PromptService] Transforming chart block:', block.title);
    
    // Handle multiple possible chart data formats from LLM
    let chartData: { labels: any[]; data: any[]; type: string } | null = null;
    
    // Format 1: block.data with datasets array (Chart.js format)
    if (block.data && block.data.labels && block.data.datasets && Array.isArray(block.data.datasets)) {
      const dataset = block.data.datasets[0];
      if (dataset && Array.isArray(dataset.data)) {
        chartData = {
          labels: block.data.labels,
          data: dataset.data,
          type: block.config?.type || dataset.type || 'bar'
        };
        console.log('[PromptService] Chart data extracted from datasets format');
      }
    }
    // Format 2: block.data with simple labels and data arrays
    else if (block.data && block.data.labels && block.data.data && Array.isArray(block.data.data)) {
      chartData = {
        labels: block.data.labels,
        data: block.data.data,
        type: block.data.type || block.config?.type || 'bar'
      };
      console.log('[PromptService] Chart data extracted from simple format');
    }
    // Format 3: block.config with datasets (legacy format)
    else if (block.config && block.config.labels && block.config.datasets && Array.isArray(block.config.datasets)) {
      const dataset = block.config.datasets[0];
      if (dataset && Array.isArray(dataset.data)) {
        chartData = {
          labels: block.config.labels,
          data: dataset.data,
          type: block.config.type || 'bar'
        };
        console.log('[PromptService] Chart data extracted from config format');
      }
    }
    // Format 4: block.config.data with Chart.js format (new LLM format)
    else if (block.config && block.config.data && block.config.data.labels && block.config.data.datasets) {
      const dataset = block.config.data.datasets[0];
      if (dataset && Array.isArray(dataset.data)) {
        chartData = {
          labels: block.config.data.labels,
          data: dataset.data,
          type: block.config.type || 'bar'
        };
        console.log('[PromptService] Chart data extracted from config.data format');
      }
    }
    
    // If we have valid chart data, transform the block
    if (chartData) {
      return {
        ...block,
        config: {
          type: chartData.type,
          ...block.config
        },
        data: chartData
      };
    }
    
    // Fallback: create default chart data
    console.log('[PromptService] Creating fallback chart data for block:', block.title);
    return {
      ...block,
      config: {
        type: 'bar',
        ...block.config
      },
      data: {
        type: 'bar',
        labels: ['Sample 1', 'Sample 2', 'Sample 3', 'Sample 4'],
        data: [65, 85, 70, 90]
      }
    };
  }

  private transformTableBlock(block: any): any {
    console.log('[PromptService] Transforming table block:', block.title);
    // If table data is already in the right format, return as is
    if (block.data && block.data.columns && block.data.rows) {
      if (block.truncated || block.data.truncated) {
        block.warning = 'Table may be incomplete due to output truncation.';
      }
      return this.enhanceTableData(block);
    }
    // Try to extract table data from various formats
    if (block.config && block.config.columns && block.data && block.data.rows) {
      if (block.truncated || block.data.truncated) {
        block.warning = 'Table may be incomplete due to output truncation.';
      }
      return this.enhanceTableData({
        ...block,
        data: {
          columns: block.config.columns,
          rows: block.data.rows
        }
      });
    }
    // Fallback: create default table data
    console.log('[PromptService] Creating fallback table data for block:', block.title);
    return {
      ...block,
      data: {
        columns: [
          { key: 'col_0', label: 'Name', type: 'text' },
          { key: 'col_1', label: 'Description', type: 'text' },
          { key: 'col_2', label: 'Status', type: 'select' }
        ],
        rows: [
          { col_0: 'Sample Item', col_1: 'Sample description', col_2: 'Active' },
          { col_0: 'Another Item', col_1: 'Another description', col_2: 'Pending' }
        ]
      }
    };
  }

  private transformKanbanBlock(block: any): any {
    console.log('[PromptService] Transforming kanban block:', block.title);
    
    // If kanban data is already in the right format, return as is
    if (block.data && block.data.columns) {
      return this.enhanceKanbanData(block);
    }
    
    // Try to extract kanban data from config
    if (block.config && block.config.columns) {
      return {
        ...block,
        data: {
          columns: block.config.columns,
          cards: block.config.cards || []
        }
      };
    }
    
    // Fallback: create default kanban data
    console.log('[PromptService] Creating fallback kanban data for block:', block.title);
    return {
      ...block,
      data: {
        columns: [
          { id: 'backlog', title: 'Backlog', color: '#e3f2fd', items: [] },
          { id: 'in-progress', title: 'In Progress', color: '#fff3e0', items: [] },
          { id: 'review', title: 'Review', color: '#fce4ec', items: [] },
          { id: 'done', title: 'Done', color: '#e8f5e8', items: [] }
        ]
      }
    };
  }

  private transformTaskListBlock(block: any): any {
    console.log('[PromptService] Transforming task-list block:', block.title);
    
    // If task data is already in the right format, return as is
    if (block.data && block.data.tasks) {
      return block;
    }
    
    // Try to extract task data from config
    if (block.config && block.config.tasks) {
      return {
        ...block,
        data: {
          tasks: block.config.tasks
        }
      };
    }
    
    // Fallback: create default task list data
    console.log('[PromptService] Creating fallback task-list data for block:', block.title);
    return {
      ...block,
      data: {
        tasks: [
          { id: '1', text: 'Sample task 1', completed: false },
          { id: '2', text: 'Sample task 2', completed: true }
        ]
      }
    };
  }

  private transformCalendarBlock(block: any): any {
    console.log('[PromptService] Transforming calendar block:', block.title);
    
    // If calendar data is already in the right format, return as is
    if (block.data && block.data.events) {
      return block;
    }
    
    // Try to extract calendar data from config
    if (block.config && block.config.events) {
      return {
        ...block,
        data: {
          events: block.config.events
        }
      };
    }
    
    // Fallback: create default calendar data
    console.log('[PromptService] Creating fallback calendar data for block:', block.title);
    return {
      ...block,
      data: {
        events: [
          { title: 'Sample Event 1', date: '2024-01-15' },
          { title: 'Sample Event 2', date: '2024-01-20' }
        ]
      }
    };
  }

  private transformTimelineBlock(block: any): any {
    console.log('[PromptService] Transforming timeline block:', block.title);
    
    // If timeline data is already in the right format, return as is
    if (block.data && block.data.events) {
      return block;
    }
    
    // Try to extract timeline data from config
    if (block.config && block.config.events) {
      return {
        ...block,
        data: {
          events: block.config.events
        }
      };
    }
    
    // Fallback: create default timeline data
    console.log('[PromptService] Creating fallback timeline data for block:', block.title);
    return {
      ...block,
      data: {
        events: [
          { title: 'Sample Event 1', date: '2024-01-15', description: 'Sample description' },
          { title: 'Sample Event 2', date: '2024-01-20', description: 'Sample description' }
        ]
      }
    };
  }

  private transformNoteBlock(block: any): any {
    console.log('[PromptService] Transforming note block:', block.title);
    
    // If note data is already in the right format, return as is
    if (block.data && block.data.text) {
      return block;
    }
    
    // Try to extract note data from config
    if (block.config && block.config.text) {
      return {
        ...block,
        data: {
          text: block.config.text
        }
      };
    }
    
    // Fallback: create default note data
    console.log('[PromptService] Creating fallback note data for block:', block.title);
    return {
      ...block,
      data: {
        text: 'Sample note content'
      }
    };
  }

  private transformStatusBlock(block: any): any {
    console.log('[PromptService] Transforming status block:', block.title);
    
    // If status data is already in the right format, return as is
    if (block.data && block.data.status) {
      return block;
    }
    
    // Try to extract status data from config
    if (block.config && block.config.status) {
      return {
        ...block,
        data: {
          status: block.config.status
        }
      };
    }
    
    // Fallback: create default status data
    console.log('[PromptService] Creating fallback status data for block:', block.title);
    return {
      ...block,
      data: {
        status: 'Active'
      }
    };
  }

  private transformAgentBlock(block: any): any {
    console.log('[PromptService] Transforming agent block:', block.title);
    
    // If agent data is already in the right format, return as is
    if (block.data && block.data.instructions) {
      return block;
    }
    
    // Try to extract agent data from config
    if (block.config && block.config.instructions) {
      return {
        ...block,
        data: {
          instructions: block.config.instructions
        }
      };
    }
    
    // Fallback: create default agent data
    console.log('[PromptService] Creating fallback agent data for block:', block.title);
    return {
      ...block,
      data: {
        instructions: 'Ask me anything about your workspace.'
      }
    };
  }

  private transformEmbedBlock(block: any): any {
    console.log('[PromptService] Transforming embed block:', block.title);
    
    // If embed data is already in the right format, return as is
    if (block.data && block.data.url && block.data.embedType) {
      return block;
    }
    
    // Try to extract embed data from config
    if (block.config && block.config.url && block.config.embedType) {
      return {
        ...block,
        data: {
          url: block.config.url,
          embedType: block.config.embedType
        }
      };
    }
    
    // Fallback: create default embed data
    console.log('[PromptService] Creating fallback embed data for block:', block.title);
    return {
      ...block,
      data: {
        url: 'https://example.com',
        embedType: 'website'
      }
    };
  }

  /**
   * Generate dashboard by inference from data patterns
   */
  async generateDashboardByInference(
    data: any[],
    metadata: any,
    context?: string,
    workspaceId?: string,
    userId?: string
  ): Promise<InterpretPromptResponse> {
    console.log('[PromptService] Generating dashboard by inference...');

    try {
      // Step 1: Pattern inference analysis
      const inferenceResult = await this.patternInferenceService.inferDashboardFromData(
        data,
        metadata,
        context
      );

      // Step 2: Generate AI insights
      const insights = await this.aiInsightsService.generateInsights({
        data,
        metadata,
        context,
        timeRange: metadata.timeRange
      });

      // Step 3: Create blocks from inference results
      const blocks: BlockInstruction[] = inferenceResult.generatedDashboard.blocks.map((block: any, index: number) => ({
        type: block.type,
        title: block.title,
        config: block.config,
        data: block.data,
        position: index
      }));

      // Step 4: Add insights block if insights are available
      if (insights.length > 0) {
        const insightsBlock: BlockInstruction = {
          type: 'note',
          title: 'AI Insights',
          config: {
            markdown: true,
            collapsible: true,
            theme: 'insights'
          },
          data: {
            content: this.formatInsightsForDisplay(insights)
          },
          position: blocks.length
        };
        blocks.push(insightsBlock);
      }

      // Step 5: Create smart analysis
      const smartAnalysis = {
        intent: {
          primaryIntent: 'dashboard-generation',
          secondaryIntents: ['data-analysis', 'pattern-recognition'],
          dataRequirements: [],
          visualizationNeeds: [],
          interactionType: 'analyze',
          complexity: 'moderate',
          domain: undefined,
          useCase: undefined,
          urgency: 'medium',
        } as IntentAnalysis,
        dataPattern: {
          type: 'structured', // valid DataPattern.type
          confidence: 0.7,
          structure: 'dashboard',
          metadata: {
            patterns: inferenceResult.patterns.map(p => p.type),
            templates: inferenceResult.dashboardTemplates.map(t => t.name),
            insights: insights.length
          }
        } as DataPattern,
        recommendations: inferenceResult.dashboardTemplates.map(template => ({
          type: template.id,
          confidence: template.priority,
          reasoning: template.description,
          suggestedData: {},
          config: {},
          priority: 'primary',
        })) as BlockRecommendation[]
      };

      return {
        intent: `Inference-based dashboard with ${inferenceResult.patterns.length} patterns detected`,
        blocks,
        description: `Automatically generated dashboard based on ${inferenceResult.patterns.length} data patterns and ${insights.length} AI insights`,
        smartAnalysis
      };

    } catch (error) {
      console.error('[PromptService] Error generating dashboard by inference:', error);
      
      // Fallback to basic dashboard
      return {
        intent: 'Basic data dashboard',
        blocks: [{
          type: 'table',
          title: 'Data Overview',
          config: { sortable: true, filterable: true },
          data: { columns: metadata.columns || [], rows: data.slice(0, 50) },
          position: 0
        }],
        description: 'Basic dashboard generated due to inference error'
      };
    }
  }

  /**
   * Process natural language query and generate visualization
   */
  async processNaturalLanguageQuery(
    query: string,
    data: any[],
    metadata: any
  ): Promise<any> {
    console.log('[PromptService] Processing natural language query:', query);

    try {
      const queryResult = await this.naturalLanguageQueryService.processQuery(
        query,
        data,
        metadata
      );

      // Convert query result to block instruction
      const block: BlockInstruction = {
        type: queryResult.visualization.type,
        title: queryResult.visualization.config.title || 'Query Result',
        config: queryResult.visualization.config,
        data: queryResult.visualization.data,
        position: 0
      };

      return {
        block,
        insights: queryResult.insights,
        recommendations: queryResult.recommendations,
        intent: queryResult.intent
      };

    } catch (error) {
      console.error('[PromptService] Error processing natural language query:', error);
      throw error;
    }
  }

  /**
   * Generate predictive analytics
   */
  async generatePredictiveAnalytics(
    data: any[],
    metadata: any,
    forecastPeriods: number = 12
  ): Promise<any> {
    console.log('[PromptService] Generating predictive analytics...');

    try {
      const dateColumns = metadata.dateColumns || [];
      const numericColumns = metadata.numericColumns || [];

      if (dateColumns.length === 0 || numericColumns.length === 0) {
        throw new Error('Date and numeric columns required for forecasting');
      }

      const forecasts: ForecastResult[] = [];
      const anomalyPredictions: PredictiveInsight[] = [];
      const trendPredictions: PredictiveInsight[] = [];

      // Generate forecasts for each numeric column
      for (const numericCol of numericColumns) {
        const forecast = await this.predictiveAnalyticsService.generateForecast(
          data,
          dateColumns[0],
          numericCol,
          forecastPeriods
        );
        forecasts.push(forecast);

        // Generate anomaly predictions
        const anomalyPrediction = await this.predictiveAnalyticsService.predictAnomalies(
          data,
          dateColumns[0],
          numericCol,
          6
        );
        anomalyPredictions.push(anomalyPrediction);

        // Generate trend change predictions
        const trendPrediction = await this.predictiveAnalyticsService.predictTrendChanges(
          data,
          dateColumns[0],
          numericCol
        );
        trendPredictions.push(trendPrediction);
      }

      // Generate pattern classifications
      const patternClassifications: PredictiveInsight[] = await this.predictiveAnalyticsService.classifyDataPatterns(
        data,
        metadata
      );

      return {
        forecasts,
        anomalyPredictions,
        trendPredictions,
        patternClassifications,
        summary: {
          totalForecasts: forecasts.length,
          totalAnomalies: anomalyPredictions.filter(p => p.data && p.data.anomalies && p.data.anomalies.length > 0).length,
          riskLevel: this.calculateOverallRiskLevel(anomalyPredictions, trendPredictions),
          opportunities: patternClassifications.filter(p => (p.type as any).category === 'opportunity').length
        }
      };

    } catch (error) {
      console.error('[PromptService] Error generating predictive analytics:', error);
      throw error;
    }
  }

  /**
   * Optimize existing dashboard
   */
  async optimizeDashboard(
    dashboard: any,
    data: any[],
    metadata: any,
    userPreferences?: any
  ): Promise<any> {
    console.log('[PromptService] Optimizing dashboard...');

    try {
      const optimizationResult = await this.dashboardOptimizationService.optimizeDashboard(
        dashboard,
        data,
        metadata,
        userPreferences
      );

      return {
        originalDashboard: dashboard,
        optimizedDashboard: optimizationResult.optimizedDashboard,
        score: optimizationResult.score,
        improvements: optimizationResult.improvements
      };

    } catch (error) {
      console.error('[PromptService] Error optimizing dashboard:', error);
      throw error;
    }
  }

  // Helper methods
  private formatInsightsForDisplay(insights: any[]): string {
    let markdown = '# AI Insights\n\n';

    // Group insights by category
    const groupedInsights = insights.reduce((groups, insight) => {
      const category = insight.type.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(insight);
      return groups;
    }, {});

    // Format each category
    Object.entries(groupedInsights).forEach(([category, categoryInsights]: [string, any]) => {
      markdown += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Insights\n\n`;
      
      categoryInsights.forEach((insight: any) => {
        markdown += `### ${insight.title}\n`;
        markdown += `${insight.summary}\n\n`;
        
        if (insight.recommendations.length > 0) {
          markdown += '**Recommendations:**\n';
          insight.recommendations.forEach((rec: any) => {
            markdown += `- ${rec.action} (${rec.effort} effort, ${rec.timeline})\n`;
          });
          markdown += '\n';
        }
      });
    });

    return markdown;
  }

  private calculateOverallRiskLevel(anomalyPredictions: any[], trendPredictions: any[]): string {
    const criticalRisks = anomalyPredictions.filter(p => p.data.riskLevel === 'high').length;
    const trendRisks = trendPredictions.filter(p => p.data.changeProbability > 70).length;

    if (criticalRisks > 2 || trendRisks > 3) return 'critical';
    if (criticalRisks > 0 || trendRisks > 1) return 'high';
    if (anomalyPredictions.length > 2 || trendPredictions.length > 2) return 'medium';
    return 'low';
  }

  /**
   * Attempt to fix malformed JSON by balancing braces/brackets.
   * Returns a repaired string if it becomes valid JSON, otherwise null.
   */
  private repairJsonString(str: string): string | null {
    if (!str) return null;
    let repaired = str;
    const openCurly = (repaired.match(/\{/g) || []).length;
    const closeCurly = (repaired.match(/}/g) || []).length;
    const openSquare = (repaired.match(/\[/g) || []).length;
    const closeSquare = (repaired.match(/]/g) || []).length;

    if (openCurly > closeCurly) {
      repaired += '}'.repeat(openCurly - closeCurly);
    }
    if (openSquare > closeSquare) {
      repaired += ']'.repeat(openSquare - closeSquare);
    }

    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return null;
    }
  }

  /**
   * Try to salvage a JSON string that is truncated at the end by progressively
   * trimming characters after the last closing brace/bracket until it parses.
   */
  private tryParseWithTruncation(str: string): any | null {
    if (!str) return null;
    let endIndex = str.lastIndexOf('}');
    let iteration = 0;
    while (endIndex !== -1 && iteration < 10) { // limit attempts
      const candidate = str.slice(0, endIndex + 1);
      try {
        const cleaned = this.cleanJSONString(candidate);
        return JSON.parse(cleaned);
      } catch {
        // Move to previous closing brace
        endIndex = str.lastIndexOf('}', endIndex - 1);
        iteration++;
      }
    }
    return null;
  }

  // --- B. Robust JSON Extraction ---
  // Add a helper to salvage as many valid rows as possible from a truncated array
  private salvageRowsFromTruncatedArray(jsonString: string): any[] {
    try {
      // Try to extract the rows array
      const rowsMatch = jsonString.match(/"rows"\s*:\s*\[(.*)/s);
      if (!rowsMatch) return [];
      let rowsStr = rowsMatch[1];
      // Try to close the array if truncated
      if (!rowsStr.trim().endsWith(']')) rowsStr += ']';
      // Try to parse as array
      const arr = JSON.parse('[' + rowsStr.split(']').shift());
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
} 