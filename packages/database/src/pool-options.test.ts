import { describe, expect, it } from 'vitest';
import type { PoolConfig } from 'pg';

import { withDatabaseTls } from './pool-options';

/**
 * The connection-string parameters that make `pg` discard a code-supplied `ssl`
 * object. Kept here as well as in the implementation so that adding one to the
 * source without deciding what it means for the tests fails loudly instead of
 * silently leaving the connection string able to override the decision.
 *
 * Cited behaviour: node-postgres, "Avoid SSL object overwrite with
 * connectionString" — connection string parameters overwrite the `ssl` object.
 */
const TLS_PARAMS_IN_CONNECTION_STRING = ['ssl', 'sslcert', 'sslkey', 'sslmode', 'sslrootcert'];

/** The query parameter names still present in `connectionString`. */
function paramNames(connectionString: string | undefined): string[] {
  const queryStart = connectionString?.indexOf('?') ?? -1;
  if (!connectionString || queryStart === -1) return [];
  const fragmentStart = connectionString.indexOf('#', queryStart);
  const query = connectionString.slice(
    queryStart + 1,
    fragmentStart === -1 ? connectionString.length : fragmentStart
  );
  return query
    .split('&')
    .map((pair) => (pair.includes('=') ? pair.slice(0, pair.indexOf('=')) : pair));
}

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

  describe('conflicting TLS parameters in the connection string', () => {
    // The regression this whole helper exists for. `.env` ships
    // `?sslmode=require`, and `pg` lets the connection string overwrite the
    // `ssl` object, so the two silently cancelled out: verification was left
    // on and every pool failed with `self-signed certificate in certificate
    // chain` while `.env` and the code both appeared to say TLS was configured.
    it('strips sslmode so the requested ssl object is the one that applies', () => {
      const config = withDatabaseTls(
        { connectionString: 'postgresql://role:pw@host:5432/postgres?sslmode=require' },
        true
      );

      expect(config.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.connectionString).toBe('postgresql://role:pw@host:5432/postgres');
    });

    it('strips every parameter pg would let override the ssl object', () => {
      // Pinned as an exact expected string so the source list cannot grow a
      // member that no test accounts for.
      const config = withDatabaseTls(
        {
          connectionString:
            'postgresql://role:pw@host:5432/postgres?ssl=true&sslcert=/a.crt&sslkey=/a.key' +
            '&sslmode=require&sslrootcert=/root.crt&application_name=hims',
        },
        true
      );

      expect(config.connectionString).toBe(
        'postgresql://role:pw@host:5432/postgres?application_name=hims'
      );
    });

    it('keeps unrelated parameters and the userinfo untouched', () => {
      // A password containing URL-significant characters must survive
      // byte for byte, which is why the rewrite is string surgery rather than
      // a round trip through `URL`.
      const config = withDatabaseTls(
        {
          connectionString:
            'postgresql://hims_app.ref:p%40ss/w+rd@aws-0-ap-south-1.pooler.supabase.com:5432' +
            '/postgres?sslmode=require&application_name=hims&connect_timeout=10',
        },
        true
      );

      expect(config.connectionString).toBe(
        'postgresql://hims_app.ref:p%40ss/w+rd@aws-0-ap-south-1.pooler.supabase.com:5432' +
          '/postgres?application_name=hims&connect_timeout=10'
      );
    });

    it('leaves no parameter able to override the ssl object', () => {
      const config = withDatabaseTls(
        { connectionString: 'postgresql://role:pw@host/postgres?sslmode=require&ssl=1' },
        true
      );

      // An intersection test rather than `arrayContaining`: the point is that
      // *no* known TLS parameter survives, not that the survivors are not a
      // superset of the list.
      const survivors = paramNames(config.connectionString).filter((name) =>
        TLS_PARAMS_IN_CONNECTION_STRING.includes(name)
      );
      expect(survivors).toEqual([]);
    });

    it('drops the query entirely when sslmode was all it carried', () => {
      const config = withDatabaseTls(
        { connectionString: 'postgresql://role:pw@host:5432/postgres?sslmode=require' },
        true
      );

      // No trailing `?`: it is a valid but different string, and leaving it
      // would mean rewriting a connection string for no reason.
      expect(config.connectionString).not.toContain('?');
    });

    it('strips a bare parameter that carries no value', () => {
      const config = withDatabaseTls(
        { connectionString: 'postgresql://role:pw@host/postgres?sslmode' },
        true
      );

      expect(config.connectionString).toBe('postgresql://role:pw@host/postgres');
    });

    it('preserves a fragment outside the rewritten query', () => {
      const config = withDatabaseTls(
        { connectionString: 'postgresql://role:pw@host/postgres?sslmode=require&a=1#frag' },
        true
      );

      // `#frag` must not be re-read as part of the value of `a`.
      expect(config.connectionString).toBe('postgresql://role:pw@host/postgres?a=1#frag');
    });

    it('keeps the connection string exactly as given when there is nothing to strip', () => {
      // `uselibpqcompat` only alters behaviour in the presence of `sslmode`, so
      // it is left in place rather than rewritten out from under the operator.
      const connectionString = 'postgresql://role:pw@host/postgres?application_name=hims';
      const config = withDatabaseTls({ connectionString }, true);

      expect(config.connectionString).toBe(connectionString);
    });

    it('leaves verify-full to the connection string when TLS is off', () => {
      // The documented escape hatch for real certificate verification, and the
      // reason the `!ssl` branch returns the caller's object untouched.
      const connectionString = 'postgresql://role:pw@host/postgres?sslmode=verify-full';
      const config = withDatabaseTls({ connectionString }, false);

      expect(config.connectionString).toBe(connectionString);
      expect(config).not.toHaveProperty('ssl');
    });
  });

  describe('without a connection string', () => {
    it('still applies the ssl object', () => {
      // A pool configured field by field has nothing to strip, and must not be
      // given a `connectionString: undefined` key it never had.
      const config: PoolConfig = withDatabaseTls({ host: 'localhost', max: 5 }, true);

      expect(config.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.host).toBe('localhost');
      expect(config).not.toHaveProperty('connectionString');
    });
  });
});
