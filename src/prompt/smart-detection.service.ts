import { Injectable } from '@nestjs/common';

export interface DataPattern {
  type: 'tabular' | 'temporal' | 'hierarchical' | 'sequential' | 'categorical' | 'numerical' | 'textual';
  confidence: number;
  structure: any;
  metadata: {
    rowCount?: number;
    columnCount?: number;
    hasDates?: boolean;
    hasNumbers?: boolean;
    hasCategories?: boolean;
    timeSeries?: boolean;
    nested?: boolean;
  };
}

export interface BlockRecommendation {
  type: string;
  confidence: number;
  reasoning: string;
  suggestedData: any;
  config: any;
}

export interface IntentAnalysis {
  primaryIntent: string;
  secondaryIntents: string[];
  dataRequirements: string[];
  visualizationNeeds: string[];
  interactionType: 'view' | 'edit' | 'analyze' | 'plan' | 'track';
}

@Injectable()
export class SmartDetectionService {
  
  /**
   * Analyze user prompt to determine intent and data requirements
   */
  analyzeIntent(prompt: string): IntentAnalysis {
    const lowerPrompt = prompt.toLowerCase();
    
    // Primary intent detection
    const intents = {
      view: ['show', 'display', 'view', 'see', 'look at', 'present'],
      edit: ['edit', 'modify', 'change', 'update', 'add', 'remove', 'create'],
      analyze: ['analyze', 'analyze', 'examine', 'study', 'investigate', 'compare'],
      plan: ['plan', 'schedule', 'organize', 'arrange', 'prepare'],
      track: ['track', 'monitor', 'follow', 'watch', 'observe']
    };

    let primaryIntent = 'view';
    let maxScore = 0;

    for (const [intent, keywords] of Object.entries(intents)) {
      const score = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent;
      }
    }

    // Secondary intents
    const secondaryIntents = Object.keys(intents).filter(intent => 
      intent !== primaryIntent && 
      intents[intent as keyof typeof intents].some(keyword => lowerPrompt.includes(keyword))
    );

    // Data requirements analysis
    const dataRequirements = this.extractDataRequirements(lowerPrompt);
    
    // Visualization needs
    const visualizationNeeds = this.extractVisualizationNeeds(lowerPrompt);

