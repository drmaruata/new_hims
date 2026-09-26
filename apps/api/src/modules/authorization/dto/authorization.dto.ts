import { z } from 'zod';

/**
 * Permission strings are `DOMAIN:RESOURCE:ACTION:SCOPE` (SRS §8). Validated
 * structurally here so a typo becomes a 400 instead of a permission that never
 * matches anything.
 */
export const PermissionCodeSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(
    /^[A-Z0-9_]+:[A-Z0-9_]+:[A-Z0-9_]+:[A-Z0-9_]+$/,
    'Permission must be DOMAIN:RESOURCE:ACTION:SCOPE using A-Z0-9_ segments'
  );

export const RoleCodeSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Z0-9_]+$/, 'Role code must be uppercase A-Z, 0-9 and underscore');

export const CreateRoleDtoSchema = z
  .object({
    code: RoleCodeSchema,
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
  })
  .strict();

export const UpdateRoleDtoSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export const SetPermissionsDtoSchema = z
  .object({
    /** Replaces the role's entire grant set. */
    permissionCodes: z.array(PermissionCodeSchema).max(1000).default([]),
  })
  .strict();

export const AssignRoleDtoSchema = z
  .object({
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
    /** Omitting these grants the role tenant-wide. */
    facilityId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  })
  .strict();

export const SetFacilityAccessDtoSchema = z
  .object({
    /** Replaces the user's facility grants with exactly this set. */
    facilityIds: z.array(z.string().uuid()).max(500).default([]),
  })
  .strict();

export const SetDepartmentAccessDtoSchema = z
  .object({
    departmentIds: z.array(z.string().uuid()).max(500).default([]),
  })
  .strict();

export const SetMembershipStatusDtoSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']),
  })
  .strict();

export type CreateRoleInput = z.infer<typeof CreateRoleDtoSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleDtoSchema>;
export type SetPermissionsInput = z.infer<typeof SetPermissionsDtoSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleDtoSchema>;
export type UpsertFacilityAccessInput = z.infer<typeof SetFacilityAccessDtoSchema>;
export type SetDepartmentAccessInput = z.infer<typeof SetDepartmentAccessDtoSchema>;
export type SetMembershipStatusInput = z.infer<typeof SetMembershipStatusDtoSchema>;
