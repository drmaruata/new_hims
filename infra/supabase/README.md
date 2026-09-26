# Self-hosted Supabase baseline

The HIMS development blueprint requires self-hosted Supabase as the platform layer for PostgreSQL, Auth, Realtime and Storage. This directory pins the upstream self-hosted Docker release and adds only the HIMS-specific migration overlay.

The official Supabase Docker documentation currently identifies self-hosted/v0.8.2 as the current tagged self-hosted configuration. The repository does not vendor the upstream 500+ line Compose file; bootstrap.sh fetches that exact tag and records it under the generated runtime directory.

Setup:

1. Run bash infra/supabase/bootstrap.sh.
2. Open infra/supabase/runtime/.env.
3. Replace all generated/example secrets and set the local URLs.
4. Start the HIMS overlay with the command printed by the bootstrap script.
5. Apply the HIMS application role with infra/db/provision-app-role.sh.
6. Point the API DATABASE_URL at the non-BYPASSRLS hims_app role.
7. Run infra/db/verify-rls.sh.

The baseline migration is mounted as an init script with a zz- prefix so it runs after Supabase's own database bootstrap scripts on a fresh database volume.

The development seed is a separate Compose overlay and is never mounted by the default stack. This prevents demo tenant data from being silently created in a pilot/production environment.

Important operational rules:

- Do not expose the Supabase Studio dashboard to the public internet without TLS and access controls.
- Keep the Supabase service/secret key server-side.
- Do not use the PostgreSQL postgres superuser as the HIMS API connection.
- Self-hosting transfers backup, DR, security hardening, monitoring and upgrade responsibility to the operator.
