import { Controller, Get, Param, Patch, Body, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @Get()
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'User details' })
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { properties: { name: { type: 'string' }, role: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'User updated' })
  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() data: { name?: string; role?: string }) {
    return this.usersService.updateUser(id, data);
  }

  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @ApiOperation({ summary: 'Get hasSeenJoyride for current user' })
  @ApiResponse({ status: 200, description: 'Joyride status' })
  @Get('me/joyride')
  async getHasSeenJoyride(@Req() req: any) {
    return this.usersService.getHasSeenJoyride(req.user.userId);
  }

  @ApiOperation({ summary: 'Set hasSeenJoyride for current user' })
  @ApiBody({ schema: { properties: { value: { type: 'boolean' } } } })
  @ApiResponse({ status: 200, description: 'Joyride status updated' })
  @Patch('me/joyride')
  async setHasSeenJoyride(@Req() req: any, @Body() body: { value: boolean }) {
    return this.usersService.setHasSeenJoyride(req.user.userId, body.value);
  }
}
