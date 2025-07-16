import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';

export interface ForecastResult {
  type: 'trend' | 'seasonal' | 'regression' | 'classification';
  confidence: number;
  predictions: Array<{
    date: string;
    value: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  }>;
  insights: string[];
  recommendations: string[];
}

export interface PredictiveInsight {
  type: 'forecast' | 'anomaly_prediction' | 'trend_prediction' | 'classification';
  title: string;
  description: string;
  confidence: number;
  data: any;
  actions: string[];
}

@Injectable()
export class PredictiveAnalyticsService {
  constructor(
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Generate forecasts for time series data
   */
  async generateForecast(
    data: any[],
    dateColumn: string,
    valueColumn: string,
    periods: number = 12
  ): Promise<ForecastResult> {
    const timeSeriesData = data
      .map(row => ({ 
        date: new Date(row[dateColumn]), 
        value: parseFloat(row[valueColumn]) 
      }))
      .filter(item => !isNaN(item.value))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (timeSeriesData.length < 6) {
      throw new Error('Insufficient data for forecasting (minimum 6 data points required)');
    }

    // Simple linear regression forecast
    const forecast = this.linearRegressionForecast(timeSeriesData, periods);
    
    // Detect seasonality and adjust forecast
    const seasonalAdjustment = this.detectSeasonality(timeSeriesData);
    const adjustedForecast = this.applySeasonalAdjustment(forecast, seasonalAdjustment);

    return {
      type: seasonalAdjustment ? 'seasonal' : 'trend',
      confidence: this.calculateForecastConfidence(timeSeriesData),
      predictions: adjustedForecast,
      insights: this.generateForecastInsights(timeSeriesData, adjustedForecast),
      recommendations: this.generateForecastRecommendations(adjustedForecast)
    };
  }

  /**
   * Predict anomalies in future data
   */
  async predictAnomalies(
    data: any[],
    dateColumn: string,
    valueColumn: string,
    periods: number = 6
  ): Promise<PredictiveInsight> {
    const timeSeriesData = data
      .map(row => ({ 
        date: new Date(row[dateColumn]), 
        value: parseFloat(row[valueColumn]) 
      }))
      .filter(item => !isNaN(item.value))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const forecast = await this.generateForecast(data, dateColumn, valueColumn, periods);
    const anomalyThreshold = this.calculateAnomalyThreshold(timeSeriesData);
    
    const predictedAnomalies = forecast.predictions.filter(pred => 
      pred.value > pred.upperBound + anomalyThreshold || 
      pred.value < pred.lowerBound - anomalyThreshold
    );

    return {
      type: 'anomaly_prediction',
      title: 'Predicted Anomalies',
      description: `${predictedAnomalies.length} potential anomalies predicted in the next ${periods} periods`,
      confidence: Math.min(0.8, predictedAnomalies.length / periods * 2),
      data: {
        anomalies: predictedAnomalies,
        threshold: anomalyThreshold,
        riskLevel: predictedAnomalies.length > periods * 0.3 ? 'high' : 'medium'
      },
      actions: [
        'Set up monitoring alerts for predicted anomaly periods',
        'Prepare contingency plans for high-risk periods',
        'Investigate potential causes of predicted anomalies'
      ]
    };
  }

  /**
   * Predict trend changes
   */
  async predictTrendChanges(
    data: any[],
    dateColumn: string,
    valueColumn: string
  ): Promise<PredictiveInsight> {
    const timeSeriesData = data
      .map(row => ({ 
        date: new Date(row[dateColumn]), 
        value: parseFloat(row[valueColumn]) 
      }))
      .filter(item => !isNaN(item.value))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const trendAnalysis = this.analyzeTrendStability(timeSeriesData);
    
    return {
      type: 'trend_prediction',
      title: 'Trend Change Prediction',
      description: `Trend is ${trendAnalysis.stability} with ${trendAnalysis.changeProbability}% probability of change`,
      confidence: trendAnalysis.confidence,
      data: {
        currentTrend: trendAnalysis.currentTrend,
        stability: trendAnalysis.stability,
        changeProbability: trendAnalysis.changeProbability,
        inflectionPoints: trendAnalysis.inflectionPoints
      },
      actions: [
        'Monitor trend stability indicators',
        'Prepare for potential trend reversal',
        'Adjust strategies based on trend predictions'
      ]
    };
  }

  /**
   * Classify data patterns for business insights
   */
  async classifyDataPatterns(
    data: any[],
    metadata: any
  ): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];

    // Growth pattern classification
    const growthPattern = this.classifyGrowthPattern(data, metadata);
    if (growthPattern) {
      insights.push(growthPattern);
    }

    // Performance pattern classification
    const performancePattern = this.classifyPerformancePattern(data, metadata);
    if (performancePattern) {
      insights.push(performancePattern);
    }

    // Risk pattern classification
    const riskPattern = this.classifyRiskPattern(data, metadata);
    if (riskPattern) {
      insights.push(riskPattern);
    }

