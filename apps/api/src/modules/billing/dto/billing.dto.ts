import { z } from 'zod';

/**
 * A billed line.
 *
 * `netAmount` is deliberately not accepted: it is quantity × unitPrice less any
 * line-level discount, and a client-supplied total that disagrees with the line
 * it belongs to is the kind of discrepancy that surfaces weeks later as an
 * unexplained variance in the revenue report. The service computes it.
 */
export const InvoiceLineSchema = z
  .object({
    serviceCode: z.string().min(1).max(32),
    description: z.string().min(1).max(255),
    departmentId: z.string().uuid(),
    quantity: z.number().positive().max(10_000),
    unitPrice: z.number().min(0).max(100_000_000),
  })
  .strict();

export const CreateInvoiceSchema = z
  .object({
    patientId: z.string().uuid(),
    encounterId: z.string().uuid().optional(),
    items: z.array(InvoiceLineSchema).min(1).max(500),
    discountAmount: z.number().min(0).optional(),
    taxAmount: z.number().min(0).optional(),
    /**
     * Amount tendered at the counter. Optional: a bill raised at the bedside is
     * frequently invoiced before the patient reaches the cashier.
     */
    paidAmount: z.number().min(0).optional(),
  })
  .strict();

export type InvoiceLineInput = z.infer<typeof InvoiceLineSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
