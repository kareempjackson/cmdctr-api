import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [PrismaModule, VectorModule, OpenaiModule],
  providers: [AgentsService],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
