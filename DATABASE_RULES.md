# Database Rules

Canonical patient identity is tenant-scoped and reused across all modules. Tenant-owned rows carry tenant_id. Business migrations are versioned. No client-side privileged database credentials. RLS is defense in depth under the NestJS service role; application DB roles must not bypass RLS.
