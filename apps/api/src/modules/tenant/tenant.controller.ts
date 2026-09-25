import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TenantService } from './tenant.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import type { DatabaseContext } from '@hims/database';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import { UpdateTenantDto, UpdateTenantDtoSchema } from './dto/update-tenant.dto.js';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(TenantGuard, PermissionsGuard)
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':tenantId')
  @RequirePermissions('PLATFORM:TENANT:READ:TENANT')
  @ApiOperation({ summary: 'Get the active tenant' })
  async get(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // A caller may only read the tenant their membership resolved to.
    this.assertOwn(tenantId, user);
    return this.tenantService.getOwn(tenantId, ctx);
  }

  @Get(':tenantId/settings')
  @RequirePermissions('PLATFORM:TENANT:READ:TENANT')
  @ApiOperation({ summary: 'Get tenant settings' })
  async getSettings(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertOwn(tenantId, user);
    return this.tenantService.getSettings(tenantId, ctx);
  }

  @Patch(':tenantId')
  @RequirePermissions('PLATFORM:TENANT:UPDATE:TENANT')
  @ApiOperation({ summary: 'Update the active tenant' })
  async update(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body(new ZodValidationPipe(UpdateTenantDtoSchema)) dto: UpdateTenantDto,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertOwn(tenantId, user);
    return this.tenantService.updateOwn(tenantId, dto, ctx);
  }

  @Get(':tenantId/facilities')
  @RequirePermissions('PLATFORM:FACILITY:READ:TENANT')
  @ApiOperation({ summary: 'List facilities in the active tenant' })
  async facilities(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertOwn(tenantId, user);
    return this.tenantService.listFacilities(tenantId, ctx);
  }

  private assertOwn(tenantId: string, user: AuthenticatedUser): void {
    if (user.tenantId !== tenantId) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
