import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateCanvasDto,
  UpdateCanvasDto,
  CreateBlockDto,
  UpdateBlockDto,
  BulkUpdateBlocksDto,
  ProjectResponseDto,
  CanvasResponseDto,
  BlockResponseDto,
  ProjectListResponseDto,
} from './dto/project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(ValidationPipe)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Project Endpoints
  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully', type: ProjectResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Project slug already exists' })
  async createProject(
    @Request() req: any,
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.createProject(req.user.id, createProjectDto);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all projects in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully', type: ProjectListResponseDto })
  @ApiResponse({ status: 403, description: 'Access denied to workspace' })
  async getWorkspaceProjects(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
  ): Promise<ProjectListResponseDto> {
    return this.projectsService.getWorkspaceProjects(req.user.id, workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project retrieved successfully', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getProject(
    @Request() req: any,
    @Param('id') projectId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.getProject(req.user.id, projectId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 409, description: 'Project slug already exists' })
  async updateProject(
    @Request() req: any,
    @Param('id') projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.updateProject(req.user.id, projectId, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 204, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteProject(
    @Request() req: any,
    @Param('id') projectId: string,
  ): Promise<void> {
    return this.projectsService.deleteProject(req.user.id, projectId);
  }

  // Canvas Endpoints
  @Post('canvases')
  @ApiOperation({ summary: 'Create a new canvas' })
  @ApiResponse({ status: 201, description: 'Canvas created successfully', type: CanvasResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async createCanvas(
    @Request() req: any,
    @Body() createCanvasDto: CreateCanvasDto,
  ): Promise<CanvasResponseDto> {
    return this.projectsService.createCanvas(req.user.id, createCanvasDto);
  }

  @Get(':projectId/canvases')
  @ApiOperation({ summary: 'Get all canvases in a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Canvases retrieved successfully', type: [CanvasResponseDto] })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getProjectCanvases(
    @Request() req: any,
    @Param('projectId') projectId: string,
  ): Promise<CanvasResponseDto[]> {
    return this.projectsService.getProjectCanvases(req.user.id, projectId);
  }

  @Get('canvases/:id')
  @ApiOperation({ summary: 'Get a canvas by ID' })
  @ApiParam({ name: 'id', description: 'Canvas ID' })
  @ApiResponse({ status: 200, description: 'Canvas retrieved successfully', type: CanvasResponseDto })
  @ApiResponse({ status: 404, description: 'Canvas not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getCanvas(
    @Request() req: any,
    @Param('id') canvasId: string,
  ): Promise<CanvasResponseDto> {
    return this.projectsService.getCanvas(req.user.id, canvasId);
  }

  @Put('canvases/:id')
  @ApiOperation({ summary: 'Update a canvas' })
  @ApiParam({ name: 'id', description: 'Canvas ID' })
  @ApiResponse({ status: 200, description: 'Canvas updated successfully', type: CanvasResponseDto })
  @ApiResponse({ status: 404, description: 'Canvas not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateCanvas(
    @Request() req: any,
    @Param('id') canvasId: string,
    @Body() updateCanvasDto: UpdateCanvasDto,
  ): Promise<CanvasResponseDto> {
    return this.projectsService.updateCanvas(req.user.id, canvasId, updateCanvasDto);
  }

  @Delete('canvases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a canvas' })
  @ApiParam({ name: 'id', description: 'Canvas ID' })
  @ApiResponse({ status: 204, description: 'Canvas deleted successfully' })
  @ApiResponse({ status: 404, description: 'Canvas not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteCanvas(
    @Request() req: any,
    @Param('id') canvasId: string,
  ): Promise<void> {
    return this.projectsService.deleteCanvas(req.user.id, canvasId);
  }

  // Block Endpoints
  @Post('blocks')
  @ApiOperation({ summary: 'Create a new block' })
  @ApiResponse({ status: 201, description: 'Block created successfully', type: BlockResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Canvas not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async createBlock(
    @Request() req: any,
    @Body() createBlockDto: CreateBlockDto,
  ): Promise<BlockResponseDto> {
    return this.projectsService.createBlock(req.user.id, createBlockDto);
  }

  @Get('canvases/:canvasId/blocks')
  @ApiOperation({ summary: 'Get all blocks in a canvas' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({ status: 200, description: 'Blocks retrieved successfully', type: [BlockResponseDto] })
  @ApiResponse({ status: 404, description: 'Canvas not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getCanvasBlocks(
    @Request() req: any,
    @Param('canvasId') canvasId: string,
  ): Promise<BlockResponseDto[]> {
    return this.projectsService.getCanvasBlocks(req.user.id, canvasId);
  }

  @Get('blocks/:id')
  @ApiOperation({ summary: 'Get a block by ID' })
  @ApiParam({ name: 'id', description: 'Block ID' })
  @ApiResponse({ status: 200, description: 'Block retrieved successfully', type: BlockResponseDto })
  @ApiResponse({ status: 404, description: 'Block not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getBlock(
    @Request() req: any,
    @Param('id') blockId: string,
  ): Promise<BlockResponseDto> {
    return this.projectsService.getBlock(req.user.id, blockId);
  }

  @Put('blocks/:id')
  @ApiOperation({ summary: 'Update a block' })
  @ApiParam({ name: 'id', description: 'Block ID' })
  @ApiResponse({ status: 200, description: 'Block updated successfully', type: BlockResponseDto })
  @ApiResponse({ status: 404, description: 'Block not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateBlock(
    @Request() req: any,
    @Param('id') blockId: string,
    @Body() updateBlockDto: UpdateBlockDto,
  ): Promise<BlockResponseDto> {
    return this.projectsService.updateBlock(req.user.id, blockId, updateBlockDto);
  }

  @Put('canvases/:canvasId/blocks/bulk')
  @ApiOperation({ summary: 'Bulk update blocks in a canvas' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({ status: 200, description: 'Blocks updated successfully', type: [BlockResponseDto] })
  @ApiResponse({ status: 404, description: 'Canvas not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async bulkUpdateBlocks(
    @Request() req: any,
    @Param('canvasId') canvasId: string,
    @Body() bulkUpdateDto: BulkUpdateBlocksDto,
  ): Promise<BlockResponseDto[]> {
    return this.projectsService.bulkUpdateBlocks(req.user.id, canvasId, bulkUpdateDto);
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a block' })
  @ApiParam({ name: 'id', description: 'Block ID' })
  @ApiResponse({ status: 204, description: 'Block deleted successfully' })
  @ApiResponse({ status: 404, description: 'Block not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteBlock(
    @Request() req: any,
    @Param('id') blockId: string,
  ): Promise<void> {
    return this.projectsService.deleteBlock(req.user.id, blockId);
  }
} 