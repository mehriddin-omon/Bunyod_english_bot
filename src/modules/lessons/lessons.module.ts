import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([CurriculumLesson, Unit, LessonProgress]),
  ],
  providers: [LessonsService],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}
