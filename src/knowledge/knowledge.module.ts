import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { BullModule } from '@nestjs/bull';
import { VectorModule } from '../vector/vector.module';
import { OpenaiModule } from '../openai/openai.module';

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
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {} 