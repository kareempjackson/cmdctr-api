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
import { PromptModule } from './prompt/prompt.module';
import { CanvasModule } from './canvas/canvas.module';
import { NotesModule } from './notes/notes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectsModule } from './projects/projects.module';
import { OpenaiModule } from './openai/openai.module';
import { AssistantModule } from './assistant/assistant.module';
import { FilesModule } from './files/files.module';
import { BillingModule } from './billing/billing.module';
import { UsageModule } from './usage/usage.module';
import { ActionsModule } from './actions/actions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatModule } from './chat/chat.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule, 
    OnboardingModule, 
    AgentsModule, 
    UsersModule, 
    ActivityModule, 
    TeamModule, 
    KnowledgeModule,
    PromptModule,
    CanvasModule,
    NotesModule,
    NotificationsModule,
    ProjectsModule,
    OpenaiModule,
    AssistantModule,
    FilesModule,
    BillingModule,
    UsageModule,
    ActionsModule,
    ChatModule,
    FeedbackModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
