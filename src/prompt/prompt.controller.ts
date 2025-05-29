import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PromptService, InterpretPromptResponse } from './prompt.service';

export class InterpretPromptDto {
  prompt: string;
  workspaceId: string;
}

@Controller('api/prompt')
@UseGuards(JwtAuthGuard)
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Post('interpret')
  async interpretPrompt(
    @Body() dto: InterpretPromptDto,
    @Request() req: any,
  ): Promise<InterpretPromptResponse> {
    return this.promptService.interpretPrompt(dto.prompt, dto.workspaceId);
  }
} 