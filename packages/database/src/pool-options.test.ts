import { describe, expect, it } from 'vitest';
import { withDatabaseTls } from './pool-options';

describe('withDatabaseTls', () => {
  const base = {
    connectionString: 'postgresql://role:pw@host:5432/postgres',
    max: 20,
  };

  it('enables encryption when TLS is requested', () => {
    const config = withDatabaseTls(base, true);
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    // The caller's own options survive; only `ssl` is added.
    expect(config.max).toBe(20);
    expect(config.connectionString).toBe(base.connectionString);
  });

  it('does not mutate the configuration it was given', () => {
    withDatabaseTls(base, true);
    // `pg` merges its options over the parsed connection string, so mutating
    // the caller's object would leak the setting into unrelated pools that
    // share it.
    expect(base).not.toHaveProperty('ssl');
  });

  it('leaves the configuration untouched when TLS is off', () => {
    // Returning the same object, with no `ssl` key at all, is deliberate: an
    // explicit `ssl: undefined` would overwrite an `sslmode` the operator put
    // in the connection string, which is how the verify-full escape hatch
    // works.
    const config = withDatabaseTls(base, false);
    expect(config).toBe(base);
    expect('ssl' in config).toBe(false);
  });
});
