import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { EncounterService } from './encounter.service.js';
import { DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import { DEFAULT_PAGE_SIZE } from '../../core/interfaces/paginated-result.js';
import type { DatabaseContext } from '@hims/database';
import type { CreateEncounterInput, UpdateEncounterInput } from './dto/encounter.dto.js';
import { CreateEncounterDtoSchema, UpdateEncounterDtoSchema } from './dto/encounter.dto.js';

@ApiTags('Encounter')
@ApiBearerAuth()
@UseGuards(TenantGuard, PermissionsGuard)
@Controller('encounters')
export class EncounterController {
  constructor(private readonly encounterService: EncounterService) {}

  @Post()
  @RequirePermissions('CLINICAL:ENCOUNTER:CREATE:FACILITY')
  @ApiOperation({ summary: 'Create an encounter' })
  async create(
    @Body(new ZodValidationPipe(CreateEncounterDtoSchema)) body: CreateEncounterInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.encounterService.create(body, ctx);
  }

  // Static segments must be declared before `:encounterId`, otherwise Express
  // matches `/patients` against the parameterised route first and the UUID pipe
  // rejects it with 400.
  @Get('patients/:patientId/encounters')
  @RequirePermissions('CLINICAL:ENCOUNTER:READ:FACILITY')
  @ApiOperation({ summary: 'List a patient encounters' })
  async listForPatient(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number
  ) {
    return this.encounterService.listForPatient(patientId, ctx, Math.min(limit, 200));
  }

  @Get('patients/:patientId/timeline')
  @RequirePermissions('CLINICAL:ENCOUNTER:READ:FACILITY')
  @ApiOperation({ summary: 'Cross-domain timeline for a patient' })
  async timeline(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @DbContext() ctx: DatabaseContext,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number
  ) {
    return this.encounterService.getPatientTimeline(patientId, ctx, Math.min(limit, 200));
  }

  @Get(':encounterId')
  @RequirePermissions('CLINICAL:ENCOUNTER:READ:FACILITY')
  @ApiOperation({ summary: 'Get an encounter' })
  async get(
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.encounterService.getById(encounterId, ctx);
  }

  @Patch(':encounterId')
  @RequirePermissions('CLINICAL:ENCOUNTER:UPDATE:FACILITY')
  @ApiOperation({ summary: 'Update encounter details (not its state)' })
  async update(
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body(new ZodValidationPipe(UpdateEncounterDtoSchema)) body: UpdateEncounterInput,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.encounterService.update(encounterId, body, ctx);
  }

  /**
   * State transitions.
   *
   * `start`/`sign`/`close` are separate routes rather than a generic
   * `POST /{id}/transition` so each can carry its own permission and be
   * separately auditable.
   */
  @Post(':encounterId/start')
  @RequirePermissions('CLINICAL:ENCOUNTER:START:FACILITY')
  @ApiOperation({ summary: 'Move an OPEN encounter to IN_PROGRESS' })
  async start(
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.encounterService.transition(encounterId, 'start', ctx);
  }

  @Post(':encounterId/sign')
  @RequirePermissions('CLINICAL:ENCOUNTER:SIGN:FACILITY')
  @ApiOperation({ summary: 'Sign an encounter, fixing its clinical content' })
  async sign(
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.encounterService.transition(encounterId, 'sign', ctx);
  }

  @Post(':encounterId/close')
  @RequirePermissions('CLINICAL:ENCOUNTER:CLOSE:FACILITY')
  @ApiOperation({ summary: 'Close a signed encounter' })
  async close(
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @DbContext() ctx: DatabaseContext
  ) {
    return this.encounterService.transition(encounterId, 'close', ctx);
  }
}
