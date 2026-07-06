import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { config, corsConfig } from './config';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ensureQuizEnum } from './database/ensure-quiz-enum';
import { ensureStudentAnswersMigrated } from './database/ensure-student-answers';
import { ensureExercisesUnified } from './database/ensure-exercises-unified';
// import { UUIDInterceptor } from 'src/infrastructure';

export default class Application {
  private static readonly logger = new Logger(Application.name);

  public static async main(): Promise<void> {
    const uploadsDir = join(process.cwd(), 'uploads');
    for (const sub of ['audio', 'images', 'videos', 'documents']) {
      const dir = join(uploadsDir, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }

    // TypeORM synchronize'dan oldin exercise_type ustunini enum ga o'tkazamiz
    await ensureQuizEnum();
    // quiz_exercises/quiz_items -> exercises/exercise_items + reading/listening
    // savollarini yagona tizimga ko'chirish (synchronize'dan OLDIN)
    await ensureExercisesUnified();

    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // synchronize student_answers ni yaratganidan keyin eski javoblarni ko'chiramiz
    await ensureStudentAnswersMigrated();

    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
    const environment = config.NODE_ENV || 'development';
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.enableCors(corsConfig[environment]);
    app.useGlobalFilters(new GlobalExceptionFilter());

    const apiPrefix = 'api/v1';
    app.setGlobalPrefix(apiPrefix);

    const port = config.APP_PORT || 2003;
    const logLevels: LogLevel[] =
      environment === 'production'
        ? ['error']
        : ['error', 'warn', 'log', 'debug', 'verbose'];

    app.useLogger(logLevels);
    // app.useGlobalInterceptors(new UUIDInterceptor()); //:id ning UUID bo'lishiga javobgar funktsiya
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    );
    await app   
      .listen(port, () => {
        Application.logger.log(
          `Application is running on: http://localhost:${port}/${apiPrefix}`,
        );
      })
      .catch((error) => {
        Application.logger.error(
          `Failed to start the application: ${(error as Error).message}`,
          (error as Error).stack,
        );
        process.exit(1); // Exit the process if the application fails to start
      });
  }
}
