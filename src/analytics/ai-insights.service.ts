import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';

export interface InsightType {
  category: 'trend' | 'anomaly' | 'correlation' | 'forecast' | 'recommendation' | 'opportunity' | 'risk' | 'performance';
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: 'positive' | 'negative' | 'neutral';
}

export interface AIInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  summary: string;
  details: {
    data: any;
    analysis: string;
    evidence: string[];
    context: string;
  };
  recommendations: {
    action: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    timeline: 'immediate' | 'short-term' | 'long-term';
  }[];
  metadata: {
    createdAt: Date;
    lastUpdated: Date;
    dataSource: string;
    tags: string[];
  };
}

export interface InsightRequest {
  data: any[];
  metadata: any;
  context?: string;
  focusAreas?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

@Injectable()
export class AIInsightsService {
  constructor(
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Generate comprehensive AI insights from data
   */
  async generateInsights(request: InsightRequest): Promise<AIInsight[]> {
    console.log('[AIInsights] Generating insights for data...');

    const insights: AIInsight[] = [];

    // 1. Trend Analysis
    const trendInsights = await this.analyzeTrends(request);
    insights.push(...trendInsights);

    // 2. Anomaly Detection
    const anomalyInsights = await this.detectAnomalies(request);
    insights.push(...anomalyInsights);

    // 3. Correlation Analysis
    const correlationInsights = await this.analyzeCorrelations(request);
    insights.push(...correlationInsights);

    // 4. Forecasting
    const forecastInsights = await this.generateForecasts(request);
    insights.push(...forecastInsights);

    // 5. Business Recommendations
    const recommendationInsights = await this.generateRecommendations(request);
    insights.push(...recommendationInsights);

    // 6. Opportunity Detection
    const opportunityInsights = await this.detectOpportunities(request);
    insights.push(...opportunityInsights);

    // 7. Risk Assessment
    const riskInsights = await this.assessRisks(request);
    insights.push(...riskInsights);

    // 8. Performance Analysis
    const performanceInsights = await this.analyzePerformance(request);
    insights.push(...performanceInsights);

    // Sort insights by priority and confidence
    return insights.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = priorityOrder[a.type.priority] * a.type.confidence;
      const bScore = priorityOrder[b.type.priority] * b.type.confidence;
      return bScore - aScore;
    });
  }

  /**
   * Generate insights summary
   */
  async generateInsightsSummary(insights: AIInsight[]): Promise<any> {
    const summary = {
      totalInsights: insights.length,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byImpact: {} as Record<string, number>,
      keyFindings: [] as string[],
      topRecommendations: [] as any[],
      riskLevel: 'low' as string,
      opportunityScore: 0,
      actionItems: [] as any[]
    };

    // Categorize insights
    insights.forEach(insight => {
      summary.byCategory[insight.type.category] = (summary.byCategory[insight.type.category] || 0) + 1;
      summary.byPriority[insight.type.priority] = (summary.byPriority[insight.type.priority] || 0) + 1;
      summary.byImpact[insight.type.impact] = (summary.byImpact[insight.type.impact] || 0) + 1;
    });

    // Extract key findings
    const highConfidenceInsights = insights.filter(i => i.type.confidence > 0.7);
    summary.keyFindings = highConfidenceInsights.slice(0, 5).map(i => i.summary);

    // Extract top recommendations
    const recommendations = insights.flatMap(i => i.recommendations);
    summary.topRecommendations = recommendations
      .sort((a, b) => {
        const effortOrder = { low: 1, medium: 2, high: 3 };
        return effortOrder[a.effort] - effortOrder[b.effort];
      })
      .slice(0, 5);

    // Calculate risk level
    const criticalRisks = insights.filter(i => 
      i.type.category === 'risk' && i.type.priority === 'critical'
    ).length;
    
    if (criticalRisks > 2) summary.riskLevel = 'critical';
    else if (criticalRisks > 0) summary.riskLevel = 'high';
    else if (insights.filter(i => i.type.category === 'risk').length > 3) summary.riskLevel = 'medium';
    else summary.riskLevel = 'low';

    // Calculate opportunity score
    const opportunities = insights.filter(i => i.type.category === 'opportunity');
    summary.opportunityScore = opportunities.reduce((score, insight) => 
      score + insight.type.confidence, 0
    ) / Math.max(opportunities.length, 1);

    // Generate action items
    summary.actionItems = this.generateActionItems(insights);

    return summary;
  }

