import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PromptService, InterpretPromptResponse } from './prompt.service';
import { UsageService } from '../usage/usage.service';
import { ActivityService } from '../activity/activity.service';

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
    private readonly activityService: ActivityService,
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
    
    // Log AI prompt activity
    await this.activityService.logActivity({
      userId,
      workspaceId: dto.workspaceId,
      category: 'ai-prompt',
      action: 'interpret',
      resource: dto.workspaceId,
      description: `AI prompt interpreted: "${dto.prompt.substring(0, 100)}${dto.prompt.length > 100 ? '...' : ''}"`,
      metadata: {
        prompt: dto.prompt,
        intent: result.intent,
        blocksGenerated: result.blocks.length,
        blockTypes: result.blocks.map(block => block.type),
        workspaceId: dto.workspaceId,
      },
      status: 'success',
    });
    
    // Increment usage after successful call
    // Estimate tokens used based on prompt length and result content
    const promptTokens = Math.ceil(dto.prompt.length / 4);
    const resultTokens = Math.ceil(JSON.stringify(result).length / 4);
    const estimatedTokens = promptTokens + resultTokens;
    
    await this.usageService.incrementUsage(userId, estimatedTokens, 'prompt');
    
    return result;
  }
} 