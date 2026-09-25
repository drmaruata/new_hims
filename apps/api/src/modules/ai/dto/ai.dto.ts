import { z } from 'zod';

/**
 * A Doctor Copilot request.
 *
 * The complaint is free text because it is dictated or typed verbatim from the
 * patient's own words, and the copilot prompt is more faithful for it. The
 * length cap exists so a pasted document cannot be used to push the model
 * outside its clinical instruction set.
 */
export const DoctorCopilotSchema = z
  .object({
    patientId: z.string().uuid(),
    chiefComplaint: z.string().min(3).max(2_000),
  })
  .strict();

export const NursingHandoverSchema = z
  .object({
    wardId: z.string().uuid(),
  })
  .strict();

export type DoctorCopilotInput = z.infer<typeof DoctorCopilotSchema>;
export type NursingHandoverInput = z.infer<typeof NursingHandoverSchema>;
