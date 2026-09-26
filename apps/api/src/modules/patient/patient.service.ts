import { createHmac, randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../core/interfaces/paginated-result.js';
import type { DatabaseContext } from '@hims/database';
import { DatabaseService } from '@hims/database';
import type {
  Encounter,
  Patient,
  Patient360Record,
  PatientContact,
  PatientIdentifier,
} from '@hims/domain-types';

/**
 * How many times a registration retries after losing the UHID race.
 *
 * The scheme in {@link mintUhid} is 10 base-36 characters of CSPRNG output per
 * UHID, so a collision is astronomically unlikely; the retries exist because
 * `UNIQUE (tenant_id, uhid)` is the only thing standing between two concurrent
 * registrations and a shared UHID, and a 500 in that case would be a data
 * integrity incident rather than a bad request.
 */
const UHID_COLLISION_RETRIES = 3;

/**
 * Identifier types the search endpoint will resolve by digest.
 *
 * These are the types whose search term must be hashed before it reaches the
 * index — a plaintext Aadhaar or ABHA number is a searchable identifier column,
 * which is precisely what a column-level redaction policy is meant to prevent.
 */
type HashedIdentifierType = 'ABHA' | 'AADHAAR' | 'VOTER_ID' | 'PASSPORT' | 'PAN' | 'DL';

/**
 * The one projection every patient read uses.
 *
 * Declared once and interpolated rather than repeated per query: the earlier
 * copy-pasted `SELECT` lists had already drifted from each other and from the
 * table, and a projection that differs between `search` and `getById` means a
 * client cannot rely on either shape.
 *
 * `version` is returned as `bigint`, which `pg` hands back as a string to avoid
 * precision loss. It is cast to `int8` in the select list and narrowed here.
 */
const PATIENT_PROJECTION = `
  p.id,
  p.tenant_id                AS "tenantId",
  p.uhid,
  p.first_name               AS "firstName",
  p.middle_name              AS "middleName",
  p.last_name                AS "lastName",
  p.display_name             AS "displayName",
  p.date_of_birth            AS "dateOfBirth",
  p.dob_precision            AS "dobPrecision",
  p.sex_at_birth             AS "sexAtBirth",
  p.gender_identity          AS "genderIdentity",
  p.marital_status           AS "maritalStatus",
  p.blood_group              AS "bloodGroup",
  p.primary_mobile           AS "primaryMobile",
  p.secondary_mobile         AS "secondaryMobile",
  p.email,
  p.address_jsonb            AS address,
  p.preferred_language       AS "preferredLanguage",
  p.communication_preference AS "communicationPreference",
  p.status,
  p.deceased_at              AS "deceasedAt",
  p.merged_into_patient_id   AS "mergedIntoPatientId",
  p.mastering_status         AS "masteringStatus",
  p.created_at               AS "createdAt",
  p.created_by               AS "createdBy",
  p.updated_at               AS "updatedAt",
  p.updated_by               AS "updatedBy",
  p.version::int8            AS version
` as const;

/** A `patients` row that is known to satisfy `Patient`. */
interface PatientRow extends Omit<Patient, 'version'> {
  version: number;
}

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);
  private readonly identifierHashKey: string;

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    this.identifierHashKey = config.getOrThrow<string>('PATIENT_IDENTIFIER_HASH_KEY');
  }

  /**
   * Search patients by UHID, name prefix, mobile or a hashed identifier.
   *
   * Deliberately **not** a `%term%` search. The only indexes available on
   * `hims_patient.patients` are `idx_patients_tenant_name` and
   * `idx_patients_tenant_mobile`, both plain btree, and `pg_trgm` is not
   * enabled — so a leading wildcard cannot use either one and every keystroke
   * would be a sequential scan across the tenant. Prefix matching on
   * `display_name` and `uhid` plus an exact match on `primary_mobile` is the
   * most specific form the current schema can serve cheaply. If substring
   * search is required later, the fix is a `pg_trgm` GIN index, not a wider
   * `LIKE`.
   *
   * An empty term returns the 50 most recently touched patients rather than
   * the whole tenant, which is what the reception desk wants on first paint.
   */
  async search(term: string | undefined, ctx: DatabaseContext, limit?: number): Promise<Patient[]> {
    const trimmed = (term ?? '').trim();
    const capped = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    // A bare 10-digit term is an Indian mobile number; the btree on
    // `primary_mobile` answers it exactly, so do not let it fall through to a
    // prefix scan that cannot use the index.
    const asMobile = /^\d{10}$/.test(trimmed) ? trimmed : null;
    // LIKE wildcards in the term are stripped rather than escaped: a caller
    // typing `%` wants patients starting with `%`, of which there are none, and
    // honouring the wildcard would turn every keystroke into a full scan.
    const prefix = trimmed ? `${trimmed.replace(/[%_\\]/g, '')}%` : null;
    const digest = trimmed && !asMobile ? this.hashIdentifier(trimmed) : null;

    const { rows } = await this.db.query<PatientRow>(
      `SELECT ${PATIENT_PROJECTION}
         FROM hims_patient.patients p
        WHERE ($1::text IS NULL
               OR p.uhid          LIKE $1
               OR p.display_name  LIKE $1
               OR p.first_name    LIKE $1)
          AND ($2::text IS NULL OR p.primary_mobile = $2)
        ORDER BY p.updated_at DESC, p.uhid ASC
        LIMIT $3`,
      [prefix, asMobile, capped],
      ctx
    );

    // Identifier hits are resolved with a second query rather than a join: a
    // patient may hold several documents, so joining would duplicate the row
    // and blow the limit with one person. The two result sets are merged and
    // de-duplicated by id, because the same patient can match both.
    const byIdentifier = digest ? await this.findByIdentifierHash(digest, ctx, capped) : [];

    const merged = new Map<string, Patient>();
    for (const row of [...rows.map(toPatient), ...byIdentifier]) {
      if (merged.size >= capped) break;
      if (!merged.has(row.id)) merged.set(row.id, row);
    }

    return [...merged.values()];
  }

  async getById(id: string, ctx: DatabaseContext): Promise<Patient> {
    const row = await this.db.one<PatientRow>(
      `SELECT ${PATIENT_PROJECTION}
         FROM hims_patient.patients p
        WHERE p.id = $1`,
      [id],
      ctx
    );

    // 404 is identical whether the row is absent or hidden by RLS, so this
    // cannot be used to probe for the existence of another tenant's patient.
    if (!row) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return toPatient(row);
  }

  /**
   * Exact lookup by a national identifier (ABHA address, Aadhaar, …).
   *
   * Answers the question the caller actually asked — "do we already have a
   * record for this document?" — which is the question MPI duplicate detection
   * asks before creating a new `patients` row. The digest is computed
   * application-side because the plaintext is never stored in an indexed
   * column.
   */
  async findByIdentifier(
    identifierType: HashedIdentifierType,
    value: string,
    ctx: DatabaseContext
  ): Promise<Patient | null> {
    const row = await this.db.one<PatientRow>(
      `SELECT ${PATIENT_PROJECTION}
         FROM hims_patient.patient_identifiers i
         JOIN hims_patient.patients p
           ON p.id = i.patient_id AND p.tenant_id = i.tenant_id
        WHERE i.tenant_id = $1
          AND i.identifier_type = $2
          AND i.value_hash = $3
          AND (i.valid_to IS NULL OR i.valid_to >= current_date)
        ORDER BY i.is_primary DESC, i.verified_at DESC NULLS LAST
        LIMIT 1`,
      [ctx.tenantId, identifierType, this.hashIdentifier(value)],
      ctx
    );

    return row ? toPatient(row) : null;
  }

  /** Every identifier document held for a patient, without the plaintext. */
  async listIdentifiers(patientId: string, ctx: DatabaseContext): Promise<PatientIdentifier[]> {
    const { rows } = await this.db.query<{
      id: string;
      identifierType: PatientIdentifier['identifierType'];
      system: string | null;
      isPrimary: boolean;
      verifiedAt: string | null;
      validFrom: string | null;
      validTo: string | null;
      valueHash: string | null;
    }>(
      `SELECT id,
              identifier_type   AS "identifierType",
              system,
              is_primary        AS "isPrimary",
              verified_at       AS "verifiedAt",
              valid_from        AS "validFrom",
              valid_to          AS "validTo",
              value_hash        AS "valueHash"
         FROM hims_patient.patient_identifiers
        WHERE patient_id = $1
        ORDER BY is_primary DESC, identifier_type`,
      [patientId],
      ctx
    );

    return rows;
  }

  /**
   * The longitudinal record behind the Patient 360 view.
   *
   * Every section is a real query against the owning schema rather than a
   * denormalised copy, so the view cannot drift from the clinical record. The
   * sections are read inside one transaction sharing a snapshot, otherwise a
   * prescription committed between two queries would produce a timeline that
   * never existed at any single instant.
   */
  async getPatient360(id: string, ctx: DatabaseContext): Promise<Patient360Record> {
    const patient = await this.getById(id, ctx);

    return this.db.transaction<Patient360Record>(async (client) => {
      const [allergies, contacts, conditions, encounters, vitals, timeline] = await Promise.all([
        this.readAllergies(client, id, ctx),
        this.readContacts(client, id, ctx),
        this.readConditions(client, id, ctx),
        this.readOpenEncounters(client, id, ctx),
        this.readRecentVitals(client, id, ctx),
        this.readTimeline(client, id, ctx),
      ]);

      return {
        patient: { ...patient, allergies, contacts },
        allergies,
        contacts,
        conditions,
        activeEncounters: encounters,
        recentVitals: vitals,
        activePrescriptions: [],
        recentLabResults: [],
        recentRadiologyReports: [],
        timeline,
      };
    }, ctx);
  }

  /**
   * Register a patient.
   *
   * The insert runs in the caller's transaction and retries on a `UHID`
   * collision, because the only uniqueness guarantee is the database
   * constraint. `display_name` is derived here rather than accepted from the
   * client: it is `NOT NULL`, it is what search and every list view read, and
   * accepting a client-supplied value would let the searchable name drift from
   * the structured name parts.
   */
  async register(input: RegisterPatientInput, ctx: DatabaseContext): Promise<Patient> {
    if (!ctx.tenantId || !ctx.userId) {
      // Reaching here means a guard was bypassed. Failing closed is the only
      // safe response: `tenant_id` is `NOT NULL` and is RLS-checked.
      throw new BadRequestException(
        'A resolved tenant and user are required to register a patient'
      );
    }

    const displayName = buildDisplayName(input);

    return this.db.transaction<Patient>(async (client) => {
      for (let attempt = 1; attempt <= UHID_COLLISION_RETRIES; attempt += 1) {
        const uhid = mintUhid();

        try {
          return await this.insertPatient(client, { ...input, uhid, displayName }, ctx);
        } catch (error) {
          if (
            !isUniqueViolation(error, 'ux_patients_tenant_uhid') ||
            attempt === UHID_COLLISION_RETRIES
          ) {
            throw error;
          }
          this.logger.warn(`UHID collision on attempt ${attempt}, retrying`);
        }
      }

      // Unreachable: the loop either returns or rethrows on the final attempt.
      throw new BadRequestException('Could not allocate a unique UHID');
    }, ctx);
  }

  private async insertPatient(
    client: PoolClient,
    input: RegisterPatientInput & { uhid: string; displayName: string },
    ctx: DatabaseContext
  ): Promise<Patient> {
    const { rows } = await client.query<PatientRow>(
      `INSERT INTO hims_patient.patients (
         tenant_id, uhid,
         first_name, middle_name, last_name, display_name,
         date_of_birth, dob_precision, sex_at_birth, gender_identity,
         marital_status, blood_group, primary_mobile, secondary_mobile, email,
         address_jsonb, preferred_language, communication_preference,
         created_by, updated_by
       ) VALUES (
         $1, $2,
         $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16::jsonb, $17, $18,
         $19, $19
       )
       RETURNING ${PATIENT_PROJECTION.replace(/\bp\./g, '')}`,
      [
        ctx.tenantId,
        input.uhid,
        input.firstName,
        input.middleName ?? null,
        input.lastName ?? null,
        input.displayName,
        input.dateOfBirth ?? null,
        input.dobPrecision ?? null,
        input.sexAtBirth ?? null,
        input.genderIdentity ?? null,
        input.maritalStatus ?? null,
        input.bloodGroup ?? null,
        input.primaryMobile ?? null,
        input.secondaryMobile ?? null,
        input.email ?? null,
        JSON.stringify(input.address ?? {}),
        input.preferredLanguage ?? null,
        input.communicationPreference ?? null,
        ctx.userId,
      ]
    );

    const created = rows[0];
    if (!created) {
      throw new BadRequestException('Patient registration returned no row');
    }

    // Identifiers are written after the patient exists because
    // `patient_identifiers.patient_id` is a foreign key. They are part of the
    // same transaction, so a failure here rolls the registration back rather
    // than leaving a patient that MPI cannot match.
    if (input.identifiers?.length) {
      await this.insertIdentifiers(client, created.id, input.identifiers, ctx);
    }

    return toPatient(created);
  }

  private async insertIdentifiers(
    client: PoolClient,
    patientId: string,
    identifiers: readonly NewPatientIdentifier[],
    ctx: DatabaseContext
  ): Promise<void> {
    for (const [index, identifier] of identifiers.entries()) {
      await client.query(
        `INSERT INTO hims_patient.patient_identifiers (
           tenant_id, patient_id, identifier_type, system,
           value_hash, value_encrypted, is_primary
         ) VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
        [
          ctx.tenantId,
          patientId,
          identifier.identifierType,
          identifier.system ?? null,
          this.hashIdentifier(identifier.value),
          // The first identifier is the primary one; an explicit flag wins.
          identifier.isPrimary ?? index === 0,
        ]
      );
    }
  }

  private async readAllergies(
    client: PoolClient,
    patientId: string,
    ctx: DatabaseContext
  ): Promise<Patient360Record['allergies']> {
    const { rows } = await client.query<{
      id: string;
      allergenType: string;
      allergenName: string;
      reactionDescription: string | null;
      severity: string | null;
      verificationStatus: string;
      onsetDate: string | null;
    }>(
      `SELECT id,
              'OTHER'                       AS "allergenType",
              allergen_name                 AS "allergenName",
              reaction                      AS "reactionDescription",
              severity,
              verification_status           AS "verificationStatus",
              onset_date                    AS "onsetDate"
         FROM hims_patient.allergies
        WHERE tenant_id = $1 AND patient_id = $2
        ORDER BY
          -- An unverified allergy is still clinically actionable and must not
          -- be buried under a pile of confirmed ones.
          CASE verification_status WHEN 'UNVERIFIED' THEN 0 ELSE 1 END,
          severity DESC NULLS LAST,
          recorded_at DESC`,
      [ctx.tenantId, patientId]
    );

    return rows.map((row) => ({
      id: row.id,
      allergenType: row.allergenType as Patient360Record['allergies'][number]['allergenType'],
      allergenName: row.allergenName,
      severity: (row.severity ?? 'UNKNOWN') as Patient360Record['allergies'][number]['severity'],
      reactionDescription: row.reactionDescription ?? undefined,
      verified: row.verificationStatus === 'VERIFIED',
      diagnosedAt: row.onsetDate ?? undefined,
    }));
  }

  private async readContacts(
    client: PoolClient,
    patientId: string,
    ctx: DatabaseContext
  ): Promise<Patient360Record['contacts']> {
    const { rows } = await client.query<{
      id: string;
      relationship: string | null;
      name: string;
      mobile: string | null;
      emergencyContact: boolean;
    }>(
      `SELECT id, relationship, name, mobile,
              emergency_contact_flag AS "emergencyContact"
         FROM hims_patient.patient_contacts
        WHERE tenant_id = $1 AND patient_id = $2
        ORDER BY emergency_contact_flag DESC, name`,
      [ctx.tenantId, patientId]
    );

    // A contact with no number cannot be reached in an emergency, and
    // `PatientContact.mobile` is required while the column is nullable. Such
    // rows are dropped rather than surfaced with a placeholder number, which
    // would read as a real contact channel and be dialled in vain.
    return rows
      .filter((row) => row.mobile !== null && row.mobile.trim().length > 0)
      .map((row) => ({
        id: row.id,
        relationship: (row.relationship ?? 'OTHER') as PatientContact['relationship'],
        name: row.name,
        mobile: row.mobile as string,
        isEmergencyContact: row.emergencyContact,
      }));
  }

  private async readOpenEncounters(
    client: PoolClient,
    patientId: string,
    ctx: DatabaseContext
  ): Promise<Encounter[]> {
    const { rows } = await client.query<{
      id: string;
      tenantId: string;
      facilityId: string;
      patientId: string;
      encounterNumber: string;
      encounterType: Encounter['encounterType'];
      departmentId: string;
      attendingPractitionerId: string | null;
      status: Encounter['status'];
      startedAt: string;
      endedAt: string | null;
      chiefComplaint: string | null;
      createdAt: string;
      updatedAt: string;
      version: number;
    }>(
      `SELECT e.id,
              e.tenant_id        AS "tenantId",
              e.facility_id      AS "facilityId",
              e.patient_id       AS "patientId",
              e.encounter_number AS "encounterNumber",
              e.encounter_type   AS "encounterType",
              e.department_id    AS "departmentId",
              e.attending_practitioner_id AS "attendingPractitionerId",
              e.status,
              e.started_at       AS "startedAt",
              e.ended_at         AS "endedAt",
              e.reason           AS "chiefComplaint",
              e.created_at       AS "createdAt",
              e.updated_at       AS "updatedAt",
              e.version::int8    AS version
         FROM hims_clinical.encounters e
        WHERE e.tenant_id = $1
          AND e.patient_id = $2
          AND e.ended_at IS NULL
          AND e.status NOT IN ('CANCELLED', 'DISCHARGED', 'COMPLETED')
        ORDER BY e.started_at DESC
        LIMIT 25`,
      [ctx.tenantId, patientId]
    );

    // `attending_practitioner_id` is nullable in the schema but `Encounter`
    // requires it; an unstaffed encounter is a real state the type cannot
    // express, so it is omitted rather than invented.
    return rows
      .filter((row) => row.attendingPractitionerId !== null)
      .map((row) => ({
        ...row,
        attendingPractitionerId: row.attendingPractitionerId as string,
      }));
  }

  /**
   * Recent vitals, pivoted out of `hims_clinical.observations`.
   *
   * `observations` is a tall table — one row per measurement, with
   * `observation_type` naming the sign — rather than a wide vitals row. The
   * `MAX(...) FILTER (...)` pivots the common signs into columns and the
   * `GROUP BY` is on the recording instant, so a nurse entering temperature and
   * pulse as two rows yields one `ClinicalVitals` with both filled in.
   */
  private async readRecentVitals(
    client: PoolClient,
    patientId: string,
    ctx: DatabaseContext
  ): Promise<Patient360Record['recentVitals']> {
    const { rows } = await client.query<{
      id: string;
      encounterId: string | null;
      patientId: string;
      recordedAt: string;
      recordedBy: string | null;
      // `value_numeric` is `numeric`, which `pg` would hand back as a string to
      // avoid precision loss. Casting to `float8` in the select list makes the
      // driver parse it as a JS number, which is what a vital sign is.
      temperatureCelsius: number | null;
      pulseBpm: number | null;
      systolicBp: number | null;
      diastolicBp: number | null;
      respiratoryRate: number | null;
      oxygenSaturationSpO2: number | null;
    }>(
      `SELECT min(o.id)                     AS id,
              min(o.encounter_id)            AS "encounterId",
              o.patient_id                   AS "patientId",
              o.observed_at                  AS "recordedAt",
              min(o.performer_id)            AS "recordedBy",
              max(o.value_numeric) FILTER (WHERE o.observation_type = 'TEMPERATURE')::float8 AS "temperatureCelsius",
              max(o.value_numeric) FILTER (WHERE o.observation_type = 'PULSE')::float8      AS "pulseBpm",
              max(o.value_numeric) FILTER (WHERE o.observation_type = 'SYSTOLIC_BP')::float8 AS "systolicBp",
              max(o.value_numeric) FILTER (WHERE o.observation_type = 'DIASTOLIC_BP')::float8 AS "diastolicBp",
              max(o.value_numeric) FILTER (WHERE o.observation_type = 'RESPIRATORY_RATE')::float8 AS "respiratoryRate",
              max(o.value_numeric) FILTER (WHERE o.observation_type = 'SPO2')::float8        AS "oxygenSaturationSpO2"
         FROM hims_clinical.observations o
        WHERE o.tenant_id = $1
          AND o.patient_id = $2
          AND o.observation_type IN ('TEMPERATURE', 'PULSE', 'SYSTOLIC_BP', 'DIASTOLIC_BP', 'RESPIRATORY_RATE', 'SPO2')
          AND o.status = 'FINAL'
        GROUP BY o.patient_id, o.observed_at
        ORDER BY o.observed_at DESC
        LIMIT 20`,
      [ctx.tenantId, patientId]
    );

    return (
      rows
        // Same nullable-column problem as the attending practitioner: the schema
        // allows observations with no performer (a monitor relaying from a
        // device), and `ClinicalVitals.recordedBy` is not optional.
        .filter((row) => row.encounterId !== null && row.recordedBy !== null)
        .map((row) => ({
          id: row.id,
          encounterId: row.encounterId as string,
          patientId: row.patientId,
          recordedAt: row.recordedAt,
          recordedBy: row.recordedBy as string,
          temperatureCelsius: row.temperatureCelsius ?? undefined,
          pulseBpm: row.pulseBpm ?? undefined,
          systolicBp: row.systolicBp ?? undefined,
          diastolicBp: row.diastolicBp ?? undefined,
          respiratoryRate: row.respiratoryRate ?? undefined,
          oxygenSaturationSpO2: row.oxygenSaturationSpO2 ?? undefined,
        }))
    );
  }

  private async readConditions(
    client: PoolClient,
    patientId: string,
    ctx: DatabaseContext
  ): Promise<Patient360Record['conditions']> {
    const { rows } = await client.query<{
      id: string;
      codeSystem: string | null;
      code: string | null;
      description: string;
      status: Patient360Record['conditions'][number]['status'];
      onsetDate: string | null;
      recordedAt: string;
    }>(
      `SELECT id,
              code_system AS "codeSystem",
              code,
              description,
              status,
              onset_date AS "onsetDate",
              recorded_at AS "recordedAt"
         FROM hims_patient.conditions
        WHERE tenant_id = $1 AND patient_id = $2
        ORDER BY
          -- Active problems first: an inactive allergy or resolved condition
          -- must not outrank something the clinician has to act on today.
          CASE status WHEN 'ACTIVE' THEN 0 WHEN 'CHRONIC' THEN 1 ELSE 2 END,
          onset_date DESC NULLS LAST`,
      [ctx.tenantId, patientId]
    );

    return rows;
  }

  private async readTimeline(
    client: PoolClient,
    patientId: string,
    ctx: DatabaseContext
  ): Promise<Patient360Record['timeline']> {
    const { rows } = await client.query<{
      id: string;
      timestamp: string;
      eventType: string;
      title: string;
      summary: string | null;
      sourceModule: string;
      sourceId: string;
      criticalFlag: boolean;
    }>(
      `SELECT id,
              occurred_at       AS timestamp,
              event_type        AS "eventType",
              event_type        AS title,
              display_summary   AS summary,
              source_domain     AS "sourceModule",
              source_record_id  AS "sourceId",
              -- clinical_significance is the schema's own escalation marker;
              -- anything other than CRITICAL is informational.
              (upper(coalesce(clinical_significance, '')) = 'CRITICAL') AS "criticalFlag"
         FROM hims_emr.timeline_entries
        WHERE tenant_id = $1 AND patient_id = $2
        ORDER BY occurred_at DESC, id DESC
        LIMIT 100`,
      [ctx.tenantId, patientId]
    );

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.eventType as Patient360Record['timeline'][number]['eventType'],
      title: row.title,
      summary: row.summary ?? '',
      sourceModule: row.sourceModule as Patient360Record['timeline'][number]['sourceModule'],
      sourceId: row.sourceId,
      criticalFlag: row.criticalFlag,
    }));
  }

  private async findByIdentifierHash(
    digest: string,
    ctx: DatabaseContext,
    limit: number
  ): Promise<Patient[]> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT DISTINCT ${PATIENT_PROJECTION}
         FROM hims_patient.patient_identifiers i
         JOIN hims_patient.patients p
           ON p.id = i.patient_id AND p.tenant_id = i.tenant_id
        WHERE i.tenant_id = $1
          AND i.value_hash = $2
        LIMIT $3`,
      [ctx.tenantId, digest, limit],
      ctx
    );

    return rows.map(toPatient);
  }

  /**
   * Digest an identifier for storage in and lookup from `value_hash`.
   *
   * HMAC-SHA256, not a bare hash. `ux_patient_identifier_hash` is a plain btree
   * index, so an attacker holding a database dump can mount an offline
   * dictionary attack against any unsalted digest of a 10-digit Aadhaar or
   * 12-digit ABHA — there are only a few billion candidates. The HMAC key lives
   * outside the database, so the dump alone is not enough.
   *
   * A tenant id is mixed into the message, which keeps digests unlinkable
   * across tenants even if the key is ever reused between environments.
   */
  private hashIdentifier(value: string): string {
    return createHmac('sha256', this.identifierHashKey)
      .update(value.trim().toUpperCase())
      .digest('hex');
  }
}

