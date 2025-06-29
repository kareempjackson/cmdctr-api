import { Injectable } from '@nestjs/common';
import { SmartDetectionService, IntentAnalysis, DataPattern, BlockRecommendation } from './smart-detection.service';

export interface EnhancedPromptContext {
  userPrompt: string;
  intentAnalysis: IntentAnalysis;
  dataPattern?: DataPattern;
  recommendations: BlockRecommendation[];
  extractedData?: any;
  globalContext?: string;
  memoryContext?: string;
}

export interface EnhancedPromptResult {
  systemPrompt: string;
  userPrompt: string;
  context: EnhancedPromptContext;
}

@Injectable()
export class EnhancedPromptService {
  constructor(
    private readonly smartDetectionService: SmartDetectionService,
  ) {}

  /**
   * Generate an enhanced prompt that leverages smart detection insights
   */
  generateEnhancedPrompt(context: EnhancedPromptContext): EnhancedPromptResult {
    const { userPrompt, intentAnalysis, dataPattern, recommendations, extractedData, globalContext, memoryContext } = context;

    // Build context-aware system prompt
    const systemPrompt = this.buildContextAwareSystemPrompt(context);

    // Enhance user prompt with smart insights
    const enhancedUserPrompt = this.enhanceUserPrompt(userPrompt, context);

    return {
      systemPrompt,
      userPrompt: enhancedUserPrompt,
      context
    };
  }

  /**
   * Build a context-aware system prompt based on smart detection
   */
  private buildContextAwareSystemPrompt(context: EnhancedPromptContext): string {
    const { intentAnalysis, dataPattern, recommendations, extractedData } = context;

    let systemPrompt = `You are an expert assistant that generates actionable, visually organized dashboards from user prompts.

SMART ANALYSIS CONTEXT:
- Primary Intent: ${intentAnalysis.primaryIntent}
- Interaction Type: ${intentAnalysis.interactionType}
- Data Requirements: ${intentAnalysis.dataRequirements.join(', ') || 'None'}
- Visualization Needs: ${intentAnalysis.visualizationNeeds.join(', ') || 'None'}`;

    if (dataPattern) {
      systemPrompt += `
- Detected Data Pattern: ${dataPattern.type} (confidence: ${dataPattern.confidence})
- Data Structure: ${this.describeDataStructure(dataPattern)}`;
    }

    if (recommendations.length > 0) {
      systemPrompt += `
- Recommended Block Types: ${recommendations.map(r => `${r.type} (${r.confidence})`).join(', ')}`;
    }

    if (extractedData) {
      systemPrompt += `
- Extracted Data Available: Yes (${this.describeExtractedData(extractedData)})`;
    }

    systemPrompt += `

BLOCK GENERATION GUIDELINES:
1. Use the smart analysis context to guide your decisions
2. Prefer recommended block types when they have high confidence (>0.8)
3. Transform extracted data into appropriate block formats
4. Create meaningful titles and descriptions
5. Ensure data consistency across blocks

AVAILABLE BLOCK TYPES:
- text: For explanations, summaries, narrative content
- table: For structured data, lists, comparisons
- chart: For visualizations, trends, analytics
- timeline: For chronological events, schedules
- kanban: For task management, workflows, status tracking
- calendar: For date-based events, scheduling
- list: For simple lists, checklists, items
- note: For quick notes, reminders
- status: For status indicators, progress
- agent: For AI assistants, interactive elements

RESPONSE FORMAT:
Generate a JSON response with the following structure:
{
  "intent": "Brief description of what the user wants",
  "blocks": [
    {
      "type": "block_type",
      "title": "Descriptive title",
      "config": { /* block-specific configuration */ },
      "data": { /* block-specific data structure */ },
      "position": 0
    }
  ],
  "reasoning": "Brief explanation of why these blocks were chosen"
}`;

    return systemPrompt;
  }

