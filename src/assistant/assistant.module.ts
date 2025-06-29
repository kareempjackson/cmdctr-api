import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { OpenaiModule } from '../openai/openai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [OpenaiModule, KnowledgeModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {} 