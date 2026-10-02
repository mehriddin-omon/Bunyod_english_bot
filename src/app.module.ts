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
import { TeacherStudentsModule } from './modules/teacher-students/teacher-students.module';
import { SectionsModule } from './modules/sections/sections.module';
import { HomeModule } from './modules/home/home.module';
import { UploadModule } from './modules/upload/upload.module';
import { ExerciseResultsModule } from './modules/exercise-results/exercise-results.module';

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
        // 400-500 bir vaqtdagi foydalanuvchida so'rovlar navbatga tiqilib
        // qolmasligi uchun pg pool sozlamalari. Standart pg pool max=10 —
        // yuqori concurrency'da bu "qotib qolish"ning asosiy sababi edi.
        extra: {
          max: Number(configService.get<string>('DB_POOL_MAX')) || 30,
          min: Number(configService.get<string>('DB_POOL_MIN')) || 5,
          // bo'sh turgan connection qancha vaqtdan keyin yopiladi
          idleTimeoutMillis: Number(configService.get<string>('DB_POOL_IDLE_MS')) || 30000,
          // pooldan connection ololmasa qancha kutib xato qaytaradi
          // (cheksiz osilib qolish o'rniga so'rov tezda xato bilan tugaydi)
          connectionTimeoutMillis: Number(configService.get<string>('DB_POOL_CONN_TIMEOUT_MS')) || 5000,
        },
        // yakka bir so'rov DB'ni band qilib qo'yib pool'ni tiqilib qolishiga
        // sabab bo'lmasligi uchun statement bo'yicha maksimal vaqt
        maxQueryExecutionTime: 5000,
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
    TeacherStudentsModule,
    SectionsModule,
    HomeModule,
    UploadModule,
    ExerciseResultsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
