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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotesService } from './notes.service';
import {
  CreateNoteDto,
  UpdateNoteDto,
  CreateJotDto,
  UpdateJotDto,
  NotesQueryDto,
  JotsQueryDto,
  NoteResponseDto,
  JotResponseDto,
  NotesListResponseDto,
  JotsListResponseDto,
} from './dto/notes.dto';

@ApiTags('Notes & Jots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  // Notes endpoints
  @Post('workspace/:workspaceId/notes')
  @ApiOperation({ summary: 'Create a new note' })
  @ApiResponse({ status: 201, description: 'Note created successfully', type: NoteResponseDto })
  async createNote(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() createNoteDto: CreateNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notesService.createNote(workspaceId, req.user.userId, createNoteDto);
  }

  @Get('workspace/:workspaceId/notes')
  @ApiOperation({ summary: 'Get notes for a workspace' })
  @ApiResponse({ status: 200, description: 'Notes retrieved successfully', type: NotesListResponseDto })
  async getNotes(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Query() query: NotesQueryDto,
  ): Promise<NotesListResponseDto> {
    return this.notesService.getNotes(workspaceId, req.user.userId, query);
  }

  @Get('notes/:noteId')
  @ApiOperation({ summary: 'Get a specific note' })
  @ApiResponse({ status: 200, description: 'Note retrieved successfully', type: NoteResponseDto })
  async getNoteById(
    @Param('noteId') noteId: string,
    @Request() req: any,
  ): Promise<NoteResponseDto> {
    return this.notesService.getNoteById(noteId, req.user.userId);
  }

  @Put('notes/:noteId')
  @ApiOperation({ summary: 'Update a note' })
  @ApiResponse({ status: 200, description: 'Note updated successfully', type: NoteResponseDto })
  async updateNote(
    @Param('noteId') noteId: string,
    @Request() req: any,
    @Body() updateNoteDto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notesService.updateNote(noteId, req.user.userId, updateNoteDto);
  }

  @Delete('notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiResponse({ status: 204, description: 'Note deleted successfully' })
  async deleteNote(
    @Param('noteId') noteId: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    return this.notesService.deleteNote(noteId, req.user.userId);
  }

  @Get('workspace/:workspaceId/notes/pinned')
  @ApiOperation({ summary: 'Get pinned notes for a workspace' })
  @ApiResponse({ status: 200, description: 'Pinned notes retrieved successfully', type: [NoteResponseDto] })
  async getPinnedNotes(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ): Promise<NoteResponseDto[]> {
    return this.notesService.getPinnedNotes(workspaceId, req.user.userId);
  }

  // Jots endpoints
  @Post('workspace/:workspaceId/jots')
  @ApiOperation({ summary: 'Create a new jot' })
  @ApiResponse({ status: 201, description: 'Jot created successfully', type: JotResponseDto })
  async createJot(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() createJotDto: CreateJotDto,
  ): Promise<JotResponseDto> {
    return this.notesService.createJot(workspaceId, req.user.userId, createJotDto);
  }

  @Get('workspace/:workspaceId/jots')
  @ApiOperation({ summary: 'Get jots for a workspace' })
  @ApiResponse({ status: 200, description: 'Jots retrieved successfully', type: JotsListResponseDto })
  async getJots(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Query() query: JotsQueryDto,
  ): Promise<JotsListResponseDto> {
    return this.notesService.getJots(workspaceId, req.user.userId, query);
  }

  @Get('workspace/:workspaceId/jots/recent')
  @ApiOperation({ summary: 'Get recent jots for a workspace' })
  @ApiResponse({ status: 200, description: 'Recent jots retrieved successfully', type: [JotResponseDto] })
  async getRecentJots(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Query('limit') limit?: number,
  ): Promise<JotResponseDto[]> {
    return this.notesService.getRecentJots(workspaceId, req.user.userId, limit);
  }

  @Put('jots/:jotId')
  @ApiOperation({ summary: 'Update a jot' })
  @ApiResponse({ status: 200, description: 'Jot updated successfully', type: JotResponseDto })
  async updateJot(
    @Param('jotId') jotId: string,
    @Request() req: any,
    @Body() updateJotDto: UpdateJotDto,
  ): Promise<JotResponseDto> {
    return this.notesService.updateJot(jotId, req.user.userId, updateJotDto);
  }

  @Delete('jots/:jotId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a jot' })
  @ApiResponse({ status: 204, description: 'Jot deleted successfully' })
  async deleteJot(
    @Param('jotId') jotId: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    return this.notesService.deleteJot(jotId, req.user.userId);
  }
} 