import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Sentry setup for a background worker.
 *
 * Deliberately not a copy of `apps/api`'s `setupSentry`. That one scrubs an
 * HTTP request — headers, query string, body — because a request summary is
 * what Sentry attaches by default. A worker has no request: what it attaches is
 * the **BullMQ job payload**, which for this system is identifiers and storage
 * references. So the scrubbing here is a different shape, aimed at the thing
 * that actually carries data.
 *
 * The rule applied is narrower and stronger: the job payload is replaced
 * entirely with the job's *identity* — name, id, queue, attempt — rather than
 * filtered key by key. An allow-list cannot be defeated by a field nobody
 * thought of; a denylist can, and the field nobody thought of is exactly the
 * one a future processor adds.
 */

/** Job attributes worth keeping: all of them are non-identifying. */
const SAFE_JOB_ATTRIBUTES = ['name', 'id', 'queueName', 'attemptsMade', 'timestamp'] as const;

interface SentryEventLike {
  extra?: Record<string, unknown>;
  contexts?: Record<string, Record<string, unknown> | undefined>;
  tags?: Record<string, string | undefined>;
}

/**
 * Initialise error monitoring for a background process.
 *
 * Called before the Nest application is created so a failure during config
 * validation, DI resolution or module construction is captured too. With no DSN
 * the SDK stays inert and costs nothing.
 */
export function setupWorkerSentry(dsn: string, nodeEnv: string, serviceName: string): void {
  Sentry.init({
    dsn,
    environment: nodeEnv,
    release: process.env['GIT_SHA'] ?? undefined,
    tracesSampleRate: 0.25,
    beforeSend(event) {
      scrubEvent(event as SentryEventLike);
      return event;
    },
  });

  Sentry.setContext('app', {
    app_name: serviceName,
    app_identifier: serviceName,
  });

  new Logger('Sentry').log(`Sentry initialised for ${serviceName} (${nodeEnv})`);
}

function scrubEvent(event: SentryEventLike): void {
  if (event.extra) {
    delete event.extra['job'];
    delete event.extra['payload'];
    delete event.extra['args'];
  }

  const bullContext = event.contexts?.['bull'];
  if (bullContext) {
    const kept: Record<string, unknown> = {};
    for (const attribute of SAFE_JOB_ATTRIBUTES) {
      if (bullContext[attribute] !== undefined) {
        kept[attribute] = bullContext[attribute];
      }
    }
    for (const key of Object.keys(bullContext)) {
      delete bullContext[key];
    }
    Object.assign(bullContext, kept);
  }

  if (event.tags) {
    delete event.tags['tenantId'];
    delete event.tags['facilityId'];
    delete event.tags['patientId'];
  }
}

export { Sentry };
