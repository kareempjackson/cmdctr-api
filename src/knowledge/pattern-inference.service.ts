import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';

export interface DataPattern {
  type: 'trend' | 'seasonal' | 'correlation' | 'distribution' | 'anomaly' | 'clustering' | 'forecast' | 'comparison';
  confidence: number;
  description: string;
  metadata: {
    strength: 'weak' | 'moderate' | 'strong';
    direction?: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    periodicity?: string;
    correlation?: number;
    outliers?: any[];
    clusters?: any[];
    forecast?: any[];
  };
  insights: string[];
  recommendations: {
    blockTypes: string[];
    visualizations: string[];
    analysis: string[];
    actions: string[];
  };
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  patterns: DataPattern[];
  blocks: Array<{
    type: string;
    title: string;
    purpose: string;
    dataMapping: Record<string, string>;
    config: any;
  }>;
  layout: {
    type: 'grid' | 'flow' | 'hierarchical' | 'story';
    columns: number;
    rows: number;
    arrangement: any[];
  };
  priority: number;
}

export interface InferenceResult {
  patterns: DataPattern[];
  dashboardTemplates: DashboardTemplate[];
  insights: {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    nextSteps: string[];
  };
  generatedDashboard: {
    intent: string;
    blocks: any[];
    layout: any;
    dataSources: string[];
  };
}

@Injectable()
export class PatternInferenceService {
  constructor(
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Analyze data and infer patterns for dashboard creation
   */
  async inferDashboardFromData(
    data: any[],
    metadata: any,
    context?: string
  ): Promise<InferenceResult> {
    console.log('[PatternInference] Analyzing data for patterns...');

    // Step 1: Detect patterns in the data
    const patterns = await this.detectDataPatterns(data, metadata);
    
    // Step 2: Generate dashboard templates based on patterns
    const dashboardTemplates = await this.generateDashboardTemplates(patterns, data, metadata);
    
    // Step 3: Create insights and recommendations
    const insights = await this.generateInsights(patterns, data, metadata);
    
    // Step 4: Generate the actual dashboard
    const generatedDashboard = await this.generateDashboard(dashboardTemplates, data, metadata, context);

    return {
      patterns,
      dashboardTemplates,
      insights,
      generatedDashboard
    };
  }

  /**
   * Detect patterns in structured data
   */
  private async detectDataPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];

    // 1. Trend Analysis
    const trendPatterns = await this.detectTrendPatterns(data, metadata);
    patterns.push(...trendPatterns);

    // 2. Seasonal Analysis
    const seasonalPatterns = await this.detectSeasonalPatterns(data, metadata);
    patterns.push(...seasonalPatterns);

    // 3. Correlation Analysis
    const correlationPatterns = await this.detectCorrelationPatterns(data, metadata);
    patterns.push(...correlationPatterns);

    // 4. Distribution Analysis
    const distributionPatterns = await this.detectDistributionPatterns(data, metadata);
    patterns.push(...distributionPatterns);

    // 5. Anomaly Detection
    const anomalyPatterns = await this.detectAnomalyPatterns(data, metadata);
    patterns.push(...anomalyPatterns);

    // 6. Clustering Analysis
    const clusteringPatterns = await this.detectClusteringPatterns(data, metadata);
    patterns.push(...clusteringPatterns);