    return insights;
  }

  // Helper methods for forecasting
  private linearRegressionForecast(data: any[], periods: number): {date: string; value: number; confidence: number; upperBound: number; lowerBound: number;}[] {
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data.map(d => d.value);
    
    const { slope, intercept } = this.calculateLinearRegression(x, y);
    
    const predictions: {date: string; value: number; confidence: number; upperBound: number; lowerBound: number;}[] = [];
    for (let i = 0; i < periods; i++) {
      const futureIndex = n + i;
      const predictedValue = slope * futureIndex + intercept;
      const confidence = Math.max(0.1, 1 - (i * 0.1)); // Decreasing confidence over time
      
      predictions.push({
        date: this.addDays(data[data.length - 1].date, i + 1).toISOString(),
        value: Math.max(0, predictedValue), // Ensure non-negative
        confidence,
        upperBound: predictedValue * (1 + 0.2 * (1 - confidence)),
        lowerBound: predictedValue * (1 - 0.2 * (1 - confidence))
      });
    }
    
    return predictions;
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

  private detectSeasonality(data: any[]): any {
    if (data.length < 12) return null;
    
    const monthlyAverages = this.calculateMonthlyAverages(data);
    const variance = this.calculateVariance(Object.values(monthlyAverages));
    
    if (variance < 0.1) return null; // No significant seasonality
    
    return {
      type: 'monthly',
      pattern: monthlyAverages,
      strength: variance > 0.3 ? 'strong' : 'moderate'
    };
  }

  private applySeasonalAdjustment(forecast: any[], seasonality: any): any[] {
    if (!seasonality) return forecast;
    
    return forecast.map(prediction => {
      const date = new Date(prediction.date);
      const month = date.getMonth();
      const seasonalFactor = seasonality.pattern[month] || 1;
      
      return {
        ...prediction,
        value: prediction.value * seasonalFactor,
        upperBound: prediction.upperBound * seasonalFactor,
        lowerBound: prediction.lowerBound * seasonalFactor
      };
    });
  }

  private calculateForecastConfidence(data: any[]): number {
    // Calculate confidence based on data consistency
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    // Higher confidence for more consistent data
    return Math.max(0.3, Math.min(0.9, 1 - coefficientOfVariation));
  }

  private calculateAnomalyThreshold(data: any[]): number {
    const values = data.map(d => d.value);
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    return iqr * 1.5; // Standard anomaly threshold
  }

  private analyzeTrendStability(data: any[]): any {
    const values = data.map(d => d.value);
    const trends: number[] = [];
    
    // Calculate rolling trends
    for (let i = 3; i < values.length; i++) {
      const recentValues = values.slice(i - 3, i);
      const { slope } = this.calculateLinearRegression([0, 1, 2], recentValues);
      trends.push(slope);
    }
    
    const trendVariance = this.calculateVariance(trends);
    const currentTrend = trends[trends.length - 1];
    const averageTrend = trends.reduce((a, b) => a + b, 0) / trends.length;
    
    const stability = trendVariance < 0.1 ? 'stable' : trendVariance < 0.3 ? 'moderate' : 'volatile';
    const changeProbability = Math.min(100, trendVariance * 200);
    
    return {
      currentTrend,
      averageTrend,
      stability,
      changeProbability,
      confidence: Math.max(0.3, 1 - trendVariance),
      inflectionPoints: this.findInflectionPoints(trends)
    };
  }

  private classifyGrowthPattern(data: any[], metadata: any): PredictiveInsight | null {
    const numericColumns = metadata.numericColumns || [];
    if (numericColumns.length === 0) return null;
    
    const values = data.map(row => parseFloat(row[numericColumns[0]])).filter(v => !isNaN(v));
    if (values.length < 6) return null;
    
    const { slope } = this.calculateLinearRegression(Array.from({ length: values.length }, (_, i) => i), values);
    const growthRate = slope / (values[0] || 1) * 100;
    
    let pattern = '';
    let actions: string[] = [];
    
    if (growthRate > 10) {
      pattern = 'exponential growth';
      actions = ['Scale operations', 'Increase capacity', 'Monitor resource constraints'];
    } else if (growthRate > 5) {
      pattern = 'steady growth';
      actions = ['Maintain momentum', 'Optimize processes', 'Plan for expansion'];
    } else if (growthRate > 0) {
      pattern = 'slow growth';
      actions = ['Identify growth barriers', 'Optimize performance', 'Explore new opportunities'];
    } else if (growthRate > -5) {
      pattern = 'decline';
      actions = ['Investigate causes', 'Implement corrective measures', 'Review strategy'];
    } else {
      pattern = 'rapid decline';
      actions = ['Urgent intervention required', 'Crisis management', 'Strategic pivot needed'];
    }
    
    return {
      type: 'classification',
      title: 'Growth Pattern Classification',
      description: `Data shows ${pattern} with ${growthRate.toFixed(1)}% growth rate`,
      confidence: Math.abs(growthRate) > 20 ? 0.9 : Math.abs(growthRate) > 10 ? 0.7 : 0.5,
      data: { growthRate, pattern, trend: slope },
      actions
    };
  }

  private classifyPerformancePattern(data: any[], metadata: any): PredictiveInsight | null {
    const numericColumns = metadata.numericColumns || [];
    if (numericColumns.length === 0) return null;
    
    const values = data.map(row => parseFloat(row[numericColumns[0]])).filter(v => !isNaN(v));
    if (values.length < 6) return null;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const coefficientOfVariation = stdDev / mean;
    
    let performance = '';
    let actions: string[] = [];
    
    if (coefficientOfVariation < 0.1) {
      performance = 'highly consistent';
      actions = ['Maintain consistency', 'Optimize for efficiency', 'Standardize processes'];
    } else if (coefficientOfVariation < 0.2) {
      performance = 'consistent';
      actions = ['Monitor for improvements', 'Identify best practices', 'Reduce variability'];
    } else if (coefficientOfVariation < 0.4) {
      performance = 'variable';
      actions = ['Investigate causes of variation', 'Implement quality controls', 'Standardize procedures'];
    } else {
      performance = 'highly variable';
      actions = ['Urgent process improvement needed', 'Root cause analysis required', 'Implement strict controls'];
    }
    
    return {
      type: 'classification',
      title: 'Performance Pattern Classification',
      description: `Performance is ${performance} with ${(coefficientOfVariation * 100).toFixed(1)}% variability`,
      confidence: 0.8,
      data: { coefficientOfVariation, performance, mean, stdDev },
      actions
    };
  }

  private classifyRiskPattern(data: any[], metadata: any): PredictiveInsight | null {
    const numericColumns = metadata.numericColumns || [];
    if (numericColumns.length === 0) return null;
    
    const values = data.map(row => parseFloat(row[numericColumns[0]])).filter(v => !isNaN(v));
    if (values.length < 6) return null;
    
    const outliers = this.detectOutliers(values);
    const outlierPercentage = (outliers.length / values.length) * 100;
    
    let riskLevel = '';
    let actions: string[] = [];
    
    if (outlierPercentage > 10) {
      riskLevel = 'high risk';
      actions = ['Immediate risk assessment required', 'Implement monitoring systems', 'Develop contingency plans'];
    } else if (outlierPercentage > 5) {
      riskLevel = 'moderate risk';
      actions = ['Monitor for risk indicators', 'Implement preventive measures', 'Review risk management procedures'];
    } else if (outlierPercentage > 1) {
      riskLevel = 'low risk';
      actions = ['Maintain current monitoring', 'Periodic risk reviews', 'Standard risk management'];
    } else {
      riskLevel = 'minimal risk';
      actions = ['Continue current practices', 'Periodic assessments', 'Maintain quality standards'];
    }
    
    return {
      type: 'classification',
      title: 'Risk Pattern Classification',
      description: `Risk level is ${riskLevel} with ${outlierPercentage.toFixed(1)}% outlier rate`,
      confidence: 0.9,
      data: { outlierPercentage, riskLevel, outliers: outliers.length },
      actions
    };
  }

  // Utility methods
  private calculateMonthlyAverages(data: any[]): Record<number, number> {
    const monthlyData: Record<number, number[]> = {};
    
    data.forEach(item => {
      const month = item.date.getMonth();
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(item.value);
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
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
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

  private findInflectionPoints(trends: number[]): number[] {
    const inflectionPoints: number[] = [];
    
    for (let i = 1; i < trends.length - 1; i++) {
      const prev = trends[i - 1];
      const curr = trends[i];
      const next = trends[i + 1];
      
      // Check for trend reversal
      if ((prev < curr && curr > next) || (prev > curr && curr < next)) {
        inflectionPoints.push(i);
      }
    }
    
    return inflectionPoints;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private generateForecastInsights(data: any[], forecast: any[]): string[] {
    const insights: string[] = [];
    
    const currentValue = data[data.length - 1].value;
    const predictedValue = forecast[0].value;
    const change = ((predictedValue - currentValue) / currentValue) * 100;
    
    insights.push(`Predicted ${change > 0 ? 'increase' : 'decrease'} of ${Math.abs(change).toFixed(1)}% in next period`);
    
    if (forecast.some(f => f.confidence < 0.5)) {
      insights.push('Forecast confidence decreases significantly for longer periods');
    }
    
    const trend = forecast[forecast.length - 1].value - forecast[0].value;
    if (Math.abs(trend) > currentValue * 0.2) {
      insights.push('Significant trend change predicted over forecast period');
    }
    
    return insights;
  }

  private generateForecastRecommendations(forecast: any[]): string[] {
    const recommendations: string[] = [];
    
    const trend = forecast[forecast.length - 1].value - forecast[0].value;
    
    if (trend > 0) {
      recommendations.push('Prepare for growth: increase capacity and resources');
      recommendations.push('Monitor for potential bottlenecks as demand increases');
    } else if (trend < 0) {
      recommendations.push('Prepare for decline: optimize costs and efficiency');
      recommendations.push('Investigate causes and implement corrective measures');
    }
    
    recommendations.push('Set up monitoring alerts for forecasted values');
    recommendations.push('Regularly update forecasts with new data');
    
    return recommendations;
  }
} 