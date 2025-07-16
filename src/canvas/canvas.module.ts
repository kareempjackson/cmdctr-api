import { Module } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';
import { CanvasCollaborationGateway } from './canvas-collaboration.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { PromptModule } from '../prompt/prompt.module';
import { ActivityService } from '../activity/activity.service';

@Module({
  imports: [PromptModule],
  controllers: [CanvasController],
  providers: [CanvasService, CanvasCollaborationGateway, PrismaService, ActivityService],
  exports: [CanvasService],
})
export class CanvasModule {} 