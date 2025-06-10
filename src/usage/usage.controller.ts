import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UsageService } from './usage.service';

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  // TODO: Replace with real auth/user extraction
  private getUserId(req: any): string {
    // Example: return req.user.id;
    return req.user?.id || req.headers['x-user-id'] || 'demo-user-id';
  }

  @Get('me')
  async getMyUsage(@Req() req) {
    const userId = this.getUserId(req);
    return this.usageService.getUsageForUser(userId);
  }

  @Post('increment')
  async incrementMyUsage(@Req() req) {
    const userId = this.getUserId(req);
    return this.usageService.incrementUsage(userId);
  }
} 