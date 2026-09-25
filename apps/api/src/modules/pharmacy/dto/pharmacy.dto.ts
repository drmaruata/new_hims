import { z } from 'zod';

/**
 * One dispensed line, resolved to a specific batch.
 *
 * The batch is supplied by the caller because FEFO selection happens against
 * live stock at the shelf: the pharmacist scans the box in front of them, and
 * the server's view of that shelf may be seconds stale. The quantity is
 * validated against what was ordered, not against what the client claims is in
 * stock — the stock ledger is the authority on that.
 */
export const DispenseLineSchema = z
  .object({
    drugId: z.string().uuid(),
    batchNumber: z.string().min(1).max(64),
    quantityDispensed: z.number().int().positive().max(100_000),
  })
  .strict();

export const DispenseMedicationSchema = z
  .object({
    items: z.array(DispenseLineSchema).min(1).max(100),
  })
  .strict();

export type DispenseLineInput = z.infer<typeof DispenseLineSchema>;
export type DispenseMedicationInput = z.infer<typeof DispenseMedicationSchema>;
