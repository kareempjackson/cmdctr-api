import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Query,
  Res,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SignupDto,
  LoginDto,
  AuthResponseDto,
  GetMeResponseDto,
  UpdateMeDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Sign up a new user' })
  @ApiResponse({
    status: 201,
    description:
      'Signup successful. Please check your email to verify your account.',
    schema: {
      example: {
        message:
          'Signup successful. Please check your email to verify your account.',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  @ApiBody({ type: SignupDto })
  @Post('signup')
  async signup(@Body() dto: SignupDto): Promise<{ message: string }> {
    return this.authService.signup(dto);
  }

  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email resent.',
    schema: {
      example: {
        message: 'Verification email resent. Please check your inbox.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User not found or already verified.',
  })
  @ApiBody({
    schema: {
      properties: { email: { type: 'string', example: 'user@example.com' } },
    },
  })
  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @ApiOperation({ summary: 'Login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or email not verified.',
  })
  @ApiBody({ type: LoginDto })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    console.log('/auth/login endpoint hit. Email:', dto.email);
    const tokens = await this.authService.login(dto, req);
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    return tokens;
  }

  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({
    status: 200,
    description: 'Current user info.',
    type: GetMeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any): Promise<GetMeResponseDto> {
    console.log('req.user in /auth/me:', req.user);
    return this.authService.getMe(req.user.userId);
  }

  @ApiOperation({ summary: 'Update current user info' })
  @ApiBody({ type: UpdateMeDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully.',
    type: GetMeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me')
  async updateMe(@Req() req: any, @Body() updateDto: UpdateMeDto): Promise<GetMeResponseDto> {
    await this.authService.updateMe(req.user.userId, updateDto);
    return this.authService.getMe(req.user.userId);
  }

  @ApiOperation({ summary: 'Logout' })
  @ApiResponse({
    status: 200,
    description: 'Logged out (placeholder).',
    schema: { example: { message: 'Logged out (placeholder)' } },
  })
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { message: 'Logged out' };
  }

  @ApiOperation({ summary: 'Verify email' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
    schema: {
      example: { accessToken: 'jwt', refreshToken: 'jwt' },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification token.',
  })
  @ApiQuery({ name: 'token', required: true })
  @Get('verify')
  async verify(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyEmail(token);
    // Set cookies for access and refresh tokens
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    return tokens;
  }
}
