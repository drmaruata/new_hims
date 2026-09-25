import { z } from 'zod';

/**
 * Who is paying, which decides the settlement path: PM-JAY and the state
 * schemes settle through their own portals, private TPAs and corporates through
 * NHCX or a direct integration.
 */
export const PayerTypeSchema = z.enum(['PMJAY', 'STATE_SCHEME', 'PRIVATE_TPA', 'CORPORATE']);

/**
 * A cashless pre-authorisation request.
 *
 * `requestedAmount` is a rupee figure the payer will counter, so it is required
 * and bounded: a pre-auth with no amount is not actionable, and one with a
 * negative or absurd amount is a data-entry error worth rejecting before it
 * reaches the payer and counts against the hospital's claim quality record.
 */
export const SubmitPreAuthSchema = z
  .object({
    encounterId: z.string().uuid(),
    patientId: z.string().uuid(),
    payerType: PayerTypeSchema,
    payerName: z.string().min(1).max(255),
    policyNumber: z.string().min(1).max(128),
    requestedAmount: z.number().positive().max(100_000_000),
  })
  .strict();

export type SubmitPreAuthInput = z.infer<typeof SubmitPreAuthSchema>;
