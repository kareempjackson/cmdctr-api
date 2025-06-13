import { Controller, Post, Body, Get, Param, Req, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

@Controller('files')
export class FilesController {
  constructor(private prisma: PrismaService) {}

  @Post('avatar-upload-url')
  async getAvatarUploadUrl(@Body() body: { fileType: string; fileName: string }) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const Bucket = process.env.AWS_S3_BUCKET!;
    const Key = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}-${body.fileName}`;
    const command = new PutObjectCommand({
      Bucket,
      Key,
      ContentType: body.fileType,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    return { url, key: Key, publicUrl: `https://${Bucket}.s3.amazonaws.com/${Key}` };
  }

  // Securely serve avatar images to authenticated users in the same workspace/team
  @UseGuards(JwtAuthGuard)
  @Get('avatar/:userId')
  async getAvatar(
    @Param('userId') userId: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    // 1. Check if the requesting user is the same or in the same workspace/team
    const requestingUserId = req.user?.id || req.user?.userId;
    if (!requestingUserId) throw new ForbiddenException('Not authenticated');
    if (requestingUserId !== userId) {
      // Check for shared workspace/team: do both users have a WorkspaceMember in the same workspace?
      const sharedWorkspace = await this.prisma.workspaceMember.findFirst({
        where: {
          userId: requestingUserId,
          workspace: {
            members: {
              some: { userId },
            },
          },
        },
      });
      if (!sharedWorkspace) throw new ForbiddenException('Not authorized to view this avatar');
    }
    // 2. Get the avatar key from the user profile (select avatar only)
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
    if (!user?.avatar) return res.status(404).json({ error: 'Avatar not found' });
    // 3. Extract the S3 key from the avatar URL
    const match = user.avatar.match(/\.com\/(.*)$/);
    if (!match) return res.status(404).json({ error: 'Invalid avatar URL' });
    const Key = match[1];
    const Bucket = process.env.AWS_S3_BUCKET!;
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const command = new GetObjectCommand({ Bucket, Key });
    try {
      const s3res = await s3.send(command);
      res.setHeader('Content-Type', s3res.ContentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename=\"${Key.split('/').pop()}\"`);
      (s3res.Body as any).pipe(res);
    } catch (err) {
      res.status(404).json({ error: 'Avatar not found' });
    }
  }
} 