import { z } from 'zod';

/**
 * Validated environment contract.
 *
 * Parsed once at process start so a misconfigured deployment fails immediately
 * and loudly instead of surfacing as a confusing runtime error later. Secrets
 * are never defaulted to a working value — if a production-critical secret is
 * missing the process refuses to start.
 */

const nodeEnv = z.enum(['development', 'test', 'staging', 'production']);

/**
 * Accepts the several spellings of a boolean that reach a process through
 * Kubernetes, Docker Compose and `.env` files, and yields a real `boolean`.
 *
 * The default passed to `.default()` must be a boolean, not the string
 * `'true'`/`'false'`: the default is the schema's *output*, so a string default
 * would put the truthy string `'false'` into a flag like TRUST_PROXY. Zod 4
 * rejects the mismatch at compile time, which is why these are booleans.
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
  );

const port = z.coerce.number().int().positive().max(65535);

const optionalString = z.string().min(1).optional();

export const ServerEnvSchema = z.object({
  NODE_ENV: nodeEnv.default('development'),
  /** 3001 because `next dev` takes 3000; keep the pair in step. */
  PORT: port.default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: booleanish.default(true),

  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  /**
   * Number of trusted reverse-proxy hops in front of the app, so `req.ip` is
   * the client rather than the load balancer. 0 means no proxy (the app is
   * exposed directly); the usual value behind one ingress is 1.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
});

export const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
  DATABASE_SSL: booleanish.default(false),
  /** Supabase direct connection, used for migrations that bypass the pooler. */
  DIRECT_URL: optionalString,

  /**
   * Connection string for the background **platform** role, used only by
   * `apps/worker` and `apps/integration-worker` for genuinely cross-tenant
   * infrastructure work — draining the outbox, sweeping stuck integrations.
   *
   * Optional here because `loadEnv()` is shared with `apps/api`, which has no
   * business holding a BYPASSRLS credential and must never be given one. The
   * workers make it a hard requirement at construction time instead, so a
   * missing value fails loudly on the process that needs it rather than
   * weakening the API's role.
   *
   * The role this points at is expected to hold `BYPASSRLS`. That is a real
   * privilege and the trade is deliberate: an outbox drain has to read every
   * tenant's pending events, and RLS keys on `app.tenant_id`, which does not
   * exist for infrastructure work. The privilege is confined to that one
   * connection pool — see `PlatformDatabaseService` — and the API's own role
   * must never have it, or every policy in the baseline migration is moot.
   */
  DATABASE_PLATFORM_URL: optionalString,

  /**
   * HMAC key for `hims_patient.patient_identifiers.value_hash`.
   *
   * Required, with no default: identifiers such as Aadhaar and ABHA are looked
   * up by digest (`ux_patient_identifier_hash` is a hash index), so the key is
   * on the correctness path rather than being a hardening option. A hardcoded
   * fallback would make every tenant's digests computable from a leaked
   * database dump, which defeats the point of hashing them.
   *
   * Must be at least 32 bytes of entropy. Rotating it makes existing
   * identifiers unresolvable until they are re-hashed, so treat it as stable
   * per environment and back it up alongside `DATABASE_URL`.
   */
  PATIENT_IDENTIFIER_HASH_KEY: z
    .string()
    .min(32, 'PATIENT_IDENTIFIER_HASH_KEY must be at least 32 characters'),
});

export const SupabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),

  /**
   * The 20-character project slug Supabase assigns when the project is created,
   * visible in both the API hostname (`<ref>.supabase.co`) and the database
   * hostname (`db.<ref>.supabase.com`).
   *
   * Not needed to connect — `DATABASE_URL` is complete on its own. It is
   * recorded separately because the pooler hostname is built from the ref *and*
   * the region, and an operator assembling a connection string by hand needs
   * one of the two to be verifiable. Requiring it would also force every
   * existing deployment to add a value that changes nothing, so it stays
   * optional; when it is present it is shape-checked, because a ref with a
   * typo produces a hostname that fails at DNS with an error that does not
   * mention the real cause.
   */
  SUPABASE_PROJECT_REF: z
    .string()
    .regex(/^[a-z0-9]{20}$/, 'SUPABASE_PROJECT_REF must be the 20-character project slug')
    .optional(),

  /**
   * The project's region, for example `ap-south-1`. Supabase's connection pooler
   * is per-region: `aws-0-<region>.pooler.supabase.com`. Optional for the same
   * reason as `SUPABASE_PROJECT_REF`, and shape-checked when present.
   */
  SUPABASE_REGION: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d$/, 'SUPABASE_REGION must look like ap-south-1')
    .optional(),

  /**
   * Server-only. Must never be exposed to a browser or mobile bundle; the API
   * role in PostgreSQL must not hold BYPASSRLS.
   */
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_JWKS_URL: optionalString,
  SUPABASE_JWT_SECRET: optionalString,
  SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),
  SUPABASE_JWT_ISSUER: optionalString,
  STORAGE_BUCKET: z.string().default('hims-documents'),
});

export const RedisEnvSchema = z.object({
  REDIS_URL: optionalString,
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: optionalString,
  REDIS_TLS: booleanish.default(false),
});

export const ObservabilityEnvSchema = z.object({
  SENTRY_DSN: optionalString,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
  OTEL_SERVICE_NAME: z.string().default('hims-api'),
  LOG_PRETTY: booleanish.default(false),
});

