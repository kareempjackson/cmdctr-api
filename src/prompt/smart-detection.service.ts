import { Injectable } from '@nestjs/common';

export interface DataPattern {
  type: 'tabular' | 'temporal' | 'hierarchical' | 'sequential' | 'categorical' | 'numerical' | 'textual' | 'mixed' | 'structured' | 'unstructured';
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
    complexity?: 'simple' | 'moderate' | 'complex';
    dataQuality?: 'high' | 'medium' | 'low';
    relationships?: string[];
    patterns?: string[];
  };
}

export interface BlockRecommendation {
  type: string;
  confidence: number;
  reasoning: string;
  suggestedData: any;
  config: any;
  priority?: 'primary' | 'secondary' | 'supporting';
  layout?: {
    position?: number;
    width?: number;
    height?: number;
    responsive?: boolean;
  };
}

export interface IntentAnalysis {
  primaryIntent: string;
  secondaryIntents: string[];
  dataRequirements: string[];
  visualizationNeeds: string[];
  interactionType: 'view' | 'edit' | 'analyze' | 'plan' | 'track' | 'create' | 'manage' | 'collaborate';
  complexity: 'simple' | 'moderate' | 'complex';
  domain?: string;
  useCase?: string;
  urgency?: 'low' | 'medium' | 'high';
}

export interface SmartCanvasContext {
  workspaceId: string;
  userId: string;
  existingBlocks?: any[];
  userPreferences?: any;
  workspaceType?: string;
  recentActivity?: any[];
  collaborationLevel?: 'individual' | 'team' | 'organization';
}

export interface EnhancedBlockRecommendation extends BlockRecommendation {
  combination?: string[];
  alternatives?: BlockRecommendation[];
  dependencies?: string[];
  estimatedComplexity?: number;
  userExperience?: 'beginner' | 'intermediate' | 'advanced';
}

@Injectable()
export class SmartDetectionService {
  
  /**
   * Enhanced intent analysis with advanced pattern recognition
   */
  analyzeIntent(prompt: string): IntentAnalysis {
    const lowerPrompt = prompt.toLowerCase();
    
    // Enhanced primary intent detection with context awareness
    const intents = {
      view: ['show', 'display', 'view', 'see', 'look at', 'present', 'what', 'how', 'explain', 'describe'],
      edit: ['edit', 'modify', 'change', 'update', 'add', 'remove', 'create', 'build', 'develop'],
      analyze: ['analyze', 'examine', 'study', 'investigate', 'compare', 'evaluate', 'assess', 'review'],
      plan: ['plan', 'schedule', 'organize', 'arrange', 'prepare', 'design', 'strategize'],
      track: ['track', 'monitor', 'follow', 'watch', 'observe', 'implement', 'execute', 'practice', 'apply'],
      create: ['create', 'build', 'develop', 'generate', 'produce', 'make'],
      manage: ['manage', 'administer', 'oversee', 'coordinate', 'supervise'],
      collaborate: ['collaborate', 'share', 'team', 'group', 'work together']
    };

    // Enhanced scoring system with context weighting
    let primaryIntent = 'view';
    let maxScore = 0;

    for (const [intent, keywords] of Object.entries(intents)) {
      let score = 0;
      
      // Base keyword matching
      score += keywords.filter(keyword => lowerPrompt.includes(keyword)).length * 2;
      
      // Context-aware scoring
      if (intent === 'track' && this.isActionOriented(lowerPrompt)) {
        score += 3; // Boost for action-oriented tracking
      }
      
      if (intent === 'analyze' && this.isDataAnalysis(lowerPrompt)) {
        score += 3; // Boost for data analysis
      }
      
      if (intent === 'plan' && this.isPlanningScenario(lowerPrompt)) {
        score += 3; // Boost for planning scenarios
      }
      
      if (intent === 'collaborate' && this.isCollaborationScenario(lowerPrompt)) {
        score += 3; // Boost for collaboration
      }
      
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent;
      }
    }

    // Override logic for question-based prompts
    const isQuestion = this.isQuestionPrompt(lowerPrompt);
    if (isQuestion && !this.isActionOriented(lowerPrompt)) {
      primaryIntent = 'view';
    }

    // Enhanced secondary intents with domain detection
    const secondaryIntents = this.extractSecondaryIntents(lowerPrompt, primaryIntent);
    
    // Domain detection
    const domain = this.detectDomain(lowerPrompt);
    
    // Use case detection
    const useCase = this.detectUseCase(lowerPrompt, primaryIntent);
    
    // Complexity assessment
    const complexity = this.assessComplexity(lowerPrompt, primaryIntent);
    
    // Urgency detection
    const urgency = this.detectUrgency(lowerPrompt);

    // Enhanced data requirements analysis
    const dataRequirements = this.extractDataRequirements(lowerPrompt);
    
    // Enhanced visualization needs
    const visualizationNeeds = this.extractVisualizationNeeds(lowerPrompt);

