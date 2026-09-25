import { z } from 'zod';

export const DepartmentTypeSchema = z.enum([
  'OUT_PATIENT',
  'IN_PATIENT',
  'LABORATORY',
  'RADIOLOGY',
  'PHARMACY',
  'OPERATION_THEATER',
  'INTENSIVE_CARE',
  'EMERGENCY',
  'ADMINISTRATION',
  'SUPPORT',
]);

export const CreateDepartmentDtoSchema = z
  .object({
    facilityId: z.string().uuid(),
    departmentCode: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Department code must be alphanumeric with - or _'),
    name: z.string().min(1).max(255),
    departmentType: DepartmentTypeSchema,
    parentDepartmentId: z.string().uuid().optional(),
    /**
     * Clinical departments require a licensed practitioner to sign clinical
     * content; administrative ones do not.
     */
    clinicalServiceFlag: z.boolean().default(true),
  })
  .strict();

export const UpdateDepartmentDtoSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    departmentType: DepartmentTypeSchema.optional(),
    parentDepartmentId: z.string().uuid().nullable().optional(),
    clinicalServiceFlag: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentDtoSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentDtoSchema>;
