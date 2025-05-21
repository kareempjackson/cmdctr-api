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
}
