import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Longest inbound id accepted, to bound what can land in logs and Sentry. */
const MAX_INBOUND_LENGTH = 128;

/** Characters allowed in a propagated id. Anything else means a new id. */
const SAFE_ID = /^[A-Za-z0-9._:-]+$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = CorrelationIdMiddleware.resolveInbound(req);
    req['correlationId'] = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  }

  /**
   * Reuse the caller's correlation id when it is safe to do so, so a trace
   * spans gateway, API and worker.
   *
   * The inbound value is attacker-controlled: it is echoed into a response
   * header, written to every log line and sent to Sentry, so it is length
   * bounded and character filtered rather than trusted verbatim. A header can
   * also arrive as string[] when repeated, hence the Array check.
   */
  private static resolveInbound(req: Request): string {
    const header = req.headers['x-correlation-id'];

    if (typeof header === 'string' && header.length > 0 && header.length <= MAX_INBOUND_LENGTH && SAFE_ID.test(header)) {
      return header;
    }

    return randomUUID();
  }
}
