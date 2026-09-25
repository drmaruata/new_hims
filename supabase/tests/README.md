# Database and RLS tests

Phase 0 database isolation verification is provided by infra/db/verify-rls.sh.

Future database tests should use pgTAP or an equivalent isolated PostgreSQL test harness. Every tenant-owned table must be covered by cross-tenant read, insert and update-denial tests where applicable.

Do not run RLS tests using the postgres superuser because superusers bypass row-level security.