  /**
   * Enhance the user prompt with smart detection insights
   */
  private enhanceUserPrompt(userPrompt: string, context: EnhancedPromptContext): string {
    const { intentAnalysis, dataPattern, recommendations, extractedData } = context;

    let enhancedPrompt = userPrompt;

    // Add intent-specific guidance
    if (intentAnalysis.primaryIntent === 'analyze') {
      enhancedPrompt += '\n\nPlease provide analytical insights and visualizations for this data.';
    } else if (intentAnalysis.primaryIntent === 'plan') {
      enhancedPrompt += '\n\nPlease create a structured plan with timelines and milestones.';
    } else if (intentAnalysis.primaryIntent === 'track') {
      enhancedPrompt += '\n\nPlease create tracking mechanisms and status indicators.';
    }

    // Add data-specific guidance
    if (dataPattern) {
      enhancedPrompt += `\n\nDetected data pattern: ${dataPattern.type}. Please optimize the layout for this data structure.`;
    }

    // Add recommendation guidance
    if (recommendations.length > 0) {
      const topRecommendation = recommendations[0];
      if (topRecommendation.confidence > 0.8) {
        enhancedPrompt += `\n\nRecommended primary block type: ${topRecommendation.type} (${topRecommendation.reasoning})`;
      }
    }

    // Add extracted data context
    if (extractedData) {
      enhancedPrompt += '\n\nStructured data has been extracted from the prompt. Please use this data to populate the blocks appropriately.';
    }

    return enhancedPrompt;
  }

  /**
   * Describe the data structure in human-readable format
   */
  private describeDataStructure(dataPattern: DataPattern): string {
    const { type, metadata } = dataPattern;
    
    switch (type) {
      case 'tabular':
        return `Table with ${metadata.rowCount} rows and ${metadata.columnCount} columns${metadata.timeSeries ? ' (time series data)' : ''}`;
      case 'temporal':
        return `Time-based data with ${metadata.hasDates ? 'date information' : 'chronological structure'}`;
      case 'hierarchical':
        return `Hierarchical structure with nested elements`;
      case 'sequential':
        return `Sequential data with ordered items`;
      case 'categorical':
        return `Categorical data with distinct categories`;
      case 'numerical':
        return `Numerical data suitable for calculations and charts`;
      case 'textual':
        return `Text-based content`;
      default:
        return 'Unknown structure';
    }
  }

  /**
   * Describe extracted data in human-readable format
   */
  private describeExtractedData(data: any): string {
    if (Array.isArray(data)) {
      return `Array with ${data.length} items`;
    }
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      return `Object with ${keys.length} properties: ${keys.join(', ')}`;
    }
    if (typeof data === 'string') {
      return `Text (${data.length} characters)`;
    }
    return typeof data;
  }

  /**
   * Generate specific prompts for different block types
   */
  generateBlockSpecificPrompt(blockType: string, context: EnhancedPromptContext): string {
    const { userPrompt, intentAnalysis, dataPattern, recommendations } = context;

    const blockPrompts = {
      table: `Create a table block for: ${userPrompt}
Focus on: Structured data presentation, clear column headers, sortable/filterable options
Data pattern: ${dataPattern?.type || 'unknown'}`,

      chart: `Create a chart block for: ${userPrompt}
Focus on: Data visualization, appropriate chart type, clear labels and legends
Intent: ${intentAnalysis.primaryIntent}`,

      timeline: `Create a timeline block for: ${userPrompt}
Focus on: Chronological events, clear dates, descriptive entries
Data pattern: ${dataPattern?.type || 'unknown'}`,

      kanban: `Create a kanban block for: ${userPrompt}
Focus on: Task management, status columns, card organization
Intent: ${intentAnalysis.primaryIntent}`,

      calendar: `Create a calendar block for: ${userPrompt}
Focus on: Date-based events, scheduling, time management
Data pattern: ${dataPattern?.type || 'unknown'}`,

      list: `Create a list block for: ${userPrompt}
Focus on: Simple item listing, clear organization, easy scanning
Intent: ${intentAnalysis.primaryIntent}`,

      text: `Create a text block for: ${userPrompt}
Focus on: Clear explanation, proper formatting, comprehensive coverage
Intent: ${intentAnalysis.primaryIntent}`
    };

    return blockPrompts[blockType as keyof typeof blockPrompts] || userPrompt;
  }

  /**
   * Generate data transformation instructions
   */
  generateDataTransformationPrompt(originalData: any, targetBlockType: string): string {
    return `Transform the following data into a ${targetBlockType} block format:

Original Data:
${JSON.stringify(originalData, null, 2)}

Requirements:
- Maintain data integrity
- Use appropriate data structure for ${targetBlockType}
- Include all relevant information
- Format for optimal display

Please provide the transformed data in the correct format for a ${targetBlockType} block.`;
  }
} 