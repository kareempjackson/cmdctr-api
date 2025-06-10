import { Controller, Post, Body } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Controller('files')
export class FilesController {
  @Post('avatar-upload-url')
  async getAvatarUploadUrl(@Body() body: { fileType: string }) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const Bucket = process.env.AWS_S3_BUCKET!;
    const Key = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${body.fileType.split('/')[1]}`;
    const command = new PutObjectCommand({
      Bucket,
      Key,
      ContentType: body.fileType,
      ACL: 'public-read',
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });
    return { url, key: Key, publicUrl: `https://${Bucket}.s3.amazonaws.com/${Key}` };
  }
} 