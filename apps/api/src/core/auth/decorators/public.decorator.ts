import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'hims:publicRoute';

/**
 * Marks a route as reachable without an access token (health, auth entry
 * points). Read by `JwtAuthGuard`.
 */
export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
