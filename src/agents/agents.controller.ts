import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAgents(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    const userId = req.user.userId;
    return this.agentsService.getAgentsForUser(
      userId,
      parseInt(page),
      parseInt(pageSize),
    );
  }
}
