export interface DatabaseContextInput {
  tenantId?: string | null;
  facilityId?: string | null;
  userId?: string | null;
  facilityIds?: readonly string[] | null;
}

/**
 * Validate the minimum RLS context before a database transaction begins.
 * Keeping this pure makes the tenant-isolation invariant independently testable.
 */
export function assertDatabaseContext(
  ctx: DatabaseContextInput | null | undefined,
): asserts ctx is DatabaseContextInput & { tenantId: string } {
  if (!ctx?.tenantId) {
    throw new Error(
      'A database context without a tenantId was supplied. Tenant-scoped database work must never run without an explicit tenant context.',
    );
  }
}
