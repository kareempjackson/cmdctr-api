import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  password: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  password: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class WorkspaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;

  @ApiProperty({ description: 'Is this the current workspace?' })
  current_workspace: boolean;
}

export class GetMeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  onboarded: boolean;

  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [WorkspaceDto] })
  workspaces: WorkspaceDto[];

  @ApiProperty({ nullable: true })
  currentWorkspaceId: string | null;
}
