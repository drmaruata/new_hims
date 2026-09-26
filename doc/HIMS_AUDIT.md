# HIMS Architecture & Requirements Audit

**Date:** 2026-09-25  
**Documents audited:** `PRD.md`, `SRS.md`, `development.md`  
**Status:** Revised baseline after audit

## Executive conclusion

The original three documents had a strong product concept and a credible technology direction, but the departmental scope and cross-module transaction contracts were not explicit enough for a production implementation. The most important corrections are now incorporated into the revised documents.

The resulting architecture is centered on:

- Ten mandatory core HIMS modules: OPD, IPD, LIS, RIS, Emergency, OT, ICU, Pharmacy, EMR and Insurance.
- One tenant-scoped canonical patient identity (UHID) reused across all modules.
- Department/service-aware encounters rather than separate patient masters.
- A canonical cross-module order model.
- NestJS as the business/API layer.
- A managed Supabase Cloud project as the data platform.
- PostgreSQL as the transactional source of truth.
- RLS plus application authorization as defense in depth for multi-tenancy.
- Next.js + React + TypeScript + Tailwind + shadcn/ui for web.
- React Native + Expo for mobile.
- Redis/BullMQ for asynchronous jobs.
- Orthanc/DICOM infrastructure for complete RIS/PACS capability.
- Dedicated interoperability adapters for ABDM/FHIR/HL7/DICOM/NHCX.

## 1. Findings from the audit

### Finding 1 — The ten operational modules needed an explicit contractual scope

**Severity:** High

The documents had more than ten domains because they also included quality, inventory, finance, analytics and other platform capabilities. That is acceptable as architecture, but the exact ten departments/modules requested for the product baseline were not explicitly defined as mandatory scope.

**Corrected:** PRD and SRS now define the ten mandatory core modules and separate them from shared platform capabilities.

### Finding 2 — Registration needed to be department-aware

**Severity:** Critical

The requirement is not simply "patient registration." The registration transaction must identify the department/service being accessed, for example Medicine OPD versus ENT OPD, while the UHID remains constant.

**Corrected:** Department/service-aware encounter requirements were added.

### Finding 3 — One patient identity must not become ten module-specific identities

**Severity:** Critical

The HIMS now explicitly separates patient identity from encounters, admissions, orders, results, dispensing, claims and procedures. EMR is a longitudinal view/domain, not a second patient database.

**Corrected:** Canonical patient/encounter/order ownership rules and acceptance tests were added.

### Finding 4 — Cross-module automation needed to be transactional

**Severity:** Critical

The following are now explicit release requirements:

`OPD prescription → Pharmacy queue`

`IPD medication order → Pharmacy queue`

`IPD lab order → LIS`

`IPD imaging order → RIS`

`IPD ICU transfer → ICU acceptance/bed/movement`

`IPD OT request → OT scheduling`

`LIS result → EMR`

`RIS report → EMR`

`Pharmacy dispensing → Inventory/Billing/EMR linkage`

No routine clinical re-entry is permitted when the source transaction already exists.

### Finding 5 — RIS must be a real RIS, not just an imaging screen

**Severity:** High

The revised scope covers scheduling, accession/study linkage, modality worklists, DICOM/PACS integration, contrast/safety documentation, reporting states, critical findings and amendments.

### Finding 6 — LIS needed full pre-analytical/analytical/post-analytical lifecycle

**Severity:** High

The revised LIS baseline now includes accessioning, barcode/sample management, rejection, aliquots, analyzers, QC, reference ranges, delta checks, technical/clinical validation, critical values, report amendment and auditability.

### Finding 7 — OT needed reverse linkage from IPD

**Severity:** High

The revised documents explicitly require OT scheduling from an authorized IPD patient context and support procedural departments such as Surgery, ENT and Dental without creating specialty-specific forks.

### Finding 8 — ICU transfer from IPD needed a formal state machine

**Severity:** High

The revised documents define ICU transfer as a workflow rather than an informal bed move: request → acceptance → bed assignment → movement → ICU encounter → ICU workflow → step-down/discharge.

### Finding 9 — Insurance needed explicit government + private support

**Severity:** High

The insurance domain now explicitly covers central/state government schemes, PM-JAY where enabled, private payers, eligibility, pre-authorisation, packages, claims, rejections, resubmission, settlement and NHCX integration boundaries.

### Finding 10 — Supabase cannot be treated as the complete backend

**Severity:** Critical

Supabase is now defined as the data platform. NestJS is the canonical business/API layer. The revised architecture prevents direct client-side business writes to PostgreSQL and keeps service-role credentials server-side.

The platform is a managed Supabase Cloud project. Backups, disaster recovery, monitoring, high availability, patching and scalability of the database are Supabase's responsibility; the deployment is responsible for access control, credential management, data residency, and verifying that the project's region and backup retention satisfy the hospital's obligations. Those residual obligations are now explicitly part of the HIMS production architecture.