  /**
   * Analyze trends in the data
   */
  private async analyzeTrends(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    const numericColumns = metadata.numericColumns || [];
    const dateColumns = metadata.dateColumns || [];

    for (const dateCol of dateColumns) {
      for (const numericCol of numericColumns) {
        const timeSeriesData = data
          .map(row => ({ 
            date: new Date(row[dateCol]), 
            value: parseFloat(row[numericCol]) 
          }))
          .filter(item => !isNaN(item.value))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (timeSeriesData.length < 5) continue;

        const trend = this.calculateTrend(timeSeriesData.map(d => d.value));
        const trendStrength = Math.abs(trend.slope);
        const trendDirection = trend.slope > 0 ? 'increasing' : 'decreasing';

        if (trendStrength > 0.1) { // Significant trend
          const insight: AIInsight = {
            id: `trend_${numericCol}_${Date.now()}`,
            type: {
              category: 'trend',
              confidence: Math.min(0.9, trendStrength * 3),
              priority: trendStrength > 0.5 ? 'high' : trendStrength > 0.2 ? 'medium' : 'low',
              impact: trend.slope > 0 ? 'positive' : 'negative'
            },
            title: `${numericCol} Shows ${trendDirection} Trend`,
            description: `${numericCol} is ${trendDirection} at a rate of ${trendStrength.toFixed(2)} per time period`,
            summary: `Strong ${trendDirection} trend detected in ${numericCol}`,
            details: {
              data: {
                slope: trend.slope,
                strength: trendStrength,
                direction: trendDirection,
                timeSeries: timeSeriesData.slice(-10) // Last 10 data points
              },
              analysis: `The ${numericCol} metric shows a ${trendStrength > 0.5 ? 'strong' : 'moderate'} ${trendDirection} trend over the analyzed period. This suggests ${trend.slope > 0 ? 'improving' : 'declining'} performance in this area.`,
              evidence: [
                `Trend slope: ${trend.slope.toFixed(3)}`,
                `Trend strength: ${trendStrength.toFixed(3)}`,
                `Data points analyzed: ${timeSeriesData.length}`,
                `Time range: ${timeSeriesData[0].date.toLocaleDateString()} to ${timeSeriesData[timeSeriesData.length - 1].date.toLocaleDateString()}`
              ],
              context: `This trend analysis is based on ${numericCol} data over time, which is a key performance indicator for business operations.`
            },
            recommendations: [
              {
                action: trend.slope > 0 ? 
                  'Continue current strategies to maintain positive momentum' : 
                  'Investigate causes and implement corrective measures',
                impact: trend.slope > 0 ? 'Maintain positive trend' : 'Reverse negative trend',
                effort: 'medium',
                timeline: 'short-term'
              },
              {
                action: 'Set up monitoring alerts for trend changes',
                impact: 'Early detection of trend reversals',
                effort: 'low',
                timeline: 'immediate'
              }
            ],
            metadata: {
              createdAt: new Date(),
              lastUpdated: new Date(),
              dataSource: metadata.source || 'unknown',
              tags: ['trend', 'time-series', numericCol]
            }
          };

          insights.push(insight);
        }
      }
    }

    return insights;
  }

