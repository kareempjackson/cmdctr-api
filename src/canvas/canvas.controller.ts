import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CanvasService,
  CanvasLayout,
  CanvasBlock,
  CreateCanvasDto,
  UpdateCanvasDto,
} from './canvas.service';
import { BlockInstruction, PromptService } from '../prompt/prompt.service';

export class CreateCanvasFromPromptDto {
  @IsString()
  prompt: string;

  @IsString()
  workspaceId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddBlockDto {
  type: string;
  title?: string;
  config: any;
  data?: any;
  position?: number;
}

export class ReorderBlocksDto {
  blockIds: string[];
}

@Controller('api/canvas')
@UseGuards(JwtAuthGuard)
export class CanvasController {
  constructor(
    private readonly canvasService: CanvasService,
    private readonly promptService: PromptService,
  ) {}

  @Post('from-prompt')
  @UsePipes(new ValidationPipe())
  async createCanvasFromPrompt(
    @Body() dto: CreateCanvasFromPromptDto,
    @Request() req: any,
  ): Promise<CanvasLayout> {
    console.log('Raw request body:', req.body);
    console.log('Parsed DTO:', dto);
    console.log('DTO constructor:', dto.constructor.name);
    console.log('typeof dto:', typeof dto);
    console.log('createCanvasFromPrompt called with:', { dto, userId: req.user?.userId, user: req.user });
    
    // Validate required fields
    if (!dto.prompt || !dto.workspaceId) {
      console.log('Missing required fields:', { prompt: dto.prompt, workspaceId: dto.workspaceId });
      throw new Error('Missing required fields: prompt and workspaceId are required');
    }
    
    // First, interpret the prompt to get block instructions
    const interpretation = await this.promptService.interpretPrompt(
      dto.prompt,
      dto.workspaceId,
    );

    console.log('Prompt interpretation result:', interpretation);

    // Then create the canvas with the interpreted blocks
    const createDto: CreateCanvasDto = {
      workspaceId: dto.workspaceId,
      name: dto.name || interpretation.intent,
      description: dto.description || interpretation.description,
      blocks: interpretation.blocks,
    };

    console.log('Creating canvas with DTO:', createDto);

    return this.canvasService.createCanvas(req.user.userId, createDto);
  }

  @Post()
  async createCanvas(
    @Body() dto: CreateCanvasDto,
    @Request() req: any,
  ): Promise<CanvasLayout> {
    return this.canvasService.createCanvas(req.user.userId, dto);
  }

  @Get(':id')
  async getCanvas(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<CanvasLayout> {
    return this.canvasService.getCanvas(req.user.userId, id);
  }

  @Get('workspace/:workspaceId')
  async getWorkspaceCanvases(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ): Promise<CanvasLayout[]> {
    return this.canvasService.getWorkspaceCanvases(req.user.userId, workspaceId);
  }

  @Put(':id')
  async updateCanvas(
    @Param('id') id: string,
    @Body() dto: UpdateCanvasDto,
    @Request() req: any,
  ): Promise<CanvasLayout> {
    return this.canvasService.updateCanvas(req.user.userId, id, dto);
  }

  @Delete(':id')
  async deleteCanvas(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.canvasService.deleteCanvas(req.user.userId, id);
    return { message: 'Canvas deleted successfully' };
  }

  @Post(':id/blocks')
  async addBlock(
    @Param('id') canvasId: string,
    @Body() dto: AddBlockDto,
    @Request() req: any,
  ): Promise<CanvasBlock> {
    const blockInstruction: BlockInstruction = {
      type: dto.type,
      title: dto.title,
      config: dto.config,
      data: dto.data,
      position: dto.position || 0,
    };
    return this.canvasService.addBlock(req.user.userId, canvasId, blockInstruction);
  }

  @Put('blocks/:blockId')
  async updateBlock(
    @Param('blockId') blockId: string,
    @Body() dto: Partial<AddBlockDto>,
    @Request() req: any,
  ): Promise<CanvasBlock> {
    return this.canvasService.updateBlock(req.user.userId, blockId, dto);
  }

  @Delete('blocks/:blockId')
  async deleteBlock(
    @Param('blockId') blockId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.canvasService.deleteBlock(req.user.userId, blockId);
    return { message: 'Block deleted successfully' };
  }

  @Put(':id/reorder')
  async reorderBlocks(
    @Param('id') canvasId: string,
    @Body() dto: ReorderBlocksDto,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.canvasService.reorderBlocks(req.user.userId, canvasId, dto.blockIds);
    return { message: 'Blocks reordered successfully' };
  }
} 