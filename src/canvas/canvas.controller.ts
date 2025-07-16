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
import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CanvasService,
  CanvasLayout,
  CanvasBlock,
  CreateCanvasDto,
  UpdateCanvasDto,
} from './canvas.service';
import { BlockInstruction, PromptService } from '../prompt/prompt.service';
import { ActivityService } from '../activity/activity.service';

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

  @IsOptional()
  deterministic?: boolean;
}

export class CreateCanvasFromTaskDto {
  @IsString()
  taskId: string;

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
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  config: any = {};

  @IsOptional()
  data?: any;

  @IsOptional()
  @IsNumber()
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
    private readonly activityService: ActivityService,
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
      req.user.userId,
      { deterministic: dto.deterministic === true ? true : false }
    );

    // --- ENHANCEMENT: Inference-based dashboard and AI insights integration ---
    let blocks = interpretation.blocks;
    let insightsBlock: BlockInstruction | null = null;
    let dataForInference: any = null;
    let metadataForInference: any = null;

    // Try to extract structured data from the interpretation or workspace
    if (blocks && blocks.length > 0) {
      // Look for a table or chart block with data
      const tableBlock = blocks.find(b => b.type === 'table' && b.data && b.data.rows && b.data.columns);
      const chartBlock = blocks.find(b => b.type === 'chart' && b.data && b.data.labels && b.data.data);
      if (tableBlock) {
        dataForInference = tableBlock.data.rows;
        metadataForInference = { columns: tableBlock.data.columns };
      } else if (chartBlock) {
        // Try to reconstruct data from chart block
        dataForInference = chartBlock.data.data.map((val: any, idx: number) => ({ label: chartBlock.data.labels[idx], value: val }));
        metadataForInference = { columns: ['label', 'value'] };
      }
    }

    // If we have data, run pattern inference and AI insights
    if (dataForInference && metadataForInference) {
      try {
        // Pattern inference
        const inferenceResult = await this.promptService['patternInferenceService'].inferDashboardFromData(
          dataForInference,
          metadataForInference,
          dto.prompt
        );
        // AI insights
        const aiInsights = await this.promptService['aiInsightsService'].generateInsights({
          data: dataForInference,
          metadata: metadataForInference,
          context: dto.prompt
        });
        // Add an insights block
        if (aiInsights && aiInsights.length > 0) {
          insightsBlock = {
            type: 'note',
            title: 'AI Insights',
            config: { markdown: true, collapsible: true, theme: 'insights' },
            data: { content: this.promptService['formatInsightsForDisplay'](aiInsights) },
            position: blocks.length
          };
        }
        if (insightsBlock) {
          blocks.push(insightsBlock);
        }
        // Optionally, add more blocks from inferenceResult.generatedDashboard.blocks
        if (inferenceResult.generatedDashboard && inferenceResult.generatedDashboard.blocks) {
          const extraBlocks = inferenceResult.generatedDashboard.blocks.map((block: any, idx: number) => ({
            ...block,
            position: blocks.length + idx + 1
          }));
          blocks = blocks.concat(extraBlocks);
        }
      } catch (err) {
        console.error('Error running inference/insights for canvas:', err);
      }
    }
    // --- END ENHANCEMENT ---

    // Then create the canvas with the interpreted (and enhanced) blocks
    const createDto: CreateCanvasDto = {
      workspaceId: dto.workspaceId,
      name: dto.name || interpretation.intent,
      description: dto.description || interpretation.description,
      blocks: blocks,
      initialPrompt: dto.prompt,
    };

    const canvas = await this.canvasService.createCanvas(req.user.userId, createDto);

    // Log AI canvas creation activity
    await this.activityService.logActivity({
      userId: req.user.userId,
      workspaceId: dto.workspaceId,
      category: 'canvas',
      action: 'create-from-ai',
      resource: canvas.id,
      description: `AI-generated canvas created: "${canvas.name}" from prompt: "${dto.prompt.substring(0, 100)}${dto.prompt.length > 100 ? '...' : ''}"`,
      metadata: {
        canvasId: canvas.id,
        canvasName: canvas.name,
        prompt: dto.prompt,
        intent: interpretation.intent,
        blocksCreated: blocks.length,
        blockTypes: blocks.map(block => block.type),
        workspaceId: dto.workspaceId,
        aiGenerated: true,
      },
      status: 'success',
    });

    return canvas;
  }

  @Post()
  async createCanvas(
    @Body() dto: CreateCanvasDto,
    @Request() req: any,
  ): Promise<CanvasLayout> {
    return this.canvasService.createCanvas(req.user.userId, dto);
  }

  @Post('from-task')
  async createCanvasFromTask(
    @Body() dto: CreateCanvasFromTaskDto,
    @Request() req: any,
  ): Promise<CanvasLayout> {
    return this.canvasService.createCanvasFromTask(req.user.userId, dto);
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
    console.log('CanvasController.addBlock received DTO:', dto);
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