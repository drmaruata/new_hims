/**
 * Worker concurrency, read once at module load.
 *
 * `@Processor(name, options)` is a decorator, so its arguments are evaluated
 * when the module is imported — long before Nest has a `ConfigService` to ask.
 * That is the only reason this is not injected, and it is why the value is read
 * straight from `process.env` rather than through `ConfigService`.
 *
 * The number is validated here rather than trusted, because a bad value does not
 * fail at the point it is read: BullMQ treats a non-numeric `concurrency` as
 * `undefined` and silently falls back to a single-threaded worker, which looks
 * like "the queue is just slow" rather than a configuration error.
 */
function readWorkerConcurrency(): number {
  const raw = process.env['WORKER_CONCURRENCY'];
  if (raw === undefined || raw === '') {
    // Matches the `WorkerEnvSchema` default, so a worker that never had the
    // variable set behaves the same as one that had it validated.
    return 10;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `WORKER_CONCURRENCY must be a positive integer; got "${raw}". BullMQ would silently treat this as 1 and the queue would appear merely slow.`
    );
  }

  return parsed;
}

export const WORKER_CONCURRENCY = readWorkerConcurrency();
