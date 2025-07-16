import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { UpdateAgentTaskDto } from './dto/update-agent-task.dto';
import { QueryAgentTasksDto } from './dto/query-agent-tasks.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('agents/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateAgentTaskDto, @Request() req) {
    return this.tasksService.createTask(createTaskDto, req.user.id);
  }

  @Get()
  findAll(@Query() query: QueryAgentTasksDto) {
    return this.tasksService.findAll(query);
  }

  @Get('stats')
  getStats(@Query('agentId') agentId?: string) {
    return this.tasksService.getTaskStats(agentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateAgentTaskDto) {
    return this.tasksService.updateTask(id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.deleteTask(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.tasksService.retryTask(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.tasksService.cancelTask(id);
  }
} 