import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post()
  async chat(@Body() body: { message: string; context?: any }) {
    return this.assistantService.chat(body.message, body.context);
  }

  @Get('history')
  async getHistory(@Query('userId') userId: string, @Query('workspaceId') workspaceId: string, @Query('limit') limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 50;
    return this.assistantService.getHistory(userId, workspaceId, lim);
  }
} 