import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { OpdService } from './opd.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { DatabaseContext } from '@hims/database';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';

/**
 * A business date, `YYYY-MM-DD`.
 *
 * Validated rather than passed through: the value is interpolated into a
 * `($n::date)` cast, and a malformed string there is a 500 from Postgres rather
 * than a 400 naming the offending field.
 */
const BusinessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be a YYYY-MM-DD business date');

const RegisterQuerySchema = z
  .object({
    date: BusinessDateSchema.optional(),
    departmentId: z.uuid().optional(),
    status: z.string().max(32).optional(),
  })
  .strict();

const CheckInSchema = z
  .object({ date: BusinessDateSchema })
  .strict();

@ApiTags('OPD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('opd')
export class OpdController {
  constructor(private readonly opdService: OpdService) {}

  @Get('appointments')
  @RequirePermissions('CLINICAL:APPOINTMENT:READ:FACILITY')
  @ApiOperation({
    summary: 'Get the OPD register for a business date',
    description:
      'Joins the patient and department so the queue can be rendered in one ' +
      'request. `date` is a business date in the facility timezone; it defaults ' +
      'to today there, not in the server timezone.',
  })
  async getAppointments(
    @Query(new ZodValidationPipe(RegisterQuerySchema)) query: RegisterQueryInput,
    @DbContext() ctx: DatabaseContext,
  ) {
    return this.opdService.getAppointments(query.date, query.departmentId, ctx);
  }

  @Post('appointments/:id/check-in')
  @RequirePermissions('CLINICAL:APPOINTMENT:UPDATE:FACILITY')
  @ApiOperation({
    summary: 'Check an appointment in and issue its queue token',
    description:
      'The token is allocated from the queue sequence inside the check-in ' +
      'transaction, so two simultaneous check-ins cannot receive the same one.',
  })
  async checkIn(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @Body(new ZodValidationPipe(CheckInSchema)) body: CheckInInput,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() _user: AuthenticatedUser,
  ) {
    if (!ctx.facilityIds?.length) {
      throw new BadRequestException(
        'Checking a patient in requires a facility scope; send X-Facility-Id',
      );
    }

    return this.opdService.checkIn(id, body.date, ctx);
  }
}

type RegisterQueryInput = z.infer<typeof RegisterQuerySchema>;
type CheckInInput = z.infer<typeof CheckInSchema>;
