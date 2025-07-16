import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';

type ColumnDef = { key: string; label: string; type: string; };

export interface QueryIntent {
  type: 'comparison' | 'trend' | 'distribution' | 'correlation' | 'ranking' | 'filter' | 'aggregation' | 'forecast';
  entities: string[];
  metrics: string[];
  dimensions: string[];
  filters: Record<string, any>;
  timeRange?: {
    start: string;
    end: string;
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  aggregation?: {
    function: 'sum' | 'average' | 'count' | 'min' | 'max' | 'median';
    groupBy: string[];
  };
  visualization?: {
    type: 'chart' | 'table' | 'metric' | 'heatmap' | 'scatter';
    subtype: string;
  };
}

export interface QueryResult {
  intent: QueryIntent;
  data: any;
  visualization: {
    type: string;
    config: any;
    data: any;
  };
  insights: string[];
  recommendations: string[];
}

@Injectable()
export class NaturalLanguageQueryService {
  constructor(
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Parse natural language query and generate visualization
   */
  async processQuery(
    query: string,
    data: any[],
    metadata: any
  ): Promise<QueryResult> {
    console.log('[NLQuery] Processing query:', query);

    // Step 1: Parse query intent
    const intent = await this.parseQueryIntent(query, metadata);
    
    // Step 2: Execute query against data
    const queryData = await this.executeQuery(intent, data, metadata);
    
    // Step 3: Generate appropriate visualization
    const visualization = await this.generateVisualization(intent, queryData, metadata);
    
    // Step 4: Generate insights and recommendations
    const insights = await this.generateInsights(intent, queryData, metadata);
    const recommendations = await this.generateRecommendations(intent, queryData, metadata);

    return {
      intent,
      data: queryData,
      visualization,
      insights,
      recommendations
    };
  }

  /**
   * Parse natural language query to extract intent
   */
  private async parseQueryIntent(query: string, metadata: any): Promise<QueryIntent> {
    const prompt = `
Parse the following natural language query and extract the intent for data analysis.

Available columns: ${metadata.columns?.join(', ') || 'unknown'}
Numeric columns: ${metadata.numericColumns?.join(', ') || 'none'}
Date columns: ${metadata.dateColumns?.join(', ') || 'none'}
Categorical columns: ${metadata.categoricalColumns?.join(', ') || 'none'}

Query: "${query}"

Return a JSON object with the following structure:
{
  "type": "comparison|trend|distribution|correlation|ranking|filter|aggregation|forecast",
  "entities": ["column names mentioned in query"],
  "metrics": ["numeric columns to analyze"],
  "dimensions": ["categorical columns to group by"],
  "filters": {"column": "value"},
  "timeRange": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD", 
    "granularity": "day|week|month|quarter|year"
  },
  "aggregation": {
    "function": "sum|average|count|min|max|median",
    "groupBy": ["columns to group by"]
  },
  "visualization": {
    "type": "chart|table|metric|heatmap|scatter",
    "subtype": "bar|line|pie|area|etc"
  }
}

Focus on:
- Identifying the main analysis type
- Extracting relevant columns from the query
- Determining appropriate aggregation functions
- Suggesting the best visualization type
`;

    try {
      const response = await this.openaiService.chatCompletion({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 512
      });
      const intent = JSON.parse(response);
      
      // Validate and clean the intent
      return this.validateAndCleanIntent(intent, metadata);
    } catch (error) {
      console.error('[NLQuery] Error parsing query intent:', error);
      return this.generateDefaultIntent(query, metadata);
    }
  }

  /**
   * Execute query against the data
   */
  private async executeQuery(intent: QueryIntent, data: any[], metadata: any): Promise<any> {
    console.log('[NLQuery] Executing query with intent:', intent.type);

    let filteredData = data;

    // Apply filters
    if (intent.filters && Object.keys(intent.filters).length > 0) {
      filteredData = this.applyFilters(filteredData, intent.filters);
    }

    // Apply time range filter
    if (intent.timeRange) {
      filteredData = this.applyTimeRangeFilter(filteredData, intent.timeRange, metadata);
    }

    // Apply aggregation
    if (intent.aggregation) {
      return this.applyAggregation(filteredData, intent.aggregation, intent.dimensions);
    }

    // Apply ranking/sorting
    if (intent.type === 'ranking') {
      return this.applyRanking(filteredData, intent.metrics, intent.dimensions);
    }

    return filteredData;
  }

  /**
   * Generate appropriate visualization
   */
  private async generateVisualization(
    intent: QueryIntent,
    data: any,
    metadata: any
  ): Promise<any> {
    const visualizationType = intent.visualization?.type || this.inferVisualizationType(intent, data);
    const subtype = intent.visualization?.subtype || this.inferVisualizationSubtype(intent, data);

    switch (visualizationType) {
      case 'chart':
        return this.generateChart(data, intent, subtype);
      case 'table':
        return this.generateTable(data, intent);
      case 'metric':
        return this.generateMetric(data, intent);
      case 'heatmap':
        return this.generateHeatmap(data, intent);
      case 'scatter':
        return this.generateScatterPlot(data, intent);
      default:
        return this.generateChart(data, intent, 'bar');
    }
  }

  /**
   * Generate insights from query results
   */
  private async generateInsights(intent: QueryIntent, data: any, metadata: any): Promise<string[]> {
    const insights: string[] = [];

    switch (intent.type) {
      case 'comparison':
        insights.push(...this.generateComparisonInsights(data, intent));
        break;
      case 'trend':
        insights.push(...this.generateTrendInsights(data, intent));
        break;
      case 'distribution':
        insights.push(...this.generateDistributionInsights(data, intent));
        break;
      case 'correlation':
        insights.push(...this.generateCorrelationInsights(data, intent));
        break;
      case 'ranking':
        insights.push(...this.generateRankingInsights(data, intent));
        break;
      case 'aggregation':
        insights.push(...this.generateAggregationInsights(data, intent));
        break;
    }

    return insights;
  }

  /**
   * Generate recommendations based on query results
   */
  private async generateRecommendations(intent: QueryIntent, data: any, metadata: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Add general recommendations based on data quality
    if (data.length < 10) {
      recommendations.push('Consider collecting more data for more reliable insights');
    }

    // Add specific recommendations based on query type
    switch (intent.type) {
      case 'trend':
        if (this.hasSignificantTrend(data, intent.metrics[0])) {
          recommendations.push('Monitor this trend closely and set up alerts for significant changes');
        }
        break;
      case 'correlation':
        if (this.hasStrongCorrelation(data, intent.metrics)) {
          recommendations.push('Investigate the causal relationship between these variables');
        }
        break;
      case 'ranking':
        recommendations.push('Focus on improving performance of bottom-ranked items');
        break;
    }

    return recommendations;
  }

  // Helper methods for query execution
  private applyFilters(data: any[], filters: Record<string, any>): any[] {
    return data.filter(row => {
      return Object.entries(filters).every(([column, value]) => {
        if (Array.isArray(value)) {
          return value.includes(row[column]);
        }
        return row[column] === value;
      });
    });
  }

  private applyTimeRangeFilter(data: any[], timeRange: any, metadata: any): any[] {
    const dateColumn = metadata.dateColumns?.[0];
    if (!dateColumn) return data;

    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);

    return data.filter(row => {
      const rowDate = new Date(row[dateColumn]);
      return rowDate >= startDate && rowDate <= endDate;
    });
  }

