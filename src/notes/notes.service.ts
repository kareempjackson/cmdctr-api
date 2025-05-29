import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
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

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  // Notes operations
  async createNote(
    workspaceId: string,
    userId: string,
    createNoteDto: CreateNoteDto,
  ): Promise<NoteResponseDto> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const note = await this.prisma.note.create({
      data: {
        title: createNoteDto.title,
        content: createNoteDto.content,
        color: createNoteDto.color,
        isPinned: createNoteDto.isPinned || false,
        workspaceId,
        createdBy: userId,
      },
      include: {
        tags: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create tags if provided
    if (createNoteDto.tags && createNoteDto.tags.length > 0) {
      await this.createNoteTags(note.id, createNoteDto.tags);
    }

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId,
      category: 'note',
      action: 'create',
      resource: note.id,
      description: `Created note: ${note.title}`,
      status: 'success',
    });

    return this.formatNoteResponse(note);
  }

  async getNotes(
    workspaceId: string,
    userId: string,
    query: NotesQueryDto,
  ): Promise<NotesListResponseDto> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const { page = 1, pageSize = 20, search, isPinned, isArchived, color, tags } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      workspaceId,
      isArchived: isArchived ?? false,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isPinned !== undefined) {
      where.isPinned = isPinned;
    }

    if (color) {
      where.color = color;
    }

    if (tags && tags.length > 0) {
      where.tags = {
        some: {
          name: { in: tags },
        },
      };
    }

    const [notes, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { isPinned: 'desc' },
          { updatedAt: 'desc' },
        ],
        include: {
          tags: true,
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.note.count({ where }),
    ]);

    return {
      notes: notes.map(this.formatNoteResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getNoteById(noteId: string, userId: string): Promise<NoteResponseDto> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      include: {
        tags: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.verifyWorkspaceAccess(note.workspaceId, userId);

    return this.formatNoteResponse(note);
  }

  async updateNote(
    noteId: string,
    userId: string,
    updateNoteDto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    const existingNote = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!existingNote) {
      throw new NotFoundException('Note not found');
    }

    await this.verifyWorkspaceAccess(existingNote.workspaceId, userId);

    // Update tags if provided
    if (updateNoteDto.tags) {
      await this.updateNoteTags(noteId, updateNoteDto.tags);
    }

    const note = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        title: updateNoteDto.title,
        content: updateNoteDto.content,
        color: updateNoteDto.color,
        isPinned: updateNoteDto.isPinned,
        isArchived: updateNoteDto.isArchived,
      },
      include: {
        tags: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: note.workspaceId,
      category: 'note',
      action: 'update',
      resource: note.id,
      description: `Updated note: ${note.title}`,
      status: 'success',
    });

    return this.formatNoteResponse(note);
  }

  async deleteNote(noteId: string, userId: string): Promise<{ success: boolean }> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.verifyWorkspaceAccess(note.workspaceId, userId);

    await this.prisma.note.delete({
      where: { id: noteId },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: note.workspaceId,
      category: 'note',
      action: 'delete',
      resource: note.id,
      description: `Deleted note: ${note.title}`,
      status: 'success',
    });

    return { success: true };
  }

  // Jots operations
  async createJot(
    workspaceId: string,
    userId: string,
    createJotDto: CreateJotDto,
  ): Promise<JotResponseDto> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const jot = await this.prisma.jot.create({
      data: {
        text: createJotDto.text,
        color: createJotDto.color,
        priority: createJotDto.priority,
        completed: createJotDto.completed || false,
        workspaceId,
        createdBy: userId,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId,
      category: 'jot',
      action: 'create',
      resource: jot.id,
      description: `Created jot: ${jot.text.substring(0, 50)}...`,
      status: 'success',
    });

    return this.formatJotResponse(jot);
  }

  async getJots(
    workspaceId: string,
    userId: string,
    query: JotsQueryDto,
  ): Promise<JotsListResponseDto> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const { page = 1, pageSize = 50, completed, priority, color } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      workspaceId,
    };

    if (completed !== undefined) {
      where.completed = completed;
    }

    if (priority) {
      where.priority = priority;
    }

    if (color) {
      where.color = color;
    }

    const [jots, total] = await Promise.all([
      this.prisma.jot.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { completed: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.jot.count({ where }),
    ]);

    return {
      jots: jots.map(this.formatJotResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateJot(
    jotId: string,
    userId: string,
    updateJotDto: UpdateJotDto,
  ): Promise<JotResponseDto> {
    const existingJot = await this.prisma.jot.findUnique({
      where: { id: jotId },
    });

    if (!existingJot) {
      throw new NotFoundException('Jot not found');
    }

    await this.verifyWorkspaceAccess(existingJot.workspaceId, userId);

    const jot = await this.prisma.jot.update({
      where: { id: jotId },
      data: {
        text: updateJotDto.text,
        color: updateJotDto.color,
        priority: updateJotDto.priority,
        completed: updateJotDto.completed,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: jot.workspaceId,
      category: 'jot',
      action: 'update',
      resource: jot.id,
      description: `Updated jot: ${jot.text.substring(0, 50)}...`,
      status: 'success',
    });

    return this.formatJotResponse(jot);
  }

  async deleteJot(jotId: string, userId: string): Promise<{ success: boolean }> {
    const jot = await this.prisma.jot.findUnique({
      where: { id: jotId },
    });

    if (!jot) {
      throw new NotFoundException('Jot not found');
    }

    await this.verifyWorkspaceAccess(jot.workspaceId, userId);

    await this.prisma.jot.delete({
      where: { id: jotId },
    });

    // Log activity
    await this.activityService.logActivity({
      userId,
      workspaceId: jot.workspaceId,
      category: 'jot',
      action: 'delete',
      resource: jot.id,
      description: `Deleted jot: ${jot.text.substring(0, 50)}...`,
      status: 'success',
    });

    return { success: true };
  }

  // Helper methods
  private async verifyWorkspaceAccess(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { createdBy: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
    });

    if (!workspace) {
      throw new ForbiddenException('Access denied to workspace');
    }
  }

  private async createNoteTags(noteId: string, tagNames: string[]) {
    const tags = tagNames.map(name => ({
      noteId,
      name,
    }));

    await this.prisma.noteTag.createMany({
      data: tags,
    });
  }

  private async updateNoteTags(noteId: string, tagNames: string[]) {
    // Delete existing tags
    await this.prisma.noteTag.deleteMany({
      where: { noteId },
    });

    // Create new tags
    if (tagNames.length > 0) {
      await this.createNoteTags(noteId, tagNames);
    }
  }

  private formatNoteResponse(note: any): NoteResponseDto {
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      workspaceId: note.workspaceId,
      createdBy: note.createdBy,
      color: note.color,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags?.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })),
      creator: note.creator,
    };
  }

  private formatJotResponse(jot: any): JotResponseDto {
    return {
      id: jot.id,
      text: jot.text,
      workspaceId: jot.workspaceId,
      createdBy: jot.createdBy,
      color: jot.color,
      completed: jot.completed,
      priority: jot.priority,
      createdAt: jot.createdAt,
      updatedAt: jot.updatedAt,
      creator: jot.creator,
    };
  }

  // Additional utility methods
  async getRecentJots(workspaceId: string, userId: string, limit: number = 10): Promise<JotResponseDto[]> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const jots = await this.prisma.jot.findMany({
      where: {
        workspaceId,
        completed: false,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return jots.map(this.formatJotResponse);
  }

  async getPinnedNotes(workspaceId: string, userId: string): Promise<NoteResponseDto[]> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const notes = await this.prisma.note.findMany({
      where: {
        workspaceId,
        isPinned: true,
        isArchived: false,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        tags: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return notes.map(this.formatNoteResponse);
  }
} 