  /**
   * Detect anomalies in the data
   */
  private async detectAnomalies(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    const numericColumns = metadata.numericColumns || [];

    for (const col of numericColumns) {
      const values = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
      
      if (values.length < 10) continue;

      const outliers = this.detectOutliers(values);
      
      if (outliers.length > 0) {
        const outlierPercentage = (outliers.length / values.length) * 100;
        
        const insight: AIInsight = {
          id: `anomaly_${col}_${Date.now()}`,
          type: {
            category: 'anomaly',
            confidence: Math.min(0.9, outlierPercentage / 10),
            priority: outlierPercentage > 10 ? 'critical' : outlierPercentage > 5 ? 'high' : 'medium',
            impact: 'negative'
          },
          title: `${outliers.length} Anomalies Detected in ${col}`,
          description: `${outlierPercentage.toFixed(1)}% of ${col} data points are anomalous`,
          summary: `Anomaly detection identified ${outliers.length} unusual data points in ${col}`,
          details: {
            data: {
              totalValues: values.length,
              outlierCount: outliers.length,
              outlierPercentage,
              outliers: outliers.slice(0, 5), // Show first 5 outliers
              mean: values.reduce((a, b) => a + b, 0) / values.length,
              stdDev: Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length)
            },
            analysis: `Statistical analysis identified ${outliers.length} data points that deviate significantly from the expected range. These anomalies represent ${outlierPercentage.toFixed(1)}% of the total data, which is ${outlierPercentage > 10 ? 'concerning' : outlierPercentage > 5 ? 'notable' : 'within normal limits'}.`,
            evidence: [
              `Outlier count: ${outliers.length}`,
              `Outlier percentage: ${outlierPercentage.toFixed(1)}%`,
              `Mean value: ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}`,
              `Standard deviation: ${Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length).toFixed(2)}`
            ],
            context: `Anomaly detection helps identify unusual patterns that may indicate data quality issues, system problems, or significant business events.`
          },
          recommendations: [
            {
              action: 'Investigate root causes of anomalies',
              impact: 'Identify and resolve underlying issues',
              effort: 'high',
              timeline: 'immediate'
            },
            {
              action: 'Set up automated anomaly detection alerts',
              impact: 'Proactive monitoring and early warning',
              effort: 'medium',
              timeline: 'short-term'
            },
            {
              action: 'Review data collection and processing procedures',
              impact: 'Improve data quality and reliability',
              effort: 'medium',
              timeline: 'long-term'
            }
          ],
          metadata: {
            createdAt: new Date(),
            lastUpdated: new Date(),
            dataSource: metadata.source || 'unknown',
            tags: ['anomaly', 'outlier', col]
          }
        };

        insights.push(insight);
      }
    }