    return {
      primaryIntent: primaryIntent as any,
      secondaryIntents,
      dataRequirements,
      visualizationNeeds,
      interactionType: primaryIntent as any,
      complexity,
      domain,
      useCase,
      urgency
    };
  }

  /**
   * Enhanced data structure analysis with pattern recognition
   */
  analyzeDataStructure(data: any): DataPattern {
    if (!data) {
      return {
        type: 'textual',
        confidence: 0.5,
        structure: null,
        metadata: {
          complexity: 'simple',
          dataQuality: 'low'
        }
      };
    }

    // Enhanced tabular data detection
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        return this.analyzeTabularData(data);
      }
    }

    // Enhanced object data analysis
    if (typeof data === 'object' && data !== null) {
      return this.analyzeObjectData(data);
    }

    // Enhanced text data analysis
    if (typeof data === 'string') {
      return this.analyzeTextData(data);
    }

    return {
      type: 'textual',
      confidence: 0.3,
      structure: data,
      metadata: {
        complexity: 'simple',
        dataQuality: 'low'
      }
    };
  }

  /**
   * Enhanced block recommendations with context awareness
   */
  generateBlockRecommendations(
    intent: IntentAnalysis,
    dataPattern: DataPattern,
    rawData?: any,
    context?: SmartCanvasContext
  ): EnhancedBlockRecommendation[] {
    const recommendations: EnhancedBlockRecommendation[] = [];

    // High confidence pattern-based recommendations
    if (dataPattern.confidence > 0.7) {
      const patternRecommendation = this.getRecommendationByPattern(dataPattern, rawData);
      if (patternRecommendation) {
        recommendations.push({
          ...patternRecommendation,
          priority: 'primary',
          estimatedComplexity: this.estimateBlockComplexity(patternRecommendation.type, dataPattern),
          userExperience: this.determineUserExperience(intent.complexity, patternRecommendation.type)
        });
      }
    }

    // Enhanced intent-based recommendations
    const intentRecommendations = this.getRecommendationsByIntent(intent, dataPattern);
    recommendations.push(...intentRecommendations.map(rec => ({
      ...rec,
      priority: rec.priority || 'secondary' as 'primary' | 'secondary' | 'supporting',
      estimatedComplexity: this.estimateBlockComplexity(rec.type, dataPattern),
      userExperience: this.determineUserExperience(intent.complexity, rec.type)
    })));

    // Enhanced visualization-based recommendations
    const vizRecommendations = this.getRecommendationsByVisualization(intent.visualizationNeeds, dataPattern);
    recommendations.push(...vizRecommendations.map(rec => ({
      ...rec,
      priority: 'supporting' as 'primary' | 'secondary' | 'supporting',
      estimatedComplexity: this.estimateBlockComplexity(rec.type, dataPattern),
      userExperience: this.determineUserExperience(intent.complexity, rec.type)
    })));

    // Context-aware recommendations
    if (context) {
      const contextRecommendations = this.getContextAwareRecommendations(intent, dataPattern, context);
      recommendations.push(...contextRecommendations);
    }

    // Multi-block layout optimization
    const optimizedRecommendations = this.optimizeBlockCombinations(recommendations, intent, dataPattern);

    // Sort by confidence and priority
    return this.deduplicateAndSortRecommendations(optimizedRecommendations);
  }

  /**
   * Enhanced data extraction with multiple format support
   */
  extractStructuredData(rawInput: string): any {
    // Enhanced CSV detection
    const csvData = this.parseCSVLikeData(rawInput);
    if (csvData) return csvData;

    // Enhanced table detection
    const tableData = this.extractTableFromText(rawInput);
    if (tableData) return tableData;

    // Enhanced list detection
    const listData = this.extractListFromText(rawInput);
    if (listData) return listData;

    // Enhanced event detection
    const eventData = this.extractEventsFromText(rawInput);
    if (eventData) return eventData;

    // Enhanced JSON detection
    const jsonData = this.extractJSONFromText(rawInput);
    if (jsonData) return jsonData;

    // Enhanced markdown table detection
    const markdownTableData = this.extractMarkdownTable(rawInput);
    if (markdownTableData) return markdownTableData;

    // Enhanced structured text detection
    const structuredTextData = this.extractStructuredText(rawInput);
    if (structuredTextData) return structuredTextData;

    return null;
  }

  // Private helper methods for enhanced functionality

  private isActionOriented(prompt: string): boolean {
    const actionKeywords = ['implement', 'execute', 'practice', 'apply', 'do', 'perform', 'carry out'];
    const questionKeywords = ['what', 'how', 'which', 'should', 'could', 'would'];
    
    const hasAction = actionKeywords.some(keyword => prompt.includes(keyword));
    const isQuestion = questionKeywords.some(keyword => prompt.includes(keyword));
    
    return hasAction && !isQuestion;
  }

  private isDataAnalysis(prompt: string): boolean {
    const analysisKeywords = ['analyze', 'examine', 'study', 'investigate', 'compare', 'evaluate', 'assess'];
    const dataKeywords = ['data', 'metrics', 'performance', 'results', 'statistics', 'numbers'];
    
    return analysisKeywords.some(keyword => prompt.includes(keyword)) &&
           dataKeywords.some(keyword => prompt.includes(keyword));
  }

  private isPlanningScenario(prompt: string): boolean {
    const planningKeywords = ['plan', 'schedule', 'organize', 'arrange', 'prepare', 'design', 'strategize'];
    const projectKeywords = ['project', 'campaign', 'initiative', 'strategy', 'roadmap'];
    
    return planningKeywords.some(keyword => prompt.includes(keyword)) &&
           projectKeywords.some(keyword => prompt.includes(keyword));
  }

  private isCollaborationScenario(prompt: string): boolean {
    const collaborationKeywords = ['collaborate', 'share', 'team', 'group', 'work together', 'coordinate'];
    const teamKeywords = ['team', 'members', 'colleagues', 'stakeholders', 'partners'];
    
    return collaborationKeywords.some(keyword => prompt.includes(keyword)) ||
           teamKeywords.some(keyword => prompt.includes(keyword));
  }

  private isQuestionPrompt(prompt: string): boolean {
    const questionKeywords = ['what', 'how', 'which', 'should', 'could', 'would', 'why', 'when', 'where'];
    return questionKeywords.some(keyword => prompt.includes(keyword));
  }

  private extractSecondaryIntents(prompt: string, primaryIntent: string): string[] {
    const intents = {
      view: ['show', 'display', 'view', 'see', 'look at', 'present'],
      edit: ['edit', 'modify', 'change', 'update', 'add', 'remove', 'create'],
      analyze: ['analyze', 'examine', 'study', 'investigate', 'compare'],
      plan: ['plan', 'schedule', 'organize', 'arrange', 'prepare'],
      track: ['track', 'monitor', 'follow', 'watch', 'observe', 'implement', 'execute', 'practice', 'apply'],
      create: ['create', 'build', 'develop', 'generate', 'produce', 'make'],
      manage: ['manage', 'administer', 'oversee', 'coordinate', 'supervise'],
      collaborate: ['collaborate', 'share', 'team', 'group', 'work together']
    };

    const secondaryIntents = Object.keys(intents).filter(intent => 
      intent !== primaryIntent && 
      intents[intent as keyof typeof intents].some(keyword => prompt.includes(keyword))
    );

    // Add context-specific secondary intents
    if (prompt.includes('project')) secondaryIntents.push('project');
    if (prompt.includes('task')) secondaryIntents.push('tasks');
    if (prompt.includes('progress')) secondaryIntents.push('progress');
    if (prompt.includes('implementation')) secondaryIntents.push('implementation');
    if (prompt.includes('dashboard')) secondaryIntents.push('dashboard');
    if (prompt.includes('report')) secondaryIntents.push('report');
    if (prompt.includes('summary')) secondaryIntents.push('summary');
    if (prompt.includes('overview')) secondaryIntents.push('overview');

    return [...new Set(secondaryIntents)]; // Remove duplicates
  }

  private detectDomain(prompt: string): string | undefined {
    const domains = {
      business: ['business', 'company', 'organization', 'enterprise', 'corporate'],
      marketing: ['marketing', 'campaign', 'advertising', 'promotion', 'brand'],
      sales: ['sales', 'revenue', 'income', 'leads', 'customers', 'clients'],
      finance: ['finance', 'financial', 'budget', 'expenses', 'revenue', 'profit'],
      hr: ['hr', 'human resources', 'employees', 'staff', 'recruitment', 'hiring'],
      project: ['project', 'development', 'engineering', 'technical', 'code'],
      education: ['education', 'learning', 'training', 'course', 'study'],
      research: ['research', 'analysis', 'study', 'investigation', 'survey']
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => prompt.includes(keyword))) {
        return domain;
      }
    }

    return undefined;
  }

  private detectUseCase(prompt: string, primaryIntent: string): string | undefined {
    const useCases = {
      'project-management': ['project', 'task', 'milestone', 'deadline', 'timeline'],
      'data-analysis': ['data', 'metrics', 'analytics', 'performance', 'statistics'],
      'planning': ['plan', 'strategy', 'roadmap', 'schedule', 'timeline'],
      'tracking': ['track', 'monitor', 'progress', 'status', 'update'],
      'collaboration': ['team', 'share', 'collaborate', 'coordinate', 'work together'],
      'reporting': ['report', 'summary', 'overview', 'dashboard', 'status'],
      'learning': ['learn', 'study', 'practice', 'training', 'education'],
      'decision-making': ['decide', 'choose', 'evaluate', 'compare', 'assess']
    };

    for (const [useCase, keywords] of Object.entries(useCases)) {
      if (keywords.some(keyword => prompt.includes(keyword))) {
        return useCase;
      }
    }

    return undefined;
  }

  private assessComplexity(prompt: string, primaryIntent: string): 'simple' | 'moderate' | 'complex' {
    const complexityIndicators = {
      simple: ['show', 'view', 'display', 'list', 'basic', 'simple'],
      moderate: ['analyze', 'compare', 'organize', 'plan', 'track'],
      complex: ['comprehensive', 'detailed', 'advanced', 'complex', 'multi', 'integrated']
    };

    let complexityScore = 0;
    
    // Base complexity from intent
    if (primaryIntent === 'view') complexityScore += 1;
    else if (primaryIntent === 'analyze' || primaryIntent === 'plan') complexityScore += 2;
    else if (primaryIntent === 'track' || primaryIntent === 'manage') complexityScore += 3;

    // Add complexity from keywords
    for (const [level, keywords] of Object.entries(complexityIndicators)) {
      const matches = keywords.filter(keyword => prompt.includes(keyword)).length;
      if (level === 'simple') complexityScore += matches;
      else if (level === 'moderate') complexityScore += matches * 2;
      else if (level === 'complex') complexityScore += matches * 3;
    }

    // Add complexity from data requirements
    if (prompt.includes('multiple') || prompt.includes('various') || prompt.includes('different')) {
      complexityScore += 2;
    }

    if (complexityScore <= 2) return 'simple';
    else if (complexityScore <= 5) return 'moderate';
    else return 'complex';
  }

  private detectUrgency(prompt: string): 'low' | 'medium' | 'high' {
    const urgencyKeywords = {
      high: ['urgent', 'asap', 'immediately', 'now', 'quick', 'fast', 'emergency'],
      medium: ['soon', 'shortly', 'this week', 'deadline', 'due'],
      low: ['when convenient', 'no rush', 'take your time', 'eventually']
    };

    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      if (keywords.some(keyword => prompt.includes(keyword))) {
        return level as 'low' | 'medium' | 'high';
      }
    }

    return 'medium'; // Default
  }

  private estimateBlockComplexity(blockType: string, dataPattern: DataPattern): number {
    const baseComplexity = {
      'text': 1,
      'note': 1,
      'status': 1,
      'list': 2,
      'table': 3,
      'chart': 4,
      'kanban': 5,
      'timeline': 4,
      'calendar': 3,
      'embed': 2,
      'column': 3
    };

    let complexity = baseComplexity[blockType as keyof typeof baseComplexity] || 2;
    
    // Adjust based on data pattern
    if (dataPattern.metadata.complexity === 'complex') complexity += 2;
    else if (dataPattern.metadata.complexity === 'moderate') complexity += 1;
    
    // Adjust based on data quality
    if (dataPattern.metadata.dataQuality === 'low') complexity += 1;
    
    return Math.min(complexity, 10); // Cap at 10
  }

  private determineUserExperience(complexity: string, blockType: string): 'beginner' | 'intermediate' | 'advanced' {
    const blockComplexity = {
      'text': 'beginner',
      'note': 'beginner',
      'status': 'beginner',
      'list': 'beginner',
      'table': 'intermediate',
      'chart': 'intermediate',
      'kanban': 'advanced',
      'timeline': 'intermediate',
      'calendar': 'intermediate',
      'embed': 'beginner',
      'column': 'intermediate'
    };

    const blockLevel = blockComplexity[blockType as keyof typeof blockComplexity] || 'intermediate';
    
    if (complexity === 'complex' && blockLevel === 'intermediate') return 'advanced';
    if (complexity === 'simple' && blockLevel === 'intermediate') return 'beginner';
    
    return blockLevel as 'beginner' | 'intermediate' | 'advanced';
  }

  private getContextAwareRecommendations(
    intent: IntentAnalysis,
    dataPattern: DataPattern,
    context: SmartCanvasContext
  ): EnhancedBlockRecommendation[] {
    const recommendations: EnhancedBlockRecommendation[] = [];

    // Collaboration-aware recommendations
    if (context.collaborationLevel === 'team' || context.collaborationLevel === 'organization') {
      recommendations.push({
        type: 'smart-notes-sticky',
        confidence: 0.7,
        reasoning: 'Team collaboration - adding sticky notes for quick communication',
        suggestedData: { noteId: null },
        config: {},
        priority: 'supporting',
        estimatedComplexity: 2,
        userExperience: 'beginner'
      });
    }

    // Workspace type recommendations
    if (context.workspaceType === 'project') {
      recommendations.push({
        type: 'kanban',
        confidence: 0.8,
        reasoning: 'Project workspace - Kanban for task management',
        suggestedData: this.transformToKanbanData(dataPattern.structure),
        config: {
          columns: [
            { id: 'backlog', title: 'Backlog', color: '#e3f2fd' },
            { id: 'in-progress', title: 'In Progress', color: '#fff3e0' },
            { id: 'review', title: 'Review', color: '#fce4ec' },
            { id: 'done', title: 'Done', color: '#e8f5e8' }
          ]
        },
        priority: 'primary',
        estimatedComplexity: 5,
        userExperience: 'advanced'
      });
    }

    return recommendations;
  }

  private optimizeBlockCombinations(
    recommendations: EnhancedBlockRecommendation[],
    intent: IntentAnalysis,
    dataPattern: DataPattern
  ): EnhancedBlockRecommendation[] {
    const optimized: EnhancedBlockRecommendation[] = [];

    // Group recommendations by priority
    const primary = recommendations.filter(r => r.priority === 'primary');
    const secondary = recommendations.filter(r => r.priority === 'secondary');
    const supporting = recommendations.filter(r => r.priority === 'supporting');

    // Add primary recommendations first
    optimized.push(...primary);

    // Add secondary recommendations with layout optimization
    secondary.forEach((rec, index) => {
      optimized.push({
        ...rec,
        layout: {
          position: index + primary.length,
          width: this.calculateOptimalWidth(rec.type, intent.complexity),
          height: this.calculateOptimalHeight(rec.type, dataPattern),
          responsive: true
        }
      });
    });

    // Add supporting recommendations
    supporting.forEach((rec, index) => {
      optimized.push({
        ...rec,
        layout: {
          position: index + primary.length + secondary.length,
          width: 1, // Full width for supporting blocks
          height: 1,
          responsive: true
        }
      });
    });

    return optimized;
  }

  private calculateOptimalWidth(blockType: string, complexity: string): number {
    const baseWidths = {
      'text': 2,
      'note': 1,
      'status': 1,
      'list': 2,
      'table': 3,
      'chart': 2,
      'kanban': 3,
      'timeline': 3,
      'calendar': 2,
      'embed': 2,
      'column': 3
    };

    let width = baseWidths[blockType as keyof typeof baseWidths] || 2;
    
    // Adjust based on complexity
    if (complexity === 'complex') width = Math.min(width + 1, 3);
    else if (complexity === 'simple') width = Math.max(width - 1, 1);
    
    return width;
  }

  private calculateOptimalHeight(blockType: string, dataPattern: DataPattern): number {
    const baseHeights = {
      'text': 1,
      'note': 1,
      'status': 1,
      'list': 2,
      'table': 3,
      'chart': 2,
      'kanban': 4,
      'timeline': 2,
      'calendar': 3,
      'embed': 2,
      'column': 3
    };

    let height = baseHeights[blockType as keyof typeof baseHeights] || 2;
    
    // Adjust based on data complexity
    if (dataPattern.metadata.complexity === 'complex') height = Math.min(height + 1, 4);
    else if (dataPattern.metadata.complexity === 'simple') height = Math.max(height - 1, 1);
    
    return height;
  }

  // Enhanced data extraction methods

  private extractJSONFromText(text: string): any | null {
    try {
      // Look for JSON patterns in the text
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  private extractMarkdownTable(text: string): any[] | null {
    const lines = text.split('\n');
    const tableLines = lines.filter(line => line.includes('|'));
    
    if (tableLines.length < 2) return null;
    
    try {
      const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
      const data = tableLines.slice(2).map(line => {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = cells[index] || '';
        });
        return row;
      });
      
      return data;
    } catch (error) {
      return null;
    }
  }

  private extractStructuredText(text: string): any | null {
    // Look for structured patterns like "Title: Content" or "Key - Value"
    const structuredPatterns = [
      /^([^:]+):\s*(.+)$/gm, // Title: Content
      /^([^-]+)-\s*(.+)$/gm, // Key - Value
      /^([^=]+)=\s*(.+)$/gm  // Key = Value
    ];
    
    for (const pattern of structuredPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const structured = matches.map(match => ({
          key: match[1].trim(),
          value: match[2].trim()
        }));
        return structured;
      }
    }
    
    return null;
  }

  /**
   * Enhanced block recommendation generation with smart combinations
   */
  private generateSmartBlockCombinations(intent: IntentAnalysis, dataPattern: DataPattern): string[][] {
    const combinations: string[][] = [];

    // Project Management Combinations
    if (intent.useCase === 'project-management' || intent.domain === 'project') {
      combinations.push(['kanban', 'timeline', 'text']);
      combinations.push(['kanban', 'list', 'status']);
      combinations.push(['timeline', 'table', 'text']);
    }

    // Data Analysis Combinations
    if (intent.useCase === 'data-analysis' || intent.primaryIntent === 'analyze') {
      combinations.push(['chart', 'table', 'text']);
      combinations.push(['chart', 'chart', 'text']); // Multiple charts
      combinations.push(['table', 'text', 'status']);
    }

    // Planning Combinations
    if (intent.useCase === 'planning' || intent.primaryIntent === 'plan') {
      combinations.push(['timeline', 'list', 'text']);
      combinations.push(['calendar', 'list', 'text']);
      combinations.push(['table', 'text', 'status']);
    }

    // Tracking Combinations
    if (intent.useCase === 'tracking' || intent.primaryIntent === 'track') {
      combinations.push(['kanban', 'chart', 'text']);
      combinations.push(['table', 'chart', 'status']);
      combinations.push(['list', 'text', 'status']);
    }

    // Reporting Combinations
    if (intent.useCase === 'reporting') {
      combinations.push(['table', 'chart', 'text']);
      combinations.push(['chart', 'chart', 'text']);
      combinations.push(['table', 'text', 'status']);
    }

    // Collaboration Combinations
    if (intent.primaryIntent === 'collaborate') {
      combinations.push(['kanban', 'smart-notes-sticky', 'text']);
      combinations.push(['table', 'smart-notes-sticky', 'text']);
      combinations.push(['list', 'smart-notes-sticky', 'status']);
    }

    // Learning Combinations
    if (intent.useCase === 'learning') {
      combinations.push(['list', 'text', 'status']);
      combinations.push(['table', 'text', 'smart-notes-sticky']);
      combinations.push(['timeline', 'text', 'status']);
    }

    return combinations;
  }

  /**
   * Smart layout optimization for multi-block canvases
   */
  private optimizeLayoutForCombination(blocks: string[], intent: IntentAnalysis): any[] {
    const layout: Array<{
      type: string;
      position: number;
      width: number;
      height: number;
      responsive: boolean;
    }> = [];
    
    // Determine optimal layout based on block types and intent
    if (blocks.includes('kanban')) {
      // Kanban should be primary and take more space
      layout.push({
        type: 'kanban',
        position: 0,
        width: 3,
        height: 4,
        responsive: true
      });
      
      // Supporting blocks
      const supportingBlocks = blocks.filter(b => b !== 'kanban');
      supportingBlocks.forEach((block, index) => {
        layout.push({
          type: block,
          position: index + 1,
          width: 1,
          height: 2,
          responsive: true
        });
      });
    } else if (blocks.includes('chart') && blocks.includes('table')) {
      // Charts and tables should be side by side
      layout.push({
        type: 'chart',
        position: 0,
        width: 2,
        height: 3,
        responsive: true
      });
      
      layout.push({
        type: 'table',
        position: 1,
        width: 2,
        height: 3,
        responsive: true
      });
      
      // Text blocks below
      const textBlocks = blocks.filter(b => b === 'text');
      textBlocks.forEach((block, index) => {
        layout.push({
          type: block,
          position: 2 + index,
          width: 3,
          height: 1,
          responsive: true
        });
      });
    } else {
      // Default layout - stack vertically
      blocks.forEach((block, index) => {
        layout.push({
          type: block,
          position: index,
          width: 3,
          height: this.calculateOptimalHeight(block, { metadata: { complexity: intent.complexity } } as DataPattern),
          responsive: true
        });
      });
    }
    
    return layout;
  }

  /**
   * Enhanced data quality assessment
   */
  private assessDataQuality(data: any): 'high' | 'medium' | 'low' {
    if (!data) return 'low';
    
    let score = 0;
    
    // Check for completeness
    if (Array.isArray(data) && data.length > 0) {
      score += Math.min(data.length / 10, 3); // Bonus for having data
      
      // Check first item for structure
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const keys = Object.keys(firstItem);
        score += Math.min(keys.length / 5, 2); // Bonus for structured data
      }
    }
    
    // Check for data types
    if (typeof data === 'object' && data !== null) {
      const hasDates = this.hasDateFields(data);
      const hasNumbers = this.hasNumericFields(data);
      const hasText = this.hasTextField(data);
      
      if (hasDates) score += 1;
      if (hasNumbers) score += 1;
      if (hasText) score += 1;
    }
    
    if (score >= 5) return 'high';
    else if (score >= 2) return 'medium';
    else return 'low';
  }

  private hasDateFields(data: any): boolean {
    if (Array.isArray(data)) {
      return data.some(item => 
        Object.values(item).some(value => 
          typeof value === 'string' && this.isDateString(value)
        )
      );
    }
    return false;
  }

  private hasNumericFields(data: any): boolean {
    if (Array.isArray(data)) {
      return data.some(item => 
        Object.values(item).some(value => 
          typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))
        )
      );
    }
    return false;
  }

  private hasTextField(data: any): boolean {
    if (Array.isArray(data)) {
      return data.some(item => 
        Object.values(item).some(value => 
          typeof value === 'string' && value.length > 10
        )
      );
    }
    return false;
  }

  /**
   * Smart block type selection based on data characteristics
   */
  private selectOptimalBlockType(dataPattern: DataPattern, intent: IntentAnalysis): string {
    // High confidence pattern-based selection
    if (dataPattern.confidence > 0.8) {
      switch (dataPattern.type) {
        case 'tabular':
          return intent.primaryIntent === 'analyze' ? 'chart' : 'table';
        case 'temporal':
          return 'timeline';
        case 'sequential':
          return intent.primaryIntent === 'track' ? 'kanban' : 'list';
        case 'hierarchical':
          return 'table';
        case 'numerical':
          return 'chart';
        default:
          return 'table';
      }
    }
    
    // Intent-based selection
    switch (intent.primaryIntent) {
      case 'track':
        return intent.useCase === 'project-management' ? 'kanban' : 'table';
      case 'analyze':
        return dataPattern.metadata.hasNumbers ? 'chart' : 'table';
      case 'plan':
        return 'timeline';
      case 'view':
        return dataPattern.type === 'tabular' ? 'table' : 'text';
      case 'edit':
        return 'table';
      case 'collaborate':
        return 'kanban';
      default:
        return 'text';
    }
  }

  /**
   * Enhanced prompt understanding with context awareness
   */
  private extractContextualInsights(prompt: string, intent: IntentAnalysis): any {
    const insights = {
      dataVolume: this.estimateDataVolume(prompt),
      timeSensitivity: this.assessTimeSensitivity(prompt),
      collaborationNeeds: this.assessCollaborationNeeds(prompt),
      complexityLevel: intent.complexity,
      recommendedApproach: this.suggestApproach(intent, prompt)
    };
    
    return insights;
  }

  private estimateDataVolume(prompt: string): 'small' | 'medium' | 'large' {
    const volumeIndicators = {
      small: ['few', 'couple', 'several', 'handful', 'small'],
      medium: ['some', 'moderate', 'reasonable', 'adequate'],
      large: ['many', 'lots', 'extensive', 'comprehensive', 'large', 'all', 'complete']
    };
    
    for (const [volume, keywords] of Object.entries(volumeIndicators)) {
      if (keywords.some(keyword => prompt.includes(keyword))) {
        return volume as 'small' | 'medium' | 'large';
      }
    }
    
    return 'medium'; // Default
  }

  private assessTimeSensitivity(prompt: string): 'low' | 'medium' | 'high' {
    const timeIndicators = {
      high: ['urgent', 'asap', 'immediately', 'now', 'quick', 'fast'],
      medium: ['soon', 'shortly', 'this week', 'deadline'],
      low: ['when convenient', 'no rush', 'take your time']
    };
    
    for (const [sensitivity, keywords] of Object.entries(timeIndicators)) {
      if (keywords.some(keyword => prompt.includes(keyword))) {
        return sensitivity as 'low' | 'medium' | 'high';
      }
    }
    
    return 'medium'; // Default
  }

  private assessCollaborationNeeds(prompt: string): boolean {
    const collaborationKeywords = ['team', 'collaborate', 'share', 'together', 'group', 'we', 'our'];
    return collaborationKeywords.some(keyword => prompt.includes(keyword));
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

  // Missing methods that are causing TypeScript errors

  private extractDataRequirements(prompt: string): string[] {
    const requirements: string[] = [];
    
    // Explicit mentions
    if (prompt.includes('data') || prompt.includes('information')) requirements.push('data');
    if (prompt.includes('chart') || prompt.includes('graph') || prompt.includes('visual')) requirements.push('visualization');
    if (prompt.includes('table') || prompt.includes('list') || prompt.includes('grid')) requirements.push('tabular');
    if (prompt.includes('timeline') || prompt.includes('schedule') || prompt.includes('calendar')) requirements.push('temporal');
    if (prompt.includes('task') || prompt.includes('todo') || prompt.includes('checklist')) requirements.push('tasks');
    if (prompt.includes('kanban') || prompt.includes('board') || prompt.includes('pipeline')) requirements.push('kanban');
    if (prompt.includes('embed') || prompt.includes('iframe') || prompt.includes('video')) requirements.push('embed');
    
    // Enhanced detection for structured lists and collections
    if (prompt.includes('law') || prompt.includes('rule') || prompt.includes('principle')) requirements.push('tabular');
    if (prompt.includes('highlight') || prompt.includes('summarize') || prompt.includes('organize')) requirements.push('tabular');
    if (prompt.includes('each') || prompt.includes('every') || prompt.includes('all')) requirements.push('tabular');
    if (prompt.includes('with') && (prompt.includes('summary') || prompt.includes('description'))) requirements.push('tabular');
    
    // Implicit detection for common scenarios
    if (prompt.includes('performance') || prompt.includes('metrics') || prompt.includes('analytics')) {
      requirements.push('data');
      requirements.push('visualization');
    }
    
    if (prompt.includes('team') || prompt.includes('members') || prompt.includes('people')) {
      requirements.push('tabular');
    }
    
    if (prompt.includes('project') || prompt.includes('milestone') || prompt.includes('deadline')) {
      requirements.push('temporal');
      requirements.push('tasks');
    }
    
    if (prompt.includes('sales') || prompt.includes('revenue') || prompt.includes('income')) {
      requirements.push('data');
      requirements.push('visualization');
    }
    
    if (prompt.includes('campaign') || prompt.includes('marketing') || prompt.includes('advertising')) {
      requirements.push('data');
      requirements.push('visualization');
    }
    
    if (prompt.includes('workflow') || prompt.includes('process') || prompt.includes('steps')) {
      requirements.push('sequential');
      requirements.push('tasks');
    }
    
    if (prompt.includes('overview') || prompt.includes('summary') || prompt.includes('dashboard')) {
      requirements.push('data');
      if (!requirements.includes('visualization')) requirements.push('visualization');
    }
    
    if (prompt.includes('track') || prompt.includes('monitor') || prompt.includes('follow')) {
      requirements.push('data');
      requirements.push('temporal');
    }
    
    if (prompt.includes('organize') || prompt.includes('manage') || prompt.includes('coordinate')) {
      requirements.push('tabular');
      requirements.push('tasks');
    }
    
    return requirements;
  }

  private extractVisualizationNeeds(prompt: string): string[] {
    const needs: string[] = [];
    
    // Explicit mentions
    if (prompt.includes('chart') || prompt.includes('graph')) needs.push('chart');
    if (prompt.includes('bar') || prompt.includes('column')) needs.push('bar-chart');
    if (prompt.includes('line') || prompt.includes('trend')) needs.push('line-chart');
    if (prompt.includes('pie') || prompt.includes('donut')) needs.push('pie-chart');
    if (prompt.includes('table') || prompt.includes('grid')) needs.push('table');
    if (prompt.includes('timeline')) needs.push('timeline');
    if (prompt.includes('calendar')) needs.push('calendar');
    if (prompt.includes('embed') || prompt.includes('iframe') || prompt.includes('video')) needs.push('embed');
    
    // Enhanced detection for table needs
    if (prompt.includes('highlight') && (prompt.includes('each') || prompt.includes('law') || prompt.includes('rule'))) needs.push('table');
    if (prompt.includes('create a table')) needs.push('table');
    if (prompt.includes('organize') && (prompt.includes('list') || prompt.includes('data'))) needs.push('table');
    if (prompt.includes('summarize') && (prompt.includes('with') || prompt.includes('including'))) needs.push('table');
    
    // Implicit detection for common scenarios
    if (prompt.includes('performance') || prompt.includes('metrics') || prompt.includes('analytics')) {
      needs.push('chart');
    }
    
    if (prompt.includes('team') || prompt.includes('members') || prompt.includes('people')) {
      needs.push('table');
    }
    
    if (prompt.includes('project') || prompt.includes('milestone') || prompt.includes('deadline')) {
      needs.push('timeline');
    }
    
    if (prompt.includes('sales') || prompt.includes('revenue') || prompt.includes('income')) {
      needs.push('chart');
      needs.push('table');
    }
    
    // More specific Kanban triggers - only for actual project/task management
    if ((prompt.includes('track') && (prompt.includes('progress') || prompt.includes('tasks') || prompt.includes('project') || prompt.includes('completion'))) ||
        (prompt.includes('manage') && (prompt.includes('tasks') || prompt.includes('project') || prompt.includes('team'))) ||
        (prompt.includes('implement') && (prompt.includes('plan') || prompt.includes('strategy'))) ||
        (prompt.includes('project') && (prompt.includes('breakdown') || prompt.includes('tasks') || prompt.includes('timeline'))) ||
        (prompt.includes('kanban') || prompt.includes('board'))) {
      needs.push('kanban');
    }
    
    // Remove the broad "workflow/process/steps" trigger that was causing issues
    // Only trigger for workflow management, not workflow information
    if ((prompt.includes('workflow') || prompt.includes('process') || prompt.includes('steps')) &&
        (prompt.includes('manage') || prompt.includes('track') || prompt.includes('implement') || prompt.includes('organize'))) {
      needs.push('kanban');
    }
    
    if (prompt.includes('track') || prompt.includes('monitor') || prompt.includes('follow')) {
      needs.push('table');
      needs.push('chart');
    }
    
    if (prompt.includes('overview') || prompt.includes('summary') || prompt.includes('dashboard')) {
      needs.push('table');
      needs.push('chart');
    }
    
    // Remove the broad "organize/manage/coordinate" trigger
    // Only trigger for specific project/task organization
    if ((prompt.includes('organize') || prompt.includes('coordinate')) &&
        (prompt.includes('project') || prompt.includes('tasks') || prompt.includes('team'))) {
      needs.push('table');
      needs.push('kanban');
    }
    
    return needs;
  }

  private analyzeTabularData(data: any[]): DataPattern {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        type: 'tabular',
        confidence: 0.3,
        structure: data,
        metadata: {
          complexity: 'simple',
          dataQuality: 'low'
        }
      };
    }

    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    const hasDates = data.some(item => 
      Object.values(item).some(value => 
        typeof value === 'string' && this.isDateString(value)
      )
    );
    const hasNumbers = data.some(item => 
      Object.values(item).some(value => 
        typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))
      )
    );

    return {
      type: 'tabular',
      confidence: 0.8,
      structure: data,
      metadata: {
        rowCount: data.length,
        columnCount: keys.length,
        hasDates,
        hasNumbers,
        hasCategories: true,
        complexity: data.length > 50 ? 'complex' : data.length > 10 ? 'moderate' : 'simple',
        dataQuality: hasNumbers && hasDates ? 'high' : hasNumbers || hasDates ? 'medium' : 'low'
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
          timeSeries: true,
          complexity: 'moderate',
          dataQuality: 'high'
        }
      };
    }

    if (data.tasks && Array.isArray(data.tasks)) {
      return {
        type: 'sequential',
        confidence: 0.8,
        structure: data,
        metadata: {
          hasCategories: true,
          complexity: 'moderate',
          dataQuality: 'medium'
        }
      };
    }

    if (data.columns && Array.isArray(data.columns)) {
      return {
        type: 'hierarchical',
        confidence: 0.7,
        structure: data,
        metadata: {
          nested: true,
          complexity: 'complex',
          dataQuality: 'high'
        }
      };
    }

    return {
      type: 'textual',
      confidence: 0.5,
      structure: data,
      metadata: {
        complexity: 'simple',
        dataQuality: 'medium'
      }
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
        metadata: { 
          hasDates: !!hasDatePattern,
          complexity: 'moderate',
          dataQuality: 'medium'
        }
      };
    }

    if (hasListPattern) {
      return {
        type: 'sequential',
        confidence: 0.6,
        structure: { text, format: 'list' },
        metadata: {
          complexity: 'simple',
          dataQuality: 'medium'
        }
      };
    }

    return {
      type: 'textual',
      confidence: 0.9,
      structure: { text },
      metadata: {
        complexity: 'simple',
        dataQuality: 'low'
      }
    };
  }

  private getRecommendationByPattern(dataPattern: DataPattern, rawData?: any): BlockRecommendation | null {
    if (dataPattern.confidence < 0.7) return null;

    switch (dataPattern.type) {
      case 'tabular':
        return {
          type: 'table',
          confidence: 0.9,
          reasoning: 'High-confidence tabular data detected',
          suggestedData: this.transformToTableData(rawData || dataPattern.structure),
          config: { sortable: true, filterable: true }
        };
      case 'temporal':
        return {
          type: 'timeline',
          confidence: 0.8,
          reasoning: 'Temporal data with dates detected',
          suggestedData: this.transformToTimelineData(rawData || dataPattern.structure),
          config: {}
        };
      case 'sequential':
        return {
          type: 'list',
          confidence: 0.8,
          reasoning: 'Sequential data detected',
          suggestedData: this.transformToListData(rawData || dataPattern.structure),
          config: {}
        };
      case 'numerical':
        return {
          type: 'chart',
          confidence: 0.8,
          reasoning: 'Numerical data detected',
          suggestedData: this.transformToChartData(rawData || dataPattern.structure),
          config: { type: 'bar' }
        };
      default:
        return null;
    }
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
      // Add text block for context
      recommendations.push({
        type: 'text',
        confidence: 0.6,
        reasoning: 'View intent - adding context text block',
        suggestedData: this.transformToTextData({ content: 'Overview and context information' }),
        config: { markdown: true }
      });
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
      // Add table for detailed data
      if (dataPattern.type === 'tabular') {
        recommendations.push({
          type: 'table',
          confidence: 0.7,
          reasoning: 'Analysis intent - adding detailed data table',
          suggestedData: this.transformToTableData(dataPattern.structure),
          config: { sortable: true, filterable: true }
        });
      }
      // Add text for insights
      recommendations.push({
        type: 'text',
        confidence: 0.6,
        reasoning: 'Analysis intent - adding insights text block',
        suggestedData: this.transformToTextData({ content: 'Key insights and analysis findings' }),
        config: { markdown: true }
      });
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
      // Add task list for actionable items
      recommendations.push({
        type: 'task-list',
        confidence: 0.6,
        reasoning: 'Planning intent - adding task list',
        suggestedData: this.transformToListData({ tasks: [] }),
        config: {}
      });
      // Add text for plan overview
      recommendations.push({
        type: 'text',
        confidence: 0.6,
        reasoning: 'Planning intent - adding plan overview',
        suggestedData: this.transformToTextData({ content: 'Plan overview and objectives' }),
        config: { markdown: true }
      });
    }

    // Track intent
    if (intent.primaryIntent === 'track') {
      // Only prioritize Kanban for actual project/task tracking scenarios
      // Check if this is about tracking progress, not just viewing information
      const isProjectTracking = intent.secondaryIntents.includes('project') || 
                               intent.secondaryIntents.includes('tasks') ||
                               intent.secondaryIntents.includes('progress') ||
                               intent.secondaryIntents.includes('implementation') ||
                               intent.visualizationNeeds.includes('kanban');
      
      if (isProjectTracking) {
        recommendations.push({
          type: 'kanban',
          confidence: 0.9,
          reasoning: 'Project/task tracking intent - Kanban board for progress tracking through stages',
          suggestedData: this.transformToKanbanData(dataPattern.structure),
          config: {
            columns: [
              { id: 'not-started', title: 'Not Started', color: '#e3f2fd' },
              { id: 'in-progress', title: 'In Progress', color: '#fff3e0' },
              { id: 'completed', title: 'Completed', color: '#e8f5e8' },
              { id: 'mastered', title: 'Mastered', color: '#f3e5f5' }
            ]
          }
        });
        
        // Add task list for actionable items
        recommendations.push({
          type: 'task-list',
          confidence: 0.7,
          reasoning: 'Project tracking intent - adding actionable task list',
          suggestedData: this.transformToListData({ tasks: [] }),
          config: {}
        });
        
        // Add status block for current status
        recommendations.push({
          type: 'status',
          confidence: 0.6,
          reasoning: 'Project tracking intent - adding status indicator',
          suggestedData: { status: 'Active' },
          config: {}
        });
        
        // Add text for implementation guidance
        recommendations.push({
          type: 'text',
          confidence: 0.6,
          reasoning: 'Project tracking intent - adding implementation guidance',
          suggestedData: this.transformToTextData({ content: 'Implementation guidance and progress tracking instructions' }),
          config: { markdown: true }
        });
      } else {
        // For informational tracking, prefer tables and charts
        if (dataPattern.type === 'tabular') {
          recommendations.push({
            type: 'table',
            confidence: 0.8,
            reasoning: 'Informational tracking intent - table for data display',
            suggestedData: this.transformToTableData(dataPattern.structure),
            config: { sortable: true }
          });
        }
        
        recommendations.push({
          type: 'chart',
          confidence: 0.7,
          reasoning: 'Informational tracking intent - chart for data visualization',
          suggestedData: this.transformToChartData(dataPattern.structure),
          config: { type: 'bar' }
        });
      }
    }

    // Edit intent
    if (intent.primaryIntent === 'edit') {
      if (dataPattern.type === 'tabular') {
        recommendations.push({
          type: 'table',
          confidence: 0.8,
          reasoning: 'Edit intent with tabular data',
          suggestedData: this.transformToTableData(dataPattern.structure),
          config: { editable: true, sortable: true }
        });
      }
      // Add text for instructions
      recommendations.push({
        type: 'text',
        confidence: 0.6,
        reasoning: 'Edit intent - adding instructions',
        suggestedData: this.transformToTextData({ content: 'Edit instructions and guidelines' }),
        config: { markdown: true }
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
            config: { sortable: true }
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
        case 'kanban':
          recommendations.push({
            type: 'kanban',
            confidence: 0.8,
            reasoning: 'Kanban board requested',
            suggestedData: this.transformToKanbanData(dataPattern.structure),
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
    // Remove duplicates based on type
    const uniqueRecommendations = recommendations.filter((rec, index, self) => 
      index === self.findIndex(r => r.type === rec.type)
    );

    // Sort by confidence (highest first)
    return uniqueRecommendations.sort((a, b) => b.confidence - a.confidence);
  }

  private parseCSVLikeData(text: string): any[] | null {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;

    // Check if it looks like CSV
    const firstLine = lines[0];
    const hasCommas = firstLine.includes(',');
    const hasTabs = firstLine.includes('\t');
    
    if (!hasCommas && !hasTabs) return null;

    const delimiter = hasCommas ? ',' : '\t';
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    
    const data = lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
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
    
    try {
      const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
      const data = tableLines.slice(2).map(line => {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = cells[index] || '';
        });
        return row;
      });
      
      return data;
    } catch (error) {
      return null;
    }
  }

  private extractListFromText(text: string): any[] | null {
    const lines = text.split('\n');
    const listLines = lines.filter(line => line.match(/^[-*•]\s/));
    
    if (listLines.length === 0) return null;
    
    return listLines.map(line => ({
      text: line.replace(/^[-*•]\s/, '').trim(),
      completed: false
    }));
  }

  private extractEventsFromText(text: string): any[] | null {
    const lines = text.split('\n');
    const eventLines = lines.filter(line => 
      line.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/) ||
      line.match(/^\d{1,2}:\d{2}/)
    );
    
    if (eventLines.length === 0) return null;
    
    return eventLines.map(line => {
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);
      const title = line.replace(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/, '').trim();
      
      return {
        title: title || 'Event',
        date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
        description: ''
      };
    });
  }

  private transformToTableData(data: any): any {
    // Handle array of objects (most common format)
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const columns = Object.keys(firstItem).map((key, index) => ({
          key: `col_${index}`,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
          type: this.inferColumnType(data, key)
        }));
        
        const rows = data.map(item => {
          const row: any = {};
          Object.keys(item).forEach((key, index) => {
            row[`col_${index}`] = item[key];
          });
          return row;
        });
        
        return {
          columns: columns,
          rows: rows
        };
      }
    }
    
    // Handle object with columns and rows
    if (data && typeof data === 'object' && data.columns && data.rows) {
      return {
        columns: Array.isArray(data.columns) ? data.columns : [],
        rows: Array.isArray(data.rows) ? data.rows : []
      };
    }
    
    // Handle object with headers and data
    if (data && typeof data === 'object' && data.headers && data.data) {
      const columns = Array.isArray(data.headers) ? data.headers.map((header: string, index: number) => ({
        key: `col_${index}`,
        label: header,
        type: 'text'
      })) : [];
      
      const rows = Array.isArray(data.data) ? data.data.map((row: any[]) => {
        const rowObj: any = {};
        row.forEach((cell, index) => {
          rowObj[`col_${index}`] = cell;
        });
        return rowObj;
      }) : [];
      
      return {
        columns: columns,
        rows: rows
      };
    }
    
    // Fallback: create sample table data
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
  }

  private transformToChartData(data: any): any {
    // Handle various input formats
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      
      // If it's an array of objects with numeric values
      if (typeof firstItem === 'object' && firstItem !== null) {
        const numericKeys = Object.keys(firstItem).filter(key => 
          typeof firstItem[key] === 'number' || !isNaN(Number(firstItem[key]))
        );
        
        if (numericKeys.length > 0) {
          // Extract labels from the first key (usually the category/name)
          const labelKey = Object.keys(firstItem)[0];
          const labels = data.map(item => item[labelKey] || 'Unknown');
          const values = data.map(item => {
            const value = item[numericKeys[0]];
            return typeof value === 'number' ? value : Number(value) || 0;
          });
          
          return {
            type: 'bar',
            labels: labels,
            data: values,
            title: 'Data Visualization',
            colorPalette: 'default'
          };
        }
      }
      
      // If it's a simple array of numbers
      if (typeof firstItem === 'number' || !isNaN(Number(firstItem))) {
        return {
          type: 'bar',
          labels: data.map((_, index) => `Item ${index + 1}`),
          data: data.map(item => Number(item) || 0),
          title: 'Data Visualization',
          colorPalette: 'default'
        };
      }
    }
    
    // Handle object format with labels and data
    if (data && typeof data === 'object' && data.labels && data.data) {
      return {
        type: data.type || 'bar',
        labels: Array.isArray(data.labels) ? data.labels : [],
        data: Array.isArray(data.data) ? data.data : [],
        title: data.title || 'Data Visualization',
        colorPalette: data.colorPalette || 'default'
      };
    }
    
    // Handle Chart.js format (datasets)
    if (data && typeof data === 'object' && data.labels && data.datasets) {
      const dataset = Array.isArray(data.datasets) ? data.datasets[0] : data.datasets;
      if (dataset && Array.isArray(dataset.data)) {
        return {
          type: data.type || dataset.type || 'bar',
          labels: Array.isArray(data.labels) ? data.labels : [],
          data: dataset.data,
          title: data.title || 'Data Visualization',
          colorPalette: data.colorPalette || 'default'
        };
      }
    }
    
    // Fallback: create sample data
    return {
      type: 'bar',
      labels: ['Sample 1', 'Sample 2', 'Sample 3', 'Sample 4'],
      data: [65, 85, 70, 90],
      title: 'Sample Chart',
      colorPalette: 'default'
    };
  }

  private transformToListData(data: any): any {
    if (data.tasks && Array.isArray(data.tasks)) {
      return { tasks: data.tasks };
    }
    
    if (Array.isArray(data)) {
      return { tasks: data.map((item, index) => ({
        id: index + 1,
        text: typeof item === 'string' ? item : JSON.stringify(item),
        completed: false
      })) };
    }
    
    return { tasks: [] };
  }

  private transformToKanbanData(data: any): any {
    const columns = [
      { id: 'backlog', title: 'Backlog', color: '#e3f2fd', items: [] as any[] },
      { id: 'in-progress', title: 'In Progress', color: '#fff3e0', items: [] as any[] },
      { id: 'review', title: 'Review', color: '#fce4ec', items: [] as any[] },
      { id: 'done', title: 'Done', color: '#e8f5e8', items: [] as any[] }
    ];

    // Guard clause: if data is null, undefined, or not an object, return default columns
    if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) {
      return { columns };
    }

    data.tasks.forEach((task: any, index: number) => {
      const columnIndex = index % columns.length;
      columns[columnIndex].items.push({
        id: task.id || index + 1,
        title: task.title || task.text || `Task ${index + 1}`,
        description: task.description || '',
        tag: task.tag || 'Task',
        assignee: task.assignee || 'Unassigned',
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null
      });
    });

    return { columns };
  }

  private transformToTimelineData(data: any): any {
    if (data.events && Array.isArray(data.events)) {
      return { events: data.events };
    }
    
    if (Array.isArray(data)) {
      return { events: data.map((item, index) => ({
        title: item.title || `Event ${index + 1}`,
        description: item.description || '',
        timestamp: item.date || item.timestamp || new Date().toISOString()
      })) };
    }
    
    return { events: [] };
  }

  private transformToCalendarData(data: any): any {
    if (data.events && Array.isArray(data.events)) {
      return { events: data.events };
    }
    
    return { events: [] };
  }

  private transformToTextData(data: any): any {
    if (typeof data === 'string') {
      return { content: data };
    }
    
    if (data.content) {
      return { content: data.content };
    }
    
    return { content: JSON.stringify(data) };
  }

  private transformToEmbedData(data: any): any {
    if (typeof data === 'string') {
      return { url: data };
    }
    
    if (data.url) {
      return { url: data.url };
    }
    
    return { url: '' };
  }

  private isDateString(value: any): boolean {
    if (typeof value !== 'string') return false;
    
    // Check for various date formats
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
      /^\d{4}\/\d{1,2}\/\d{1,2}$/, // YYYY/MM/DD
    ];
    
    return dateFormats.some(format => format.test(value));
  }

  private inferColumnType(data: any[], key: string): string {
    if (!Array.isArray(data) || data.length === 0) return 'text';
    
    const values = data.map(item => item[key]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return 'text';
    
    // Check if all values are numbers
    const allNumbers = values.every(v => typeof v === 'number' || !isNaN(Number(v)));
    if (allNumbers) return 'number';
    
    // Check if all values are dates
    const allDates = values.every(v => this.isDateString(v));
    if (allDates) return 'date';
    
    // Check if values are boolean-like
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0'];
    const allBoolean = values.every(v => booleanValues.includes(String(v).toLowerCase()));
    if (allBoolean) return 'boolean';
    
    return 'text';
  }

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
      case 'embed':
        return this.transformToEmbedData(data);
      default:
        return data;
    }
  }
} 