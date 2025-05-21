import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';
import { WeaviateService } from './weaviate.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [VectorService, WeaviateService],
  exports: [VectorService, WeaviateService],
})
export class VectorModule {}
