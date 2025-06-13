import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { ConfigService } from '../config/config.service';
import { v4 as uuidv4 } from 'uuid';

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
    opts?: { deterministic?: boolean }
  ): Promise<InterpretPromptResponse> {
    if (opts?.deterministic) {
      // Use rule-based parser
      return this.ruleBasedParse(prompt);
    }
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
          { type: 'crm', title: 'CRM Board', config: {}, data: {}, position: 0 },
          { type: 'kanban', title: 'Sales Pipeline', config: { columns: [ { title: 'New' }, { title: 'Contacted' }, { title: 'Negotiation' }, { title: 'Won' }, { title: 'Lost' } ] }, data: { cards: [ { id: '1', title: 'Acme Inc', column: 'New', value: '$5,000' }, { id: '2', title: 'Globex', column: 'Contacted', value: '$3,200' } ] }, position: 1 },
          { type: 'table', title: 'Leads Table', config: { columns: [ { key: 'name', label: 'Name', type: 'text' }, { key: 'stage', label: 'Stage', type: 'text' }, { key: 'value', label: 'Value', type: 'text' }, { key: 'contact', label: 'Contact', type: 'text' } ] }, data: { rows: [ { name: 'Acme Inc', stage: 'New', value: '$5,000', contact: 'Jane Smith' }, { name: 'Globex', stage: 'Contacted', value: '$3,200', contact: 'Tom Cruise' } ] }, position: 2 },
          { type: 'chart', title: 'Deals by Stage', config: { type: 'bar', xKey: 'stage', yKey: 'count' }, data: { rows: [ { stage: 'New', count: 4 }, { stage: 'Contacted', count: 3 }, { stage: 'Won', count: 1 } ] }, position: 3 },
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
} 