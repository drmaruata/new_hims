import type { PoolConfig } from 'pg';

/**
 * Query parameters that configure TLS *on the connection string*.
 *
 * `pg` parses `connectionString` and merges the result *over* the config object
 * it was given, so any of these keys present in the URL silently replaces the
 * `ssl` object set below. The node-postgres docs are explicit about it: "If you
 * plan to use a combination of a database connection string from the
 * environment and SSL settings in the config object directly, then you must
 * avoid including any of `sslcert`, `sslkey`, `sslrootcert`, or `sslmode` in the
 * connection string. If any of these options are used then the `ssl` object is
 * replaced and any additional options provided there will be lost."
 *
 * `ssl` is in the set for the same reason as the other four: `?ssl=1` parses to
 * `ssl === true`, and `pg/lib/connection.js` only copies the object's options
 * into `tls.connect` when `self.ssl !== true`, so the `rejectUnauthorized:
 * false` below is dropped just as silently.
 *
 * Matched case-sensitively, because that is how the library reads them: a
 * param named `SSLMODE` becomes an unrelated config key that `pg` ignores, so
 * it cannot defeat this function and must not be rewritten out from under an
 * operator.
 */
const CONNECTION_STRING_TLS_PARAMS = new Set([
  'ssl',
  'sslcert',
  'sslkey',
  'sslmode',
  'sslrootcert',
]);

/**
 * Remove the TLS query parameters from a PostgreSQL connection string.
 *
 * Deliberately string surgery rather than a round trip through `URL`. The
 * password lives in the userinfo, and re-serialising a URL re-encodes it — a
 * password containing `@`, `/`, `+` or `:` comes back differently, and the
 * connection then fails to authenticate for a reason that has nothing to do
 * with TLS. Everything outside the query is therefore returned byte for byte.
 */
function stripConnectionStringTlsParams(connectionString: string): string {
  const queryStart = connectionString.indexOf('?');
  if (queryStart === -1) return connectionString;

  // PostgreSQL has no use for a fragment, but the `URL` parser that
  // `pg-connection-string` uses discards one, so the query is bounded by it
  // here too. Otherwise the fragment would be spliced into the rewritten query
  // and re-read as part of the final parameter's value.
  const fragmentStart = connectionString.indexOf('#', queryStart);
  const queryEnd = fragmentStart === -1 ? connectionString.length : fragmentStart;
  const fragment = connectionString.slice(queryEnd);

  const pairs = connectionString.slice(queryStart + 1, queryEnd).split('&');
  const kept = pairs.filter((pair) => {
    const separator = pair.indexOf('=');
    return !CONNECTION_STRING_TLS_PARAMS.has(separator === -1 ? pair : pair.slice(0, separator));
  });

  // Returned untouched when there was nothing to strip, so a URL carrying only
  // unrelated parameters is not needlessly rewritten.
  if (kept.length === pairs.length) return connectionString;

  const base = connectionString.slice(0, queryStart);
  return kept.length === 0 ? base + fragment : `${base}?${kept.join('&')}${fragment}`;
}

/**
 * Applies the TLS decision to a `pg` pool configuration.
 *
 * ## Why this is not just another `if` at the call site
 *
 * Three pools connect to PostgreSQL in this monorepo: the API
 * (`packages/database`), and the outbox and integration workers
 * (`apps/worker`, `apps/integration-worker`). `DATABASE_SSL` is a declared
 * environment variable, and before this helper existed it was read by nothing
 * — every pool constructed a `Pool` without an `ssl` key, so setting
 * `DATABASE_SSL=true` in a deployment quietly did nothing. A security-relevant
 * flag that is declared but inert is worse than a missing one, because an
 * operator reasonably believes it is in effect.
 *
 * The deployment target is a managed Supabase Cloud database reached over the
 * public internet, so TLS is not optional there. Centralising the decision
 * means all three pools behave the same way and a future fourth one cannot
 * forget.
 *
 * ## Why the connection string is rewritten
 *
 * The connection strings in `.env` carry `?sslmode=require`, because that is
 * what Supabase documents and it is the only TLS setting libpq understands
 * without a certificate. On its own that is fine, but `pg` lets the connection
 * string *overwrite* an `ssl` object supplied in code — so the documented
 * `?sslmode=require` and this function silently cancelled each other out. The
 * result was an encrypted connection to a private certificate authority with
 * certificate verification left **on**, and every pool failing at connect with
 * `self-signed certificate in certificate chain`. An operator reading `.env`
 * would have seen TLS enabled, in the code they would have seen
 * `rejectUnauthorized: false`, and neither would have explained the failure.
 *
 * The parameters are therefore removed from the connection string so the
 * decision made here is the decision that applies. Whichever way it is
 * resolved — silently unverified, or loudly unable to start — it is the same
 * for all three pools and it is the one this function documents.
 *
 * Note what that costs: `DATABASE_SSL=true` overrides the connection string
 * even when the operator wrote `?sslmode=verify-full` in it, so the way to ask
 * for verification is to turn the flag off, not to strengthen the URL. Stated
 * here and in `.env.example` because a silently discarded hardening setting is
 * worse than one that was never offered.
 *
 * ## Why `rejectUnauthorized: false`
 *
 * This is exactly what libpq's `sslmode=require` means: the connection is
 * encrypted, but the server's certificate is not verified against a trust
 * anchor. The Supabase pooler presents a private PKI whose root is in no
 * public CA bundle, so verification is impossible without shipping that root
 * to every one of the three images — a separate decision, deliberately not
 * made here. What this buys is that the connection is genuinely encrypted and
 * no worse than what `sslmode=require` promised before.
 *
 * It is *not* the stronger posture, and nothing here should be read as
 * claiming it is: without a trust anchor, a machine-in-the-middle with a
 * certificate for the right hostname would be accepted. To get verification,
 * leave `DATABASE_SSL` off and put `?sslmode=verify-full` in the connection
 * string, in which case `pg` applies the URL's own setting and this helper
 * returns the configuration untouched. See `.env.example`.
 */
export function withDatabaseTls(config: PoolConfig, ssl: boolean): PoolConfig {
  if (!ssl) {
    // Returned untouched rather than as `{ ...config, ssl: undefined }`.
    // `pg` merges its options *over* the parsed connection string, so an
    // explicit `ssl: undefined` would erase an `sslmode` the operator set in
    // the URL and silently disable TLS. Omitting the key is what lets the
    // connection string have the final say.
    return config;
  }

  const { connectionString, ...rest } = config;
  const next: PoolConfig = { ...rest, ssl: { rejectUnauthorized: false } };

  // Only rewritten when it actually carries a conflicting TLS parameter;
  // otherwise the operator's exact string is what connects, which keeps this
  // out of the way of the `verify-full` path and of any pool that has not opted
  // into TLS rewriting yet.
  if (connectionString !== undefined) {
    next.connectionString = stripConnectionStringTlsParams(connectionString);
  }

  return next;
}
