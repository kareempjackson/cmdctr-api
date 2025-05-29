import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';

@Injectable()
export class WeaviateService {
  private client: WeaviateClient;

  constructor(private readonly config: ConfigService) {
    this.client = weaviate.client({
      scheme: 'http',
      host: this.config
        .get<string>('WEAVIATE_URL')!
        .replace(/^https?:\/\//, ''),
    });
  }

  async initAgentMemory(agentId: string): Promise<void> {
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    const schema = {
      class: className,
      properties: [
        { name: 'input', dataType: ['text'] },
        { name: 'output', dataType: ['text'] },
        { name: 'timestamp', dataType: ['date'] },
        { name: 'embedding', dataType: ['number[]'] },
        { name: 'metadata', dataType: ['text'] },
      ],
      vectorizer: 'none',
    };
    try {
      await this.client.schema.classCreator().withClass(schema).do();
    } catch (err) {
      if (err?.message?.includes('already exists')) return;
      throw err;
    }
  }

  async searchMemory(agentId: string, queryEmbedding: number[], topK = 5) {
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    // Weaviate hybrid search (vector search)
    const result = await this.client.graphql.get()
      .withClassName(className)
      .withFields('input output timestamp metadata')
      .withNearVector({ vector: queryEmbedding, certainty: 0.7 })
      .withLimit(topK)
      .do();
    return result?.data?.Get?.[className] || [];
  }

  async storeMemory(agentId: string, input: string, output: string, embedding: number[], timestamp: string, metadata: any) {
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    await this.client.data.creator()
      .withClassName(className)
      .withProperties({ input, output, embedding, timestamp, metadata: JSON.stringify(metadata) })
      .do();
  }
}
