import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AgentsModule } from './agents/agents.module';
import { UsersModule } from './users/users.module';
import { ActivityModule } from './activity/activity.module';
import { TeamModule } from './team/team.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [AuthModule, OnboardingModule, AgentsModule, UsersModule, ActivityModule, TeamModule, KnowledgeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
