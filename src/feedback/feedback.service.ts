import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async createFeedback(dto: CreateFeedbackDto & { userId: string }) {
    return this.prisma.feedback.create({ data: dto });
  }

  async getFeedback(targetType: string, targetId: string) {
    return this.prisma.feedback.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  async deleteFeedback(id: string, userId: string) {
    // Only allow deleting own feedback
    const feedback = await this.prisma.feedback.findUnique({ where: { id } });
    if (!feedback || feedback.userId !== userId) throw new Error('Not allowed');
    return this.prisma.feedback.delete({ where: { id } });
  }
}