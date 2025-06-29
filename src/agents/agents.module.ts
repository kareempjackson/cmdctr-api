import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { OpenaiModule } from '../openai/openai.module';
import { ActivityModule } from '../activity/activity.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ActionsModule } from '../actions/actions.module';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'agent-training',
    }),
    PrismaModule,
    VectorModule,
    OpenaiModule,
    ActivityModule,
    KnowledgeModule,
    ActionsModule,
  ],
  providers: [AgentsService],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
