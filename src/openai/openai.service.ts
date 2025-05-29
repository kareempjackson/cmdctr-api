import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateAgentConfig(name: string, purpose: string): Promise<any> {
    const prompt = `You are an AI assistant onboarding a new agent. Generate a JSON config for an agent with the following:
- Name: ${name}
- Purpose: ${purpose}
Return a JSON object with keys: systemPrompt, capabilities (array), roleAssumptions (array).`;
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 512,
    });
    // Try to parse the first code block or JSON in the response
    const content = completion.choices[0]?.message?.content || '';
    try {
      const jsonMatch =
        content.match(/```json([\s\S]*?)```/i) ||
        content.match(/```([\s\S]*?)```/i);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content;
      return JSON.parse(jsonString);
    } catch {
      return { systemPrompt: content, capabilities: [], roleAssumptions: [] };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  }
}
