import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** One field-level problem, matching the contract's error `details` array. */
interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Turns any thrown value into the single error envelope the contract defines
 * (API_CONTRACT §5), and makes sure an unexpected failure never leaks an
 * internal message, stack or class name to a caller in production.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    const correlationId = request.correlationId ?? 'unknown';
    const { status, code, message, details } = this.describe(exception);

    // A 5xx is a bug on our side and always gets a full log; a 4xx is the
    // caller's mistake and is logged at warn so real faults stay visible.
    const line = `${request.method} ${request.originalUrl} -> ${status} ${code} [${correlationId}]`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(`${line} ${message}`);
    }

    // Mask 5xx detail in production: the message may embed a connection string,
    // a SQL fragment or a patient identifier. The correlation id is kept so an
    // operator can still find the full detail in the logs.
    const mask = process.env['NODE_ENV'] === 'production' && status >= 500;

    response.status(status).json({
      error: {
        code,
        message: mask ? 'An unexpected error occurred' : message,
        details: mask ? [] : details,
        correlationId,
      },
    });
  }

  /**
   * Classify a thrown value.
   *
   * Only an `HttpException` is trusted to describe itself. Anything else is an
   * unhandled failure, so it is reported as a flat 500 with a stable code
   * rather than with `error.name`, which would publish internal class names
   * such as `TypeError` and hint at the implementation.
   */
  private describe(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details: ErrorDetail[];
  } {
    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: exception instanceof Error ? exception.message : 'Internal server error',
        details: [],
      };
    }

    const status = exception.getStatus();
    const body = exception.getResponse();

    // `getResponse()` is either a string or an object we ourselves constructed.
    if (typeof body === 'string') {
      return { status, code: defaultCodeFor(status), message: body, details: [] };
    }

    const record = body as Record<string, unknown>;
    const rawMessage = record['message'];
    const rawDetails = record['details'];

    return {
      status,
      code: typeof record['code'] === 'string' ? record['code'] : defaultCodeFor(status),
      // Nest's ValidationPipe puts an array of strings in `message`; a single
      // string is what the envelope expects.
      message: Array.isArray(rawMessage)
        ? 'Request validation failed'
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message,
      details: Array.isArray(rawDetails) ? (rawDetails as ErrorDetail[]) : [],
    };
  }
}

/** Stable, status-derived code for exceptions raised without an explicit one. */
function defaultCodeFor(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    case HttpStatus.GATEWAY_TIMEOUT:
      return 'GATEWAY_TIMEOUT';
    case HttpStatus.BAD_GATEWAY:
      return 'BAD_GATEWAY';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}
