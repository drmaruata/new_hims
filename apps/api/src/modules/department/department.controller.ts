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

import { DepartmentService } from './department.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import { DEFAULT_PAGE_SIZE } from '../../core/interfaces/paginated-result.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import type { DatabaseContext } from '@hims/database';
import { CreateDepartmentDtoSchema, UpdateDepartmentDtoSchema } from './dto/department.dto.js';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(TenantGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @RequirePermissions('PLATFORM:DEPARTMENT:READ:TENANT')
  @ApiOperation({ summary: 'List departments' })
  async list(
    @DbContext() ctx: DatabaseContext,
    @Query('facilityId') facilityId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number
  ) {
    return this.departmentService.list(ctx, {
      facilityId,
      status,
      limit: Math.min(limit, 200),
    });
  }

  @Post()
  @RequirePermissions('PLATFORM:DEPARTMENT:CREATE:TENANT')
  @ApiOperation({ summary: 'Create a department' })
  async create(
    @Body(new ZodValidationPipe(CreateDepartmentDtoSchema)) body: unknown,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.departmentService.create(body as never, ctx);
  }

  @Get(':departmentId')
  @RequirePermissions('PLATFORM:DEPARTMENT:READ:FACILITY')
  @ApiOperation({ summary: 'Get a department' })
  async get(
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const department = await this.departmentService.getById(departmentId, ctx);

    // A department id in the URL must not widen access beyond the caller's
    // facility grants. 404 rather than 403 so this cannot be used to discover
    // departments in facilities the caller cannot access.
    if (!user.isTenantAdmin && !user.facilityIds.includes(department.facilityId)) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  @Patch(':departmentId')
  @RequirePermissions('PLATFORM:DEPARTMENT:UPDATE:FACILITY')
  @ApiOperation({ summary: 'Update a department' })
  async update(
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Body(new ZodValidationPipe(UpdateDepartmentDtoSchema)) body: unknown,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.departmentService.update(departmentId, body as never, ctx);
  }
}
