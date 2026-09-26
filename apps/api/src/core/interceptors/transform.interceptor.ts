import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';

import type { PaginatedResult } from '../interfaces/paginated-result.js';

export interface ResponseMeta {
  correlationId: string;
  timestamp: string;
  nextCursor?: string | null;
  hasMore?: boolean;
  totalCount?: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

function isPaginated<T>(value: unknown): value is PaginatedResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PaginatedResult<T>).items) &&
    'hasMore' in value
  );
}

/**
 * Wraps every successful response in the standard envelope
 * (API_CONTRACT §5). Controllers return the raw payload — or a
 * `PaginatedResult` for lists — and never build `meta` themselves.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T> | ApiEnvelope<T[]>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiEnvelope<T> | ApiEnvelope<T[]>> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (request.headers?.['x-correlation-id'] as string | undefined) ??
      (request as Request & { correlationId?: string }).correlationId ??
      'unknown';

    return next.handle().pipe(
      map((payload) => {
        const meta: ResponseMeta = {
          correlationId,
          timestamp: new Date().toISOString(),
        };

        if (isPaginated<T>(payload)) {
          meta.nextCursor = payload.nextCursor;
          meta.hasMore = payload.hasMore;
          if (payload.totalCount !== undefined) {
            meta.totalCount = payload.totalCount;
          }
          return { data: payload.items, meta };
        }

        return { data: payload, meta };
      })
    );
  }
}
