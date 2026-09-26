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
      'PATIENT_IDENTIFIER_HASH_KEY'
    );
  });

  it('rejects production use of the development auth fallback', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', AUTH_DEV_FALLBACK: 'true' })).toThrow(
      'AUTH_DEV_FALLBACK'
    );
  });

  // The platform moved from a self-hosted stack to a managed Supabase Cloud
  // project, so `SUPABASE_URL` now points off-host. These cover the guard that
  // makes an unencrypted connection to that host a startup failure rather than
  // a silent one.
  const cloud = {
    ...base,
    SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    DATABASE_URL:
      'postgresql://hims_app.abcdefghijklmnopqrst:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  };

  it('accepts a Supabase Cloud URL when TLS is enabled', () => {
    const env = loadEnv({ ...cloud, DATABASE_SSL: 'true' });
    expect(env.DATABASE_SSL).toBe(true);
  });

  it('rejects a Supabase Cloud URL with TLS disabled', () => {
    expect(() => loadEnv({ ...cloud, DATABASE_SSL: 'false' })).toThrow('DATABASE_SSL');
  });

  it('rejects a Supabase Cloud URL with TLS left at its default', () => {
    // The dangerous case: DATABASE_SSL is simply never set, so nothing in the
    // deployment configuration mentions transport security at all.
    expect(() => loadEnv(cloud)).toThrow('DATABASE_SSL');
  });

  it('does not apply the cloud TLS guard to a non-cloud host', () => {
    // Local development and the plain-PostgreSQL CI job keep working without
    // TLS; only a cloud hostname forces it.
    const env = loadEnv({ ...base, DATABASE_SSL: 'false' });
    expect(env.DATABASE_SSL).toBe(false);
  });

  it('treats a lookalike hostname as not-cloud', () => {
    // Guards against a substring match widening the rule to hosts that merely
    // mention supabase.co in their name.
    expect(() =>
      loadEnv({ ...base, SUPABASE_URL: 'https://supabase.co.example.test', DATABASE_SSL: 'false' })
    ).not.toThrow();
  });

  it('rejects a malformed project ref', () => {
    expect(() =>
      loadEnv({ ...cloud, DATABASE_SSL: 'true', SUPABASE_PROJECT_REF: 'too-short' })
    ).toThrow('SUPABASE_PROJECT_REF');
  });

  it('rejects a malformed region', () => {
    expect(() => loadEnv({ ...cloud, DATABASE_SSL: 'true', SUPABASE_REGION: 'Mumbai' })).toThrow(
      'SUPABASE_REGION'
    );
  });
});
