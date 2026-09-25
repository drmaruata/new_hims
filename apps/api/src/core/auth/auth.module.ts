import { Global, Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { TenantGuard } from './guards/tenant.guard.js';
import { FacilityGuard } from './guards/facility.guard.js';

/**
 * Platform-wide authentication and authorization.
 *
 * Global so every domain module gets the guards without re-importing them, and
 * so the principal is resolved exactly once per request.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    PermissionsGuard,
    TenantGuard,
    FacilityGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    PermissionsGuard,
    TenantGuard,
    FacilityGuard,
  ],
})
export class AuthModule {}

