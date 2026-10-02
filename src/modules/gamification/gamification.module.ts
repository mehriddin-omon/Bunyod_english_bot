import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { GamificationService } from './gamification.service';
import { XpService } from './xp.service';
import { GamificationController } from './gamification.controller';
import { UserGamification, XpTransaction } from 'src/common/core/entitys/gamification.entity';
import { UserAchievement, Achievement } from 'src/common/core/entitys/achievement.entity';
import { Group } from 'src/common/core/entitys/group.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([UserGamification, XpTransaction, UserAchievement, Achievement, Group]),
  ],
  providers: [GamificationService, XpService],
  controllers: [GamificationController],
  // XpService boshqa modullarga ochiq: dars, lug'at va mashq natijalari
  // hammasi coinni SHU servis orqali beradi (boshqa yo'l yo'q).
  exports: [GamificationService, XpService],
})
export class GamificationModule {}
