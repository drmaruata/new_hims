import { z } from 'zod';

/**
 * A radiologist's structured report.
 *
 * `impression` is required separately from `findings` because it is the field
 * the referring clinician reads and the one a downstream FHIR `DiagnosticReport`
 * maps to; deriving it from the findings prose server-side is not something a
 * language model should be doing in a signed record.
 *
 * `isCriticalFinding` is expected to drive an alert to the ordering clinician.
 */
export const SubmitRadiologyReportSchema = z
  .object({
    findings: z.string().min(1).max(20000),
    impression: z.string().min(1).max(4000),
    isCriticalFinding: z.boolean().optional(),
  })
  .strict();

export type SubmitRadiologyReportInput = z.infer<typeof SubmitRadiologyReportSchema>;
