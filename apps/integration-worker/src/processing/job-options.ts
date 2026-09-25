/** Job option overrides, kept apart from `core/queues/queue.module.ts`. */

export const DEFAULT_RETRY = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
} as const;

export const EXPEDITED_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'fixed' as const, delay: 1_000 },
  removeOnFail: { age: 3_600 },
} as const;
