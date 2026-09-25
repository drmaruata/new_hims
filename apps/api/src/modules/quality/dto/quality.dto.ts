import { z } from 'zod';

/**
 * Patient safety incident categories recognised by the NABH/NQAS quality
 * register. Kept as an enum rather than free text because the indicator
 * roll-ups group by it, and "Slip/fall" and "FALL" would be two categories.
 */
export const IncidentCategorySchema = z.enum([
  'MEDICATION_ERROR',
  'FALL',
  'SENTINEL_EVENT',
  'EQUIPMENT_FAILURE',
  'NEAR_MISS',
]);

/**
 * Severity drives whether the event becomes an RCA/CAPA obligation, so it is
 * required rather than defaulted. A "near miss" default on a sentinel event
 * would close the wrong cases.
 */
export const IncidentSeveritySchema = z.enum([
  'NEAR_MISS',
  'MINOR',
  'MODERATE',
  'MAJOR',
  'CATASTROPHIC',
]);

export const ReportIncidentSchema = z
  .object({
    category: IncidentCategorySchema,
    severity: IncidentSeveritySchema,
    description: z.string().min(10).max(10_000),
    /** Filled in when the root-cause analysis closes, not at report time. */
    rcaSummary: z.string().max(10_000).optional(),
    capaPlan: z.string().max(10_000).optional(),
  })
  .strict();

export type ReportIncidentInput = z.infer<typeof ReportIncidentSchema>;
