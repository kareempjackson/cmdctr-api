import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { ConfigService } from '../config/config.service';

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
}

@Injectable()
export class PromptService {
  private llm: ChatOpenAI;

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly configService: ConfigService,
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
  ): Promise<InterpretPromptResponse> {
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an AI assistant that helps users build workspace dashboards by interpreting their natural language requests.

Given the user's prompt, analyze their intent and break it down into specific block instructions.

Available block types:
- text: Rich text content with markdown support
- table: Data tables with columns and rows
- chart: Data visualization (bar, line, pie, etc.)
- task-list: Interactive checklist with tasks
- kanban: Kanban board with columns and cards
- calendar: Calendar view for events and deadlines
- timeline: Project timeline visualization
- note: Quick notes and ideas
- select: Dropdown selection field
- status: Status indicator badges
- jot: Quick idea capture
- agent: AI assistant block

User Prompt: "{prompt}"
Workspace ID: {workspaceId}

Respond with a JSON object containing:
1. "intent": A brief description of what the user wants to build
2. "blocks": An array of block objects, each with:
   - "type": The block type from the list above
   - "title": A descriptive title for the block
   - "config": Configuration object specific to the block type
   - "data": Initial data content (if applicable)
   - "position": Order position (starting from 0)

Example response for "Build a CRM dashboard":
{{
  "intent": "Create a customer relationship management dashboard",
  "blocks": [
    {{
      "type": "text",
      "title": "CRM Dashboard",
      "config": {{ "markdown": true }},
      "data": {{ "content": "# CRM Dashboard\\n\\nManage your customer relationships and sales pipeline." }},
      "position": 0
    }},
    {{
      "type": "table",
      "title": "Contacts",
      "config": {{
        "columns": [
          {{ "key": "name", "label": "Name", "type": "text" }},
          {{ "key": "email", "label": "Email", "type": "email" }},
          {{ "key": "company", "label": "Company", "type": "text" }},
          {{ "key": "status", "label": "Status", "type": "select", "options": ["Lead", "Prospect", "Customer"] }}
        ],
        "sortable": true,
        "filterable": true
      }},
      "data": {{
        "rows": [
          {{ "name": "John Doe", "email": "john@example.com", "company": "Acme Corp", "status": "Customer" }}
        ]
      }},
      "position": 1
    }},
    {{
      "type": "kanban",
      "title": "Sales Pipeline",
      "config": {{
        "columns": [
          {{ "id": "leads", "title": "Leads", "color": "#e3f2fd" }},
          {{ "id": "qualified", "title": "Qualified", "color": "#f3e5f5" }},
          {{ "id": "proposal", "title": "Proposal", "color": "#fff3e0" }},
          {{ "id": "closed", "title": "Closed", "color": "#e8f5e8" }}
        ]
      }},
      "data": {{
        "cards": [
          {{ "id": "1", "title": "Acme Corp Deal", "column": "qualified", "value": "$50,000" }}
        ]
      }},
      "position": 2
    }}
  ]
}}

Respond only with valid JSON. Be creative and comprehensive based on the user's request.
`);

    const chain = new LLMChain({
      llm: this.llm,
      prompt: promptTemplate,
    });

    try {
      const result = await chain.call({
        prompt,
        workspaceId,
      });

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

      // Validate and sanitize the response
      return this.validateAndSanitizeResponse(parsedResponse);
    } catch (error) {
      console.error('Error interpreting prompt:', error);
      
      // Fallback response
      return {
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
      };
    }
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

    const sanitizedBlocks = response.blocks
      .filter((block: any) => {
        return (
          block &&
          typeof block.type === 'string' &&
          validBlockTypes.includes(block.type) &&
          typeof block.position === 'number'
        );
      })
      .map((block: any, index: number) => ({
        type: block.type,
        title: block.title || `Block ${index + 1}`,
        config: block.config || {},
        data: block.data || null,
        position: block.position,
      }))
      .sort((a: any, b: any) => a.position - b.position);

    return {
      intent: response.intent,
      blocks: sanitizedBlocks,
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
} 