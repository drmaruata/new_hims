# Self-hosted Supabase baseline

The HIMS development blueprint requires self-hosted Supabase as the platform layer for PostgreSQL, Auth, Realtime and Storage. This directory pins the upstream self-hosted Docker release and adds only the HIMS-specific migration overlay.

The official Supabase Docker documentation currently identifies self-hosted/v0.8.2 as the current tagged self-hosted configuration. The repository does not vendor the upstream 500+ line Compose file; bootstrap.sh fetches that exact tag and records it under the generated runtime directory.

Setup:

1. Run bash infra/supabase/bootstrap.sh.
2. Open infra/supabase/runtime/.env.
3. Replace all generated/example secrets and set the local URLs.
4. Start the stack and wait for it to become healthy:
   `docker compose -f infra/supabase/runtime/docker-compose.yml up -d --wait`
5. Apply the HIMS migrations: `pnpm db:migrate`.
6. Apply the development seed: `pnpm db:seed`.
7. Apply the HIMS application role: `pnpm db:provision-app-role`.
8. Point the API DATABASE_URL at the non-BYPASSRLS hims_app role.
9. Verify isolation: `HIMS_TENANT_ID=<seed tenant uuid> pnpm db:verify-rls`.

The HIMS migrations are applied by the migration runner, not mounted as Postgres
init scripts. The baseline is not replayable over a schema that already exists, so
mounting it at container init and then running the runner would fail on
`relation "hims_core.tenants" already exists`; and skipping the runner would leave
the later migrations unapplied while still appearing to succeed. Keeping one path
also keeps migration order visible in the runner's output rather than encoded in
init-script filename prefixes.

For the same reason the development seed is an explicit command rather than a
Compose overlay. It creates a demo tenant, so it must be something an operator
asks for, not something that happens to whatever volume the stack was started
against. `infra/db/seed.sh` refuses to run against a non-local host unless
`HIMS_ALLOW_REMOTE_SEED=1` is set.

Important operational rules:

- Do not expose the Supabase Studio dashboard to the public internet without TLS and access controls.
- Keep the Supabase service/secret key server-side.
- Do not use the PostgreSQL postgres superuser as the HIMS API connection.
- Self-hosting transfers backup, DR, security hardening, monitoring and upgrade responsibility to the operator.
