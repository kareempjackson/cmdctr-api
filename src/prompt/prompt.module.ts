import { Module } from '@nestjs/common';
import { PromptService } from './prompt.service';
import { PromptController } from './prompt.controller';
import { OpenaiService } from '../openai/openai.service';
import { ConfigService } from '../config/config.service';
import { UsageModule } from '../usage/usage.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SmartDetectionService } from './smart-detection.service';
import { EnhancedPromptService } from './enhanced-prompt.service';
import { ActivityService } from '../activity/activity.service';
import { PatternInferenceService } from '../knowledge/pattern-inference.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [UsageModule, KnowledgeModule, AnalyticsModule],
  controllers: [PromptController],
  providers: [
    PromptService, 
    SmartDetectionService, 
    EnhancedPromptService,
    OpenaiService, 
    ConfigService,
    ActivityService,
    PatternInferenceService
  ],
  exports: [PromptService, SmartDetectionService, EnhancedPromptService, PatternInferenceService],
})
export class PromptModule {} 