import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamService } from './team.service';
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  TeamMemberResponseDto,
  WorkspaceTeamResponseDto,
  RemoveMemberDto,
  BulkInviteDto,
  TeamStatsDto,
} from './dto/team.dto';

@ApiTags('Team Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all team members for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Team members retrieved successfully',
    type: WorkspaceTeamResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Access denied to workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getWorkspaceTeam(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
  ): Promise<WorkspaceTeamResponseDto> {
    const userId = req.user.userId;
    return this.teamService.getWorkspaceTeam(workspaceId, userId);
  }

  @Post('workspace/:workspaceId/invite')
  @ApiOperation({ summary: 'Invite a new member to the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 201,
    description: 'Member invited successfully',
    type: TeamMemberResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'User already a member' })
  async inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() inviteDto: InviteMemberDto,
    @Req() req: any,
  ): Promise<TeamMemberResponseDto> {
    const userId = req.user.userId;
    return this.teamService.inviteMember(workspaceId, inviteDto, userId);
  }

  @Post('workspace/:workspaceId/bulk-invite')
  @ApiOperation({ summary: 'Bulk invite multiple members to the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 201,
    description: 'Bulk invite completed',
    type: [TeamMemberResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async bulkInvite(
    @Param('workspaceId') workspaceId: string,
    @Body() bulkInviteDto: BulkInviteDto,
    @Req() req: any,
  ): Promise<TeamMemberResponseDto[]> {
    const userId = req.user.userId;
    return this.teamService.bulkInvite(workspaceId, bulkInviteDto, userId);
  }

  @Put('workspace/:workspaceId/member/:memberId/role')
  @ApiOperation({ summary: 'Update a team member\'s role' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'Member role updated successfully',
    type: TeamMemberResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 400, description: 'Cannot remove last owner' })
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateMemberRoleDto,
    @Req() req: any,
  ): Promise<TeamMemberResponseDto> {
    const userId = req.user.userId;
    return this.teamService.updateMemberRole(workspaceId, memberId, updateDto, userId);
  }

  @Delete('workspace/:workspaceId/member')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a team member from the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 400, description: 'Cannot remove last owner' })
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Body() removeDto: RemoveMemberDto,
    @Req() req: any,
  ): Promise<void> {
    const userId = req.user.userId;
    return this.teamService.removeMember(workspaceId, removeDto, userId);
  }

  @Get('workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get team statistics for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Team statistics retrieved successfully',
    type: TeamStatsDto,
  })
  @ApiResponse({ status: 403, description: 'Access denied to workspace' })
  async getTeamStats(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
  ): Promise<TeamStatsDto> {
    const userId = req.user.userId;
    return this.teamService.getTeamStats(workspaceId, userId);
  }

  @Post('workspace/:workspaceId/member/:memberId/resend-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation to a pending member' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async resendInvite(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ): Promise<{ message: string }> {
    // TODO: Implement resend invite logic
    return { message: 'Invitation resent successfully' };
  }
} 