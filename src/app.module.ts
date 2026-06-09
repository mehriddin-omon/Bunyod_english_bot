import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GuardModule, ResponseTransformInterceptor } from '@my/common';
import { AuthModule } from './modules/auth';
import { UserModule } from './modules/user';
import { AdminModule } from './modules/admin';
import { VocabularyModule } from './modules/vocabulary';
import { GroupModule } from './modules/group/group.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { TeacherLessonsModule } from './modules/teacher-lessons/teacher-lessons.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DB_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        retryAttempts: 3,
      }),
    }),

    GuardModule,
    AuthModule,
    AdminModule,
    UserModule,
    VocabularyModule,
    GroupModule,
    StatisticsModule,
    ProgressModule,
    ScheduleModule,
    AssignmentsModule,
    MonitoringModule,
    GamificationModule,
    NotificationsModule,
    LessonsModule,
    TeacherLessonsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
