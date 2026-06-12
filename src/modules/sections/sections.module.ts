import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([Unit, Lesson, LessonProgress]),
  ],
  providers: [SectionsService],
  controllers: [SectionsController],
  exports: [SectionsService],
})
export class SectionsModule {}
