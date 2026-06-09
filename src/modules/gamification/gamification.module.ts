import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { UserAchievement, Achievement } from 'src/common/core/entitys/achievement.entity';
import { Group } from 'src/common/core/entitys/group.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([UserGamification, UserAchievement, Achievement, Group]),
  ],
  providers: [GamificationService],
  controllers: [GamificationController],
  exports: [GamificationService],
})
export class GamificationModule {}
