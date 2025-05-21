import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [AuthModule, OnboardingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
