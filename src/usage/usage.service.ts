import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { UsageResponseDto, UsageLimitDto } from './dto/usage.dto';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsageForUser(userId: string): Promise<UsageResponseDto> {
    let usage = await this.prisma.usage.findUnique({ where: { userId } });
    
    // Create usage record if it doesn't exist
    if (!usage) {
      usage = await this.prisma.usage.create({
        data: {
          userId,
          requests: 0,
          tokens: 0,
          lastReset: new Date(),
        },
      });
    }
    
    return usage;
  }

  async incrementUsage(userId: string, tokensUsed: number = 0, usageType?: string): Promise<UsageResponseDto> {
    let usage = await this.prisma.usage.findUnique({ where: { userId } });
    
    // Create usage record if it doesn't exist
    if (!usage) {
      usage = await this.prisma.usage.create({
        data: {
          userId,
          requests: 0,
          tokens: 0,
          lastReset: new Date(),
        },
      });
    }
    
    return this.prisma.usage.update({
      where: { userId },
      data: { 
        requests: { increment: 1 },
        tokens: { increment: tokensUsed }
      },
    });
  }

  async resetUsage(userId: string): Promise<UsageResponseDto> {
    const usage = await this.getUsageForUser(userId);
    
    return this.prisma.usage.update({
      where: { userId },
      data: { 
        requests: 0,
        tokens: 0,
        lastReset: new Date()
      },
    });
  }

  async getUsageLimits(userId: string): Promise<UsageLimitDto> {
    const usage = await this.getUsageForUser(userId);
    
    // Get user's plan/role to determine limits
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    // Define limits based on user role (you can customize these)
    const limits = this.getLimitsForRole(user?.role || 'free');
    
    return {
      requestsLimit: limits.requests,
      tokensLimit: limits.tokens,
      requestsUsed: usage.requests,
      tokensUsed: usage.tokens,
      requestsRemaining: Math.max(0, limits.requests - usage.requests),
      tokensRemaining: Math.max(0, limits.tokens - usage.tokens),
    };
  }

  async checkUsageLimit(userId: string, tokensToUse: number = 0): Promise<boolean> {
    const limits = await this.getUsageLimits(userId);
    
    // Check if user has exceeded limits
    if (limits.requestsUsed >= limits.requestsLimit) {
      throw new ForbiddenException('Request limit reached. Please upgrade your plan.');
    }
    
    if (limits.tokensUsed + tokensToUse > limits.tokensLimit) {
      throw new ForbiddenException('Token limit would be exceeded. Please upgrade your plan.');
    }
    
    return true;
  }

  private getLimitsForRole(role: string): { requests: number; tokens: number } {
    switch (role) {
      case 'admin':
        return { requests: 10000, tokens: 1000000 };
      case 'premium':
        return { requests: 5000, tokens: 500000 };
      case 'pro':
        return { requests: 2000, tokens: 200000 };
      case 'basic':
        return { requests: 1000, tokens: 100000 };
      case 'free':
      default:
        return { requests: 100, tokens: 10000 };
    }
  }

  @Cron('0 0 1 * *')
  async resetAllUsageMonthly() {
    console.log('Resetting all usage records for new month...');
    await this.prisma.usage.updateMany({ 
      data: { 
        requests: 0, 
        tokens: 0,
        lastReset: new Date() 
      } 
    });
    console.log('Monthly usage reset completed.');
  }

  // Admin methods for usage management
  async getAllUsageStats() {
    const stats = await this.prisma.usage.aggregate({
      _sum: {
        requests: true,
        tokens: true,
      },
      _count: {
        userId: true,
      },
    });

    return {
      totalUsers: stats._count?.userId || 0,
      totalRequests: stats._sum?.requests || 0,
      totalTokens: stats._sum?.tokens || 0,
    };
  }

  async getUserUsageHistory(userId: string, days: number = 30) {
    // This would require a separate usage history table for detailed tracking
    // For now, return current usage
    return this.getUsageForUser(userId);
  }
} 