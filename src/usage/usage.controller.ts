import { Controller, Get, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageService } from './usage.service';
import { UsageResponseDto, IncrementUsageDto, UsageLimitDto } from './dto/usage.dto';

@ApiTags('Usage Tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user usage' })
  @ApiResponse({
    status: 200,
    description: 'User usage retrieved successfully',
    type: UsageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMyUsage(@Req() req: any): Promise<UsageResponseDto> {
    const userId = req.user.userId;
    return this.usageService.getUsageForUser(userId);
  }

  @Get('limits')
  @ApiOperation({ summary: 'Get user usage limits and current status' })
  @ApiResponse({
    status: 200,
    description: 'Usage limits retrieved successfully',
    type: UsageLimitDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMyUsageLimits(@Req() req: any): Promise<UsageLimitDto> {
    const userId = req.user.userId;
    return this.usageService.getUsageLimits(userId);
  }

  @Post('increment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Increment usage for current user' })
  @ApiResponse({
    status: 200,
    description: 'Usage incremented successfully',
    type: UsageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Usage limit exceeded',
  })
  @ApiBody({ type: IncrementUsageDto })
  async incrementMyUsage(
    @Req() req: any,
    @Body() dto: IncrementUsageDto,
  ): Promise<UsageResponseDto> {
    const userId = req.user.userId;
    return this.usageService.incrementUsage(userId, dto.tokensUsed || 0, dto.usageType);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset usage for current user' })
  @ApiResponse({
    status: 200,
    description: 'Usage reset successfully',
    type: UsageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async resetMyUsage(@Req() req: any): Promise<UsageResponseDto> {
    const userId = req.user.userId;
    return this.usageService.resetUsage(userId);
  }

  @Post('check-limit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if user can make a request with given token usage' })
  @ApiResponse({
    status: 200,
    description: 'Usage limit check passed',
    schema: {
      example: { canProceed: true }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Usage limit would be exceeded',
  })
  @ApiBody({
    schema: {
      properties: {
        tokensToUse: { type: 'number', example: 100, description: 'Number of tokens to use' }
      }
    }
  })
  async checkUsageLimit(
    @Req() req: any,
    @Body() body: { tokensToUse?: number },
  ): Promise<{ canProceed: boolean }> {
    const userId = req.user.userId;
    await this.usageService.checkUsageLimit(userId, body.tokensToUse || 0);
    return { canProceed: true };
  }
} 