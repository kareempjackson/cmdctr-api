import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { ActionLibraryService } from './tasks/action-library.service';
import { TaskExecutionService } from './tasks/task-execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { OpenaiModule } from '../openai/openai.module';
import { ActivityModule } from '../activity/activity.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ActionsModule } from '../actions/actions.module';
import { BullModule } from '@nestjs/bull';
import { TasksModule } from './tasks/tasks.module';

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
    TasksModule,
  ],
  providers: [AgentsService, ActionLibraryService, TaskExecutionService],
  controllers: [AgentsController],
  exports: [AgentsService, ActionLibraryService, TaskExecutionService],
})
export class AgentsModule {}
