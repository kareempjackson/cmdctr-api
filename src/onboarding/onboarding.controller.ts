import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { OnboardingInitDto } from './dto/onboarding-init.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('onboarding')
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @ApiOperation({ summary: 'Initialize onboarding and create workspace' })
  @ApiBody({ type: OnboardingInitDto })
  @ApiResponse({
    status: 201,
    description: 'Workspace created',
    schema: { example: { workspaceId: 'uuid' } },
  })
  @Post('init')
  async init(@Body() dto: OnboardingInitDto, @CurrentUser() user: any) {
    return this.onboardingService.init(dto, user.userId);
  }

  @ApiOperation({ summary: 'Create agent for workspace' })
  @ApiBody({ type: CreateAgentDto })
  @ApiResponse({
    status: 201,
    description: 'Agent created',
    schema: { example: { agentId: 'uuid' } },
  })
  @Post('agent')
  async createAgent(@Body() dto: CreateAgentDto, @CurrentUser() user: any) {
    return this.onboardingService.createAgent(dto, user.userId);
  }
}
