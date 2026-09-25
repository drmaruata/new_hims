import { z } from 'zod';

/**
 * The sex recorded at birth and the patient's own stated gender are separate
 * columns in `hims_patient.patients` (`sex_at_birth`, `gender_identity`) and
 * are modelled as such. Conflating them into one `gender` field is what the
 * previous version of this file did, and it discarded a distinction the
 * clinical record is required to keep.
 */
export const SexAtBirthSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);

export const GenderIdentitySchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);

export const MaritalStatusSchema = z.enum([
  'SINGLE',
  'MARRIED',
  'DIVORCED',
  'WIDOWED',
  'OTHER',
]);

export const BloodGroupSchema = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
]);

/**
 * How precisely a date of birth is known.
 *
 * The column is nullable but so is its precision, and the distinction is
 * clinically load-bearing: a birth date recorded only to the year must not be
 * rendered as `01 Jan` and then used to compute a paediatric dose.
 */
export const DobPrecisionSchema = z.enum(['DAY', 'MONTH', 'YEAR', 'UNKNOWN']);

/** ABHA addresses are `name@abdm`; the rest are opaque per issuing authority. */
export const IdentifierTypeSchema = z.enum([
  'ABHA',
  'AADHAAR',
  'PAN',
  'PASSPORT',
  'VOTER_ID',
  'DL',
  'OTHER',
]);

/** Identifier types that are stored hashed and can be looked up by digest. */
export const HashedIdentifierTypeSchema = z.enum([
  'ABHA',
  'AADHAAR',
  'PAN',
  'PASSPORT',
  'VOTER_ID',
  'DL',
]);

const NewPatientIdentifierSchema = z
  .object({
    identifierType: IdentifierTypeSchema,
    /**
     * The plaintext identifier. It is HMACed on the way in and never written to
     * an indexed column, so the value in this request is the only place it
     * appears in clear text.
     */
    value: z.string().min(1).max(128),
    /** Issuing authority, e.g. `UIDAI` for Aadhaar, `ABDM` for ABHA. */
    system: z.string().max(64).optional(),
    /**
     * Defaults to the first identifier supplied. Two primaries would violate
     * nothing in the schema but would make "the" primary ambiguous.
     */
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const RegisterPatientSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    middleName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),

    dateOfBirth: z.iso.date().optional(),
    dobPrecision: DobPrecisionSchema.optional(),
    sexAtBirth: SexAtBirthSchema.optional(),
    genderIdentity: GenderIdentitySchema.optional(),
    maritalStatus: MaritalStatusSchema.optional(),
    bloodGroup: BloodGroupSchema.optional(),

    /** Indian mobile numbers are 10 digits without a leading `+91`. */
    primaryMobile: z
      .string()
      .regex(/^\d{10}$/, 'primaryMobile must be 10 digits without a country code')
      .optional(),
    secondaryMobile: z
      .string()
      .regex(/^\d{10}$/, 'secondaryMobile must be 10 digits without a country code')
      .optional(),
    email: z.email().optional(),

    address: z.record(z.string(), z.unknown()).optional(),
    preferredLanguage: z.string().max(16).optional(),
    communicationPreference: z.enum(['SMS', 'EMAIL', 'PUSH', 'PHONE']).optional(),

    identifiers: z.array(NewPatientIdentifierSchema).max(10).optional(),
  })
  .strict()
  .refine((value) => value.dateOfBirth === undefined || value.dobPrecision === undefined, {
    message:
      'dobPrecision is only meaningful alongside dateOfBirth; omit it or set both',
    path: ['dobPrecision'],
  })
  .refine(
    (value) =>
      value.dateOfBirth === undefined ||
      Date.parse(`${value.dateOfBirth}T00:00:00Z`) <= Date.now(),
    { message: 'dateOfBirth cannot be in the future', path: ['dateOfBirth'] },
  )
  .refine(
    (value) =>
      value.identifiers?.filter((identifier) => identifier.isPrimary).length !== undefined &&
      value.identifiers !== undefined
        ? value.identifiers.filter((identifier) => identifier.isPrimary).length <= 1
        : true,
    {
      message: 'At most one identifier may be marked primary',
      path: ['identifiers'],
    },
  );

export const SearchPatientsSchema = z
  .object({
    search: z.string().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export type RegisterPatientInput = z.infer<typeof RegisterPatientSchema>;
export type SearchPatientsInput = z.infer<typeof SearchPatientsSchema>;
export type NewPatientIdentifierInput = z.infer<typeof NewPatientIdentifierSchema>;
export type HashedIdentifierType = z.infer<typeof HashedIdentifierTypeSchema>;
