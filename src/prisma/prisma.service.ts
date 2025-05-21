// PrismaService provides typed access to the PrismaClient instance for the database
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  // PrismaService for DB access
}
