import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { FacilityService } from './facility.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import { DEFAULT_PAGE_SIZE } from '../../core/interfaces/paginated-result.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import type { DatabaseContext } from '@hims/database';
import { CreateFacilityDtoSchema, UpdateFacilityDtoSchema } from './dto/facility.dto.js';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(TenantGuard, PermissionsGuard)
@Controller('facilities')
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  @Get()
  @RequirePermissions('PLATFORM:FACILITY:READ:TENANT')
  @ApiOperation({ summary: 'List facilities available to the caller' })
  async list(
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.facilityService.list(ctx, {
      isTenantAdmin: user.isTenantAdmin,
      facilityIds: user.facilityIds,
      limit: Math.min(limit, 200),
      status,
    });
  }

  @Post()
  @RequirePermissions('PLATFORM:FACILITY:CREATE:TENANT')
  @ApiOperation({ summary: 'Create a facility' })
  async create(
    @Body(new ZodValidationPipe(CreateFacilityDtoSchema)) body: unknown,
    @DbContext() ctx: DatabaseContext,
  ) {
    return this.facilityService.create(body as never, ctx);
  }

  @Get(':facilityId')
  @RequirePermissions('PLATFORM:FACILITY:READ:FACILITY')
  @ApiOperation({ summary: 'Get a facility' })
  async get(
    @Param('facilityId', new ParseUUIDPipe()) facilityId: string,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // A facility id in the URL must not widen access beyond what
    // `user_facility_access` already grants. 404 (not 403) so this cannot be
    // used to discover facility ids in other parts of the tenant.
    if (!user.isTenantAdmin && !user.facilityIds.includes(facilityId)) {
      throw new NotFoundException('Facility not found');
    }
    return this.facilityService.getById(facilityId, ctx);
  }

  @Patch(':facilityId')
  @RequirePermissions('PLATFORM:FACILITY:UPDATE:FACILITY')
  @ApiOperation({ summary: 'Update a facility' })
  async update(
    @Param('facilityId', new ParseUUIDPipe()) facilityId: string,
    @Body(new ZodValidationPipe(UpdateFacilityDtoSchema)) body: unknown,
    @DbContext() ctx: DatabaseContext,
  ) {
    return this.facilityService.update(facilityId, body as never, ctx);
  }

  @Get(':facilityId/departments')
  @RequirePermissions('PLATFORM:DEPARTMENT:READ:FACILITY')
  @ApiOperation({ summary: 'List departments in a facility' })
  async departments(
    @Param('facilityId', new ParseUUIDPipe()) facilityId: string,
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number,
  ) {
    return this.facilityService.listDepartments(facilityId, ctx, Math.min(limit, 200));
  }

  @Get(':facilityId/locations')
  @RequirePermissions('PLATFORM:LOCATION:READ:FACILITY')
  @ApiOperation({ summary: 'List locations in a facility' })
  async locations(
    @Param('facilityId', new ParseUUIDPipe()) facilityId: string,
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number,
  ) {
    return this.facilityService.listLocations(facilityId, ctx, Math.min(limit, 200));
  }
}
