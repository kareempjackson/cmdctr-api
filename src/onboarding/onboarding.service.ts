import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenaiService } from '../openai/openai.service';
import { WeaviateService } from '../vector/weaviate.service';
import { OnboardingInitDto } from './dto/onboarding-init.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { Prisma } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/library';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenaiService,
    private readonly weaviate: WeaviateService,
  ) {}

  async init(dto: OnboardingInitDto, userId: string) {
    // Create workspace
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.workspaceName,
        createdBy: userId,
        members: {
          create: [{ userId, role: 'owner' }],
        },
      },
    });
    // Update user role only (do not set onboarded yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.userRole },
    });
    return { workspaceId: workspace.id };
  }

  async createAgent(dto: CreateAgentDto, userId: string) {
    // Find user's workspace
    const member: Prisma.WorkspaceMemberGetPayload<{
      include: { workspace: true };
    }> | null = await this.prisma.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
    });
    if (!member) throw new NotFoundException('Workspace not found');
    // Generate agent config
    const config: InputJsonValue = await this.openai.generateAgentConfig(
      dto.agentName,
      dto.agentPurpose,
    );
    // Create agent
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.agentName,
        purpose: dto.agentPurpose,
        config,
        workspaceId: member.workspaceId,
      },
    });
    // Initialize Weaviate namespace
    await this.weaviate.initAgentMemory(agent.id);
    // Set onboarded to true after agent creation and memory init
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboarded: true },
    });
    return { agentId: agent.id };
  }
}
