import { Module } from '@nestjs/common';
import { PatternInferenceService } from '../knowledge/pattern-inference.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { NaturalLanguageQueryService } from './natural-language-query.service';
import { DashboardOptimizationService } from './dashboard-optimization.service';
import { RealTimeAnalyticsService } from './real-time-analytics.service';
import { AIInsightsService } from './ai-insights.service';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [OpenaiModule],
  providers: [
    PatternInferenceService,
    PredictiveAnalyticsService,
    NaturalLanguageQueryService,
    DashboardOptimizationService,
    RealTimeAnalyticsService,
    AIInsightsService,
  ],
  exports: [
    PatternInferenceService,
    PredictiveAnalyticsService,
    NaturalLanguageQueryService,
    DashboardOptimizationService,
    RealTimeAnalyticsService,
    AIInsightsService,
  ],
})
export class AnalyticsModule {} 