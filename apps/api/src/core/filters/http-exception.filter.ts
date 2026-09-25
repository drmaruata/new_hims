import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message || exception.message
        : 'Internal server error';

    const correlationId = (request.headers['x-correlation-id'] as string) || `gen-${Date.now()}`;

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${JSON.stringify(message)}`
    );

    response.status(status).json({
      error: {
        code: (exception as any)?.code || (status === 404 ? 'NOT_FOUND' : 'API_ERROR'),
        message: Array.isArray(message) ? message.join(', ') : message,
        correlationId,
      },
    });
  }
}
