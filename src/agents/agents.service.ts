import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';

@Injectable()
export class AgentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAgentsForUser(userId: string, page = 1, pageSize = 10) {
    // Find all workspace IDs for this user
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);
    // Get total count
    const total = await this.prisma.agent.count({
      where: { workspaceId: { in: workspaceIds } },
    });
    // Get paginated agents
    const agents = await this.prisma.agent.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      agents,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // TODO: Implement agent management logic
}
