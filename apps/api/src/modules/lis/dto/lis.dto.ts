import { z } from 'zod';

/**
 * A verified analyte result.
 *
 * `numericResult` is optional because not every assay is numeric: cultures,
 * smears and serology report text, and forcing a number would either invent one
 * or reject the result. It is carried separately from `resultValue` so a delta
 * check can compare numerics without re-parsing a formatted display string.
 *
 * `isCritical` is a client declaration in the stub only. Once the analyser
 * bridge and the reference-range tables exist, critical-value determination
 * must be resolved server-side against them: a critical potassium that the
 * client forgets to flag is a patient-safety failure, not a validation gap.
 */
export const VerifyLabResultSchema = z
  .object({
    resultValue: z.string().min(1).max(64),
    numericResult: z.number().finite().optional(),
    /** Set by the caller's delta/range check until the server computes it. */
    isAbnormal: z.boolean().optional(),
    isCritical: z.boolean().optional(),
  })
  .strict();

export type VerifyLabResultInput = z.infer<typeof VerifyLabResultSchema>;
