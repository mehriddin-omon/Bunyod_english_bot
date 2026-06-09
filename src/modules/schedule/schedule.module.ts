import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import { Group } from 'src/common/core/entitys/group.entity';

@Module({
  imports: [GuardModule, TypeOrmModule.forFeature([Schedule, Group])],
  providers: [ScheduleService],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}
