import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  HashedIdentifierTypeSchema,
  RegisterPatientSchema,
  SearchPatientsSchema,
  type HashedIdentifierType,
  type RegisterPatientInput,
  type SearchPatientsInput,
} from './dto/patient.dto.js';
import { PatientService } from './patient.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { DatabaseContext } from '@hims/database';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';

@ApiTags('Patient')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  /**
   * Declared before `:id` so the literal path is matched first. Express routes
   * are ordered, and `identifier/ABHA/<value>` is three segments so it would
   * not collide with `:id` — but `:id/identifiers` would be shadowed if the
   * order were ever changed, and relying on segment counts to stay correct is
   * not a property worth having.
   */
  @Get('identifier/:type/:value')
  @ApiOperation({
    summary: 'Resolve a patient from a national identifier document',
    description:
      'The plaintext identifier is HMACed and matched against ' +
      '`patient_identifiers.value_hash`. The plaintext is never stored in an ' +
      'indexed column and is not echoed back.',
  })
  async findByIdentifier(
    @Param('type', new ZodValidationPipe(HashedIdentifierTypeSchema))
    type: HashedIdentifierType,
    @Param('value') value: string,
    @DbContext() ctx: DatabaseContext,
  ) {
    const patient = await this.patientService.findByIdentifier(type, value, ctx);

    // A miss is a 404 rather than a 200-with-null, so a client cannot confuse
    // "not registered" with "the endpoint returned nothing". The message is
    // identical for a genuinely unknown identifier and one hidden by RLS.
    if (!patient) {
      throw new NotFoundException('No patient is registered with that identifier');
    }

    return patient;
  }

  @Get()
  @ApiOperation({
    summary: 'Search patients by UHID, name prefix, mobile or national identifier',
    description:
      'Matches a UHID or `display_name` prefix, an exact 10-digit mobile, or ' +
      'the HMAC digest of an ABHA / Aadhaar / voter / passport / PAN number. ' +
      'Substring search is deliberately not offered: the schema has only btree ' +
      'indexes and no `pg_trgm`, so a leading wildcard cannot use one.',
  })
  async search(
    @Query(new ZodValidationPipe(SearchPatientsSchema)) query: SearchPatientsInput,
    @DbContext() ctx: DatabaseContext,
  ) {
    return this.patientService.search(query.search, ctx, query.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  async getById(@Param('id') id: string, @DbContext() ctx: DatabaseContext) {
    return this.patientService.getById(id, ctx);
  }

  @Get(':id/360')
  @ApiOperation({
    summary: 'Get the unified Patient 360 longitudinal medical record',
  })
  async get360(@Param('id') id: string, @DbContext() ctx: DatabaseContext) {
    return this.patientService.getPatient360(id, ctx);
  }

  @Get(':id/identifiers')
  @ApiOperation({
    summary: 'List the identifier documents held for a patient',
    description: 'Returns the document type and digest, never the plaintext.',
  })
  async listIdentifiers(
    @Param('id') id: string,
    @DbContext() ctx: DatabaseContext,
  ) {
    return this.patientService.listIdentifiers(id, ctx);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new patient with a canonically minted UHID' })
  async register(
    @Body(new ZodValidationPipe(RegisterPatientSchema)) body: RegisterPatientInput,
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() _user: AuthenticatedUser,
  ) {
    return this.patientService.register(body, ctx);
  }
}
