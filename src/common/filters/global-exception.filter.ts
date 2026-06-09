import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ichki server xatosi';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any).message ?? exception.message;
    } else if (exception instanceof QueryFailedError) {
      const pg = exception as any;
      if (pg.code === '23505') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Bu qiymat allaqachon mavjud';
      } else if (pg.code === '23503') {
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Bog\'liq yozuv topilmadi';
      }
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url}`, exception.stack);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      data: null,
    });
  }
}
