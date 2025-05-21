import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenaiModule } from '../openai/openai.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [PrismaModule, OpenaiModule, VectorModule],
  providers: [OnboardingService],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
