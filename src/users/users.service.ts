import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(id: string, data: { name?: string; role?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async getHasSeenJoyride(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { hasSeenJoyride: true } });
    if (!user) throw new NotFoundException('User not found');
    return { hasSeenJoyride: user.hasSeenJoyride };
  }

  async setHasSeenJoyride(userId: string, value: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { hasSeenJoyride: value } });
    return { success: true };
  }
}