  private applyAggregation(data: any[], aggregation: any, dimensions: string[]): any {
    if (dimensions.length === 0) {
      // Simple aggregation without grouping
      const values = data.map(row => parseFloat(row[aggregation.metrics?.[0] || 'value'])).filter(v => !isNaN(v));
      return this.calculateAggregation(values, aggregation.function);
    }

    // Grouped aggregation
    const groups: Record<string, any[]> = {};
    
    data.forEach(row => {
      const groupKey = dimensions.map(dim => row[dim]).join('|');
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(row);
    });

    return Object.entries(groups).map(([groupKey, groupData]) => {
      const groupValues = groupData.map(row => 
        parseFloat(row[aggregation.metrics?.[0] || 'value'])
      ).filter(v => !isNaN(v));

      const groupParts = groupKey.split('|');
      const result: any = {};
      
      dimensions.forEach((dim, index) => {
        result[dim] = groupParts[index];
      });
      
      result[aggregation.function] = this.calculateAggregation(groupValues, aggregation.function);
      result.count = groupData.length;
      
      return result;
    });
  }

  private applyRanking(data: any[], metrics: string[], dimensions: string[]): any[] {
    const metric = metrics[0];
    const sorted = [...data].sort((a, b) => {
      const aVal = parseFloat(a[metric]) || 0;
      const bVal = parseFloat(b[metric]) || 0;
      return bVal - aVal; // Descending order
    });

    return sorted.slice(0, 10); // Top 10
  }

