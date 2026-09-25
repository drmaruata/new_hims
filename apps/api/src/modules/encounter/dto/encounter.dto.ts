import { z } from 'zod';

/**
 * Encounter types. The reference data table (`hims_catalog`) is the
 * authoritative list at runtime; this enum keeps the API contract explicit and
 * lets a bad value fail as 400 rather than 500.
 */
export const EncounterTypeSchema = z.enum([
  'OPD',
  'IPD',
  'EMERGENCY',
  'DAY_CARE',
  'OPERATION_THEATER',
  'ICU',
  'HOME_CARE',
  'TELemedicine',
  'RCM',
  'DEAD_BODY',
]);

export const CreateEncounterDtoSchema = z
  .object({
    facilityId: z.string().uuid(),
    patientId: z.string().uuid(),
    encounterType: EncounterTypeSchema,
    departmentId: z.string().uuid(),
    /** Required by some departments, optional at the API boundary. */
    attendingPractitionerId: z.string().uuid().optional(),
    /** Set when this encounter continues an earlier one. */
    parentEncounterId: z.string().uuid().optional(),
    /** Set when this encounter was derived from a referral or another record. */
    sourceEncounterId: z.string().uuid().optional(),
    reason: z.string().max(1000).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .refine(
    (value) => value.parentEncounterId !== value.sourceEncounterId,
    { message: 'parentEncounterId and sourceEncounterId must differ', path: ['sourceEncounterId'] },
  );

export const UpdateEncounterDtoSchema = z
  .object({
    reason: z.string().max(1000).optional(),
    attendingPractitionerId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

/** Events accepted by `POST /encounters/{id}/{action}`. */
export const EncounterActionSchema = z.enum(['start', 'sign', 'close']);

export type CreateEncounterInput = z.infer<typeof CreateEncounterDtoSchema>;
export type UpdateEncounterInput = z.infer<typeof UpdateEncounterDtoSchema>;
export type EncounterAction = z.infer<typeof EncounterActionSchema>;
