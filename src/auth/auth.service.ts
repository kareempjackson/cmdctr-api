import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '../config/config.service';
import { Request } from 'express';
import { randomBytes } from 'crypto';
import * as postmark from 'postmark';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');
    const hash = await bcrypt.hash(dto.password, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        verified: false,
        verificationToken,
        verificationTokenExpires,
      },
    });
    await this.sendVerificationEmail(user.email, verificationToken);
    return {
      message:
        'Signup successful. Please check your email to verify your account.',
    };
  }

  async sendVerificationEmail(email: string, token: string) {
    const client = new postmark.ServerClient(
      this.config.get<string>('POSTMARK_API_KEY')!,
    );
    const verifyUrl = `${this.config.get<string>('FRONTEND_URL')!}/verify?token=${token}`;
    await client.sendEmail({
      From: this.config.get<string>('POSTMARK_FROM_EMAIL')!,
      To: email,
      Subject: 'Verify your email',
      HtmlBody: `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
    });
  }

  async verifyEmail(token: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: { gt: new Date() },
      },
    });
    if (!user)
      throw new BadRequestException('Invalid or expired verification token');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });
    // Issue tokens after verification
    return this.generateTokens(user.id, user.email);
  }

  async login(dto: LoginDto, req: Request): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.verified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }
    // Log login event
    await this.prisma.loginEvent.create({
      data: {
        userId: user.id,
        ip: req.ip ?? '',
        userAgent: req.headers['user-agent'] || '',
        device: req.headers['user-agent'] || '', // Optionally parse device info
      },
    });
    return this.generateTokens(user.id, user.email);
  }

  async getMe(userId: string) {
    // Fetch user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        onboarded: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    // Fetch all workspaces for this user
    let memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
    
    // If user has no workspaces, create a default one
    if (memberships.length === 0) {
      console.log('User has no workspaces, creating default workspace for user:', userId);
      
      // Create default workspace
      const defaultWorkspace = await this.prisma.workspace.create({
        data: {
          name: `${user?.name || 'My'} Workspace`,
          createdBy: userId,
        },
      });
      
      // Add user as member of the workspace
      await this.prisma.workspaceMember.create({
        data: {
          userId,
          workspaceId: defaultWorkspace.id,
          role: 'owner',
        },
      });
      
      // Refresh memberships
      memberships = await this.prisma.workspaceMember.findMany({
        where: { userId },
        include: { workspace: true },
      });
    }
    
    type WorkspaceWithCurrent = {
      id: string;
      name: string;
      role: string;
      current_workspace: boolean;
    };
    let workspaces: WorkspaceWithCurrent[] = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      current_workspace: false, // will be set below
    }));
    // Pick the first workspace as current (or null)
    const currentWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;
    // Mark current workspace and reorder
    workspaces = workspaces.map((ws) => ({
      ...ws,
      current_workspace: ws.id === currentWorkspaceId,
    }));
    if (currentWorkspaceId) {
      // Move current workspace to the front
      workspaces.sort((a, b) =>
        a.current_workspace ? -1 : b.current_workspace ? 1 : 0,
      );
    }
    // Ensure all required fields for GetMeResponseDto
    return {
      id: user?.id || '',
      email: user?.email || '',
      name: user?.name || '',
      role: user?.role || '',
      onboarded: user?.onboarded ?? false,
      verified: user?.verified ?? false,
      createdAt: user?.createdAt || new Date(0),
      updatedAt: user?.updatedAt || new Date(0),
      workspaces,
      currentWorkspaceId,
    };
  }

  async updateMe(userId: string, updateData: { name?: string; email?: string; avatar?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
    }

    // Update user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateData.name,
        email: updateData.email,
        // Note: avatar field would need to be added to the User model if needed
      },
    });
  }

  async generateTokens(
    userId: string,
    email: string,
  ): Promise<AuthResponseDto> {
    const payload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRATION') || '7d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('User not found');
    if (user.verified) throw new BadRequestException('User already verified');
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpires },
    });
    await this.sendVerificationEmail(user.email, verificationToken);
    return { message: 'Verification email resent. Please check your inbox.' };
  }
}
