import type { Job } from 'bullmq';
import { z } from 'zod';

import type { DatabaseContext } from '@hims/database';

const JobScopeSchema = z.object({
  tenantId: z.string().uuid('Job payload is missing a valid tenantId'),
  facilityId: z.string().uuid().nullish(),
  actorUserId: z.string().uuid().nullish(),
  correlationId: z.string().min(1).default('unknown'),
  eventId: z.string().uuid().nullish(),
});

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

export function jobCorrelationId(job: Job): string {
  const value = (job.data as Record<string, unknown> | undefined)?.['correlationId'];
  return typeof value === 'string' && value.length > 0 ? value : String(job.id ?? 'no-id');
}
