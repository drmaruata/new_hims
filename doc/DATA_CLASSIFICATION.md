# HIMS Data Classification Policy

Status: Phase 0 baseline
Date: 2026-09-26

| Class | Examples | Minimum handling |
|---|---|---|
| PUBLIC | Product documentation, published service descriptions | Normal web publication |
| INTERNAL | Non-sensitive configuration, operational metadata | Authenticated staff access |
| CONFIDENTIAL | Business configuration, contracts, internal reports | Role/scope restriction, audit |
| SENSITIVE | Patient identifiers, contact data, clinical documents, claims | Tenant/facility scope, RLS, encryption in transit/at rest, access audit |
| RESTRICTED | Aadhaar/ABHA-linked identifiers, high-risk clinical data, break-glass records, privileged security data | Explicit least privilege, strong audit, export controls, step-up authentication where policy requires |

Rules

1. Never place patient content, access tokens, service keys or database credentials in source control.
2. Logs must use identifiers and event metadata rather than raw clinical content wherever possible.
3. AI requests must carry a classification and source-context manifest; only approved use cases may process sensitive data.
4. Offline/mobile caches must have an explicit classification policy and encryption.
5. Bulk exports require explicit permission and audit evidence.
6. Retention and deletion follow the tenant's approved clinical/legal policy; clinical records are not deleted by ordinary UI actions.
