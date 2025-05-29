import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  TeamMemberResponseDto,
  WorkspaceTeamResponseDto,
  RemoveMemberDto,
  BulkInviteDto,
  TeamStatsDto,
  TeamRole,
  MemberStatus,
} from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async getWorkspaceTeam(workspaceId: string, userId: string): Promise<WorkspaceTeamResponseDto> {
    // Verify user has access to this workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                loginEvents: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { createdAt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const members: TeamMemberResponseDto[] = workspace.members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      workspaceId: member.workspaceId,
      name: member.user.name || 'Unknown',
      email: member.user.email,
      role: member.role as TeamRole,
      status: MemberStatus.ACTIVE, // For now, all existing members are active
      joinedAt: member.user.createdAt,
      lastActive: member.user.loginEvents[0]?.createdAt || undefined,
      avatar: undefined, // TODO: Add avatar support
    }));

    const membersByRole = members.reduce((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    }, {} as Record<TeamRole, number>);

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      members,
      totalMembers: members.length,
      membersByRole,
    };
  }

  async inviteMember(workspaceId: string, inviteDto: InviteMemberDto, inviterId: string): Promise<TeamMemberResponseDto> {
    // Verify inviter has permission (admin or owner)
    await this.verifyAdminAccess(workspaceId, inviterId);

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: inviteDto.email },
    });

    // Check if user is already a member
    if (user) {
      const existingMember = await this.prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
          workspaceId,
        },
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this workspace');
      }
    }

    // If user doesn't exist, create a pending user record
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: inviteDto.email,
          password: '', // Will be set when they accept invitation
          name: inviteDto.email.split('@')[0], // Default name from email
          verified: false,
        },
      });
    }

    // Create workspace membership
    const member = await this.prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role: inviteDto.role,
      },
      include: {
        user: true,
      },
    });

    // Log the activity
    await this.activityService.logActivity({
      userId: inviterId,
      workspaceId,
      category: 'team',
      action: 'invite',
      resource: member.id,
      description: `Invited ${inviteDto.email} as ${inviteDto.role}`,
      metadata: {
        invitedEmail: inviteDto.email,
        role: inviteDto.role,
        message: inviteDto.message,
      },
      status: 'success',
    });

    // TODO: Send invitation email

    return {
      id: member.id,
      userId: member.user.id,
      workspaceId: member.workspaceId,
      name: member.user.name || 'Unknown',
      email: member.user.email,
      role: member.role as TeamRole,
      status: user.verified ? MemberStatus.ACTIVE : MemberStatus.PENDING,
      joinedAt: member.user.createdAt,
      lastActive: undefined,
      avatar: undefined,
    };
  }

  async updateMemberRole(workspaceId: string, memberId: string, updateDto: UpdateMemberRoleDto, updaterId: string): Promise<TeamMemberResponseDto> {
    // Verify updater has permission
    await this.verifyAdminAccess(workspaceId, updaterId);

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        id: memberId,
        workspaceId,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    // Prevent removing the last owner
    if (member.role === TeamRole.OWNER && updateDto.role !== TeamRole.OWNER) {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: TeamRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner from the workspace');
      }
    }

    // Update the role
    const updatedMember = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: updateDto.role },
      include: {
        user: {
          include: {
            loginEvents: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Log the activity
    await this.activityService.logActivity({
      userId: updaterId,
      workspaceId,
      category: 'team',
      action: 'update-role',
      resource: memberId,
      description: `Updated ${member.user.email}'s role from ${member.role} to ${updateDto.role}`,
      metadata: {
        previousRole: member.role,
        newRole: updateDto.role,
        targetUserId: member.userId,
      },
      status: 'success',
    });

    return {
      id: updatedMember.id,
      userId: updatedMember.user.id,
      workspaceId: updatedMember.workspaceId,
      name: updatedMember.user.name || 'Unknown',
      email: updatedMember.user.email,
      role: updatedMember.role as TeamRole,
      status: updatedMember.user.verified ? MemberStatus.ACTIVE : MemberStatus.PENDING,
      joinedAt: updatedMember.user.createdAt,
      lastActive: updatedMember.user.loginEvents[0]?.createdAt || undefined,
      avatar: undefined,
    };
  }

  async removeMember(workspaceId: string, removeDto: RemoveMemberDto, removerId: string): Promise<void> {
    // Verify remover has permission
    await this.verifyAdminAccess(workspaceId, removerId);

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        id: removeDto.memberId,
        workspaceId,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    // Prevent removing the last owner
    if (member.role === TeamRole.OWNER) {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: TeamRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner from the workspace');
      }
    }

    // Remove the member
    await this.prisma.workspaceMember.delete({
      where: { id: removeDto.memberId },
    });

    // Log the activity
    await this.activityService.logActivity({
      userId: removerId,
      workspaceId,
      category: 'team',
      action: 'remove',
      resource: removeDto.memberId,
      description: `Removed ${member.user.email} from workspace`,
      metadata: {
        removedUserId: member.userId,
        removedUserEmail: member.user.email,
        previousRole: member.role,
        reason: removeDto.reason,
      },
      status: 'success',
    });
  }

  async bulkInvite(workspaceId: string, bulkInviteDto: BulkInviteDto, inviterId: string): Promise<TeamMemberResponseDto[]> {
    // Verify inviter has permission
    await this.verifyAdminAccess(workspaceId, inviterId);

    const results: TeamMemberResponseDto[] = [];
    const errors: string[] = [];

    for (const invite of bulkInviteDto.invites) {
      try {
        const member = await this.inviteMember(workspaceId, invite, inviterId);
        results.push(member);
      } catch (error) {
        errors.push(`${invite.email}: ${error.message}`);
      }
    }

    // Log bulk invite activity
    await this.activityService.logActivity({
      userId: inviterId,
      workspaceId,
      category: 'team',
      action: 'bulk-invite',
      description: `Bulk invited ${bulkInviteDto.invites.length} members`,
      metadata: {
        totalInvites: bulkInviteDto.invites.length,
        successful: results.length,
        errors: errors.length,
        errorDetails: errors,
      },
      status: errors.length > 0 ? 'warning' : 'success',
    });

    return results;
  }

  async getTeamStats(workspaceId: string, userId: string): Promise<TeamStatsDto> {
    // Verify user has access
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            verified: true,
            createdAt: true,
          },
        },
      },
    });

    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.user.verified).length;
    const pendingInvites = totalMembers - activeMembers;

    const membersByRole = members.reduce((acc, member) => {
      acc[member.role as TeamRole] = (acc[member.role as TeamRole] || 0) + 1;
      return acc;
    }, {} as Record<TeamRole, number>);

    // Recent joins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentJoins = members.filter(m => 
      m.user.createdAt >= thirtyDaysAgo
    ).length;

    return {
      totalMembers,
      activeMembers,
      pendingInvites,
      membersByRole,
      recentJoins,
      averageResponseTime: '2.5 days', // TODO: Calculate actual response time
    };
  }

  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied to this workspace');
    }
  }

  private async verifyAdminAccess(workspaceId: string, userId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    if (member.role !== TeamRole.OWNER && member.role !== TeamRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to manage team members');
    }
  }
} 