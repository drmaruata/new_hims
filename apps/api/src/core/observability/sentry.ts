import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Headers whose values identify a person or a scope and must never be sent to a
 * third-party SaaS. `authorization` and `cookie` carry the Supabase session;
 * the `x-tenant-id` / `x-facility-id` pair identifies which hospital's data is
 * being touched, which is commercially and clinically sensitive on its own.
 */
const REDACTED_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-tenant-id',
  'x-facility-id',
  'idempotency-key',
] as const;

/** Placeholder written in place of a sensitive value. */
const REDACTED = '[redacted]';

/**
 * Query parameters that carry an identifier. A URL is attached to every event,
 * so `/patients/uhid/...` or `?mobile=...` would otherwise ship patient data to
 * a third party even with the request body and headers stripped.
 */
const REDACTED_QUERY_KEYS = [
  'uhid',
  'mobile',
  'search',
  'q',
  'national_id',
  'abha',
  'identifier',
] as const;

/**
 * Initialise Sentry error and performance monitoring.
 *
 * Runs before the Nest application is created so module-load and bootstrap
 * failures are captured too. The caller only invokes this when a DSN is
 * configured; with no DSN the SDK stays inert and costs nothing.
 */
export function setupSentry(
  dsn: string,
  nodeEnv: string,
  options: { serviceName?: string; tracesSampleRate?: number; enableProfiling?: boolean } = {}
): void {
  const serviceName = options.serviceName ?? 'hims-api';

  Sentry.init({
    dsn,
    environment: nodeEnv,
    release: process.env['GIT_SHA'] ?? undefined,

    tracesSampleRate: options.tracesSampleRate ?? 0.1,
    // Sentry 11 renamed profiling to a session-level rate with an explicit
    // lifecycle. Off unless asked for: continuous profiling of a request path
    // that touches patient records is not worth the egress by default.
    ...(options.enableProfiling
      ? { profileSessionSampleRate: 0.1, profileLifecycle: 'manual' as const }
      : {}),

    /**
     * Sentry 11 removed the `sendDefaultPii` and `service` options. Not sending
     * PII is now the only behaviour, which is the safe default for PHI, and the
     * service name is set through the `app` context after `init`.
     *
     * Because there is no longer a flag to lean on, the scrubbing below is the
     * only thing standing between a patient record and a third-party project,
     * so it is deliberately explicit about each field it removes.
     */
    beforeSend(event) {
      scrubRequest(event.request);

      // IP addresses are personal data. Sentry attaches them automatically.
      if (event.user) {
        delete event.user['ip_address'];
        if (event.user['id']) {
          // The internal user id is a stable cross-tenant identifier; a salted
          // per-install hash would still be a re-identification vector, so the
          // subject is dropped entirely and the actor id is attached as a tag
          // instead by the caller that knows the tenant.
          delete event.user['id'];
        }
      }

      // Free-text left in breadcrumbs (a logged request body, a SQL fragment)
      // is where PHI most often escapes.
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (crumb.data && typeof crumb.data === 'object') {
            scrubObject(crumb.data as Record<string, unknown>);
          }
        }
      }

      return event;
    },

    beforeSendTransaction(event) {
      // Transaction events carry the URL, so scrub the same way.
      scrubRequest(event.request);
      return event;
    },
  });

  // Sentry 11 dropped the `service` init option; `app_name` in the `app`
  // context is what the platform now groups and labels events by.
  Sentry.setContext('app', {
    app_name: serviceName,
    app_identifier: serviceName,
  });

  new Logger('Sentry').log(`Sentry initialised for ${serviceName} (${nodeEnv})`);
}

/**
 * The subset of a Sentry event request summary this module scrubs.
 *
 * Declared structurally rather than imported from `@sentry/core` so the
 * scrubbing contract is visible here and does not shift with an SDK upgrade.
 */
interface SentryRequestSummary {
  url?: string;
  /**
   * Sentry 11 types this as `string | Record<string, string> | Array<[string,
   * string]>` — the raw query string, a parsed map, or a key/value pair array.
   * Only the string form can be rewritten in place, so the other two forms are
   * passed through rather than mangled.
   */
  query_string?: string | Record<string, string> | Array<[string, string]> | null;
  headers?: Record<string, string>;
  cookies?: unknown;
  data?: unknown;
  env?: Record<string, unknown>;
}

/** Strip headers, query values and body from a request summary. */
function scrubRequest(request: SentryRequestSummary | undefined): void {
  if (!request) return;

  delete request.data;
  delete request.cookies;

  if (request.headers) {
    for (const header of REDACTED_HEADERS) {
      if (request.headers[header] !== undefined) {
        request.headers[header] = REDACTED;
      }
    }
  }

  // `query_string` is a string when captured from the URL and an array when
  // Sentry reconstructed it from parsed params; only the string form can be
  // rewritten.
  if (typeof request.query_string === 'string') {
    // `URLSearchParams` tolerates a partial query string, so a malformed value
    // cannot throw here and take down error reporting.
    const params = new URLSearchParams(request.query_string);
    let changed = false;
    for (const key of REDACTED_QUERY_KEYS) {
      if (params.has(key)) {
        params.set(key, REDACTED);
        changed = true;
      }
    }
    if (changed) request.query_string = params.toString();
  }

  if (request.env) {
    scrubObject(request.env);
  }
}

/**
 * Replace obviously clinical or identifying values in a free-form object,
 * recursively. This is a backstop, not an allow-list: it is the last thing to
 * run before an event leaves the cluster, so it errs toward removing.
 */
function scrubObject(value: Record<string, unknown>, depth = 0): void {
  if (depth > 6) return;

  const identifying =
    /^(?:.*_)?(?:name|mobile|phone|email|address|dob|date_of_birth|aadhaar|abha|national_id|mrn|uhid|diagnosis|notes?|remark|body|payload|data|token|secret|password|pin)$/i;

  for (const [key, entry] of Object.entries(value)) {
    if (identifying.test(key)) {
      value[key] = REDACTED;
      continue;
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      scrubObject(entry as Record<string, unknown>, depth + 1);
    }
  }
}

export { Sentry };