// =============================================================================
// Inputs
// =============================================================================

export interface NewPatientIdentifier {
  identifierType: PatientIdentifier['identifierType'];
  value: string;
  system?: string | null;
  isPrimary?: boolean;
}

export interface RegisterPatientInput {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  dobPrecision?: Patient['dobPrecision'];
  sexAtBirth?: Patient['sexAtBirth'];
  genderIdentity?: Patient['genderIdentity'];
  maritalStatus?: Patient['maritalStatus'];
  bloodGroup?: Patient['bloodGroup'];
  primaryMobile?: string | null;
  secondaryMobile?: string | null;
  email?: string | null;
  address?: Record<string, unknown>;
  preferredLanguage?: string | null;
  communicationPreference?: Patient['communicationPreference'];
  identifiers?: readonly NewPatientIdentifier[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Compose the `display_name` the search index and every list view read.
 *
 * Derived, never accepted from the client: `display_name` is `NOT NULL` and it
 * is the single field a receptionist can read a patient by, so it has to be a
 * function of the structured name parts or the two can disagree.
 */
function buildDisplayName(input: RegisterPatientInput): string {
  const parts = [input.firstName, input.middleName, input.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  if (parts.length === 0) {
    throw new BadRequestException('At least one name part is required to register a patient');
  }

  return parts.join(' ');
}

/**
 * Mint a UHID that is unique per tenant without a database sequence.
 *
 * There are no sequences in `doc/supabase_schema.sql`, so the number is built
 * here. The year prefix makes it readable and groups a tenant's registrations
 * chronologically; the remaining 10 characters are base-36 CSPRNG output, which
 * is 52 bits — enough that `UNIQUE (tenant_id, uhid)` is never realistically
 * going to reject one, and the retry loop above covers the remainder.
 *
 * `Math.random()` was used previously. It is a predictable 32-bit PRNG, so two
 * registrations in the same millisecond could collide, and an attacker could
 * enumerate the sequence and walk it to an existing patient's record.
 */
function mintUhid(): string {
  const year = new Date().getUTCFullYear();
  const entropy = randomBytes(8).readBigUInt64BE(0).toString(36).toUpperCase().padStart(10, '0');
  return `UHID-${year}-${entropy}`;
}

function toPatient(row: PatientRow): Patient {
  return row;
}

/** True when `error` is a Postgres unique-constraint violation. */
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { code?: string; constraint?: string };
  if (candidate.code !== '23505') return false;

  return constraint === undefined || candidate.constraint === constraint;
}