    return patterns.filter(p => p.confidence > 0.3); // Only keep patterns with decent confidence
  }

  /**
   * Detect trend patterns in time series data
   */
  private async detectTrendPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const dateColumns = metadata.dateColumns || [];
    const numericColumns = metadata.numericColumns || [];

    for (const dateCol of dateColumns) {
      for (const numericCol of numericColumns) {
        const timeSeriesData = data
          .map(row => ({ date: new Date(row[dateCol]), value: parseFloat(row[numericCol]) }))
          .filter(item => !isNaN(item.value))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (timeSeriesData.length < 3) continue;

        const trend = this.calculateTrend(timeSeriesData.map(d => d.value));
        
        if (Math.abs(trend.slope) > 0.1) { // Significant trend
          patterns.push({
            type: 'trend',
            confidence: Math.min(0.9, Math.abs(trend.slope) * 2),
            description: `${numericCol} shows a ${trend.slope > 0 ? 'strong upward' : 'strong downward'} trend over time`,
            metadata: {
              strength: Math.abs(trend.slope) > 0.5 ? 'strong' : Math.abs(trend.slope) > 0.2 ? 'moderate' : 'weak',
              direction: trend.slope > 0 ? 'increasing' : 'decreasing'
            },
            insights: [
              `${numericCol} is ${trend.slope > 0 ? 'growing' : 'declining'} at a rate of ${Math.abs(trend.slope).toFixed(2)} per time period`,
              `This trend suggests ${trend.slope > 0 ? 'positive' : 'negative'} performance in ${numericCol}`
            ],
            recommendations: {
              blockTypes: ['chart', 'table', 'status'],
              visualizations: ['line-chart', 'area-chart'],
              analysis: ['trend-analysis', 'forecasting'],
              actions: ['monitor-trend', 'set-alerts']
            }
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect seasonal patterns
   */
  private async detectSeasonalPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const dateColumns = metadata.dateColumns || [];
    const numericColumns = metadata.numericColumns || [];

    for (const dateCol of dateColumns) {
      for (const numericCol of numericColumns) {
        const timeSeriesData = data
          .map(row => ({ 
            date: new Date(row[dateCol]), 
            value: parseFloat(row[numericCol]),
            month: new Date(row[dateCol]).getMonth(),
            dayOfWeek: new Date(row[dateCol]).getDay()
          }))
          .filter(item => !isNaN(item.value));

        if (timeSeriesData.length < 12) continue; // Need enough data for seasonality

        // Check for monthly seasonality
        const monthlyAverages = this.calculateMonthlyAverages(timeSeriesData);
        const monthlyVariance = this.calculateVariance(Object.values(monthlyAverages));
        
        if (monthlyVariance > 0.1) { // Significant monthly variation
          patterns.push({
            type: 'seasonal',
            confidence: Math.min(0.8, monthlyVariance * 3),
            description: `${numericCol} shows seasonal patterns with monthly variations`,
            metadata: {
              strength: monthlyVariance > 0.3 ? 'strong' : monthlyVariance > 0.15 ? 'moderate' : 'weak',
              periodicity: 'monthly'
            },
            insights: [
              `${numericCol} varies significantly by month`,
              `Peak months: ${this.getPeakMonths(monthlyAverages).join(', ')}`,
              `Low months: ${this.getLowMonths(monthlyAverages).join(', ')}`
            ],
            recommendations: {
              blockTypes: ['chart', 'calendar', 'table'],
              visualizations: ['heatmap', 'line-chart'],
              analysis: ['seasonality-analysis', 'planning'],
              actions: ['seasonal-planning', 'resource-allocation']
            }
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect correlation patterns between variables
   */
  private async detectCorrelationPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const numericColumns = metadata.numericColumns || [];

    if (numericColumns.length < 2) return patterns;

    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        
        const values1 = data.map(row => parseFloat(row[col1])).filter(v => !isNaN(v));
        const values2 = data.map(row => parseFloat(row[col2])).filter(v => !isNaN(v));
        
        if (values1.length < 5 || values2.length < 5) continue;
        
        const correlation = this.calculateCorrelation(values1, values2);
        
        if (Math.abs(correlation) > 0.5) { // Strong correlation
          patterns.push({
            type: 'correlation',
            confidence: Math.abs(correlation),
            description: `${col1} and ${col2} show a ${correlation > 0 ? 'strong positive' : 'strong negative'} correlation`,
            metadata: {
              strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
              correlation: correlation
            },
            insights: [
              `${col1} and ${col2} are ${correlation > 0 ? 'positively' : 'negatively'} correlated (r = ${correlation.toFixed(2)})`,
              `Changes in ${col1} ${correlation > 0 ? 'predict' : 'inversely predict'} changes in ${col2}`
            ],
            recommendations: {
              blockTypes: ['chart', 'table', 'note'],
              visualizations: ['scatter-plot', 'correlation-matrix'],
              analysis: ['correlation-analysis', 'causal-inference'],
              actions: ['investigate-relationship', 'optimize-variables']
            }
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect distribution patterns
   */
  private async detectDistributionPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const numericColumns = metadata.numericColumns || [];

    for (const col of numericColumns) {
      const values = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
      
      if (values.length < 10) continue;
      
      const distribution = this.analyzeDistribution(values);
      
      patterns.push({
        type: 'distribution',
        confidence: 0.7,
        description: `${col} follows a ${distribution.type} distribution`,
        metadata: {
          strength: 'moderate',
          ...distribution
        },
        insights: [
          `${col} has a mean of ${distribution.mean.toFixed(2)} and standard deviation of ${distribution.stdDev.toFixed(2)}`,
          `${distribution.outliers.length} outliers detected`,
          `The distribution is ${distribution.skewness > 0.5 ? 'right-skewed' : distribution.skewness < -0.5 ? 'left-skewed' : 'symmetric'}`
        ],
        recommendations: {
          blockTypes: ['chart', 'table', 'status'],
          visualizations: ['histogram', 'box-plot', 'violin-plot'],
          analysis: ['distribution-analysis', 'outlier-detection'],
          actions: ['investigate-outliers', 'normalize-data']
        }
      });
    }

    return patterns;
  }

  /**
   * Detect anomalies in the data
   */
  private async detectAnomalyPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const numericColumns = metadata.numericColumns || [];

    for (const col of numericColumns) {
      const values = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
      
      if (values.length < 10) continue;
      
      const outliers = this.detectOutliers(values);
      
      if (outliers.length > 0) {
        patterns.push({
          type: 'anomaly',
          confidence: Math.min(0.9, outliers.length / values.length * 5),
          description: `${outliers.length} anomalies detected in ${col}`,
          metadata: {
            strength: outliers.length > values.length * 0.1 ? 'strong' : 'moderate',
            outliers: outliers
          },
          insights: [
            `${outliers.length} outliers detected in ${col}`,
            `Outliers represent ${(outliers.length / values.length * 100).toFixed(1)}% of the data`,
            `Investigation recommended for unusual values`
          ],
          recommendations: {
            blockTypes: ['chart', 'table', 'alert'],
            visualizations: ['box-plot', 'scatter-plot'],
            analysis: ['anomaly-detection', 'root-cause-analysis'],
            actions: ['investigate-anomalies', 'set-alerts']
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Detect clustering patterns
   */
  private async detectClusteringPatterns(data: any[], metadata: any): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];
    const numericColumns = metadata.numericColumns || [];

    if (numericColumns.length < 2) return patterns;

    // Use first two numeric columns for clustering
    const col1 = numericColumns[0];
    const col2 = numericColumns[1];
    
    const points = data
      .map(row => ({ 
        x: parseFloat(row[col1]), 
        y: parseFloat(row[col2]),
        id: data.indexOf(row)
      }))
      .filter(point => !isNaN(point.x) && !isNaN(point.y));

    if (points.length < 10) return patterns;

    const clusters = this.simpleClustering(points);
    
    if (clusters.length > 1) {
      patterns.push({
        type: 'clustering',
        confidence: Math.min(0.8, clusters.length / 3),
        description: `${clusters.length} distinct clusters identified in ${col1} vs ${col2}`,
        metadata: {
          strength: clusters.length > 3 ? 'strong' : 'moderate',
          clusters: clusters.map(c => ({ size: c.length, center: c.center }))
        },
        insights: [
          `${clusters.length} distinct groups identified`,
          `Largest cluster has ${Math.max(...clusters.map(c => c.length))} items`,
          `Clusters suggest natural groupings in the data`
        ],
        recommendations: {
          blockTypes: ['chart', 'table', 'kanban'],
          visualizations: ['scatter-plot', 'cluster-map'],
          analysis: ['cluster-analysis', 'segmentation'],
          actions: ['segment-customers', 'target-marketing']
        }
      });
    }

    return patterns;
  }

  /**
   * Generate dashboard templates based on detected patterns
   */
  private async generateDashboardTemplates(
    patterns: DataPattern[],
    data: any[],
    metadata: any
  ): Promise<DashboardTemplate[]> {
    const templates: DashboardTemplate[] = [];

    // 1. Performance Dashboard Template
    if (patterns.some(p => p.type === 'trend')) {
      templates.push({
        id: 'performance-dashboard',
        name: 'Performance Dashboard',
        description: 'Track key performance indicators and trends over time',
        patterns: patterns.filter(p => p.type === 'trend'),
        blocks: [
          {
            type: 'chart',
            title: 'Performance Trends',
            purpose: 'Show key metrics over time',
            dataMapping: { x: 'date', y: 'value' },
            config: { type: 'line', showTrends: true }
          },
          {
            type: 'status',
            title: 'Current Status',
            purpose: 'Display current performance indicators',
            dataMapping: { value: 'latest_value', target: 'target' },
            config: { showTargets: true }
          },
          {
            type: 'table',
            title: 'Detailed Metrics',
            purpose: 'Show detailed performance data',
            dataMapping: { columns: 'all_columns' },
            config: { sortable: true, filterable: true }
          }
        ],
        layout: {
          type: 'grid',
          columns: 3,
          rows: 2,
          arrangement: [
            { block: 0, col: 0, row: 0, colspan: 2, rowspan: 1 },
            { block: 1, col: 2, row: 0, colspan: 1, rowspan: 1 },
            { block: 2, col: 0, row: 1, colspan: 3, rowspan: 1 }
          ]
        },
        priority: 0.9
      });
    }

    // 2. Seasonal Analysis Dashboard
    if (patterns.some(p => p.type === 'seasonal')) {
      templates.push({
        id: 'seasonal-analysis',
        name: 'Seasonal Analysis Dashboard',
        description: 'Analyze seasonal patterns and plan accordingly',
        patterns: patterns.filter(p => p.type === 'seasonal'),
        blocks: [
          {
            type: 'chart',
            title: 'Seasonal Patterns',
            purpose: 'Show seasonal variations',
            dataMapping: { x: 'month', y: 'value' },
            config: { type: 'bar', showSeasonality: true }
          },
          {
            type: 'calendar',
            title: 'Seasonal Calendar',
            purpose: 'Visualize seasonal events',
            dataMapping: { date: 'date', value: 'value' },
            config: { showHeatmap: true }
          },
          {
            type: 'note',
            title: 'Seasonal Insights',
            purpose: 'Key seasonal findings',
            dataMapping: { content: 'insights' },
            config: { markdown: true }
          }
        ],
        layout: {
          type: 'grid',
          columns: 2,
          rows: 2,
          arrangement: [
            { block: 0, col: 0, row: 0, colspan: 1, rowspan: 1 },
            { block: 1, col: 1, row: 0, colspan: 1, rowspan: 1 },
            { block: 2, col: 0, row: 1, colspan: 2, rowspan: 1 }
          ]
        },
        priority: 0.8
      });
    }

    // 3. Correlation Analysis Dashboard
    if (patterns.some(p => p.type === 'correlation')) {
      templates.push({
        id: 'correlation-analysis',
        name: 'Correlation Analysis Dashboard',
        description: 'Explore relationships between variables',
        patterns: patterns.filter(p => p.type === 'correlation'),
        blocks: [
          {
            type: 'chart',
            title: 'Correlation Matrix',
            purpose: 'Show correlations between variables',
            dataMapping: { variables: 'numeric_columns' },
            config: { type: 'heatmap', showCorrelations: true }
          },
          {
            type: 'chart',
            title: 'Scatter Plots',
            purpose: 'Detailed correlation analysis',
            dataMapping: { x: 'var1', y: 'var2' },
            config: { type: 'scatter', showTrendline: true }
          },
          {
            type: 'table',
            title: 'Correlation Summary',
            purpose: 'Correlation coefficients and significance',
            dataMapping: { correlations: 'correlation_data' },
            config: { sortable: true }
          }
        ],
        layout: {
          type: 'grid',
          columns: 2,
          rows: 2,
          arrangement: [
            { block: 0, col: 0, row: 0, colspan: 2, rowspan: 1 },
            { block: 1, col: 0, row: 1, colspan: 1, rowspan: 1 },
            { block: 2, col: 1, row: 1, colspan: 1, rowspan: 1 }
          ]
        },
        priority: 0.7
      });
    }

    // 4. Anomaly Detection Dashboard
    if (patterns.some(p => p.type === 'anomaly')) {
      templates.push({
        id: 'anomaly-detection',
        name: 'Anomaly Detection Dashboard',
        description: 'Monitor and investigate unusual patterns',
        patterns: patterns.filter(p => p.type === 'anomaly'),
        blocks: [
          {
            type: 'chart',
            title: 'Anomaly Detection',
            purpose: 'Highlight outliers and anomalies',
            dataMapping: { x: 'date', y: 'value', anomalies: 'outliers' },
            config: { type: 'line', highlightAnomalies: true }
          },
          {
            type: 'table',
            title: 'Anomaly Details',
            purpose: 'Detailed information about anomalies',
            dataMapping: { anomalies: 'outlier_data' },
            config: { sortable: true, filterable: true }
          },
          {
            type: 'alert',
            title: 'Anomaly Alerts',
            purpose: 'Real-time anomaly notifications',
            dataMapping: { alerts: 'anomaly_alerts' },
            config: { autoRefresh: true }
          }
        ],
        layout: {
          type: 'grid',
          columns: 2,
          rows: 2,
          arrangement: [
            { block: 0, col: 0, row: 0, colspan: 2, rowspan: 1 },
            { block: 1, col: 0, row: 1, colspan: 1, rowspan: 1 },
            { block: 2, col: 1, row: 1, colspan: 1, rowspan: 1 }
          ]
        },
        priority: 0.8
      });
    }

    return templates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate insights from patterns
   */
  private async generateInsights(
    patterns: DataPattern[],
    data: any[],
    metadata: any
  ): Promise<any> {
    const summary = this.generateSummary(patterns, data, metadata);
    const keyFindings = patterns.map(p => p.description);
    const recommendations = patterns.flatMap(p => p.recommendations.actions);
    const nextSteps: string[] = this.generateNextSteps(patterns, data, metadata);

    return {
      summary,
      keyFindings,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      nextSteps
    };
  }

  /**
   * Generate the actual dashboard
   */
  private async generateDashboard(
    templates: DashboardTemplate[],
    data: any[],
    metadata: any,
    context?: string
  ): Promise<any> {
    if (templates.length === 0) {
      return this.generateDefaultDashboard(data, metadata);
    }

    const bestTemplate = templates[0]; // Highest priority template
    
    const blocks = bestTemplate.blocks.map((blockTemplate, index) => {
      return this.createBlockFromTemplate(blockTemplate, data, metadata, index);
    });

    return {
      intent: `Dashboard based on ${bestTemplate.name}`,
      blocks,
      layout: bestTemplate.layout,
      dataSources: [metadata.source || 'unknown']
    };
  }

  // Helper methods for pattern detection
  private calculateTrend(values: number[]): { slope: number; intercept: number } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  private calculateMonthlyAverages(data: any[]): Record<number, number> {
    const monthlyData: Record<number, number[]> = {};
    
    data.forEach(item => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = [];
      }
      monthlyData[item.month].push(item.value);
    });
    
    const averages: Record<number, number> = {};
    Object.keys(monthlyData).forEach(month => {
      const monthNum = parseInt(month);
      averages[monthNum] = monthlyData[monthNum].reduce((a, b) => a + b, 0) / monthlyData[monthNum].length;
    });
    
    return averages;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  private getPeakMonths(averages: Record<number, number>): string[] {
    const sorted = Object.entries(averages).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3).map(([month]) => this.getMonthName(parseInt(month)));
  }

  private getLowMonths(averages: Record<number, number>): string[] {
    const sorted = Object.entries(averages).sort((a, b) => a[1] - b[1]);
    return sorted.slice(0, 3).map(([month]) => this.getMonthName(parseInt(month)));
  }

  private getMonthName(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month];
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    
    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const xVariance = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
    const yVariance = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    
    return numerator / Math.sqrt(xVariance * yVariance);
  }

  private analyzeDistribution(values: number[]): any {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    // Calculate skewness
    const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / values.length;
    
    // Detect outliers (using IQR method)
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const outliers = values.filter(val => val < q1 - 1.5 * iqr || val > q3 + 1.5 * iqr);
    
    return {
      type: Math.abs(skewness) > 0.5 ? 'skewed' : 'normal',
      mean,
      median,
      stdDev,
      skewness,
      outliers: outliers.map(val => ({ value: val, index: values.indexOf(val) }))
    };
  }

  private detectOutliers(values: number[]): any[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    return values
      .map((val, index) => ({ value: val, index }))
      .filter(item => item.value < q1 - 1.5 * iqr || item.value > q3 + 1.5 * iqr);
  }

  private simpleClustering(points: any[]): any[] {
    // Simple k-means clustering with k=3
    const k = Math.min(3, Math.floor(points.length / 3));
    if (k < 2) return [points];
    
    // Initialize centroids
    let centroids = points.slice(0, k).map(p => ({ x: p.x, y: p.y }));
    
    for (let iteration = 0; iteration < 10; iteration++) {
      // Assign points to clusters
      const clusters: any[] = Array.from({ length: k }, () => []);
      
      points.forEach(point => {
        let minDistance = Infinity;
        let bestCluster = 0;
        
        centroids.forEach((centroid, i) => {
          const distance = Math.sqrt(Math.pow(point.x - centroid.x, 2) + Math.pow(point.y - centroid.y, 2));
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = i;
          }
        });
        
        clusters[bestCluster].push(point);
      });
      
      // Update centroids
      centroids = clusters.map(cluster => {
        if (cluster.length === 0) return { x: 0, y: 0 };
        const centerX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
        const centerY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;
        return { x: centerX, y: centerY };
      });
    }
    
    // Final assignment
    const finalClusters: any[] = Array.from({ length: k }, () => []);
    points.forEach(point => {
      let minDistance = Infinity;
      let bestCluster = 0;
      
      centroids.forEach((centroid, i) => {
        const distance = Math.sqrt(Math.pow(point.x - centroid.x, 2) + Math.pow(point.y - centroid.y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = i;
        }
      });
      
      finalClusters[bestCluster].push(point);
    });
    
    return finalClusters
      .filter(cluster => cluster.length > 0)
      .map(cluster => ({
        points: cluster,
        center: {
          x: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
          y: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length
        },
        size: cluster.length
      }));
  }

  private generateSummary(patterns: DataPattern[], data: any[], metadata: any): string {
    const patternTypes = patterns.map(p => p.type);
    const uniqueTypes = [...new Set(patternTypes)];
    
    return `Analysis of ${data.length} records revealed ${patterns.length} significant patterns: ${uniqueTypes.join(', ')}. The data shows ${patternTypes.includes('trend') ? 'clear trends' : 'stable patterns'} with ${patternTypes.includes('seasonal') ? 'seasonal variations' : 'consistent behavior'}.`;
  }

  private generateNextSteps(patterns: DataPattern[], data: any[], metadata: any): string[] {
    const steps: string[] = [];
    
    if (patterns.some(p => p.type === 'trend')) {
      steps.push('Monitor trend continuation and set up alerts for trend changes');
    }
    
    if (patterns.some(p => p.type === 'seasonal')) {
      steps.push('Plan resources and activities based on seasonal patterns');
    }
    
    if (patterns.some(p => p.type === 'correlation')) {
      steps.push('Investigate causal relationships between correlated variables');
    }
    
    if (patterns.some(p => p.type === 'anomaly')) {
      steps.push('Investigate root causes of detected anomalies');
    }
    
    if (patterns.some(p => p.type === 'clustering')) {
      steps.push('Develop targeted strategies for different customer segments');
    }
    
    return steps;
  }

  private generateDefaultDashboard(data: any[], metadata: any): any {
    return {
      intent: 'Basic data overview dashboard',
      blocks: [
        {
          type: 'table',
          title: 'Data Overview',
          config: { sortable: true, filterable: true },
          data: {
            columns: metadata.columns || [],
            rows: data.slice(0, 50) // Limit to first 50 rows
          },
          position: 0
        }
      ],
      layout: { type: 'grid', columns: 1, rows: 1 },
      dataSources: [metadata.source || 'unknown']
    };
  }

  private createBlockFromTemplate(template: any, data: any[], metadata: any, index: number): any {
    // This is a simplified implementation - in practice, you'd have more sophisticated
    // data mapping and block creation logic
    return {
      type: template.type,
      title: template.title,
      config: template.config,
      data: this.mapDataToBlock(template, data, metadata),
      position: index
    };
  }

  private mapDataToBlock(template: any, data: any[], metadata: any): any {
    // Simplified data mapping - in practice, you'd have more sophisticated mapping logic
    switch (template.type) {
      case 'chart':
        return this.mapDataForChart(template, data, metadata);
      case 'table':
        return this.mapDataForTable(template, data, metadata);
      case 'status':
        return this.mapDataForStatus(template, data, metadata);
      default:
        return {};
    }
  }

  private mapDataForChart(template: any, data: any[], metadata: any): any {
    const numericColumns = metadata.numericColumns || [];
    const dateColumns = metadata.dateColumns || [];
    
    if (template.config.type === 'line' && dateColumns.length > 0 && numericColumns.length > 0) {
      const timeSeriesData = data
        .map(row => ({ 
          date: new Date(row[dateColumns[0]]), 
          value: parseFloat(row[numericColumns[0]]) 
        }))
        .filter(item => !isNaN(item.value))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      return {
        labels: timeSeriesData.map(d => d.date.toLocaleDateString()),
        data: timeSeriesData.map(d => d.value),
        type: 'line'
      };
    }
    
    return {
      labels: ['Data 1', 'Data 2', 'Data 3'],
      data: [10, 20, 30],
      type: 'bar'
    };
  }

  private mapDataForTable(template: any, data: any[], metadata: any): any {
    return {
      columns: metadata.columns || [],
      rows: data.slice(0, 20) // Limit rows for performance
    };
  }

  private mapDataForStatus(template: any, data: any[], metadata: any): any {
    const numericColumns = metadata.numericColumns || [];
    if (numericColumns.length > 0) {
      const values = data.map(row => parseFloat(row[numericColumns[0]])).filter(v => !isNaN(v));
      const latestValue = values[values.length - 1] || 0;
      const averageValue = values.reduce((a, b) => a + b, 0) / values.length;
      
      return {
        value: latestValue,
        target: averageValue * 1.1, // 10% above average as target
        status: latestValue >= averageValue ? 'good' : 'warning'
      };
    }
    
    return {
      value: 0,
      target: 100,
      status: 'neutral'
    };
  }
} 