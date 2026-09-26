import type { PoolConfig } from 'pg';

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
 * ## Why `rejectUnauthorized: false`
 *
 * This is exactly what libpq's `sslmode=require` means: the connection is
 * encrypted, but the server's certificate is not verified against a trust
 * anchor. It is what Supabase's own documented connection strings rely on, and
 * it is the reason a Cloud deployment does not fail closed on a machine whose
 * CA bundle does not include the certificate the pooler presents.
 *
 * The stronger posture is available without a code change: leave `DATABASE_SSL`
 * off and put `?sslmode=verify-full` in the connection string, in which case
 * `pg` applies the URL's own setting and this helper returns the configuration
 * untouched. See `.env.example`.
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

  return { ...config, ssl: { rejectUnauthorized: false } };
}
