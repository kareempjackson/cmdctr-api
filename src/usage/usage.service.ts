import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsageForUser(userId: string) {
    const usage = await this.prisma.usage.findUnique({ where: { userId } });
    if (!usage) throw new NotFoundException('Usage record not found');
    return usage;
  }

  async incrementUsage(userId: string) {
    const usage = await this.prisma.usage.findUnique({ where: { userId } });
    if (!usage) throw new NotFoundException('Usage record not found');
    if (usage.promptsUsed >= usage.promptsLimit) throw new ForbiddenException('Usage limit reached');
    return this.prisma.usage.update({
      where: { userId },
      data: { promptsUsed: { increment: 1 } },
    });
  }

  async resetUsage(userId: string) {
    return this.prisma.usage.update({
      where: { userId },
      data: { promptsUsed: 0 },
    });
  }

  @Cron('0 0 1 * *')
  async resetAllUsageMonthly() {
    await this.prisma.usage.updateMany({ data: { promptsUsed: 0, resetDate: new Date() } });
    // You can add logging here if desired
  }
} 