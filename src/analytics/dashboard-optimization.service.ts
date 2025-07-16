import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';

export interface OptimizationResult {
  score: number;
  improvements: string[];
  optimizedDashboard: {
    layout: any;
    blocks: any[];
    recommendations: string[];
  };
}

export interface LayoutOptimization {
  type: 'grid' | 'flow' | 'hierarchical' | 'story';
  arrangement: any[];
  score: number;
  reasoning: string;
}

export interface BlockOptimization {
  blockId: string;
  improvements: string[];
  optimizedConfig: any;
  score: number;
}

@Injectable()
export class DashboardOptimizationService {
  constructor(
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Optimize dashboard layout and blocks
   */
  async optimizeDashboard(
    dashboard: any,
    data: any[],
    metadata: any,
    userPreferences?: any
  ): Promise<OptimizationResult> {
    console.log('[DashboardOptimization] Optimizing dashboard...');

    // Step 1: Analyze current dashboard
    const analysis = await this.analyzeDashboard(dashboard, data, metadata);
    
    // Step 2: Optimize layout
    const layoutOptimization = await this.optimizeLayout(dashboard, analysis, userPreferences);
    
    // Step 3: Optimize individual blocks
    const blockOptimizations = await this.optimizeBlocks(dashboard.blocks, data, metadata, analysis);
    
    // Step 4: Generate optimized dashboard
    const optimizedDashboard = await this.generateOptimizedDashboard(
      dashboard,
      layoutOptimization,
      blockOptimizations,
      analysis
    );

    // Step 5: Calculate overall score
    const score = this.calculateOptimizationScore(layoutOptimization, blockOptimizations, analysis);

    return {
      score,
      improvements: this.generateImprovements(layoutOptimization, blockOptimizations, analysis),
      optimizedDashboard
    };
  }

  /**
   * Analyze current dashboard for optimization opportunities
   */
  private async analyzeDashboard(dashboard: any, data: any[], metadata: any): Promise<any> {
    const analysis = {
      blockCount: dashboard.blocks?.length || 0,
      layoutType: dashboard.layout?.type || 'grid',
      dataUtilization: this.calculateDataUtilization(dashboard.blocks, data, metadata),
      visualBalance: this.calculateVisualBalance(dashboard.blocks),
      informationDensity: this.calculateInformationDensity(dashboard.blocks, data),
      userExperience: this.calculateUserExperience(dashboard.blocks),
      performance: this.calculatePerformanceScore(dashboard.blocks, data),
      accessibility: this.calculateAccessibilityScore(dashboard.blocks),
      insights: [] as string[],
      issues: [] as string[]
    };

    // Identify specific issues and opportunities
    if (analysis.blockCount === 0) {
      analysis.issues.push('Dashboard has no blocks');
    } else if (analysis.blockCount > 8) {
      analysis.issues.push('Too many blocks may overwhelm users');
    }

    if (analysis.dataUtilization < 0.3) {
      analysis.issues.push('Low data utilization - many blocks may not be using data effectively');
    }

    if (analysis.visualBalance < 0.5) {
      analysis.issues.push('Poor visual balance - blocks may be unevenly distributed');
    }

    if (analysis.informationDensity > 0.8) {
      analysis.issues.push('High information density may confuse users');
    }

    // Generate insights
    analysis.insights = this.generateAnalysisInsights(analysis, dashboard, data, metadata);

    return analysis;
  }

  /**
   * Optimize dashboard layout
   */
  private async optimizeLayout(
    dashboard: any,
    analysis: any,
    userPreferences?: any
  ): Promise<LayoutOptimization> {
    const blockCount = analysis.blockCount;
    const currentLayout = dashboard.layout?.type || 'grid';

    // Determine optimal layout type
    let optimalLayoutType: 'grid' | 'flow' | 'hierarchical' | 'story' = 'grid';
    let reasoning = '';

    if (blockCount <= 2) {
      optimalLayoutType = 'flow';
      reasoning = 'Few blocks work better in a flow layout for better focus';
    } else if (blockCount <= 4) {
      optimalLayoutType = 'grid';
      reasoning = 'Grid layout provides good balance for moderate number of blocks';
    } else if (blockCount <= 6) {
      optimalLayoutType = 'hierarchical';
      reasoning = 'Hierarchical layout helps organize many blocks logically';
    } else {
      optimalLayoutType = 'story';
      reasoning = 'Story layout guides users through many blocks sequentially';
    }

    // Generate optimal arrangement
    const arrangement = this.generateOptimalArrangement(blockCount, optimalLayoutType, analysis);

    const score = this.calculateLayoutScore(optimalLayoutType, arrangement, analysis);

    return {
      type: optimalLayoutType,
      arrangement,
      score,
      reasoning
    };
  }

  /**
   * Optimize individual blocks
   */
  private async optimizeBlocks(
    blocks: any[],
    data: any[],
    metadata: any,
    analysis: any
  ): Promise<BlockOptimization[]> {
    const optimizations: BlockOptimization[] = [];

    for (const block of blocks) {
      const optimization = await this.optimizeBlock(block, data, metadata, analysis);
      optimizations.push(optimization);
    }

    return optimizations;
  }

  /**
   * Optimize a single block
   */
  private async optimizeBlock(
    block: any,
    data: any[],
    metadata: any,
    analysis: any
  ): Promise<BlockOptimization> {
    const improvements: string[] = [];
    const optimizedConfig = { ...block.config };

    // Block-specific optimizations
    switch (block.type) {
      case 'chart':
        const chartOptimization = this.optimizeChartBlock(block, data, metadata);
        improvements.push(...chartOptimization.improvements);
        Object.assign(optimizedConfig, chartOptimization.config);
        break;
      
      case 'table':
        const tableOptimization = this.optimizeTableBlock(block, data, metadata);
        improvements.push(...tableOptimization.improvements);
        Object.assign(optimizedConfig, tableOptimization.config);
        break;
      
      case 'kanban':
        const kanbanOptimization = this.optimizeKanbanBlock(block, data, metadata);
        improvements.push(...kanbanOptimization.improvements);
        Object.assign(optimizedConfig, kanbanOptimization.config);
        break;
      
      default:
        // Generic optimizations for other block types
        const genericOptimization = this.optimizeGenericBlock(block, data, metadata);
        improvements.push(...genericOptimization.improvements);
        Object.assign(optimizedConfig, genericOptimization.config);
    }

    // Performance optimizations
    if (data.length > 1000) {
      improvements.push('Large dataset detected - enabling pagination and lazy loading');
      optimizedConfig.pagination = true;
      optimizedConfig.lazyLoading = true;
    }

    // Accessibility optimizations
    improvements.push('Adding accessibility features');
    optimizedConfig.ariaLabel = block.title || 'Data visualization';
    optimizedConfig.keyboardNavigation = true;

    const score = this.calculateBlockOptimizationScore(improvements, block, data);

    return {
      blockId: block.id || 'unknown',
      improvements,
      optimizedConfig,
      score
    };
  }

  /**
   * Generate optimized dashboard
   */
  private async generateOptimizedDashboard(
    originalDashboard: any,
    layoutOptimization: LayoutOptimization,
    blockOptimizations: BlockOptimization[],
    analysis: any
  ): Promise<any> {
    // Apply layout optimization
    const optimizedLayout = {
      type: layoutOptimization.type,
      columns: this.calculateOptimalColumns(layoutOptimization.type, analysis.blockCount),
      rows: this.calculateOptimalRows(layoutOptimization.type, analysis.blockCount),
      arrangement: layoutOptimization.arrangement
    };

    // Apply block optimizations
    const optimizedBlocks = originalDashboard.blocks.map((block: any, index: number) => {
      const optimization = blockOptimizations.find(opt => opt.blockId === (block.id || `block_${index}`));
      return {
        ...block,
        config: optimization?.optimizedConfig || block.config,
        position: index
      };
    });

    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(
      layoutOptimization,
      blockOptimizations,
      analysis
    );

    return {
      intent: originalDashboard.intent,
      blocks: optimizedBlocks,
      layout: optimizedLayout,
      dataSources: originalDashboard.dataSources || [],
      recommendations
    };
  }

  // Helper methods for analysis
  private calculateDataUtilization(blocks: any[], data: any[], metadata: any): number {
    if (!blocks || blocks.length === 0) return 0;

    let totalUtilization = 0;
    let validBlocks = 0;

    blocks.forEach(block => {
      if (block.data && Object.keys(block.data).length > 0) {
        totalUtilization += 1;
      }
      validBlocks++;
    });

    return validBlocks > 0 ? totalUtilization / validBlocks : 0;
  }

  private calculateVisualBalance(blocks: any[]): number {
    if (!blocks || blocks.length === 0) return 0;

    // Calculate visual weight distribution
    const weights = blocks.map(block => {
      switch (block.type) {
        case 'chart': return 3;
        case 'table': return 2;
        case 'kanban': return 4;
        case 'metric': return 1;
        default: return 2;
      }
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const averageWeight = totalWeight / weights.length;
    const variance = weights.reduce((sum, weight) => sum + Math.pow(weight - averageWeight, 2), 0) / weights.length;

    // Lower variance = better balance
    return Math.max(0, 1 - variance / (averageWeight * averageWeight));
  }

  private calculateInformationDensity(blocks: any[], data: any[]): number {
    if (!blocks || blocks.length === 0) return 0;

    let totalDensity = 0;
    let validBlocks = 0;

    blocks.forEach(block => {
      let density = 0;
      
      if (block.type === 'table' && block.data?.rows) {
        density = Math.min(1, block.data.rows.length / 20); // Normalize to 0-1
      } else if (block.type === 'chart' && block.data?.data) {
        density = Math.min(1, block.data.data.length / 10);
      } else if (block.type === 'kanban' && block.data?.columns) {
        const totalItems = block.data.columns.reduce((sum: number, col: any) => sum + (col.items?.length || 0), 0);
        density = Math.min(1, totalItems / 30);
      }

      totalDensity += density;
      validBlocks++;
    });

    return validBlocks > 0 ? totalDensity / validBlocks : 0;
  }

  private calculateUserExperience(blocks: any[]): number {
    if (!blocks || blocks.length === 0) return 0;

    let totalScore = 0;
    let validBlocks = 0;

    blocks.forEach(block => {
      let score = 0.5; // Base score

      // Add points for good practices
      if (block.title) score += 0.1;
      if (block.config?.responsive) score += 0.1;
      if (block.config?.sortable) score += 0.1;
      if (block.config?.filterable) score += 0.1;
      if (block.config?.showLegend) score += 0.1;

      totalScore += score;
      validBlocks++;
    });

    return validBlocks > 0 ? totalScore / validBlocks : 0;
  }

  private calculatePerformanceScore(blocks: any[], data: any[]): number {
    if (!blocks || blocks.length === 0) return 0;

    let totalScore = 1;
    let penalties = 0;

    // Penalize for large datasets without optimization
    if (data.length > 1000) {
      const unoptimizedBlocks = blocks.filter(block => 
        !block.config?.pagination && !block.config?.lazyLoading
      );
      penalties += unoptimizedBlocks.length * 0.1;
    }

    // Penalize for too many blocks
    if (blocks.length > 8) {
      penalties += (blocks.length - 8) * 0.05;
    }

    return Math.max(0, totalScore - penalties);
  }

  private calculateAccessibilityScore(blocks: any[]): number {
    if (!blocks || blocks.length === 0) return 0;

    let totalScore = 0;
    let validBlocks = 0;

    blocks.forEach(block => {
      let score = 0.3; // Base accessibility score

      // Add points for accessibility features
      if (block.config?.ariaLabel) score += 0.2;
      if (block.config?.keyboardNavigation) score += 0.2;
      if (block.config?.highContrast) score += 0.1;
      if (block.config?.screenReaderSupport) score += 0.2;

      totalScore += score;
      validBlocks++;
    });

    return validBlocks > 0 ? totalScore / validBlocks : 0;
  }

  private generateAnalysisInsights(analysis: any, dashboard: any, data: any[], metadata: any): string[] {
    const insights: string[] = [];

    if (analysis.blockCount === 0) {
      insights.push('Dashboard is empty - consider adding relevant visualizations');
    } else if (analysis.blockCount > 8) {
      insights.push('Consider consolidating blocks to improve focus and performance');
    }

    if (analysis.dataUtilization < 0.3) {
      insights.push('Many blocks are not effectively utilizing the available data');
    }

    if (analysis.visualBalance < 0.5) {
      insights.push('Visual balance could be improved for better user experience');
    }

    if (analysis.informationDensity > 0.8) {
      insights.push('High information density may overwhelm users - consider simplifying');
    }

    if (analysis.performance < 0.7) {
      insights.push('Performance optimizations recommended for better user experience');
    }

    return insights;
  }

  // Layout optimization methods
  private generateOptimalArrangement(blockCount: number, layoutType: string, analysis: any): any[] {
    switch (layoutType) {
      case 'flow':
        return this.generateFlowArrangement(blockCount);
      case 'grid':
        return this.generateGridArrangement(blockCount);
      case 'hierarchical':
        return this.generateHierarchicalArrangement(blockCount);
      case 'story':
        return this.generateStoryArrangement(blockCount);
      default:
        return this.generateGridArrangement(blockCount);
    }
  }

  private generateFlowArrangement(blockCount: number): any[] {
    return Array.from({ length: blockCount }, (_, i) => ({
      block: i,
      col: 0,
      row: i,
      colspan: 1,
      rowspan: 1
    }));
  }

  private generateGridArrangement(blockCount: number): any[] {
    const columns = Math.ceil(Math.sqrt(blockCount));
    const rows = Math.ceil(blockCount / columns);

    return Array.from({ length: blockCount }, (_, i) => ({
      block: i,
      col: i % columns,
      row: Math.floor(i / columns),
      colspan: 1,
      rowspan: 1
    }));
  }

  private generateHierarchicalArrangement(blockCount: number): { block: number; col: number; row: number; colspan: number; rowspan: number; }[] {
    // Create a hierarchical layout with main content and sidebar
    const mainBlocks = Math.ceil(blockCount * 0.7);
    const sidebarBlocks = blockCount - mainBlocks;

    const arrangement: { block: number; col: number; row: number; colspan: number; rowspan: number; }[] = [];

    // Main content area
    for (let i = 0; i < mainBlocks; i++) {
      arrangement.push({
        block: i,
        col: 0,
        row: i,
        colspan: 2,
        rowspan: 1
      });
    }

    // Sidebar
    for (let i = 0; i < sidebarBlocks; i++) {
      arrangement.push({
        block: mainBlocks + i,
        col: 2,
        row: i,
        colspan: 1,
        rowspan: 1
      });
    }

    return arrangement;
  }

  private generateStoryArrangement(blockCount: number): any[] {
    // Create a story-like layout with sections
    const sections = Math.ceil(blockCount / 3);
    
    return Array.from({ length: blockCount }, (_, i) => ({
      block: i,
      col: 0,
      row: i,
      colspan: 1,
      rowspan: 1,
      section: Math.floor(i / 3)
    }));
  }

  private calculateLayoutScore(layoutType: string, arrangement: any[], analysis: any): number {
    let score = 0.5; // Base score

    // Score based on layout type appropriateness
    if (analysis.blockCount <= 2 && layoutType === 'flow') score += 0.2;
    if (analysis.blockCount <= 4 && layoutType === 'grid') score += 0.2;
    if (analysis.blockCount <= 6 && layoutType === 'hierarchical') score += 0.2;
    if (analysis.blockCount > 6 && layoutType === 'story') score += 0.2;

    // Score based on arrangement efficiency
    const efficiency = this.calculateArrangementEfficiency(arrangement);
    score += efficiency * 0.3;

    return Math.min(1, score);
  }

  private calculateArrangementEfficiency(arrangement: any[]): number {
    if (arrangement.length === 0) return 0;

    // Calculate space utilization
    const totalCells = arrangement.reduce((sum, item) => sum + (item.colspan * item.rowspan), 0);
    const maxCol = Math.max(...arrangement.map(item => item.col + item.colspan));
    const maxRow = Math.max(...arrangement.map(item => item.row + item.rowspan));
    const totalSpace = maxCol * maxRow;

    return totalSpace > 0 ? totalCells / totalSpace : 0;
  }

  // Block optimization methods
  private optimizeChartBlock(block: any, data: any[], metadata: any): any {
    const improvements: string[] = [];
    const config = { ...block.config };

    // Optimize chart type based on data
    if (block.data?.labels && block.data?.data) {
      const dataLength = block.data.data.length;
      
      if (dataLength > 20 && config.type === 'bar') {
        improvements.push('Large dataset detected - switching to horizontal bar chart for better readability');
        config.type = 'horizontalBar';
      }
      
      if (dataLength > 50) {
        improvements.push('Very large dataset - enabling data sampling and zoom features');
        config.sampling = true;
        config.zoom = true;
      }
    }

    // Add performance optimizations
    config.animation = data.length < 100; // Disable animations for large datasets
    config.responsive = true;
    config.maintainAspectRatio = false;

    return { improvements, config };
  }

  private optimizeTableBlock(block: any, data: any[], metadata: any): any {
    const improvements: string[] = [];
    const config = { ...block.config };

    if (data.length > 100) {
      improvements.push('Large dataset - enabling pagination and search');
      config.pagination = true;
      config.search = true;
      config.pageSize = 25;
    }

    if (data.length > 500) {
      improvements.push('Very large dataset - enabling virtual scrolling');
      config.virtualScrolling = true;
    }

    // Add sorting and filtering
    config.sortable = true;
    config.filterable = true;
    config.exportable = true;

    return { improvements, config };
  }

  private optimizeKanbanBlock(block: any, data: any[], metadata: any): any {
    const improvements: string[] = [];
    const config = { ...block.config };

    // Add drag and drop
    config.draggable = true;
    config.droppable = true;

    // Add performance optimizations
    if (block.data?.columns) {
      const totalItems = block.data.columns.reduce((sum: number, col: any) => sum + (col.items?.length || 0), 0);
      
      if (totalItems > 100) {
        improvements.push('Large kanban board - enabling lazy loading and virtualization');
        config.lazyLoading = true;
        config.virtualization = true;
      }
    }

    // Add collaboration features
    config.realtime = true;
    config.comments = true;
    config.assignments = true;

    return { improvements, config };
  }

  private optimizeGenericBlock(block: any, data: any[], metadata: any): any {
    const improvements: string[] = [];
    const config = { ...block.config };

    // Add responsive design
    config.responsive = true;
    config.mobileOptimized = true;

    // Add accessibility
    config.ariaLabel = block.title || 'Data block';
    config.keyboardNavigation = true;

    return { improvements, config };
  }

  private calculateBlockOptimizationScore(improvements: string[], block: any, data: any[]): number {
    let score = 0.5; // Base score

    // Add points for each improvement
    score += improvements.length * 0.1;

    // Add points for data utilization
    if (block.data && Object.keys(block.data).length > 0) {
      score += 0.2;
    }

    // Add points for performance considerations
    if (data.length > 1000 && (block.config?.pagination || block.config?.lazyLoading)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  // Utility methods
  private calculateOptimalColumns(layoutType: string, blockCount: number): number {
    switch (layoutType) {
      case 'flow':
        return 1;
      case 'grid':
        return Math.ceil(Math.sqrt(blockCount));
      case 'hierarchical':
        return 3;
      case 'story':
        return 1;
      default:
        return Math.ceil(Math.sqrt(blockCount));
    }
  }

  private calculateOptimalRows(layoutType: string, blockCount: number): number {
    switch (layoutType) {
      case 'flow':
        return blockCount;
      case 'grid':
        return Math.ceil(blockCount / Math.ceil(Math.sqrt(blockCount)));
      case 'hierarchical':
        return Math.ceil(blockCount * 0.7);
      case 'story':
        return blockCount;
      default:
        return Math.ceil(blockCount / Math.ceil(Math.sqrt(blockCount)));
    }
  }

  private calculateOptimizationScore(
    layoutOptimization: LayoutOptimization,
    blockOptimizations: BlockOptimization[],
    analysis: any
  ): number {
    const layoutScore = layoutOptimization.score * 0.3;
    const blockScore = blockOptimizations.reduce((sum, opt) => sum + opt.score, 0) / blockOptimizations.length * 0.4;
    const analysisScore = (analysis.dataUtilization + analysis.visualBalance + analysis.userExperience) / 3 * 0.3;

    return layoutScore + blockScore + analysisScore;
  }

  private generateImprovements(
    layoutOptimization: LayoutOptimization,
    blockOptimizations: BlockOptimization[],
    analysis: any
  ): string[] {
    const improvements: string[] = [];

    // Layout improvements
    if (layoutOptimization.reasoning) {
      improvements.push(`Layout optimized: ${layoutOptimization.reasoning}`);
    }

    // Block improvements
    blockOptimizations.forEach(optimization => {
      optimization.improvements.forEach(improvement => {
        improvements.push(`Block ${optimization.blockId}: ${improvement}`);
      });
    });

    // Analysis-based improvements
    analysis.insights.forEach(insight => {
      improvements.push(insight);
    });

    return improvements;
  }

  private generateOptimizationRecommendations(
    layoutOptimization: LayoutOptimization,
    blockOptimizations: BlockOptimization[],
    analysis: any
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (analysis.performance < 0.7) {
      recommendations.push('Consider implementing data caching for better performance');
      recommendations.push('Enable lazy loading for large datasets');
    }

    // Accessibility recommendations
    if (analysis.accessibility < 0.7) {
      recommendations.push('Add screen reader support for better accessibility');
      recommendations.push('Implement keyboard navigation for all interactive elements');
    }

    // User experience recommendations
    if (analysis.userExperience < 0.7) {
      recommendations.push('Add tooltips and help text for better user guidance');
      recommendations.push('Implement responsive design for mobile devices');
    }

    // Data utilization recommendations
    if (analysis.dataUtilization < 0.5) {
      recommendations.push('Review data mapping to ensure all relevant data is displayed');
      recommendations.push('Consider adding more data-driven visualizations');
    }

    return recommendations;
  }
} 