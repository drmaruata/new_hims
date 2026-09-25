/**
 * Job option overrides, kept apart from `core/queues/queue.module.ts` so the
 * reason a particular job is treated differently from the default is next to the
 * override rather than a number in a producer.
 */

/**
 * The default retry policy, as applied by `BullModule.forRoot`.
 *
 * Exponential from 2s over 5 attempts: roughly two minutes of retries. Chosen to
 * outlast a database failover or a Redis restart — both of which resolve in
 * well under a minute — without parking a genuinely dead job for long.
 */
export const DEFAULT_RETRY = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
} as const;

/**
 * For jobs where a person is waiting.
 *
 * A critical lab result, a code-status ICU alert or a rejected claim does not
 * benefit from backing off: the first attempt is the one that matters, and the
 * alert escalates to a human if the *channel* fails, not if the first delivery
 * attempt fails. The attempt count is lower than the default because a
 * notification that is 30 seconds late has already lost its purpose, and a job
 * that keeps retrying a dead pager gateway is worse than one that escalates.
 *
 * `removeOnFail` is set so a failed expedited job is not silently retried into
 * a duplicate alert five minutes later.
 */
export const EXPEDITED_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'fixed' as const, delay: 1_000 },
  removeOnFail: { age: 3_600 },
} as const;
