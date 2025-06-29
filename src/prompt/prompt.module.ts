import { Module } from '@nestjs/common';
import { PromptService } from './prompt.service';
import { PromptController } from './prompt.controller';
import { OpenaiService } from '../openai/openai.service';
import { ConfigService } from '../config/config.service';
import { UsageModule } from '../usage/usage.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SmartDetectionService } from './smart-detection.service';
import { EnhancedPromptService } from './enhanced-prompt.service';

@Module({
  imports: [UsageModule, KnowledgeModule],
  controllers: [PromptController],
  providers: [
    PromptService, 
    SmartDetectionService, 
    EnhancedPromptService,
    OpenaiService, 
    ConfigService
  ],
  exports: [PromptService, SmartDetectionService, EnhancedPromptService],
})
export class PromptModule {} 