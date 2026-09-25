import type { Job } from 'bullmq';
import { z } from 'zod';

import type { DatabaseContext } from '../core/database/database.service.js';

/**
 * The shape every job payload must have before a processor is allowed to touch
 * the database.
 *
 * Validated rather than cast. A job payload is JSON that crossed a process
 * boundary and may have been written by a version of the producer that no
 * longer exists, so `job.data as OutboxRelayJob` would be a claim, not a fact.
 * Validating turns a malformed payload into a loud failure on the job that
 * caused it, instead of an undefined tenant reaching a `set_config` call.
 */
const JobScopeSchema = z.object({
  /** A UUID, not merely a string: this value goes straight into a GUC. */
  tenantId: z.string().uuid('Job payload is missing a valid tenantId'),
  facilityId: z.string().uuid().nullish(),
  actorUserId: z.string().uuid().nullish(),
  correlationId: z.string().min(1).default('unknown'),
  eventId: z.string().uuid().nullish(),
});

/**
 * Extract and validate the tenant scope from a job payload.
 *
 * Throws on a missing or malformed `tenantId`. That is the point: the
 * alternative is a job that runs with no tenant scope at all, and under
 * row-level security that does not mean "all data" — it means zero rows, and a
 * processor that writes results derived from nothing.
 *
 * `actorUserId` is carried for the audit trail only. Per EVENT_CATALOGUE.md
 * §3.8, a job payload is not a permission, so a processor acting on a user's
 * behalf must re-authorize rather than trust this field.
 */
export function jobContext(job: Job): DatabaseContext {
  const parsed = JobScopeSchema.safeParse(job.data);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');

    throw new Error(
      `Job ${job.id ?? '(no id)'} on ${job.queueName} has an unusable payload — ${detail}. A job without tenant scope cannot be processed safely.`,
    );
  }

  return {
    tenantId: parsed.data.tenantId,
    facilityId: parsed.data.facilityId ?? null,
    userId: parsed.data.actorUserId ?? null,
  };
}

/**
 * The correlation id for a job, or the job id if the payload has none.
 *
 * Returned separately from `jobContext` because logging uses it on the
 * validation-failure path too, where there is no valid context to return.
 */
export function jobCorrelationId(job: Job): string {
  const value = (job.data as Record<string, unknown> | undefined)?.['correlationId'];
  return typeof value === 'string' && value.length > 0 ? value : String(job.id ?? 'no-id');
}
