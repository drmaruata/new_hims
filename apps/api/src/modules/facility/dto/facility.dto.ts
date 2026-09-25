import { z } from 'zod';

const ianaTimezone = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid IANA timezone identifier' },
);

const jsonObject = z.record(z.string(), z.unknown()).default({});

export const FacilityTypeSchema = z.enum([
  'HOSPITAL',
  'CLINIC',
  'DIAGNOSTIC_CENTRE',
  'SPECIALTY_CENTRE',
  'BLOOD_BANK',
  'PHARMACY',
  'WAREHOUSE',
]);

export const CreateFacilityDtoSchema = z
  .object({
    facilityCode: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Facility code must be alphanumeric with - or _'),
    name: z.string().min(1).max(255),
    facilityType: FacilityTypeSchema,
    /** Health Facility Registry identifier, where the state publishes one. */
    hfrId: z.string().max(64).optional(),
    timezone: ianaTimezone.optional(),
    address: jsonObject,
    contact: jsonObject,
    settings: jsonObject,
  })
  .strict();

export const UpdateFacilityDtoSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    facilityType: FacilityTypeSchema.optional(),
    hfrId: z.string().max(64).nullable().optional(),
    timezone: ianaTimezone.optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    address: z.record(z.string(), z.unknown()).optional(),
    contact: z.record(z.string(), z.unknown()).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export type CreateFacilityInput = z.infer<typeof CreateFacilityDtoSchema>;
export type UpdateFacilityInput = z.infer<typeof UpdateFacilityDtoSchema>;
