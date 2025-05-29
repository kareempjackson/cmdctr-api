import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AgentsModule } from './agents/agents.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AuthModule, OnboardingModule, AgentsModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
