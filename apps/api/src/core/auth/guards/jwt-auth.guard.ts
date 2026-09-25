import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthService } from '../auth.service.js';
import { TokenService } from '../token.service.js';
import { PUBLIC_ROUTE_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedUser } from '../auth.types.js';
import type { DatabaseContext } from '@hims/database';

/**
 * Authenticates the request and attaches the resolved principal as
 * `request.user` plus a ready-to-use RLS context as `request.dbContext`.
 *
 * Runs after middleware but before interceptors, so every controller and
 * service can rely on `request.user` being populated.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = TokenService.extractBearer(request.headers?.authorization);

    if (!token) {
      if (isPublic) return true;
      const devUser = this.authService.devFallbackUser();
      if (devUser) {
        this.attach(request, devUser);
        return true;
      }
      throw new UnauthorizedException('Missing bearer access token');
    }

    const claims = await this.tokenService.verify(token);

    // The tenant is requested through a header, but it is only ever *honoured*
    // after AuthService confirms an active membership. A client cannot widen
    // its own scope by sending a different value.
    const requestedTenant = request.headers?.['x-tenant-id'] as
      | string
      | undefined;
    const requestedFacility = request.headers?.['x-facility-id'] as
      | string
      | undefined;

    const user = await this.authService.resolve(
      claims,
      requestedTenant,
      requestedFacility,
    );

    this.attach(request, user);
    return true;
  }

  private attach(request: Request, user: AuthenticatedUser): void {
    const req = request as Request & {
      user: AuthenticatedUser;
      dbContext: DatabaseContext;
    };
    req.user = user;
    req.dbContext = {
      tenantId: user.tenantId,
      userId: user.userId,
      facilityIds: user.facilityIds,
      isTenantAdmin: user.isTenantAdmin,
    };
  }
}

