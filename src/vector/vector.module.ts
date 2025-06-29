import { Module } from '@nestjs/common';
import { WeaviateService } from './weaviate.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [WeaviateService],
  exports: [WeaviateService],
})
export class VectorModule {}