  private calculateAggregation(values: number[], functionName: string): number {
    switch (functionName) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'count':
        return values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'median':
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? 
          (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      default:
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  // Visualization generation methods
  private generateChart(data: any, intent: QueryIntent, subtype: string): any {
    const chartConfig = {
      type: subtype,
      title: this.generateChartTitle(intent),
      config: {
        type: subtype,
        showLegend: true,
        showGrid: true,
        responsive: true
      },
      data: this.prepareChartData(data, intent, subtype)
    };

    return chartConfig;
  }

  private generateTable(data: any, intent: QueryIntent): any {
    return {
      type: 'table',
      title: this.generateTableTitle(intent),
      config: {
        sortable: true,
        filterable: true,
        pagination: true
      },
      data: {
        columns: this.extractColumns(data, intent),
        rows: Array.isArray(data) ? data : [data]
      }
    };
  }

  private generateMetric(data: any, intent: QueryIntent): any {
    const value = this.extractMetricValue(data, intent);
    const previousValue = this.extractPreviousValue(data, intent);
    const change = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;

    return {
      type: 'metric',
      title: this.generateMetricTitle(intent),
      config: {
        showChange: true,
        showTrend: true
      },
      data: {
        value,
        change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      }
    };
  }

  private generateHeatmap(data: any, intent: QueryIntent): any {
    return {
      type: 'heatmap',
      title: this.generateHeatmapTitle(intent),
      config: {
        showValues: true,
        colorScale: 'viridis'
      },
      data: this.prepareHeatmapData(data, intent)
    };
  }

  private generateScatterPlot(data: any, intent: QueryIntent): any {
    return {
      type: 'scatter',
      title: this.generateScatterTitle(intent),
      config: {
        showTrendline: true,
        showLabels: true
      },
      data: this.prepareScatterData(data, intent)
    };
  }

  // Insight generation methods
  private generateComparisonInsights(data: any, intent: QueryIntent): string[] {
    const insights: string[] = [];
    
    if (Array.isArray(data) && data.length > 1) {
      const values = data.map(item => parseFloat(item[intent.metrics[0]])).filter(v => !isNaN(v));
      const max = Math.max(...values);
      const min = Math.min(...values);
      const difference = ((max - min) / min) * 100;
      
      insights.push(`The highest value is ${difference.toFixed(1)}% higher than the lowest value`);
      
      if (difference > 50) {
        insights.push('There is significant variation in the data');
      }
    }
    
    return insights;
  }

  private generateTrendInsights(data: any, intent: QueryIntent): string[] {
    const insights: string[] = [];
    
    if (Array.isArray(data) && data.length > 2) {
      const values = data.map(item => parseFloat(item[intent.metrics[0]])).filter(v => !isNaN(v));
      const { slope } = this.calculateLinearRegression(Array.from({ length: values.length }, (_, i) => i), values);
      
      if (Math.abs(slope) > 0.1) {
        insights.push(`Data shows a ${slope > 0 ? 'strong upward' : 'strong downward'} trend`);
      } else {
        insights.push('Data shows a relatively stable trend');
      }
    }
    
    return insights;
  }

  private generateDistributionInsights(data: any, intent: QueryIntent): string[] {
    const insights: string[] = [];
    
    if (Array.isArray(data)) {
      const values = data.map(item => parseFloat(item[intent.metrics[0]])).filter(v => !isNaN(v));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
      const coefficientOfVariation = stdDev / mean;
      
      if (coefficientOfVariation > 0.5) {
        insights.push('Data shows high variability');
      } else if (coefficientOfVariation > 0.2) {
        insights.push('Data shows moderate variability');
      } else {
        insights.push('Data shows low variability');
      }
    }
    
    return insights;
  }

  private generateCorrelationInsights(data: any, intent: QueryIntent): string[] {
    const insights: string[] = [];
    
    if (Array.isArray(data) && intent.metrics.length >= 2) {
      const values1 = data.map(item => parseFloat(item[intent.metrics[0]])).filter(v => !isNaN(v));
      const values2 = data.map(item => parseFloat(item[intent.metrics[1]])).filter(v => !isNaN(v));
      
      if (values1.length === values2.length && values1.length > 5) {
        const correlation = this.calculateCorrelation(values1, values2);
        insights.push(`Correlation coefficient: ${correlation.toFixed(2)}`);
        
        if (Math.abs(correlation) > 0.7) {
          insights.push('Strong correlation detected');
        } else if (Math.abs(correlation) > 0.5) {
          insights.push('Moderate correlation detected');
        } else {
          insights.push('Weak correlation detected');
        }
      }
    }
    
    return insights;
  }

  private generateRankingInsights(data: any, intent: QueryIntent): string[] {
    const insights: string[] = [];
    
    if (Array.isArray(data) && data.length > 0) {
      const topValue = parseFloat(data[0][intent.metrics[0]]) || 0;
      const bottomValue = parseFloat(data[data.length - 1][intent.metrics[0]]) || 0;
      const difference = ((topValue - bottomValue) / bottomValue) * 100;
      
      insights.push(`Top performer is ${difference.toFixed(1)}% higher than bottom performer`);
      
      if (difference > 100) {
        insights.push('Significant performance gap exists');
      }
    }
    
    return insights;
  }

  private generateAggregationInsights(data: any, intent: QueryIntent): string[] {
    const insights: string[] = [];
    
    if (Array.isArray(data)) {
      const total = data.reduce((sum, item) => sum + (parseFloat(item[intent.metrics[0]]) || 0), 0);
      const average = total / data.length;
      
      insights.push(`Total: ${total.toFixed(2)}`);
      insights.push(`Average: ${average.toFixed(2)}`);
      
      if (data.length > 10) {
        insights.push(`Based on ${data.length} data points`);
      }
    }
    
    return insights;
  }

  // Utility methods
  private validateAndCleanIntent(intent: any, metadata: any): QueryIntent {
    // Ensure all required fields exist
    const cleanIntent: QueryIntent = {
      type: intent.type || 'aggregation',
      entities: intent.entities || [],
      metrics: intent.metrics || [],
      dimensions: intent.dimensions || [],
      filters: intent.filters || {},
      aggregation: intent.aggregation,
      visualization: intent.visualization
    };

    // Validate that referenced columns exist
    const availableColumns = metadata.columns || [];
    cleanIntent.entities = cleanIntent.entities.filter(entity => availableColumns.includes(entity));
    cleanIntent.metrics = cleanIntent.metrics.filter(metric => availableColumns.includes(metric));
    cleanIntent.dimensions = cleanIntent.dimensions.filter(dimension => availableColumns.includes(dimension));

    return cleanIntent;
  }

  private generateDefaultIntent(query: string, metadata: any): QueryIntent {
    return {
      type: 'aggregation',
      entities: [],
      metrics: metadata.numericColumns?.slice(0, 1) || [],
      dimensions: metadata.categoricalColumns?.slice(0, 1) || [],
      filters: {},
      aggregation: {
        function: 'average',
        groupBy: metadata.categoricalColumns?.slice(0, 1) || []
      },
      visualization: {
        type: 'chart',
        subtype: 'bar'
      }
    };
  }

  private inferVisualizationType(intent: QueryIntent, data: any): string {
    switch (intent.type) {
      case 'comparison':
        return 'chart';
      case 'trend':
        return 'chart';
      case 'distribution':
        return 'chart';
      case 'correlation':
        return 'scatter';
      case 'ranking':
        return 'table';
      case 'aggregation':
        return Array.isArray(data) && data.length > 10 ? 'chart' : 'table';
      default:
        return 'chart';
    }
  }

  private inferVisualizationSubtype(intent: QueryIntent, data: any): string {
    switch (intent.type) {
      case 'comparison':
        return 'bar';
      case 'trend':
        return 'line';
      case 'distribution':
        return 'histogram';
      case 'correlation':
        return 'scatter';
      case 'ranking':
        return 'bar';
      case 'aggregation':
        return Array.isArray(data) && data.length > 10 ? 'bar' : 'table';
      default:
        return 'bar';
    }
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    
    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const xVariance = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
    const yVariance = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    
    return numerator / Math.sqrt(xVariance * yVariance);
  }

  private hasSignificantTrend(data: any, metric: string): boolean {
    if (!Array.isArray(data) || data.length < 3) return false;
    
    const values = data.map(item => parseFloat(item[metric])).filter(v => !isNaN(v));
    const { slope } = this.calculateLinearRegression(Array.from({ length: values.length }, (_, i) => i), values);
    
    return Math.abs(slope) > 0.1;
  }

  private hasStrongCorrelation(data: any, metrics: string[]): boolean {
    if (!Array.isArray(data) || metrics.length < 2) return false;
    
    const values1 = data.map(item => parseFloat(item[metrics[0]])).filter(v => !isNaN(v));
    const values2 = data.map(item => parseFloat(item[metrics[1]])).filter(v => !isNaN(v));
    
    if (values1.length !== values2.length || values1.length < 5) return false;
    
    const correlation = this.calculateCorrelation(values1, values2);
    return Math.abs(correlation) > 0.7;
  }

  // Title generation methods
  private generateChartTitle(intent: QueryIntent): string {
    const metric = intent.metrics[0] || 'Value';
    const dimension = intent.dimensions[0] || '';
    
    switch (intent.type) {
      case 'comparison':
        return `${metric} by ${dimension}`;
      case 'trend':
        return `${metric} Over Time`;
      case 'distribution':
        return `${metric} Distribution`;
      case 'ranking':
        return `Top ${metric}`;
      default:
        return `${metric} Analysis`;
    }
  }

  private generateTableTitle(intent: QueryIntent): string {
    return `${intent.metrics[0] || 'Data'} Details`;
  }

  private generateMetricTitle(intent: QueryIntent): string {
    return `${intent.metrics[0] || 'Metric'}`;
  }

  private generateHeatmapTitle(intent: QueryIntent): string {
    return `${intent.metrics[0] || 'Data'} Heatmap`;
  }

  private generateScatterTitle(intent: QueryIntent): string {
    return `${intent.metrics[0] || 'X'} vs ${intent.metrics[1] || 'Y'}`;
  }

  // Data preparation methods
  private prepareChartData(data: any, intent: QueryIntent, subtype: string): any {
    if (!Array.isArray(data)) return { labels: [], data: [] };

    switch (subtype) {
      case 'bar':
      case 'line':
        return this.prepareBarLineData(data, intent);
      case 'pie':
        return this.preparePieData(data, intent);
      case 'histogram':
        return this.prepareHistogramData(data, intent);
      default:
        return this.prepareBarLineData(data, intent);
    }
  }

  private prepareBarLineData(data: any[], intent: QueryIntent): any {
    const dimension = intent.dimensions[0];
    const metric = intent.metrics[0];

    if (dimension) {
      return {
        labels: data.map(item => item[dimension]),
        data: data.map(item => parseFloat(item[metric]) || 0)
      };
    } else {
      return {
        labels: data.map((_, index) => `Item ${index + 1}`),
        data: data.map(item => parseFloat(item[metric]) || 0)
      };
    }
  }

  private preparePieData(data: any[], intent: QueryIntent): any {
    const dimension = intent.dimensions[0];
    const metric = intent.metrics[0];

    return {
      labels: data.map(item => item[dimension]),
      data: data.map(item => parseFloat(item[metric]) || 0)
    };
  }

  private prepareHistogramData(data: any[], intent: QueryIntent): any {
    const metric = intent.metrics[0];
    const values = data.map(item => parseFloat(item[metric])).filter(v => !isNaN(v));
    
    // Create histogram bins
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
    const binSize = (max - min) / binCount;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: min + i * binSize,
      end: min + (i + 1) * binSize,
      count: 0
    }));
    
    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
      bins[binIndex].count++;
    });
    
    return {
      labels: bins.map(bin => `${bin.start.toFixed(1)}-${bin.end.toFixed(1)}`),
      data: bins.map(bin => bin.count)
    };
  }

  private prepareHeatmapData(data: any[], intent: QueryIntent): any {
    // Simplified heatmap data preparation
    return {
      xLabels: intent.dimensions[0] ? [...new Set(data.map(item => item[intent.dimensions[0]]))] : [],
      yLabels: intent.dimensions[1] ? [...new Set(data.map(item => item[intent.dimensions[1]]))] : [],
      data: data.map(item => parseFloat(item[intent.metrics[0]]) || 0)
    };
  }

  private prepareScatterData(data: any[], intent: QueryIntent): any {
    if (intent.metrics.length < 2) return { x: [], y: [] };

    return {
      x: data.map(item => parseFloat(item[intent.metrics[0]]) || 0),
      y: data.map(item => parseFloat(item[intent.metrics[1]]) || 0),
      labels: data.map(item => item[intent.dimensions[0]] || '')
    };
  }

  private extractColumns(data: any, intent: QueryIntent): ColumnDef[] {
    if (!Array.isArray(data) || data.length === 0) return [];
    
    const columns: ColumnDef[] = [];
    const allColumns = Object.keys(data[0]);
    
    // Add dimensions first
    intent.dimensions.forEach(dim => {
      if (allColumns.includes(dim)) {
        columns.push({ key: dim, label: dim, type: 'text' });
      }
    });
    
    // Add metrics
    intent.metrics.forEach(metric => {
      if (allColumns.includes(metric)) {
        columns.push({ key: metric, label: metric, type: 'number' });
      }
    });
    
    return columns;
  }

  private extractMetricValue(data: any, intent: QueryIntent): number {
    if (Array.isArray(data)) {
      const values = data.map(item => parseFloat(item[intent.metrics[0]])).filter(v => !isNaN(v));
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    return parseFloat(data[intent.metrics[0]]) || 0;
  }

  private extractPreviousValue(data: any, intent: QueryIntent): number | null {
    // Simplified - in practice, you'd compare with previous time period
    return null;
  }
} 