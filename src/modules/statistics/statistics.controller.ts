import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { StatisticsService } from './statistics.service';

@Controller('api/v1/statistics')
@UseGuards(GuardService)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * O'quvchi statistikasi
   */
  @Get('student/:userId/lesson/:lessonId')
  async getStudentStatistics(@Param('userId') userId: string, @Param('lessonId') lessonId: string) {
    return {
      statusCode: 200,
      message: 'Student statistics retrieved',
      data: await this.statisticsService.getStudentStatistics(userId, lessonId),
    };
  }

  /**
   * Sinf statistikasi
   */
  @Get('group/:groupId')
  async getGroupStatistics(@Param('groupId') groupId: string) {
    return {
      statusCode: 200,
      message: 'Group statistics retrieved',
      data: await this.statisticsService.getGroupStatistics(groupId),
    };
  }

  /**
   * Darsi statistikasi
   */
  @Get('lesson/:lessonId')
  async getLessonStatistics(@Param('lessonId') lessonId: string) {
    return {
      statusCode: 200,
      message: 'Lesson statistics retrieved',
      data: await this.statisticsService.getLessonStatistics(lessonId),
    };
  }

  /**
   * Foydalanuvchi umumiy statistikasi
   */
  @Get('user/:userId/overall')
  async getUserOverallStatistics(@Param('userId') userId: string) {
    return {
      statusCode: 200,
      message: 'User overall statistics retrieved',
      data: await this.statisticsService.getUserOverallStatistics(userId),
    };
  }

  /**
   * Progress yangilash
   */
  @Post('progress/update')
  async updateProgress(
    @Body()
    data: {
      userId: string;
      lessonId: string;
      progress: number;
      score?: number;
      correctAnswers?: number;
      totalQuestions?: number;
    },
  ) {
    return {
      statusCode: 200,
      message: 'Progress updated',
      data: await this.statisticsService.updateProgress(data.userId, data.lessonId, {
        progress: data.progress,
        score: data.score,
        correctAnswers: data.correctAnswers,
        totalQuestions: data.totalQuestions,
        completedAt: data.progress === 100 ? new Date() : undefined,
        updatedAt: new Date(),
      }),
    };
  }
}
