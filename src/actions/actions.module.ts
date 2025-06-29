import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OpenaiService } from '../openai/openai.service';
import { ActivityService } from '../activity/activity.service';
import { ConfigService } from '../config/config.service';

@Module({
  providers: [
    ActionsService,
    PrismaService,
    OpenaiService,
    ActivityService,
    ConfigService,
  ],
  controllers: [ActionsController],
  exports: [ActionsService],
})
export class ActionsModule {} 