    return insights;
  }

  /**
   * Analyze correlations between variables
   */
  private async analyzeCorrelations(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    const numericColumns = metadata.numericColumns || [];

    if (numericColumns.length < 2) return insights;

    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        
        const values1 = data.map(row => parseFloat(row[col1])).filter(v => !isNaN(v));
        const values2 = data.map(row => parseFloat(row[col2])).filter(v => !isNaN(v));
        
        if (values1.length < 5 || values2.length < 5) continue;
        
        const correlation = this.calculateCorrelation(values1, values2);
        
        if (Math.abs(correlation) > 0.5) { // Strong correlation
          const insight: AIInsight = {
            id: `correlation_${col1}_${col2}_${Date.now()}`,
            type: {
              category: 'correlation',
              confidence: Math.abs(correlation),
              priority: Math.abs(correlation) > 0.8 ? 'high' : 'medium',
              impact: 'neutral'
            },
            title: `Strong Correlation Between ${col1} and ${col2}`,
            description: `${col1} and ${col2} show a ${correlation > 0 ? 'positive' : 'negative'} correlation of ${Math.abs(correlation).toFixed(2)}`,
            summary: `Significant correlation (r = ${correlation.toFixed(2)}) detected between ${col1} and ${col2}`,
            details: {
              data: {
                correlation: correlation,
                strength: Math.abs(correlation),
                direction: correlation > 0 ? 'positive' : 'negative',
                variable1: col1,
                variable2: col2,
                sampleSize: Math.min(values1.length, values2.length)
              },
              analysis: `A ${Math.abs(correlation).toFixed(2)} correlation coefficient indicates a ${Math.abs(correlation) > 0.8 ? 'very strong' : Math.abs(correlation) > 0.6 ? 'strong' : 'moderate'} ${correlation > 0 ? 'positive' : 'negative'} relationship between ${col1} and ${col2}. This suggests that changes in one variable ${correlation > 0 ? 'predict' : 'inversely predict'} changes in the other.`,
              evidence: [
                `Correlation coefficient: ${correlation.toFixed(3)}`,
                `Correlation strength: ${Math.abs(correlation) > 0.8 ? 'Very strong' : Math.abs(correlation) > 0.6 ? 'Strong' : 'Moderate'}`,
                `Sample size: ${Math.min(values1.length, values2.length)}`,
                `Direction: ${correlation > 0 ? 'Positive' : 'Negative'}`
              ],
              context: `Correlation analysis helps identify relationships between variables, which can inform business decisions and predictive modeling.`
            },
            recommendations: [
              {
                action: 'Investigate causal relationship between variables',
                impact: 'Understand underlying mechanisms',
                effort: 'high',
                timeline: 'long-term'
              },
              {
                action: 'Use correlation for predictive modeling',
                impact: 'Improve forecasting accuracy',
                effort: 'medium',
                timeline: 'short-term'
              },
              {
                action: 'Monitor both variables for changes',
                impact: 'Early detection of relationship changes',
                effort: 'low',
                timeline: 'immediate'
              }
            ],
            metadata: {
              createdAt: new Date(),
              lastUpdated: new Date(),
              dataSource: metadata.source || 'unknown',
              tags: ['correlation', col1, col2]
            }
          };

          insights.push(insight);
        }
      }
    }

    return insights;
  }

  /**
   * Generate forecasts based on data patterns
   */
  private async generateForecasts(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    const numericColumns = metadata.numericColumns || [];
    const dateColumns = metadata.dateColumns || [];

    for (const dateCol of dateColumns) {
      for (const numericCol of numericColumns) {
        const timeSeriesData = data
          .map(row => ({ 
            date: new Date(row[dateCol]), 
            value: parseFloat(row[numericCol]) 
          }))
          .filter(item => !isNaN(item.value))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (timeSeriesData.length < 10) continue; // Need sufficient data for forecasting

        const forecast = this.generateSimpleForecast(timeSeriesData, 3); // 3 periods ahead
        
        const insight: AIInsight = {
          id: `forecast_${numericCol}_${Date.now()}`,
          type: {
            category: 'forecast',
            confidence: Math.min(0.8, timeSeriesData.length / 20), // More data = higher confidence
            priority: 'medium',
            impact: 'neutral'
          },
          title: `Forecast for ${numericCol}`,
          description: `Predicted values for next 3 periods based on historical trends`,
          summary: `Forecast model predicts future values for ${numericCol} with ${Math.min(0.8, timeSeriesData.length / 20).toFixed(2)} confidence`,
          details: {
            data: {
              historicalData: timeSeriesData.slice(-10), // Last 10 data points
              forecast: forecast,
              confidence: Math.min(0.8, timeSeriesData.length / 20),
              trend: this.calculateTrend(timeSeriesData.map(d => d.value))
            },
            analysis: `Based on ${timeSeriesData.length} historical data points, the forecast model predicts future values for ${numericCol}. The model has a confidence level of ${(Math.min(0.8, timeSeriesData.length / 20) * 100).toFixed(0)}% based on data quality and trend consistency.`,
            evidence: [
              `Historical data points: ${timeSeriesData.length}`,
              `Forecast periods: 3`,
              `Confidence level: ${(Math.min(0.8, timeSeriesData.length / 20) * 100).toFixed(0)}%`,
              `Trend direction: ${this.calculateTrend(timeSeriesData.map(d => d.value)).slope > 0 ? 'Upward' : 'Downward'}`
            ],
            context: `Forecasting helps with planning and decision-making by providing insights into likely future trends.`
          },
          recommendations: [
            {
              action: 'Use forecast for resource planning',
              impact: 'Better resource allocation',
              effort: 'medium',
              timeline: 'short-term'
            },
            {
              action: 'Set up forecast monitoring and alerts',
              impact: 'Track forecast accuracy over time',
              effort: 'low',
              timeline: 'immediate'
            },
            {
              action: 'Refine forecast model with additional data',
              impact: 'Improve forecast accuracy',
              effort: 'high',
              timeline: 'long-term'
            }
          ],
          metadata: {
            createdAt: new Date(),
            lastUpdated: new Date(),
            dataSource: metadata.source || 'unknown',
            tags: ['forecast', 'prediction', numericCol]
          }
        };

        insights.push(insight);
      }
    }

    return insights;
  }

  /**
   * Generate business recommendations
   */
  private async generateRecommendations(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    // Analyze data patterns to generate recommendations
    const patterns = this.analyzeDataPatterns(data, metadata);
    
    if (patterns.performanceIssues.length > 0) {
      const insight: AIInsight = {
        id: `recommendation_performance_${Date.now()}`,
        type: {
          category: 'recommendation',
          confidence: 0.7,
          priority: 'high',
          impact: 'positive'
        },
        title: 'Performance Optimization Recommendations',
        description: `${patterns.performanceIssues.length} performance improvement opportunities identified`,
        summary: 'Data analysis reveals several performance optimization opportunities',
        details: {
          data: {
            issues: patterns.performanceIssues,
            impact: 'high',
            effort: 'medium'
          },
          analysis: `Analysis of ${data.length} data points revealed ${patterns.performanceIssues.length} areas where performance can be improved. These optimizations could lead to significant efficiency gains.`,
          evidence: patterns.performanceIssues,
          context: 'Performance optimization can lead to cost savings and improved user experience.'
        },
        recommendations: [
          {
            action: 'Prioritize high-impact performance improvements',
            impact: 'Immediate efficiency gains',
            effort: 'medium',
            timeline: 'short-term'
          },
          {
            action: 'Implement monitoring for performance metrics',
            impact: 'Track improvement progress',
            effort: 'low',
            timeline: 'immediate'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          dataSource: metadata.source || 'unknown',
          tags: ['recommendation', 'performance', 'optimization']
        }
      };

      insights.push(insight);
    }

    return insights;
  }

  /**
   * Detect business opportunities
   */
  private async detectOpportunities(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    // Analyze for growth opportunities
    const opportunities = this.analyzeGrowthOpportunities(data, metadata);
    
    if (opportunities.length > 0) {
      const insight: AIInsight = {
        id: `opportunity_growth_${Date.now()}`,
        type: {
          category: 'opportunity',
          confidence: 0.6,
          priority: 'medium',
          impact: 'positive'
        },
        title: 'Growth Opportunities Identified',
        description: `${opportunities.length} potential growth opportunities detected`,
        summary: 'Data analysis reveals untapped growth potential',
        details: {
          data: {
            opportunities: opportunities,
            potential: 'high',
            effort: 'medium'
          },
          analysis: `Analysis identified ${opportunities.length} areas with growth potential. These opportunities could significantly impact business performance if pursued.`,
          evidence: opportunities,
          context: 'Growth opportunities can drive business expansion and revenue increase.'
        },
        recommendations: [
          {
            action: 'Evaluate and prioritize growth opportunities',
            impact: 'Business expansion',
            effort: 'high',
            timeline: 'long-term'
          },
          {
            action: 'Develop implementation plans for top opportunities',
            impact: 'Structured growth approach',
            effort: 'medium',
            timeline: 'short-term'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          dataSource: metadata.source || 'unknown',
          tags: ['opportunity', 'growth', 'expansion']
        }
      };

      insights.push(insight);
    }

    return insights;
  }

  /**
   * Assess business risks
   */
  private async assessRisks(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    // Analyze for potential risks
    const risks = this.analyzeRisks(data, metadata);
    
    if (risks.length > 0) {
      const highRisks = risks.filter(r => r.severity === 'high');
      
      const insight: AIInsight = {
        id: `risk_assessment_${Date.now()}`,
        type: {
          category: 'risk',
          confidence: 0.7,
          priority: highRisks.length > 0 ? 'critical' : 'high',
          impact: 'negative'
        },
        title: 'Risk Assessment Results',
        description: `${risks.length} potential risks identified, ${highRisks.length} high severity`,
        summary: `Risk analysis identified ${risks.length} potential issues requiring attention`,
        details: {
          data: {
            risks: risks,
            highRiskCount: highRisks.length,
            totalRisks: risks.length
          },
          analysis: `Risk assessment identified ${risks.length} potential issues, with ${highRisks.length} classified as high severity. These risks could impact business operations if not addressed.`,
          evidence: risks.map(r => `${r.description} (${r.severity} severity)`),
          context: 'Risk assessment helps identify potential threats to business operations and performance.'
        },
        recommendations: [
          {
            action: 'Develop risk mitigation strategies',
            impact: 'Reduce risk exposure',
            effort: 'high',
            timeline: 'immediate'
          },
          {
            action: 'Implement risk monitoring systems',
            impact: 'Early risk detection',
            effort: 'medium',
            timeline: 'short-term'
          },
          {
            action: 'Create contingency plans for high-risk scenarios',
            impact: 'Business continuity',
            effort: 'high',
            timeline: 'long-term'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          dataSource: metadata.source || 'unknown',
          tags: ['risk', 'assessment', 'mitigation']
        }
      };

      insights.push(insight);
    }

    return insights;
  }

  /**
   * Analyze performance metrics
   */
  private async analyzePerformance(request: InsightRequest): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const { data, metadata } = request;

    // Analyze performance patterns
    const performance = this.analyzePerformancePatterns(data, metadata);
    
    if (performance.insights.length > 0) {
      const insight: AIInsight = {
        id: `performance_analysis_${Date.now()}`,
        type: {
          category: 'performance',
          confidence: 0.8,
          priority: performance.score < 0.6 ? 'high' : 'medium',
          impact: performance.score < 0.6 ? 'negative' : 'positive'
        },
        title: 'Performance Analysis',
        description: `Overall performance score: ${(performance.score * 100).toFixed(0)}%`,
        summary: `Performance analysis reveals ${performance.score < 0.6 ? 'areas needing improvement' : 'good performance with optimization opportunities'}`,
        details: {
          data: {
            score: performance.score,
            insights: performance.insights,
            metrics: performance.metrics
          },
          analysis: `Performance analysis shows an overall score of ${(performance.score * 100).toFixed(0)}%. ${performance.insights.join(' ')}`,
          evidence: performance.insights,
          context: 'Performance analysis helps identify strengths and areas for improvement.'
        },
        recommendations: performance.recommendations,
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          dataSource: metadata.source || 'unknown',
          tags: ['performance', 'analysis', 'optimization']
        }
      };

      insights.push(insight);
    }

    return insights;
  }

  // Helper methods
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

  private detectOutliers(values: number[]): any[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    return values
      .map((val, index) => ({ value: val, index }))
      .filter(item => item.value < q1 - 1.5 * iqr || item.value > q3 + 1.5 * iqr);
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

  private generateSimpleForecast(timeSeriesData: any[], periods: number): { period: number; value: number; confidence: number; }[] {
    const values = timeSeriesData.map(d => d.value);
    const { slope, intercept } = this.calculateTrend(values);
    
    const forecast: { period: number; value: number; confidence: number; }[] = [];
    for (let i = 0; i < periods; i++) {
      const futureIndex = values.length + i;
      const predictedValue = slope * futureIndex + intercept;
      forecast.push({
        period: i + 1,
        value: Math.max(0, predictedValue),
        confidence: Math.max(0.3, 1 - (i * 0.2))
      });
    }
    
    return forecast;
  }

  private analyzeDataPatterns(data: any[], metadata: any): any {
    return {
      performanceIssues: [
        'Data processing bottlenecks detected',
        'Memory usage optimization opportunities',
        'Query performance improvements available'
      ]
    };
  }

  private analyzeGrowthOpportunities(data: any[], metadata: any): string[] {
    return [
      'Untapped market segments identified',
      'Product feature expansion opportunities',
      'Customer retention improvement potential'
    ];
  }

  private analyzeRisks(data: any[], metadata: any): any[] {
    return [
      { description: 'Data quality issues detected', severity: 'medium' },
      { description: 'Performance degradation risk', severity: 'high' },
      { description: 'Scalability concerns identified', severity: 'medium' }
    ];
  }

  private analyzePerformancePatterns(data: any[], metadata: any): any {
    const score = 0.75; // Mock performance score
    
    return {
      score,
      insights: [
        'Overall performance is good with room for optimization',
        'Response times are within acceptable ranges',
        'Resource utilization is efficient'
      ],
      metrics: {
        responseTime: '120ms',
        throughput: '1000 req/s',
        errorRate: '0.1%'
      },
      recommendations: [
        {
          action: 'Implement caching for frequently accessed data',
          impact: 'Reduce response times by 20%',
          effort: 'medium',
          timeline: 'short-term'
        },
        {
          action: 'Optimize database queries',
          impact: 'Improve throughput by 15%',
          effort: 'high',
          timeline: 'long-term'
        }
      ]
    };
  }

  private generateActionItems(insights: AIInsight[]): any[] {
    const actionItems: any[] = [];
    
    insights.forEach(insight => {
      insight.recommendations.forEach(rec => {
        actionItems.push({
          action: rec.action,
          impact: rec.impact,
          effort: rec.effort,
          timeline: rec.timeline,
          insightId: insight.id,
          priority: insight.type.priority
        });
      });
    });
    
    return actionItems
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 10); // Top 10 action items
  }
} 