/**
 * Worker concurrency, read once at module load.
 *
 * `@Processor(name, options)` is a decorator, so its arguments are evaluated
 * when the module is imported — long before Nest has a `ConfigService` to ask.
 * That is the only reason this is not injected, and it is why the value is read
 * straight from `process.env` rather than through `ConfigService`.
 */
function readWorkerConcurrency(): number {
  const raw = process.env['WORKER_CONCURRENCY'];
  if (raw === undefined || raw === '') {
    return 10;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `WORKER_CONCURRENCY must be a positive integer; got "${raw}". BullMQ would silently treat this as 1 and the queue would appear merely slow.`,
    );
  }

  return parsed;
}

export const WORKER_CONCURRENCY = readWorkerConcurrency();
