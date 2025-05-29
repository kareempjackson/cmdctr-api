import { Module } from '@nestjs/common';
import { PromptService } from './prompt.service';
import { PromptController } from './prompt.controller';
import { OpenaiService } from '../openai/openai.service';
import { ConfigService } from '../config/config.service';

@Module({
  controllers: [PromptController],
  providers: [PromptService, OpenaiService, ConfigService],
  exports: [PromptService],
})
export class PromptModule {} 