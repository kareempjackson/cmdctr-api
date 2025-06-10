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
    const userId = req.user?.id;
    // Check usage before allowing prompt
    const usage = await this.usageService.getUsageForUser(userId);
    if (usage.promptsUsed >= usage.promptsLimit) {
      throw new ForbiddenException('Prompt usage limit reached. Please upgrade your plan.');
    }
    // Interpret prompt
    const result = await this.promptService.interpretPrompt(dto.prompt, dto.workspaceId);
    // Increment usage after successful call
    await this.usageService.incrementUsage(userId);
    return result;
  }
} 