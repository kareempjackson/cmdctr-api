import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export enum MemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  INACTIVE = 'inactive',
}

export class InviteMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: TeamRole, example: TeamRole.MEMBER })
  @IsEnum(TeamRole)
  role: TeamRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: TeamRole, example: TeamRole.ADMIN })
  @IsEnum(TeamRole)
  role: TeamRole;
}

export class TeamMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: TeamRole })
  role: TeamRole;

  @ApiProperty({ enum: MemberStatus })
  status: MemberStatus;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ nullable: true })
  lastActive?: Date;

  @ApiProperty({ nullable: true })
  avatar?: string;
}

export class WorkspaceTeamResponseDto {
  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  workspaceName: string;

  @ApiProperty({ type: [TeamMemberResponseDto] })
  members: TeamMemberResponseDto[];

  @ApiProperty()
  totalMembers: number;

  @ApiProperty()
  membersByRole: Record<TeamRole, number>;
}

export class RemoveMemberDto {
  @ApiProperty()
  @IsUUID()
  memberId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkInviteDto {
  @ApiProperty({ type: [InviteMemberDto] })
  invites: InviteMemberDto[];
}

export class TeamStatsDto {
  @ApiProperty()
  totalMembers: number;

  @ApiProperty()
  activeMembers: number;

  @ApiProperty()
  pendingInvites: number;

  @ApiProperty()
  membersByRole: Record<TeamRole, number>;

  @ApiProperty()
  recentJoins: number; // Last 30 days

  @ApiProperty()
  averageResponseTime: string; // For pending invites
} 