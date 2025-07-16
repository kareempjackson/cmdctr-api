import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { EnhancedKnowledgeIntegrationService } from './enhanced-knowledge-integration.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { BullModule } from '@nestjs/bull';
import { VectorModule } from '../vector/vector.module';
import { OpenaiModule } from '../openai/openai.module';
import { PatternInferenceService } from './pattern-inference.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'agent-training',
    }),
    PrismaModule,
    ActivityModule,
    VectorModule,
    OpenaiModule,
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, EnhancedKnowledgeIntegrationService, PatternInferenceService],
  exports: [KnowledgeService, EnhancedKnowledgeIntegrationService, PatternInferenceService],
})
export class KnowledgeModule {} 