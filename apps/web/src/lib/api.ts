import { HimsApiClient, ApiError } from '@hims/api-client';
import { createSupabaseBrowserClient } from '@hims/auth';

/**
 * The API origin, from a build-time public variable.
 *
 * Must be the API's own origin: the API sets its global prefix to `api/v1`, so
 * the base URL here already ends in `/api/v1` and callers pass paths like
 * `/patients`. Defaulted to port **3001** to match `AppEnvSchema`; the previous
 * default of 4000 contradicted it and every request 404'd at the router.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const browserSupabase =
  typeof window !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createSupabaseBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/**
 * Server-side client, used from Server Components and Route Handlers.
 *
 * Carries no credentials. The session lives in the browser (Supabase Auth
 * stores its tokens client-side), so a server render cannot present an access
 * token. Anything authenticated must be fetched from a Client Component, or
 * through a Route Handler that forwards the caller's own `Authorization`
 * header. This instance exists for the genuinely public endpoints.
 */
export const apiClient = new HimsApiClient({ baseUrl: API_BASE_URL });

/**
 * Browser-side client, used from Client Components.
 *
 * Reads the token and facility scope from storage on each request rather than
 * at construction, so a token refresh or a facility switch takes effect without
 * the client being rebuilt.
 */
export const browserApiClient = new HimsApiClient({
  baseUrl: API_BASE_URL,
  getAuthToken: async () => {
    const { data } = await browserSupabase?.auth.getSession() ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  },
  getFacilityId: () => window.localStorage.getItem('hims_facility_id'),
});

/**
 * Turn a thrown {@link ApiError} into something a person can act on.
 *
 * A 401 is called out separately because it almost always means the session
 * expired rather than that the dashboard is broken, and the right response is
 * to re-authenticate, not to retry.
 */
export function describeApiError(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        title: 'Session expired',
        detail: 'Sign in again to view hospital metrics.',
      };
    }
    if (error.status === 403) {
      return {
        title: 'Not permitted',
        detail:
          'Your role does not include command centre analytics for this facility.',
      };
    }
    if (error.code === 'RATE_LIMITED') {
      return {
        title: 'Too many requests',
        detail: 'The dashboard is polling faster than the rate limit allows.',
      };
    }
    return {
      title: `API error ${error.status}`,
      detail: error.message || 'The command centre service returned an error.',
    };
  }

  return {
    title: 'Cannot reach the API',
    detail:
      error instanceof Error
        ? error.message
        : 'The hospital command centre API is unreachable from this client.',
  };
}
