import { Controller, Post, Body, Get, Query, Delete, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Request } from 'express';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async createFeedback(@Body() dto: CreateFeedbackDto, @Req() req: Request) {
    // Assume req['user'].id is available from auth middleware
    return this.feedbackService.createFeedback({ ...dto, userId: req['user'].id });
  }

  @Get()
  async getFeedback(
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    return this.feedbackService.getFeedback(targetType, targetId);
  }

  @Delete(':id')
  async deleteFeedback(@Param('id') id: string, @Req() req: Request) {
    // Only allow deleting own feedback
    return this.feedbackService.deleteFeedback(id, req['user'].id);
  }
}