### Finding 11 — Docker Desktop is for development, not the target hospital runtime

**Severity:** High

Docker Desktop is retained for developer workstations and local integration testing of the application and its supporting services. Production target environments are Linux Docker Engine or an orchestrated platform with persistent storage, secure networking, backups, monitoring and DR, connecting to the managed Supabase Cloud project over an encrypted connection.

### Finding 12 — Current Indian quality and interoperability developments needed to be reflected

**Severity:** High

The documents now explicitly account for:

- NABH Hospital Accreditation Standards, 6th Edition.
- NQAS 2024 materials.
- NHSRC risk-management and HAI-surveillance materials.
- January 2026 integration of LaQshya and MusQan criteria into NQAS for relevant public facilities from 1 April 2026.
- ABDM privacy-by-design, consent and interoperability requirements.
- NHCX claims-exchange boundary.
- DPDP Act/Rules data-governance requirements.

## 2. Recommended production architecture

```text
                           USERS
                             |
                 +-----------+-----------+
                 |                       |
             Next.js Web          React Native/Expo
                 |                       |
                 +-----------+-----------+
                             |
                       HTTPS / WSS
                             |
                      WAF / Reverse Proxy
                             |
                     NestJS Application API
                             |
          +------------------+------------------+
          |                  |                  |
      Core Clinical      Platform         Cross-module
      OPD/IPD/ED/ICU     Tenant/Auth      Orders/Events
      OT/LIS/RIS         RBAC/Audit        Workflow
      Pharmacy/EMR       Documents         Notifications
      Insurance          Configuration     Reconciliation
          |                  |                  |
          +------------------+------------------+
                             |
                    SELF-HOSTED SUPABASE
             PostgreSQL / Auth / Realtime / Storage
                             |
       +----------+----------+----------+-----------+
       |          |          |          |           |
     Redis      Workers    Outbox     Orthanc    Search
    BullMQ                 + Broker     PACS      OpenSearch
       |                     |            |
       +---------------------+------------+
                             |
                   Integration Boundary
             ABDM / FHIR / HL7 / DICOM / NHCX
                             |
                 External hospital ecosystem
```

## 3. Services required outside Supabase

### Essential

- Redis + BullMQ.
- Backup/restore tooling with off-host copies.
- Production observability.
- Secrets management.
- Secure ingress/reverse proxy/firewall.
- PDF/document rendering.
- Orthanc/PACS for complete RIS.
- External messaging/payment services where enabled.

### Strongly recommended

- ClamAV for file-ingestion malware scanning.
- OpenSearch when PostgreSQL search no longer meets operational requirements.
- HAPI FHIR when a dedicated full FHIR server is justified.
- HL7 interface engine where legacy devices/systems require it.
- Vault or a managed secret manager.
- Wazuh or a managed SIEM for mature deployments.

### Optional by deployment

- NATS/Kafka.
- OCR.
- Jitsi or managed video.
- Dedicated analytics warehouse.

## 4. Latest guideline-driven feature additions

The HIMS should additionally ship with structured support for:

- Medication reconciliation.
- High-alert medication controls.
- Clinical prescription audit.
- Clinical/death audit.
- HAI surveillance.
- Risk register and risk-control actions.
- Patient-safety incidents and near misses.
- CAPA effectiveness verification.
- Consent and privacy request workflows.
- Facility-specific quality indicator definitions and evidence.
- Audit-ready immutable clinical records.
- Structured terminology/coding support.
- FHIR/ABDM mapping and profile validation.
- NHCX claim transaction reconciliation.

## 5. Decisions that should become Architecture Decision Records before coding

1. Supabase authentication flow and whether the backend uses JWT-to-Postgres transaction context or another RLS-safe pattern.
2. Shared-cluster tenant isolation versus database-per-tenant criteria for enterprise customers.
3. Exact FHIR release/profile strategy for ABDM/NRCeS and future interoperability.
4. Orthanc deployment and long-term PACS storage strategy.
5. Redis/BullMQ retention and failure/retry policy.
6. Outbox broker threshold for introducing NATS/Kafka.
7. Backup/RPO/RTO tiers.
8. Exact secrets-management solution.
9. Exact messaging/payment vendors.
10. Production Linux topology for the first pilot hospital.

## 6. Final audit verdict

The documents are now substantially closer to an implementation-ready architecture. The largest remaining work is not adding more feature lists; it is converting the requirements into the next engineering artifacts:

`Database schema → API contract → RBAC matrix → workflow/state machines → event catalogue → integration contracts → UI screen map → test traceability matrix → Docker Compose environment → production deployment manifests.`

Those artifacts should be generated directly from the revised PRD, SRS and development blueprint so that the implementation does not drift from the approved architecture.
