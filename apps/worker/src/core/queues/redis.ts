import { ConfigService } from '@nestjs/config';
// `RedisOptions` is imported from `bullmq`, not `ioredis`, on purpose. BullMQ 6
// declares its own structurally-similar `RedisOptions` (with an index signature)
// and its `QueueOptions.connection` accepts only BullMQ's `ConnectionOptions`
// union. ioredis's `RedisOptions` is a different interface with no index
// signature, so it is not assignable to that union and `tsc` rejects it.
import type { RedisOptions } from 'bullmq';

/**
 * Build the Redis options BullMQ connects with.
 *
 * Three settings here are not defaults and each has a reason:
 *
 *  * `maxRetriesPerRequest: null` is required by BullMQ, not optional. A
 *    blocking `BRPOPLPUSH` waits indefinitely for a job, and ioredis's default
 *    behaviour of failing the command after N retries turns that wait into a
 *    stream of errors on an idle queue. Every BullMQ connection in this process
 *    has to be built this way, which is why the worker and its producers share
 *    one factory rather than each rolling their own.
 *
 *  * `enableReadyCheck` stays on. `lazyConnect` is deliberately not used: a
 *    worker that believes it is connected to a queue it cannot reach will drain
 *    nothing and report success.
 *
 *  * TLS is derived from the URL scheme when `REDIS_URL` is set, so a managed
 *    Redis reached over `rediss://` is not silently downgraded to plaintext.
 */
export function createRedisConnectionOptions(configService: ConfigService): RedisOptions {
  const url = configService.get<string>('REDIS_URL');

  if (url) {
    return {
      ...fromRedisUrl(url),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };
  }

  return {
    host: configService.get<string>('REDIS_HOST') ?? 'localhost',
    port: configService.get<number>('REDIS_PORT') ?? 6379,
    password: configService.get<string>('REDIS_PASSWORD'),
    ...(configService.get<boolean>('REDIS_TLS') ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

/**
 * Translate a `redis://` / `rediss://` URL into ioredis options.
 *
 * Hand-rolled rather than passed straight to `new Redis(url)`: BullMQ's
 * `connection` option takes a plain options object, and handing it a live
 * ioredis instance would make several queues share one socket, which starves a
 * worker's blocking command behind the producers' ordinary traffic.
 */
function fromRedisUrl(url: string): RedisOptions {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `REDIS_URL is not a valid URL: ${url}. Expected redis://host:port or rediss://host:port.`
    );
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(
      `REDIS_URL has unsupported scheme "${parsed.protocol}". Expected redis: or rediss:.`
    );
  }

  // `decodeURIComponent` because a managed Redis URL carries a password that
  // was percent-encoded into it; passing the raw form fails authentication with
  // a message that does not obviously point at encoding.
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