export const WorkerEnvSchema = z.object({
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  WORKER_OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  WORKER_OUTBOX_POLL_MS: z.coerce.number().int().positive().default(1_000),
  OUTBOX_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Connection-pool size for a worker's tenant-scoped pool.
   *
   * Not the API's `DATABASE_POOL_MAX`: a worker's in-flight job count is
   * `WORKER_CONCURRENCY`, so the pool is sized to that rather than to a
   * request rate. Sizing it independently is what stops a wide worker from
   * holding `WORKER_CONCURRENCY` connections open against the same server the
   * API is serving from.
   */
  WORKER_POOL_MAX: z.coerce.number().int().positive().default(10),

  /**
   * Connection-pool size for the cross-tenant platform pool.
   *
   * Small on purpose: that pool only ever runs short, indexed maintenance
   * statements, so a large one would compete with the API for connections for
   * no throughput benefit.
   */
  PLATFORM_POOL_MAX: z.coerce.number().int().positive().default(4),

  /**
   * How long an outbox event may sit in `IN_FLIGHT` before the sweeper assumes
   * the relay that claimed it is dead and returns it to `PENDING`.
   *
   * Must comfortably exceed the time one batch takes to claim, enqueue and
   * mark — a value shorter than that makes the sweeper fight live relays and
   * produce duplicate work.
   */
  OUTBOX_STUCK_MINUTES: z.coerce.number().int().positive().default(5),

  /**
   * Publish attempts before an outbox event is moved to the terminal `DEAD`
   * state and stops being retried.
   *
   * Independent of a job's own retry policy: this counts *relay* failures
   * (routing, enqueue) rather than *processing* failures, which BullMQ owns.
   */
  OUTBOX_MAX_PUBLISH_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

export const IntegrationsEnvSchema = z.object({
  ABDM_ABHA_BASE_URL: optionalString,
  FHIR_BASE_URL: optionalString,
  HL7_RECEIVER_PORT: z.coerce.number().int().positive().optional(),
  ORTHANC_BASE_URL: optionalString,
  ORTHANC_DICOMWEB_BASE_URL: optionalString,
  ORTHANC_USERNAME: optionalString,
  ORTHANC_PASSWORD: optionalString,
  GOTENBERG_BASE_URL: optionalString,
  CLAMAV_BASE_URL: optionalString,
  OPENSEARCH_URL: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMS_PROVIDER_BASE_URL: optionalString,
  SMS_PROVIDER_API_KEY: optionalString,
  WHATSAPP_PROVIDER_BASE_URL: optionalString,
  WHATSAPP_PROVIDER_API_KEY: optionalString,
});

export const AppEnvSchema = ServerEnvSchema.merge(DatabaseEnvSchema)
  .merge(SupabaseEnvSchema)
  .merge(RedisEnvSchema)
  .merge(ObservabilityEnvSchema)
  .merge(WorkerEnvSchema)
  .merge(IntegrationsEnvSchema);

export type AppEnv = z.infer<typeof AppEnvSchema>;

/**
 * Parse `process.env`, coercing and validating in one place.
 *
 * @param source defaults to `process.env`; pass an explicit object in tests.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = AppEnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;

  // Production must never run with the local-development auth bypass on.
  if (env.NODE_ENV === 'production' && source.AUTH_DEV_FALLBACK) {
    throw new Error('AUTH_DEV_FALLBACK must not be set when NODE_ENV=production');
  }

  if (!env.SUPABASE_JWKS_URL && !env.SUPABASE_JWT_SECRET) {
    throw new Error(
      'Set SUPABASE_JWKS_URL (preferred) or SUPABASE_JWT_SECRET so access tokens can be verified'
    );
  }

  // A Supabase Cloud project is reached over the public internet, so an
  // unencrypted connection to it would carry patient data in the clear. Both
  // halves of the condition are checked separately on purpose: this catches the
  // case where someone reached for the locally-familiar `DATABASE_SSL=false`
  // default while pointing DATABASE_URL at a cloud project, and it catches a
  // host that is merely *named* like a cloud project. Failing at startup is the
  // point — the alternative is a deployment that looks healthy and is not.
  if (isSupabaseCloudHost(env.SUPABASE_URL) && !env.DATABASE_SSL) {
    throw new Error(
      'SUPABASE_URL is a Supabase Cloud host but DATABASE_SSL is off. Set DATABASE_SSL=true, ' +
        'or put ?sslmode=verify-full on DATABASE_URL and leave DATABASE_SSL unset so the ' +
        'connection string carries TLS. Patient data must not cross the public internet in clear text.'
    );
  }

  return env;
}

/**
 * Whether `url` addresses a managed Supabase Cloud project.
 *
 * Cloud projects are served from `https://<project-ref>.supabase.co`. Testing
 * for that shape rather than asking the operator to declare the deployment
 * means a misconfigured production environment cannot slip past: the thing that
 * makes the cloud target risky — that it is off-host — is derived from the
 * hostname itself, so there is no separate flag to forget.
 */
function isSupabaseCloudHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    // Anchored on the registrable domain and exact. A hostname merely
    // *containing* `supabase.co` is not this platform, and the port and path are
    // irrelevant to where the bytes travel.
    return hostname.endsWith('.supabase.co');
  } catch {
    // Zod has already rejected an unparseable SUPABASE_URL by this point, so
    // this is unreachable in practice. Treated as "not cloud" rather than
    // throwing a second, less specific error.
    return false;
  }
}

export const isProduction = (env: Pick<AppEnv, 'NODE_ENV'>) => env.NODE_ENV === 'production';