    return {
      primaryIntent: primaryIntent as any,
      secondaryIntents,
      dataRequirements,
      visualizationNeeds,
      interactionType: primaryIntent as any
    };
  }

  /**
   * Analyze data structure to determine the best block type
   */
  analyzeDataStructure(data: any): DataPattern {
    if (!data) {
      return {
        type: 'textual',
        confidence: 0.5,
        structure: null,
        metadata: {}
      };
    }

    // Check if it's tabular data
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        return this.analyzeTabularData(data);
      }
    }

    // Check if it's a single object with specific patterns
    if (typeof data === 'object' && data !== null) {
      return this.analyzeObjectData(data);
    }

    // Check if it's text
    if (typeof data === 'string') {
      return this.analyzeTextData(data);
    }

    return {
      type: 'textual',
      confidence: 0.3,
      structure: data,
      metadata: {}
    };
  }

  /**
   * Generate block recommendations based on intent and data analysis
   */
  generateBlockRecommendations(
    intent: IntentAnalysis,
    dataPattern: DataPattern,
    rawData?: any
  ): BlockRecommendation[] {
    const recommendations: BlockRecommendation[] = [];

    // High confidence recommendations based on data pattern
    if (dataPattern.confidence > 0.7) {
      const patternRecommendation = this.getRecommendationByPattern(dataPattern, rawData);
      if (patternRecommendation) {
        recommendations.push(patternRecommendation);
      }
    }

    // Intent-based recommendations
    const intentRecommendations = this.getRecommendationsByIntent(intent, dataPattern);
    recommendations.push(...intentRecommendations);

    // Visualization-based recommendations
    const vizRecommendations = this.getRecommendationsByVisualization(intent.visualizationNeeds, dataPattern);
    recommendations.push(...vizRecommendations);

    // Sort by confidence and remove duplicates
    return this.deduplicateAndSortRecommendations(recommendations);
  }

  /**
   * Transform raw data into the correct format for a specific block type
   */
  transformDataForBlock(data: any, blockType: string): any {
    switch (blockType) {
      case 'table':
        return this.transformToTableData(data);
      case 'chart':
        return this.transformToChartData(data);
      case 'list':
        return this.transformToListData(data);
      case 'kanban':
        return this.transformToKanbanData(data);
      case 'timeline':
        return this.transformToTimelineData(data);
      case 'calendar':
        return this.transformToCalendarData(data);
      case 'text':
        return this.transformToTextData(data);
      default:
        return data;
    }
  }

  /**
   * Smart data extraction from various sources
   */
  extractStructuredData(rawInput: string): any {
    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(rawInput);
      return jsonData;
    } catch {}

    // Try to parse as CSV-like data
    const csvData = this.parseCSVLikeData(rawInput);
    if (csvData) return csvData;

    // Try to extract tabular data from text
    const tableData = this.extractTableFromText(rawInput);
    if (tableData) return tableData;

    // Try to extract list items
    const listData = this.extractListFromText(rawInput);
    if (listData) return listData;

    // Try to extract dates and events
    const eventData = this.extractEventsFromText(rawInput);
    if (eventData) return eventData;

    return null;
  }

  // Private helper methods

  private extractDataRequirements(prompt: string): string[] {
    const requirements: string[] = [];
    
    if (prompt.includes('data') || prompt.includes('information')) requirements.push('data');
    if (prompt.includes('chart') || prompt.includes('graph') || prompt.includes('visual')) requirements.push('visualization');
    if (prompt.includes('table') || prompt.includes('list') || prompt.includes('grid')) requirements.push('tabular');
    if (prompt.includes('timeline') || prompt.includes('schedule') || prompt.includes('calendar')) requirements.push('temporal');
    if (prompt.includes('task') || prompt.includes('todo') || prompt.includes('checklist')) requirements.push('tasks');
    if (prompt.includes('kanban') || prompt.includes('board') || prompt.includes('pipeline')) requirements.push('kanban');
    
    // Enhanced detection for structured lists and collections
    if (prompt.includes('law') || prompt.includes('rule') || prompt.includes('principle')) requirements.push('tabular');
    if (prompt.includes('highlight') || prompt.includes('summarize') || prompt.includes('organize')) requirements.push('tabular');
    if (prompt.includes('each') || prompt.includes('every') || prompt.includes('all')) requirements.push('tabular');
    if (prompt.includes('with') && (prompt.includes('summary') || prompt.includes('description'))) requirements.push('tabular');
    
    return requirements;
  }

  private extractVisualizationNeeds(prompt: string): string[] {
    const needs: string[] = [];
    
    if (prompt.includes('chart') || prompt.includes('graph')) needs.push('chart');
    if (prompt.includes('bar') || prompt.includes('column')) needs.push('bar-chart');
    if (prompt.includes('line') || prompt.includes('trend')) needs.push('line-chart');
    if (prompt.includes('pie') || prompt.includes('donut')) needs.push('pie-chart');
    if (prompt.includes('table') || prompt.includes('grid')) needs.push('table');
    if (prompt.includes('timeline')) needs.push('timeline');
    if (prompt.includes('calendar')) needs.push('calendar');
    
    // Enhanced detection for table needs
    if (prompt.includes('highlight') && (prompt.includes('each') || prompt.includes('law') || prompt.includes('rule'))) needs.push('table');
    if (prompt.includes('create a table')) needs.push('table');
    if (prompt.includes('organize') && (prompt.includes('list') || prompt.includes('data'))) needs.push('table');
    if (prompt.includes('summarize') && (prompt.includes('with') || prompt.includes('including'))) needs.push('table');
    
    return needs;
  }

  private analyzeTabularData(data: any[]): DataPattern {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    const hasDates = keys.some(key => 
      data.some(item => this.isDateString(item[key]))
    );
    const hasNumbers = keys.some(key => 
      data.some(item => typeof item[key] === 'number')
    );
    const hasCategories = keys.some(key => 
      data.some(item => typeof item[key] === 'string' && !this.isDateString(item[key]))
    );

    return {
      type: 'tabular',
      confidence: 0.9,
      structure: { rows: data, columns: keys },
      metadata: {
        rowCount: data.length,
        columnCount: keys.length,
        hasDates,
        hasNumbers,
        hasCategories,
        timeSeries: hasDates && hasNumbers
      }
    };
  }

  private analyzeObjectData(data: any): DataPattern {
    // Check for specific patterns
    if (data.events && Array.isArray(data.events)) {
      return {
        type: 'temporal',
        confidence: 0.8,
        structure: data,
        metadata: {
          hasDates: data.events.some((e: any) => e.date || e.timestamp),
          timeSeries: true
        }
      };
    }

    if (data.tasks && Array.isArray(data.tasks)) {
      return {
        type: 'sequential',
        confidence: 0.8,
        structure: data,
        metadata: {
          hasCategories: true
        }
      };
    }

    if (data.columns && Array.isArray(data.columns)) {
      return {
        type: 'hierarchical',
        confidence: 0.7,
        structure: data,
        metadata: {
          nested: true
        }
      };
    }

    return {
      type: 'textual',
      confidence: 0.5,
      structure: data,
      metadata: {}
    };
  }

  private analyzeTextData(text: string): DataPattern {
    // Check if text contains structured data patterns
    const lines = text.split('\n');
    const hasTablePattern = lines.some(line => line.includes('|') || line.includes('\t'));
    const hasListPattern = lines.some(line => line.match(/^[-*•]\s/));
    const hasDatePattern = text.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);

    if (hasTablePattern) {
      return {
        type: 'tabular',
        confidence: 0.7,
        structure: { text, format: 'table' },
        metadata: { hasDates: !!hasDatePattern }
      };
    }

    if (hasListPattern) {
      return {
        type: 'sequential',
        confidence: 0.6,
        structure: { text, format: 'list' },
        metadata: {}
      };
    }

    return {
      type: 'textual',
      confidence: 0.9,
      structure: { text },
      metadata: {}
    };
  }

  private getRecommendationByPattern(dataPattern: DataPattern, rawData?: any): BlockRecommendation | null {
    switch (dataPattern.type) {
      case 'tabular':
        if (dataPattern.metadata.timeSeries) {
          return {
            type: 'chart',
            confidence: 0.9,
            reasoning: 'Time series data detected - chart visualization recommended',
            suggestedData: this.transformToChartData(rawData || dataPattern.structure),
            config: { type: 'line' }
          };
        }
        return {
          type: 'table',
          confidence: 0.9,
          reasoning: 'Tabular data structure detected',
          suggestedData: this.transformToTableData(rawData || dataPattern.structure),
          config: { sortable: true, filterable: true }
        };

      case 'temporal':
        if (dataPattern.metadata.hasDates) {
          return {
            type: 'timeline',
            confidence: 0.8,
            reasoning: 'Temporal data with dates detected',
            suggestedData: this.transformToTimelineData(rawData || dataPattern.structure),
            config: {}
          };
        }
        break;

      case 'sequential':
        return {
          type: 'list',
          confidence: 0.8,
          reasoning: 'Sequential data structure detected',
          suggestedData: this.transformToListData(rawData || dataPattern.structure),
          config: {}
        };

      case 'hierarchical':
        return {
          type: 'kanban',
          confidence: 0.7,
          reasoning: 'Hierarchical data structure detected',
          suggestedData: this.transformToKanbanData(rawData || dataPattern.structure),
          config: {}
        };
    }

    return null;
  }

  private getRecommendationsByIntent(intent: IntentAnalysis, dataPattern: DataPattern): BlockRecommendation[] {
    const recommendations: BlockRecommendation[] = [];

    // View intent
    if (intent.primaryIntent === 'view') {
      if (dataPattern.type === 'tabular') {
        recommendations.push({
          type: 'table',
          confidence: 0.8,
          reasoning: 'View intent with tabular data',
          suggestedData: this.transformToTableData(dataPattern.structure),
          config: { sortable: true }
        });
      }
    }

    // Analyze intent
    if (intent.primaryIntent === 'analyze') {
      if (dataPattern.metadata.hasNumbers) {
        recommendations.push({
          type: 'chart',
          confidence: 0.8,
          reasoning: 'Analysis intent with numerical data',
          suggestedData: this.transformToChartData(dataPattern.structure),
          config: { type: 'bar' }
        });
      }
    }

    // Plan intent
    if (intent.primaryIntent === 'plan') {
      recommendations.push({
        type: 'timeline',
        confidence: 0.7,
        reasoning: 'Planning intent detected',
        suggestedData: this.transformToTimelineData(dataPattern.structure),
        config: {}
      });
    }

    // Track intent
    if (intent.primaryIntent === 'track') {
      recommendations.push({
        type: 'kanban',
        confidence: 0.7,
        reasoning: 'Tracking intent detected',
        suggestedData: this.transformToKanbanData(dataPattern.structure),
        config: {}
      });
    }

    return recommendations;
  }

  private getRecommendationsByVisualization(needs: string[], dataPattern: DataPattern): BlockRecommendation[] {
    const recommendations: BlockRecommendation[] = [];

    needs.forEach(need => {
      switch (need) {
        case 'chart':
          recommendations.push({
            type: 'chart',
            confidence: 0.8,
            reasoning: 'Chart visualization requested',
            suggestedData: this.transformToChartData(dataPattern.structure),
            config: { type: 'bar' }
          });
          break;
        case 'table':
          recommendations.push({
            type: 'table',
            confidence: 0.8,
            reasoning: 'Table visualization requested',
            suggestedData: this.transformToTableData(dataPattern.structure),
            config: {}
          });
          break;
        case 'timeline':
          recommendations.push({
            type: 'timeline',
            confidence: 0.8,
            reasoning: 'Timeline visualization requested',
            suggestedData: this.transformToTimelineData(dataPattern.structure),
            config: {}
          });
          break;
        case 'calendar':
          recommendations.push({
            type: 'calendar',
            confidence: 0.8,
            reasoning: 'Calendar visualization requested',
            suggestedData: this.transformToCalendarData(dataPattern.structure),
            config: {}
          });
          break;
      }
    });

    return recommendations;
  }

  private deduplicateAndSortRecommendations(recommendations: BlockRecommendation[]): BlockRecommendation[] {
    const seen = new Set<string>();
    const unique = recommendations.filter(rec => {
      const key = rec.type;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  // Data transformation methods
  private transformToTableData(data: any): any {
    if (Array.isArray(data)) {
      const columns = data.length > 0 ? Object.keys(data[0]).map(key => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        type: this.inferColumnType(data, key)
      })) : [];
      
      return {
        columns,
        rows: data
      };
    }
    
    if (data.rows && data.columns) {
      return data;
    }
    
    return { columns: [], rows: [] };
  }

  private transformToChartData(data: any): any {
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]);
      const labelKey = keys.find(key => this.isDateString(data[0][key])) || keys[0];
      const valueKey = keys.find(key => typeof data[0][key] === 'number') || keys[1];
      
      return {
        type: 'bar',
        labels: data.map(item => item[labelKey]),
        data: data.map(item => item[valueKey])
      };
    }
    
    return { type: 'bar', labels: [], data: [] };
  }

  private transformToListData(data: any): any {
    if (Array.isArray(data)) {
      return {
        items: data.map((item, index) => ({
          id: index.toString(),
          text: typeof item === 'string' ? item : JSON.stringify(item)
        }))
      };
    }
    
    if (data.tasks) {
      return {
        items: data.tasks.map((task: any, index: number) => ({
          id: task.id || index.toString(),
          text: task.text || task.title || task.name
        }))
      };
    }
    
    return { items: [] };
  }

  private transformToKanbanData(data: any): any {
    if (data.columns && data.cards) {
      return data;
    }
    
    if (Array.isArray(data)) {
      // Try to infer columns from data
      const statuses = [...new Set(data.map(item => item.status || item.state || 'To Do'))];
      const columns = statuses.map(status => ({
        id: status.toLowerCase().replace(/\s+/g, '-'),
        title: status,
        items: data.filter(item => (item.status || item.state || 'To Do') === status)
          .map((item, index) => ({
            id: item.id || index.toString(),
            title: item.title || item.name || item.text,
            tag: item.tag || item.category || 'General',
            assignee: item.assignee || item.owner || 'Unassigned'
          }))
      }));
      
      return { columns };
    }
    
    return { columns: [] };
  }

  private transformToTimelineData(data: any): any {
    if (data.events) {
      return {
        events: data.events.map((event: any, index: number) => ({
          id: event.id || index.toString(),
          title: event.title || event.name,
          date: event.date || event.timestamp || event.startDate,
          description: event.description || event.details
        }))
      };
    }
    
    if (Array.isArray(data)) {
      return {
        events: data.map((item, index) => ({
          id: index.toString(),
          title: item.title || item.name || item.text,
          date: item.date || item.timestamp,
          description: item.description || item.details
        }))
      };
    }
    
    return { events: [] };
  }

  private transformToCalendarData(data: any): any {
    if (data.events) {
      return {
        events: data.events.map((event: any, index: number) => ({
          id: event.id || index.toString(),
          date: event.date || event.timestamp || event.startDate,
          title: event.title || event.name,
          description: event.description || event.details
        }))
      };
    }
    
    return { events: [] };
  }

  private transformToTextData(data: any): any {
    if (typeof data === 'string') {
      return { content: data };
    }
    
    if (data.content) {
      return data;
    }
    
    return { content: JSON.stringify(data, null, 2) };
  }

  // Helper methods
  private isDateString(value: any): boolean {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}/.test(value);
  }

  private inferColumnType(data: any[], key: string): string {
    const values = data.map(item => item[key]).filter(v => v !== null && v !== undefined);
    if (values.length === 0) return 'text';
    
    const firstValue = values[0];
    if (typeof firstValue === 'number') return 'number';
    if (this.isDateString(firstValue)) return 'date';
    if (typeof firstValue === 'string') {
      // Check if it's an email
      if (firstValue.includes('@')) return 'email';
      // Check if it's a select/category
      const uniqueValues = [...new Set(values)];
      if (uniqueValues.length <= 10) return 'select';
      return 'text';
    }
    
    return 'text';
  }

  private parseCSVLikeData(text: string): any[] | null {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    return data.length > 0 ? data : null;
  }

  private extractTableFromText(text: string): any[] | null {
    const lines = text.split('\n');
    const tableLines = lines.filter(line => line.includes('|'));
    if (tableLines.length < 2) return null;
    
    const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
    const data = tableLines.slice(1).map(line => {
      const values = line.split('|').map(v => v.trim()).filter(v => v);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    return data.length > 0 ? data : null;
  }

  private extractListFromText(text: string): any[] | null {
    const lines = text.split('\n');
    const listItems = lines
      .map(line => line.match(/^[-*•]\s*(.+)/))
      .filter(match => match)
      .map(match => match![1].trim());
    
    return listItems.length > 0 ? listItems : null;
  }

  private extractEventsFromText(text: string): any[] | null {
    const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g;
    const dates = text.match(datePattern);
    
    if (!dates || dates.length === 0) return null;
    
    return dates.map((date, index) => ({
      id: index.toString(),
      title: `Event ${index + 1}`,
      date,
      description: 'Extracted from text'
    }));
  }
} 