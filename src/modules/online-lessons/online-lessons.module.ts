import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OnlineLesson,
  OnlineLessonAttendance,
  OnlineLessonInvitee,
  OnlineLessonRecording,
  RecordingView,
} from 'src/common/core/entitys/online-lesson.entity';
import { AudienceModule } from 'src/common/services/audience.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  OnlineLessonsController,
  TeacherOnlineLessonsController,
  ZoomWebhookController,
} from './online-lessons.controller';
import { OnlineLessonsService } from './online-lessons.service';
import { OnlineLessonsJobs } from './online-lessons.jobs';
import { ZoomClient } from './zoom.client';
import { RecordingStorageService } from './recording-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OnlineLesson,
      OnlineLessonInvitee,
      OnlineLessonAttendance,
      OnlineLessonRecording,
      RecordingView,
    ]),
    AudienceModule,
    NotificationsModule,
  ],
  providers: [OnlineLessonsService, OnlineLessonsJobs, ZoomClient, RecordingStorageService],
  controllers: [TeacherOnlineLessonsController, OnlineLessonsController, ZoomWebhookController],
})
export class OnlineLessonsModule {}
