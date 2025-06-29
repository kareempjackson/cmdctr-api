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

  async listAllMemories(agentId: string) {
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      const result = await this.client.graphql.get()
        .withClassName(className)
        .withFields('input output timestamp metadata')
        .withLimit(100)
        .do();
      const memories = result?.data?.Get?.[className] || [];
      console.log(`[Weaviate][${agentId}] Listing all memories (${memories.length}):`);
      for (const [i, mem] of memories.entries()) {
        console.log(`  Memory ${i + 1}: input="${mem.input?.slice(0, 80)}...", output="${mem.output?.slice(0, 40)}...", metadata=${mem.metadata}`);
      }
      return memories;
    } catch (err) {
      console.error(`[Weaviate][${agentId}] Error listing memories:`, err);
      return [];
    }
  }

  async initWorkspaceMemory(workspaceId: string): Promise<void> {
    const className = `WorkspaceMemory_${workspaceId.replace(/-/g, '')}`;
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

  async storeWorkspaceMemory(workspaceId: string, input: string, output: string, embedding: number[], timestamp: string, metadata: any) {
    const className = `WorkspaceMemory_${workspaceId.replace(/-/g, '')}`;
    await this.client.data.creator()
      .withClassName(className)
      .withProperties({ input, output, embedding, timestamp, metadata: JSON.stringify(metadata) })
      .do();
  }

  async searchWorkspaceMemory(workspaceId: string, queryEmbedding: number[], topK = 5) {
    const className = `WorkspaceMemory_${workspaceId.replace(/-/g, '')}`;
    // Log query embedding info
    console.log(`[WeaviateService][Search] Query embedding length: ${queryEmbedding.length}`);
    const result = await this.client.graphql.get()
      .withClassName(className)
      .withFields('input output timestamp metadata')
      .withNearVector({ vector: queryEmbedding, certainty: 0.7 })
      .withLimit(topK)
      .do();
    const chunks = result?.data?.Get?.[className] || [];
    console.log(`[WeaviateService][Search] Returned ${chunks.length} results for workspace ${workspaceId}`);
    for (const [i, chunk] of chunks.entries()) {
      console.log(`[WeaviateService][Search] Result ${i + 1}/${chunks.length} (length: ${chunk.input?.length || 0}):`, (chunk.input || '').slice(0, 200).replace(/\n/g, ' ') + ((chunk.input || '').length > 200 ? '...' : ''));
    }
    return chunks;
  }

  // Memory Summarization and Smart Selection Methods
  async getAllMemories(agentId: string): Promise<any[]> {
    const className = `AgentMemory_${agentId.replace(/-/g, '')}`;
    try {
      const result = await this.client.graphql.get()
        .withClassName(className)
        .withFields('input output timestamp metadata _additional { id }')
        .withLimit(1000) // Get all memories
        .do();
      const memories = result?.data?.Get?.[className] || [];
      console.log(`[WeaviateService][Memory] Retrieved ${memories.length} total memories for agent ${agentId}`);
      return memories.map(mem => ({
        id: mem._additional?.id,
        input: mem.input,
        output: mem.output,
        timestamp: mem.timestamp,
        metadata: mem.metadata ? JSON.parse(mem.metadata) : {},
      }));
    } catch (err) {
      console.error(`[WeaviateService][Memory] Error getting all memories for agent ${agentId}:`, err);
      return [];
    }
  }

  async generateMemorySummary(agentId: string): Promise<string> {
    const memories = await this.getAllMemories(agentId);
    if (memories.length === 0) {
      console.log(`[WeaviateService][Memory] No memories found for agent ${agentId}, returning empty summary`);
      return '';
    }

    console.log(`[WeaviateService][Memory] Generating summary for ${memories.length} memories from agent ${agentId}`);

    // Filter out training file memories and focus on actual conversations
    const conversationMemories = memories.filter(mem => 
      mem.output !== '[TRAINING FILE]' && 
      mem.input && 
      mem.output && 
      mem.input.trim().length > 0 && 
      mem.output.trim().length > 0
    );

    if (conversationMemories.length === 0) {
      console.log(`[WeaviateService][Memory] No conversation memories found for agent ${agentId}`);
      return '';
    }

    // Create a summary prompt
    const memoryText = conversationMemories
      .map(mem => `Q: ${mem.input}\nA: ${mem.output}`)
      .join('\n\n');

    const summaryPrompt = `Summarize the following conversation history in 2-3 concise paragraphs, focusing on key themes, patterns, and important information. Keep it under 300 words:\n\n${memoryText}`;

    try {
      // Use OpenAI directly for summary generation
      const { Configuration, OpenAIApi } = require('openai');
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);

      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: summaryPrompt }],
        max_tokens: 400,
        temperature: 0.3,
      });

      const summary = completion.data.choices[0]?.message?.content || '';
      console.log(`[WeaviateService][Memory] Generated summary for agent ${agentId} (${summary.length} chars)`);
      return summary;
    } catch (error) {
      console.error(`[WeaviateService][Memory] Error generating summary for agent ${agentId}:`, error);
      // Fallback: return a simple concatenation of recent memories
      const recentMemories = conversationMemories.slice(-5);
      return `Recent interactions: ${recentMemories.map(mem => `${mem.input} -> ${mem.output}`).join('; ')}`;
    }
  }

  async buildComprehensiveMemoryContext(agentId: string, query: string): Promise<string> {
    console.log(`[WeaviateService][Memory] Building comprehensive memory context for agent ${agentId}`);
    
    const allMemories = await this.getAllMemories(agentId);
    
    if (allMemories.length === 0) {
      console.log(`[WeaviateService][Memory] No memories found for agent ${agentId}`);
      return '';
    }

    // Strategy: Summary + Recent + Semantic
    let memoryContext = '';
    
    if (allMemories.length <= 10) {
      // Use all memories if few (10 or fewer)
      console.log(`[WeaviateService][Memory] Using all ${allMemories.length} memories for agent ${agentId}`);
      memoryContext = '\nAll Past Interactions:';
      for (const mem of allMemories) {
        if (mem.output !== '[TRAINING FILE]') {
          memoryContext += `\n- Q: ${mem.input}\n  A: ${mem.output}`;
        }
      }
    } else {
      // Use summary + recent + semantic for larger memory sets
      console.log(`[WeaviateService][Memory] Using summary + recent + semantic for ${allMemories.length} memories`);
      
      // Generate summary
      const summary = await this.generateMemorySummary(agentId);
      
      // Get recent memories (last 5)
      const recent = allMemories.slice(-5).filter(mem => mem.output !== '[TRAINING FILE]');
      
      // Get semantic matches
      const queryEmbedding = await this.generateEmbedding(query);
      const semantic = await this.searchMemory(agentId, queryEmbedding, 5);
      
      // Build comprehensive context
      memoryContext = '';
      
      if (summary) {
        memoryContext += `\nMemory Summary: ${summary}`;
      }
      
      if (recent.length > 0) {
        memoryContext += '\n\nRecent Interactions:';
        for (const mem of recent) {
          memoryContext += `\n- Q: ${mem.input}\n  A: ${mem.output}`;
        }
      }
      
      if (semantic.length > 0) {
        memoryContext += '\n\nRelevant Past Interactions:';
        for (const mem of semantic) {
          // Avoid duplicates with recent
          if (!recent.find(r => r.id === mem.id) && mem.output !== '[TRAINING FILE]') {
            memoryContext += `\n- Q: ${mem.input}\n  A: ${mem.output}`;
          }
        }
      }
    }

    console.log(`[WeaviateService][Memory] Built memory context for agent ${agentId} (${memoryContext.length} chars)`);
    return memoryContext;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use the same embedding service as the rest of the application
    const { Configuration, OpenAIApi } = require('openai');
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data.data[0].embedding;
  }
}
