import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthorizationService } from './authorization.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import { DEFAULT_PAGE_SIZE } from '../../core/interfaces/paginated-result.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import type { DatabaseContext } from '@hims/database';
import type {
  AssignRoleInput,
  CreateRoleInput,
  SetDepartmentAccessInput,
  SetPermissionsInput,
  UpdateRoleInput,
  UpsertFacilityAccessInput,
} from './dto/authorization.dto.js';
import {
  AssignRoleDtoSchema,
  CreateRoleDtoSchema,
  SetDepartmentAccessDtoSchema,
  SetFacilityAccessDtoSchema,
  SetPermissionsDtoSchema,
  UpdateRoleDtoSchema,
} from './dto/authorization.dto.js';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(TenantGuard, PermissionsGuard)
@Controller()
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get('users')
  @RequirePermissions('PLATFORM:USER:READ:TENANT')
  @ApiOperation({ summary: 'List users in the active tenant' })
  async listUsers(
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number,
    @Query('search') search: string | undefined,
    @Query('status') status: string | undefined
  ) {
    return this.authorizationService.listUsers(ctx, {
      limit: Math.min(limit, 200),
      search,
      status,
    });
  }

  @Get('users/:userId')
  @RequirePermissions('PLATFORM:USER:READ:TENANT')
  @ApiOperation({ summary: 'Get a user with roles and facility grants' })
  async getUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.getUser(userId, ctx);
  }

  @Post('users/:userId/deactivate')
  @RequirePermissions('PLATFORM:USER:UPDATE:TENANT')
  @ApiOperation({ summary: 'Suspend a user and revoke their grants' })
  async deactivate(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    // Guard against an administrator locking themselves — and potentially the
    // last administrator — out of the tenant.
    if (userId === actor.userId) {
      throw new ConflictException('You cannot deactivate your own account');
    }
    return this.authorizationService.setMembershipStatus(userId, 'SUSPENDED', ctx);
  }

  @Post('users/:userId/reactivate')
  @RequirePermissions('PLATFORM:USER:UPDATE:TENANT')
  @ApiOperation({ summary: 'Restore a suspended user' })
  async reactivate(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.setMembershipStatus(userId, 'ACTIVE', ctx);
  }

  @Post('users/:userId/roles')
  @RequirePermissions('PLATFORM:USER:UPDATE:TENANT')
  @ApiOperation({ summary: 'Assign a role at a facility/department scope' })
  async assignRole(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(new ZodValidationPipe(AssignRoleDtoSchema)) body: AssignRoleInput,
    @DbContext() ctx: DatabaseContext
  ) {
    if (body.userId !== userId) {
      throw new BadRequestException('Body userId must match the path userId');
    }
    return this.authorizationService.assignRole(body, ctx);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('PLATFORM:USER:UPDATE:TENANT')
  @ApiOperation({ summary: 'Revoke a role assignment' })
  async revokeRole(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.revokeRole(userId, roleId, ctx);
  }

  @Put('users/:userId/facility-access')
  @RequirePermissions('PLATFORM:USER:UPDATE:TENANT')
  @ApiOperation({ summary: 'Replace a user facility grants' })
  async setFacilityAccess(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(new ZodValidationPipe(SetFacilityAccessDtoSchema)) body: UpsertFacilityAccessInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.setFacilityAccess(userId, body, ctx);
  }

  @Put('users/:userId/department-access')
  @RequirePermissions('PLATFORM:USER:UPDATE:TENANT')
  @ApiOperation({ summary: 'Replace a user department grants' })
  async setDepartmentAccess(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(new ZodValidationPipe(SetDepartmentAccessDtoSchema)) body: SetDepartmentAccessInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.setDepartmentAccess(userId, body.departmentIds, ctx);
  }

  @Get('roles')
  @RequirePermissions('PLATFORM:ROLE:READ:TENANT')
  @ApiOperation({ summary: 'List roles' })
  async listRoles(
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number
  ) {
    return this.authorizationService.listRoles(ctx, Math.min(limit, 200));
  }

  @Post('roles')
  @RequirePermissions('PLATFORM:ROLE:CREATE:TENANT')
  @ApiOperation({ summary: 'Create a tenant-defined role' })
  async createRole(
    @Body(new ZodValidationPipe(CreateRoleDtoSchema)) body: CreateRoleInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.createRole(body, ctx);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('PLATFORM:ROLE:UPDATE:TENANT')
  @ApiOperation({ summary: 'Update a role' })
  async updateRole(
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body(new ZodValidationPipe(UpdateRoleDtoSchema)) body: UpdateRoleInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.updateRole(roleId, body, ctx);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermissions('PLATFORM:ROLE:UPDATE:TENANT')
  @ApiOperation({ summary: 'Replace a role permission set' })
  async setPermissions(
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body(new ZodValidationPipe(SetPermissionsDtoSchema)) body: SetPermissionsInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.authorizationService.setRolePermissions(roleId, body, ctx);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List the permission catalogue' })
  async listPermissions(
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number
  ) {
    return this.authorizationService.listPermissions(Math.min(limit, 1000), ctx);
  }
}
