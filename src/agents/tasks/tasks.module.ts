import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskExecutionService } from './task-execution.service';
import { ActionLibraryService } from './action-library.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, TaskExecutionService, ActionLibraryService],
  exports: [TasksService, TaskExecutionService, ActionLibraryService],
})
export class TasksModule {} 