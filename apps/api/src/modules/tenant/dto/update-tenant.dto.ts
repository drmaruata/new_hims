import { z } from 'zod';

/**
 * IANA timezone, e.g. `Asia/Kolkata`. Validated against the runtime's own
 * database so an invalid zone fails at the API boundary rather than at the
 * first date render.
 */
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

export const UpdateTenantDtoSchema = z
  .object({
    legalName: z.string().min(1).max(255).optional(),
    displayName: z.string().min(1).max(255).optional(),
    timezone: ianaTimezone.optional(),
    defaultLocale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Must be a BCP-47 locale such as en-IN')
      .optional(),
    defaultCurrency: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO 4217 code')
      .optional(),
    dataRegion: z.string().max(64).optional(),
    planCode: z.string().max(64).optional(),
    /** Merged into the existing settings object; keys are not removed. */
    settings: z.record(z.string(), z.unknown()).optional(),
    /** Optimistic concurrency token from the last read. */
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export type UpdateTenantDto = z.infer<typeof UpdateTenantDtoSchema>;
