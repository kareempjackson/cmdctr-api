import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PromptService, InterpretPromptResponse } from './prompt.service';
import { UsageService } from '../usage/usage.service';

export class InterpretPromptDto {
  prompt: string;
  workspaceId: string;
}

@Controller('api/prompt')
@UseGuards(JwtAuthGuard)
export class PromptController {
  constructor(
    private readonly promptService: PromptService,
    private readonly usageService: UsageService,
  ) {}

  @Post('interpret')
  async interpretPrompt(
    @Body() dto: InterpretPromptDto,
    @Request() req: any,
  ): Promise<InterpretPromptResponse> {
    const userId = req.user.userId;
    
    // Check usage limits before processing
    await this.usageService.checkUsageLimit(userId, 0); // We'll update tokens after processing
    
    // Interpret prompt
    const result = await this.promptService.interpretPrompt(dto.prompt, dto.workspaceId, userId);
    
    // Increment usage after successful call
    // Estimate tokens used based on prompt length and result content
    const promptTokens = Math.ceil(dto.prompt.length / 4);
    const resultTokens = Math.ceil(JSON.stringify(result).length / 4);
    const estimatedTokens = promptTokens + resultTokens;
    
    await this.usageService.incrementUsage(userId, estimatedTokens, 'prompt');
    
    return result;
  }
} 