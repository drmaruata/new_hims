import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * Session introspection only.
 *
 * Login, refresh and logout are handled by Supabase Auth directly; the API
 * never issues credentials (API_CONTRACT §3). This endpoint exists so clients
 * can discover the *server-resolved* scope for a token — tenant, facilities,
 * roles and permissions — which they are not allowed to assert themselves.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Return the server-resolved principal, tenant and permission scope',
  })
  async session(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('memberships')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List the tenants this user is an active member of',
  })
  async memberships(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listMemberships(user.userId);
  }
}
