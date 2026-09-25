import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

export interface SupabaseJwtClaims extends JWTPayload {
  /** Supabase Auth subject — `auth.users.id`. */
  sub: string;
  email?: string;
  /** Display name, if the project opted into it. Never used for authorization. */
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  /** Supabase sets this when the session passed an AAL2 factor. */
  amr?: Array<{ method: string; timestamp: number }>;
  role?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  session_id?: string;
}

const JWKS_REFRESH_MS = 10 * 60 * 1000;

/**
 * Verifies Supabase Auth access tokens.
 *
 * Tokens are always validated against the project's JWKS — the API never
 * decrypts or mints its own access tokens, and it never falls back to decoding
 * an unverified token in production (API_CONTRACT §3).
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly keySet?: JWTVerifyGetKey;
  private readonly jwtSecret?: Uint8Array;
  private readonly audience: string;
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    this.audience =
      this.configService.get<string>('SUPABASE_JWT_AUDIENCE', 'authenticated');
    this.issuer =
      this.configService.get<string>('SUPABASE_JWT_ISSUER') ??
      `${this.configService.get<string>('SUPABASE_URL', 'http://localhost:54321').replace(/\/$/, '')}/auth/v1`;

    const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');
    if (jwksUrl) {
      this.keySet = createRemoteJWKSet(new URL(jwksUrl), {
        cooldownDuration: JWKS_REFRESH_MS,
        cacheMaxAge: JWKS_REFRESH_MS,
      });
      this.logger.log(`Verifying access tokens against JWKS at ${jwksUrl}`);
    } else {
      const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
      if (secret) {
        this.jwtSecret = new TextEncoder().encode(secret);
        this.logger.warn(
          'SUPABASE_JWKS_URL is not set; falling back to HS256 verification with SUPABASE_JWT_SECRET. Prefer JWKS so keys can rotate.',
        );
      } else {
        this.logger.warn(
          'No SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET configured. All access tokens will be rejected until one is provided.',
        );
      }
    }
  }

  /**
   * Extract the bearer token from an `Authorization` header.
   */
  static extractBearer(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, ...rest] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || rest.length === 0) return null;
    const token = rest.join(' ').trim();
    return token.length > 0 ? token : null;
  }

  async verify(token: string): Promise<SupabaseJwtClaims> {
    try {
      if (this.keySet) {
        const { payload } = await jwtVerify(token, this.keySet, {
          audience: this.audience,
          issuer: this.issuer,
        });
        return payload as SupabaseJwtClaims;
      }
      if (this.jwtSecret) {
        const { payload } = await jwtVerify(token, this.jwtSecret, {
          audience: this.audience,
          issuer: this.issuer,
        });
        return payload as SupabaseJwtClaims;
      }
      throw new UnauthorizedException('Token verification is not configured');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      // A stale signing key is the common case right after a Supabase key
      // rotation; jose re-fetches the JWKS once before surfacing the failure.
      this.logger.debug(`Token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Read claims without verifying. Only for diagnostics/logging — never for
   * making an authorization decision.
   */
  peek(token: string): SupabaseJwtClaims | null {
    try {
      return decodeJwt(token) as SupabaseJwtClaims;
    } catch {
      return null;
    }
  }

  /** True when the session was elevated with a second factor (Supabase AAL2). */
  static hasMfa(claims: SupabaseJwtClaims): boolean {
    if (Array.isArray(claims.amr) && claims.amr.some((e) => e.method === 'mfa')) {
      return true;
    }
    return claims.app_metadata?.['aal'] === 'aal2';
  }
}
