import { ConfigService } from '@nestjs/config';
// BullMQ 6 declares its own `RedisOptions`/`ConnectionOptions` union; ioredis's
// `RedisOptions` is a different interface and is not assignable to it. See the
// worker's redis.ts for the full explanation.
import type { RedisOptions } from 'bullmq';

export function createRedisConnectionOptions(
  configService: ConfigService,
): RedisOptions {
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

function fromRedisUrl(url: string): RedisOptions {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `REDIS_URL is not a valid URL: ${url}. Expected redis://host:port or rediss://host:port.`,
    );
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(
      `REDIS_URL has unsupported scheme "${parsed.protocol}". Expected redis: or rediss:.`,
    );
  }

  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
