-- Re-point the development seed tenant at an RFC 9562 conformant UUID.
--
-- The seed tenant was `11111111-1111-1111-1111-111111111111`. PostgreSQL's
-- `uuid` type accepts it, but it is not a valid RFC 9562 UUID: the variant
-- nibble must be one of 8/9/a/b and this one is `1`. Zod 4's `z.uuid()` — which
-- every DTO in `@hims/validation` uses for identifiers — rejects it, so the
-- seed tenant could not be passed through an API schema even though it was a
-- perfectly good database key. The readable all-ones shape is kept, with real
-- version (`4`) and variant (`8`) nibbles:
--
--     11111111-1111-1111-1111-111111111111  ->  11111111-1111-4111-8111-111111111111
--
-- `20260926000000_phase0_permission_normalization.sql` and `supabase/seed/seed.sql`
-- now carry the new value, so a database built from scratch never sees the old
-- one. This migration exists for environments that applied the earlier
-- revision: it re-points the rows that migration created. It is deliberately
-- narrow and idempotent, and it touches no clinical or tenant-owned data —
-- only the development role/permission grants, which have no rows outside a
-- seeded environment.
--
-- A production environment has no rows matching the old id, so this is a no-op
-- there.

BEGIN;

DO $$
DECLARE
  moved bigint;
BEGIN
  UPDATE hims_core.role_permissions
  SET tenant_id = '11111111-1111-4111-8111-111111111111'::uuid
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

  GET DIAGNOSTICS moved = ROW_COUNT;

  IF moved > 0 THEN
    RAISE NOTICE 'Re-pointed % seed role/permission grant(s) to the RFC 9562 tenant id', moved;
  ELSE
    RAISE NOTICE 'No seed role/permission grants referenced the old tenant id; nothing to re-point';
  END IF;
END
$$;

COMMIT;
