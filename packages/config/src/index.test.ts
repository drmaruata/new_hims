import { describe, expect, it } from 'vitest';
import { loadEnv } from './index';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hims_db',
  PATIENT_IDENTIFIER_HASH_KEY: 'test-key-with-at-least-32-characters-123',
  SUPABASE_URL: 'http://localhost:8000',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_JWT_SECRET: 'test-jwt-secret',
};

describe('loadEnv', () => {
  it('coerces numeric and boolean environment values', () => {
    const env = loadEnv({
      ...base,
      DATABASE_POOL_MAX: '12',
      CORS_CREDENTIALS: 'false',
    });
    expect(env.DATABASE_POOL_MAX).toBe(12);
    expect(env.CORS_CREDENTIALS).toBe(false);
  });

  it('rejects missing tenant-sensitive hashing configuration', () => {
    expect(() => loadEnv({ ...base, PATIENT_IDENTIFIER_HASH_KEY: undefined })).toThrow(
      'PATIENT_IDENTIFIER_HASH_KEY',
    );
  });

  it('rejects production use of the development auth fallback', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', AUTH_DEV_FALLBACK: 'true' }),
    ).toThrow('AUTH_DEV_FALLBACK');
  });
});
