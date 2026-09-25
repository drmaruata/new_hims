# HIMS Production Development Blueprint

**Working product name:** TBD  
**Document:** `development.md`  
**Version:** 2.0  
**Date:** 2026-09-25  
**Related documents:** `PRD.md`, `SRS.md`  
**Status:** Production architecture and development roadmap  
**Product name/pricing:** TBD

---

## 1. Purpose

This document defines the production development architecture, engineering standards, repository structure, environments, deployment model, security model, data architecture, frontend architecture, backend architecture, integration architecture, observability strategy, CI/CD model, testing strategy, release strategy, disaster recovery model, and complete development roadmap for the HIMS.

It supplements rather than replaces `PRD.md` and `SRS.md`.

The PRD defines **what the product must accomplish**.

The SRS defines **what the software must do and what constraints it must satisfy**.

This document defines **how the engineering organization should build, operate, scale, test, release, and evolve the system in production**.

---

# 2. Architecture Decision Summary

## 2.1 Recommended frontend strategy

Do **not** use React Native as the frontend technology for the entire product.

Use a two-surface frontend architecture:

1. **Web application:** Next.js + React + TypeScript + Tailwind CSS + **shadcn/ui**.
2. **Mobile applications:** React Native + Expo + TypeScript, with a native mobile implementation of the HIMS design tokens.

The web application is the primary surface for clinicians, nurses, pharmacists, laboratory staff, radiology staff, billing teams, hospital administrators, quality teams and hospital leadership.

The mobile application is the primary surface for patients, doctors on mobile, nurses on mobile workflows, field/ambulance workflows, approval workflows and selected operational tasks.

This separation is deliberate. A hospital HIMS contains dense tables, split views, multi-column forms, data grids, reporting dashboards, keyboard-heavy workflows, printing, document review, large clinical records and administration screens. These are better served by a browser-first desktop/tablet UI than by attempting to make React Native the universal UI framework.

React Native remains the correct choice for the dedicated mobile experience because it allows Android and iOS applications to share most application code while still exposing native device capabilities. The architecture should use Expo SDK 57 / React Native 0.86 as the current baseline, subject to the team's compatibility validation before production lock. Expo SDK 57 was released in June 2026 and targets React Native 0.86; Expo's current documentation also establishes the New Architecture as the direction for current SDKs. [Expo SDK 57](https://expo.dev/sdk/57) [Expo SDK reference](https://docs.expo.dev/versions/latest/) [Expo New Architecture](https://docs.expo.dev/guides/new-architecture/)

The web frontend should use the current supported Next.js major available when implementation begins. The project should pin an exact version in the lockfile and upgrade through an explicit dependency-review process. The UI foundation shall be **shadcn/ui + Tailwind CSS**, with components committed into the repository and evolved as the HIMS Design System. shadcn/ui currently supports Tailwind v4 and React 19, and its data-table guidance is designed to compose with TanStack Table. [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/base/data-table)

## 2.2 Recommended backend strategy

Use **TypeScript + NestJS** for the core backend platform.

Start as a **modular monolith with hard domain boundaries**, not as dozens of microservices.

The backend shall be designed so that domains can later be extracted into independently deployable services without rewriting the domain layer.

This is the recommended sequence:

```text
Phase A
Modular Monolith
      |
      +---- PostgreSQL
      +---- Redis
      +---- Object Storage
      +---- Background Workers
      +---- Event Bus / Outbox
      |
      v
Phase B
Selective Service Extraction
      |
      +---- Integration Gateway
      +---- Notification Service
      +---- Search Service
      +---- Document Service
      +---- AI Gateway
      |
      v
Phase C
Hospital-Scale Distributed Architecture
      |
      +---- Clinical services where justified
      +---- RCM services where justified
      +---- Integration platform
      +---- Analytics platform
```

NestJS is appropriate because it provides explicit modules, providers, dependency injection and encapsulation, which map well to the domain-oriented architecture required here. Its documentation recommends feature modules and controlled module interfaces rather than indiscriminate global dependencies. [NestJS modules](https://docs.nestjs.com/modules)

## 2.3 Database strategy

Use **PostgreSQL 18** as the primary transactional database for new deployments, after validating all required extensions, ORM support and managed-service availability.

PostgreSQL 18 is the current supported major release as of August 2026, with PostgreSQL 17 also supported. Production deployments should use the latest patched minor release of the selected major version. [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/)

Use PostgreSQL for authoritative transactional data. Do not distribute authoritative clinical state across multiple databases merely for architectural fashion.

## 2.4 Primary architectural style

The system shall use:

- Domain-driven modular architecture.
- Clean/hexagonal boundaries where practical.
- REST APIs for most client interaction.
- FHIR-oriented interoperability APIs.
- WebSockets or Server-Sent Events for real-time operational updates.
- Transactional outbox for reliable domain-event publication.
- Background jobs for non-blocking work.
- Object storage for documents and media.
- Search infrastructure for full-text and operational search when PostgreSQL search becomes insufficient.
- Event-driven integration for external systems.
- CQRS only where it solves a demonstrated read/write scaling problem.
- Microservices only where independent scaling, isolation or organizational ownership justifies them.

## 2.5 Deployment baseline

### Primary development/data-platform decision

The project shall use **self-hosted Supabase** as the primary database/auth/realtime/storage platform for development and controlled environments.

The boundary is:

```text
Frontend (Next.js / React Native)
            |
            v
        NestJS API
  business logic + authorization
            |
            +-----------------------------+
            |                             |
            v                             v
   Self-hosted Supabase              Supporting services
   PostgreSQL/Auth/Realtime/Storage  Redis/Workers/PACS/Search/etc.
```

Supabase is the platform layer, not the complete HIMS backend. NestJS remains the authoritative business/API layer.

### Docker Desktop vs production

Docker Desktop is recommended for:

- developer laptops
- local Supabase stack
- local Redis/workers
- local PACS/LIS/RIS simulators
- integration testing
- UI/API development

Docker Desktop is **not** the target production runtime for a hospital. Production should use Linux Docker Engine or a container orchestrator. Supabase's current self-hosting guidance explicitly states that self-hosting transfers server provisioning, security hardening, backups, DR, monitoring, HA and scalability responsibilities to the operator. (https://supabase.com/docs/guides/self-hosting)

### Production deployment tiers

**Tier 1 — Development:** Docker Desktop + Compose.

**Tier 2 — Pilot hospital:** Linux server(s) + Docker Compose, persistent PostgreSQL/Storage volumes, off-host backups, TLS, monitoring and secure LAN integration.

**Tier 3 — Multi-hospital SaaS:** Kubernetes or managed container platform, HA PostgreSQL strategy, replicated object storage, Redis HA, centralized observability and controlled service extraction.

**Tier 4 — Enterprise dedicated:** Dedicated tenant deployment with dedicated database/object storage/keys and optional customer-controlled infrastructure.

The application code and domain boundaries must remain common across tiers.

---

# 3. Product Architecture Principles

The following principles are mandatory unless an architecture decision record explicitly overrides them.

## 3.1 Patient identity is foundational

Every clinical, financial, operational and communication workflow must resolve to a canonical patient identity.

The system must not permit independent patient records to silently emerge in OPD, IPD, laboratory, pharmacy and billing modules.

## 3.2 Domain ownership is explicit

Every table, service, API and business rule must have a clear domain owner.

Examples:

- Patient identity belongs to Patient 360.
- Bed state belongs to Bed Management.
- Medication administration belongs to Nursing/Medication Administration.
- Invoice state belongs to Billing/RCM.
- CAPA state belongs to Quality.

Cross-domain operations happen through explicit application interfaces or domain events.

## 3.3 Clinical safety over convenience

A clinically dangerous shortcut is not acceptable merely because it produces a faster UI.

Clinical workflows must prioritize:

- identity confirmation
- allergy visibility
- medication safety
- order verification
- result acknowledgement
- critical-value escalation
- auditability
- provenance
- role separation
- human override with reason capture

## 3.4 Immutable clinical history

Once a clinical event has been finalized, the system must not silently overwrite its historical meaning.

Corrections must create traceable amendments.

For example:

```text
Original prescription
      |
      v
Correction requested
      |
      v
Authorized correction
      |
      +---- Original retained
      +---- New version created
      +---- Reason stored
      +---- Actor stored
      +---- Timestamp stored
```

## 3.5 Configuration over forks

Hospitals must be configurable without creating customer-specific source-code branches.

Configuration should cover:

- departments
- locations
- wards
- beds
- appointment rules
- billing rules
- tax configuration
- payer contracts
- lab catalogues
- formularies
- clinical templates
- quality indicators
- approval matrices
- notification templates
- working hours
- escalation rules
- branding

## 3.6 Standards at the boundary

Internal domain models should be optimized for the product's workflow and usability.

External interoperability contracts should use standards wherever applicable.

FHIR is an interoperability model containing healthcare resources and APIs; the architecture should therefore maintain an explicit mapping layer between internal domain entities and FHIR resources instead of making the database schema itself a literal FHIR resource store. [HL7 FHIR R4 overview](https://hl7.org/fhir/R4/overview-arch.html)

---

# 4. High-Level System Architecture

```text
                         ┌──────────────────────────────┐
                         │          USERS                │
                         │ Patient / Doctor / Nurse /   │
                         │ Lab / Radiology / Pharmacy / │
                         │ Billing / Admin / Quality    │
                         └──────────────┬───────────────┘
                                        │
                         ┌──────────────▼───────────────┐
                         │          FRONTENDS            │
                         │ Next.js Web + React Native   │
                         │ Expo Mobile + Kiosk optional │
                         │ Tailwind + shadcn/ui (web)   │
                         └──────────────┬───────────────┘
                                        │ HTTPS/WebSocket
                              ┌─────────▼─────────┐
                              │ Edge / WAF /      │
                              │ Reverse Proxy     │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ NestJS API / BFF  │
                              │ Canonical business│
                              │ API + AuthZ       │
                              └─────────┬─────────┘
                                        │
       ┌────────────────────────────────┼────────────────────────────────┐
       │                                │                                │
┌──────▼──────┐                 ┌───────▼────────┐               ┌──────▼─────┐
│  CORE       │                 │  CROSS-MODULE  │               │ PLATFORM   │
│  CLINICAL   │                 │  ORCHESTRATION │               │ SERVICES   │
│             │                 │                │               │            │
│ OPD         │                 │ Orders         │               │ Tenant     │
│ IPD         │                 │ Patient 360    │               │ Auth       │
│ Emergency   │                 │ Encounter      │               │ RBAC/ABAC  │
│ ICU         │                 │ Medication     │               │ Audit      │
│ OT          │                 │ Notifications  │               │ Documents  │
│ LIS         │                 │ Workflow       │               │ Config     │
│ RIS         │                 │ Billing links  │               │ FeatureFlag│
│ Pharmacy    │                 │ Events         │               │            │
│ Insurance   │                 │ Reconciliation │               │            │
│ EMR         │                 │                │               │            │
└──────┬──────┘                 └───────┬────────┘               └──────┬─────┘
       │                                │                                │
       └────────────────────────────────┼────────────────────────────────┘
                                        │
                  ┌─────────────────────▼──────────────────────┐
                  │            SELF-HOSTED SUPABASE             │
                  │ PostgreSQL | Auth | Realtime | Storage    │
                  └─────────────────────┬──────────────────────┘
                                        │
             ┌──────────────────────────┼─────────────────────────────┐
             │                          │                             │
       ┌─────▼──────┐             ┌─────▼─────┐                ┌──────▼─────┐
       │ Redis      │             │ Workers   │                │ Outbox     │
       │ cache/lock│             │ BullMQ    │                │ + Broker   │
       └────────────┘             └─────┬─────┘                │ NATS/Kafka │
                                       │                       └──────┬─────┘
                                       │                              │
          ┌────────────────────────────┼──────────────────────────────┼─────────┐
          │                            │                              │         │
     Notifications                Interoperability                Search    AI/BI
     SMS/WhatsApp/                 ABDM/FHIR/HL7/DICOM             OpenSearch Analytics
     Email/Push                    PACS / Payers                    later   warehouse

```

### Critical architectural rule

The same patient transaction is never copied independently into every module. Modules maintain their domain records and foreign-key/reference relationships back to the canonical patient/encounter/order model. EMR is a longitudinal presentation and document/clinical-record domain; it is not a second patient database.


# 4A. Supabase Service Boundary and Supporting Stack

Supabase currently consists of PostgreSQL plus services including Auth, PostgREST, Realtime and Storage. The official self-hosting guidance also makes clear that self-hosted operators assume responsibility for security, backups, monitoring, availability and scaling. (https://supabase.com/docs/guides/self-hosting)

| Capability | Supabase | Additional service | Deployment recommendation |
|---|---|---|---|
| PostgreSQL | Yes | — | Docker development; Linux production; HA later |
| Auth/JWT | Yes | Enterprise IdP optional | Supabase Auth; optional OIDC/SSO later |
| REST API | Yes | NestJS | PostgREST only for controlled data access; NestJS canonical business API |
| Realtime | Yes | — | UI subscriptions; not durable event transport |
| Object storage | Yes | MinIO/S3 preferred for durable large-scale storage as needed | Supabase Storage + durable S3-compatible backend |
| Background jobs | No | Redis + BullMQ | Docker/Kubernetes |
| Event broker | No durable broker built for all HIMS needs | NATS/Kafka later | Add after outbox-driven modular-monolith stage |
| Search | PostgreSQL search | OpenSearch later | Docker/Kubernetes/managed |
| PACS | No | Orthanc | Docker/Kubernetes |
| DICOMweb | No | Orthanc / DICOM gateway | Docker/Kubernetes |
| FHIR server | No dedicated full server | HAPI FHIR optional | Docker/Kubernetes |
| HL7 interface engine | No | Approved interface engine | Docker/Kubernetes |
| PDF generation | No complete renderer | Gotenberg | Docker |
| OCR | No | Tesseract optional | Docker |
| Malware scanning | No | ClamAV | Docker |
| Secrets | No enterprise vault equivalent assumed | Vault / cloud secrets manager | Docker or managed |
| Metrics/traces/logs | Not sufficient as full production observability platform | OTel + Prometheus/Grafana/Loki/Tempo | Docker/Kubernetes/managed |
| Backup/DR | Self-host operator responsibility | pgBackRest + off-host storage | Linux production |
| WAF/edge | No full internet edge stack | Nginx/Traefik + cloud WAF as applicable | Docker/cloud |
| Email/SMS/WhatsApp | No | External providers | Managed API services |
| Payments | No | Razorpay/PayU/etc. | Managed |
| Push | No | FCM/APNs | Managed |
| Video | No | Jitsi / managed provider | Docker or managed |
| SIEM | No | Wazuh / managed SIEM | Later production maturity |

### RLS and tenant context

Supabase PostgreSQL RLS is a defense-in-depth control. Every exposed tenant-owned table shall enable RLS. Authorization data must not be taken from user-editable `user_metadata`; authorization claims may use controlled server-side application metadata or, preferably for detailed HIMS authorization, database-backed role/scope tables. The Supabase documentation states that `service_role` bypasses RLS and must remain server-side; the application must therefore never expose that credential to web or mobile clients. (https://supabase.com/docs/guides/database/postgres/row-level-security)

NestJS request handling shall establish tenant/facility context transactionally before accessing tenant data. Pooled connections must never retain another request's tenant context.


---

# 4B. Local Docker Desktop Development Stack

The local development environment shall model the production boundaries without requiring cloud services.

```text
Docker Desktop
┌─────────────────────────────────────────────────────────────────────┐
│ hims-dev network                                                   │
│                                                                     │
│  Next.js web            NestJS API              Worker              │
│       │                     │                     │                 │
│       └──────────────┬──────┴──────────────┬──────┘                 │
│                      │                     │                        │
│                Supabase gateway      Redis + BullMQ                │
│                      │                     │                        │
│                PostgreSQL 18             Outbox                     │
│                Auth / Storage /        + event jobs                 │
│                Realtime                                              │
│                                                                     │
│  Orthanc(PACS)  Gotenberg(PDF)  ClamAV  Mailpit  optional OpenSearch│
└─────────────────────────────────────────────────────────────────────┘
```

Recommended local services:

- `supabase` — self-hosted Supabase Compose stack.
- `api` — NestJS backend.
- `worker` — BullMQ worker process.
- `redis` — cache/queue/locks.
- `orthanc` — PACS/DICOM simulator/edge PACS for RIS development.
- `gotenberg` — deterministic PDF document rendering.
- `clamav` — malware scan pipeline.
- `mailpit` — safe local email testing.
- `opensearch` — optional local profile, enabled when search features require it.
- `otel/prometheus/grafana/loki/tempo` — optional observability profile.

Local development may use Docker Desktop, but production persistent storage must not depend on a developer workstation filesystem.

---

# 4C. Production Hospital Network Topology

For a hospital with local diagnostic devices, printers and intermittent external connectivity:

```text
                    INTERNET
                       │
               Cloud WAF / Firewall
                       │
               Reverse Proxy / LB
                 ┌─────┴─────┐
                 │           │
               Web          API
                 │           │
                 └─────┬─────┘
                       │
                 NestJS Platform
                       │
          ┌────────────┼────────────┐
          │            │            │
       Supabase      Redis       Workers
          │            │            │
      PostgreSQL    Queues       Integrations
          │                         │
          └─────────────┬───────────┘
                        │
                 Secure Edge Connector
                        │
              ┌─────────┼─────────┐
              │         │         │
             LIS      PACS      Printers/
           analyzers  DICOM      scanners
```

The hospital edge connector is a controlled integration boundary. It should not maintain an uncontrolled shadow HIMS database. Local queues may exist for device communication and short-lived resilience, but authoritative clinical state remains in the HIMS data plane according to the deployment's offline strategy.

---

# 4D. Canonical Data Ownership Model

The following objects have one authoritative owner:

| Object | Owner | Consumers |
|---|---|---|
| Patient/UHID | Patient/MPI | All modules |
| Encounter | Clinical/Encounter | OPD/IPD/Emergency/ICU/OT/LIS/RIS/Pharmacy/Billing |
| Department | Organization/Configuration | OPD/IPD/OT/LIS/RIS/Reporting |
| Bed state | IPD/Bed | IPD/ICU/Emergency/Command Center |
| Medication order | Clinical/Medication | Pharmacy/MAR/EMR/Billing as configured |
| MAR event | Nursing/Medication Administration | EMR/Quality/Clinical review |
| Lab order | Clinical/Orders | LIS |
| Lab result | LIS | EMR/Clinical/Billing where configured |
| Imaging order | Clinical/Orders | RIS |
| Imaging study/report | RIS | EMR/Clinical/Billing where configured |
| Surgery case | OT | IPD/OPD/Inventory/Pharmacy/Insurance/Billing/EMR |
| Dispensing | Pharmacy | Inventory/Billing/EMR |
| Claim | Insurance/RCM | Billing/Finance/External payer |

The EMR must consume authoritative source events and assemble a longitudinal view. It must not become a second source of truth for laboratory, radiology, pharmacy or OT transactions.

---

# 5. Frontend Architecture

## 5.1 Frontend applications

The monorepo shall contain at least these applications:

```text
apps/
  web/
  patient-mobile/
  clinician-mobile/
  kiosk/                  # optional later
  admin-console/          # may initially be part of web
```

The preferred strategy is one web application with route-level role experiences rather than separate web applications for every role.

## 5.2 Web technology stack

Recommended:

- Next.js 16.x line, pinned to a validated patch.
- React.
- TypeScript with strict mode.
- TanStack Query for server-state synchronization.
- React Hook Form for complex forms.
- Zod for runtime validation.
- **shadcn/ui as the source-owned component foundation**, configured once and committed to the repository.
- A proprietary HIMS Design System layered above shadcn/ui for clinical and operational components.
- TanStack Table-based data-grid patterns suitable for clinical and operational workloads.
- Charting library with controlled rendering.
- Playwright for end-to-end testing.
- Vitest for unit/component-level testing.

## 5.3 Web rendering policy

Do not render the entire HIMS as static server-rendered pages.

Recommended rendering patterns:

- Server components for page shells, metadata and low-interactivity content.
- Client components for interactive clinical workflows.
- Client-side cached queries for rapidly changing operational boards.
- Server actions only where their security and operational characteristics are clearly understood; REST APIs remain the canonical application API.

## 5.4 Web application layers

```text
Presentation
  |
  +---- Pages / Routes
  +---- Layouts
  +---- Workbench screens
  +---- Modal / Drawer workflows
  |
UI / Interaction
  |
  +---- Design system
  +---- Form controls
  +---- Tables
  +---- Clinical widgets
  +---- Charts
  |
Application
  |
  +---- Query hooks
  +---- Mutation hooks
  +---- Command handlers
  +---- Local workflow state
  |
API
  |
  +---- Typed API client
  +---- Authentication
  +---- Error normalization
  +---- Pagination
  +---- Retry policy
  +---- Request correlation
```

## 5.5 Role-based workbenches

The web application should not expose the same navigation to every user.

Primary workbenches:

### Reception Workbench

- appointment queue
- patient search
- new registration
- insurance details
- payment status
- token management

### Doctor Workbench

- today's patients
- patient 360
- encounter timeline
- notes
- vitals
- allergies
- medications
- orders
- investigations
- prescriptions
- follow-up
- AI clinical assistance

### Nursing Workbench

- ward board
- patient acuity
- medication schedule
- vitals
- nursing tasks
- intake/output
- escalation
- handover

### Laboratory Workbench

- sample collection
- accession queue
- analyser status
- pending results
- abnormal results
- critical values
- verification

### Radiology Workbench

- modality schedule
- worklist
- study status
- reporting
- report verification
- PACS launch

### Pharmacy Workbench

- prescription queue
- dispensing
- substitution rules
- stock
- expiry
- purchase
- returns
- recalls

### Billing/RCM Workbench

- charges
- estimates
- invoices
- authorizations
- claims
- rejections
- collections
- ageing

### Quality Workbench

- indicator dashboard
- incidents
- RCA
- CAPA
- audits
- infection surveillance
- accreditation evidence

### Executive Command Center

- occupancy
- OPD volume
- ED status
- ICU status
- OT status
- revenue
- claims
- quality
- alerts
- staffing

## 5.6 Frontend state model

State should be divided into:

1. **Server state:** data fetched from backend.
2. **UI state:** dialogs, tabs, filters, local preferences.
3. **Workflow state:** multi-step transactional interaction.
4. **Offline state:** explicitly synchronized mobile data only.

Do not place all application state in a single global store.

## 5.7 Clinical form architecture

Every high-risk clinical form should support:

- autosave where clinically appropriate
- explicit finalization
- versioning
- amendment
- validation
- warnings
- mandatory-field rules
- accessibility
- keyboard navigation
- timestamp
- author
- facility/location context
- encounter context

## 5.8 Date/time handling

The frontend must never directly render raw JavaScript `Date` objects.

All API dates must be converted into presentation-safe values through a shared date/time layer.

Store timestamps in UTC.

Convert to facility/user timezone only at the presentation boundary.

Use explicit date-only types for clinical dates where time is not clinically meaningful.

This rule prevents errors such as React attempting to render a native Date object as a child.

---

# 6. React Native / Mobile Architecture

## 6.1 Why React Native

React Native is appropriate for:

- patient mobile app
- doctor mobile app
- selected nurse workflows
- field/ambulance workflows
- task approvals
- push notifications
- barcode scanning
- document capture
- device camera use
- biometric login where allowed
- offline-first operational tasks

Expo SDK 57 should be the initial baseline, using React Native 0.86 and the New Architecture. The precise Expo patch should be pinned after dependency compatibility testing. [Expo SDK 57](https://expo.dev/sdk/57)

## 6.2 Mobile app structure

Use Expo Router.

```text
apps/clinician-mobile/
  app/
    (auth)/
    (protected)/
      dashboard/
      patients/
      encounters/
      tasks/
      notifications/
      approvals/
    settings/
  src/
    features/
    components/
    api/
    stores/
    offline/
    sync/
    security/
    hooks/
    utils/
```

## 6.3 Mobile apps should share a package layer

```text
packages/
  design-system/
  api-client/
  domain-types/
  validation/
  auth-client/
  localization/
  date-time/
  telemetry/
```

## 6.4 Patient app features

Initial production target:

- login
- patient identity
- appointments
- queue status
- prescriptions
- lab results
- invoices
- payments
- discharge documents
- follow-up reminders
- communication preferences
- family members
- consent flows
- ABHA integration entry points
- teleconsultation entry point

## 6.5 Clinician app features

Initial production target:

- today's schedule
- patient search
- patient snapshot
- encounter list
- results
- notifications
- pending approvals
- emergency alerts
- secure messaging where implemented
- voice-to-text assistance where validated

## 6.6 Mobile offline policy

Offline access is not unrestricted.

Clinical data must be classified into:

```text
Class A: Never cache offline
Highly sensitive / high-risk live state

Class B: Restricted offline
Data required for short workflow continuity

Class C: Offline-safe
Reference data and non-sensitive task metadata
```

Offline clinical data must be:

- encrypted at rest
- encrypted on device
- expiring according to policy
- remotely revocable where possible
- logged
- synchronized with conflict handling

Do not build generic offline synchronization for every entity during early development.

---

# 7. Backend Architecture

## 7.1 Backend style

The backend shall begin as a modular NestJS application.

```text
apps/api/
  src/
    main.ts
    app.module.ts
    config/
    core/
    modules/
```

The backend modules must map to domains rather than controllers.

## 7.2 Domain modules

Recommended module boundaries:

```text
platform
  auth
  authorization
  tenant
  facility
  configuration
  audit
  notifications
  documents
  search

clinical
  patient
  practitioner
  encounter
  emr
  orders
  medication
  care-plan
  nursing
  icu
  emergency
  ot
  lab
  radiology

operations
  appointment
  queue
  bed
  inventory
  procurement
  asset
  housekeeping
  ambulance

financial
  pricing
  billing
  payments
  insurance
  tpa
  claims
  revenue-cycle
  finance

quality
  indicator
  incident
  rca
  capa
  audit
  infection-control
  accreditation

engagement
  patient-portal
  telemedicine
  communication

interoperability
  abdm
  fhir
  hl7
  dicom
  external-systems

intelligence
  analytics
  ai
  recommendations
```

## 7.3 Module internal structure

Each major domain should use a consistent internal structure:

```text
patient/
  domain/
    entities/
    value-objects/
    services/
    policies/
    events/
  application/
    commands/
    queries/
    handlers/
    dto/
  infrastructure/
    persistence/
    mappers/
    repositories/
  interfaces/
    http/
    events/
```

Not every module needs every folder. The pattern exists to preserve separation between domain logic, application orchestration and infrastructure.

## 7.4 Domain entities vs database models

Do not make ORM models the domain model.

Prefer:

```text
HTTP DTO
   |
   v
Application Command
   |
   v
Domain Model
   |
   v
Repository Interface
   |
   v
Infrastructure Repository
   |
   v
PostgreSQL
```

This makes future service extraction substantially easier.

---

# 8. Backend Service Boundaries

## 8.1 Core API service

Initially contains most business domains.

Responsibilities:

- authentication integration
- authorization
- clinical workflows
- operational workflows
- financial workflows
- quality workflows
- configuration
- transactional business rules

## 8.2 Worker service

Separate process from day one.

Responsibilities:

- report generation
- notification sending
- document processing
- data export
- scheduled reminders
- asynchronous integration calls
- bulk imports
- analytics ingestion
- non-critical AI tasks

## 8.3 Integration gateway

Can begin inside the worker/runtime but should have a clear boundary.

Responsibilities:

- ABDM communication
- payer APIs
- SMS providers
- WhatsApp provider
- email provider
- payment gateway
- accounting/ERP
- LIS devices
- PACS
- external HIMS migration

## 8.4 AI gateway

All AI functionality must go through a controlled internal AI gateway.

No frontend should directly call a third-party LLM API.

The AI gateway handles:

- model selection
- prompt templates
- data minimization
- authorization
- redaction
- tool permissions
- logging
- safety policy
- model fallback
- usage tracking
- cost tracking
- human-review thresholds

---

# 9. API Architecture

## 9.1 API strategy

Use versioned REST APIs:

```text
/api/v1/auth
/api/v1/patients
/api/v1/encounters
/api/v1/appointments
/api/v1/orders
/api/v1/lab
/api/v1/radiology
/api/v1/pharmacy
/api/v1/billing
/api/v1/claims
/api/v1/quality
/api/v1/integrations
```

FHIR APIs should be separately namespaced or exposed through a dedicated interoperability gateway rather than mixing internal API contracts with external standards contracts.

Example:

```text
/api/v1/patients
/api/v1/encounters

/fhir/r4/Patient
/fhir/r4/Observation
/fhir/r4/Encounter
```

## 9.2 API requirements

Every API must define:

- authentication requirement
- authorization policy
- request schema
- response schema
- validation rules
- idempotency behaviour
- audit requirement
- rate-limit policy
- error codes
- pagination rules
- correlation ID
- tenant/facility context

## 9.3 Idempotency

All commands that may be retried must support idempotency where appropriate.

Examples:

- payment creation
- invoice generation
- prescription submission
- claim submission
- notification dispatch
- ABDM transaction initiation

Use an `Idempotency-Key` header for externally retryable operations.

## 9.4 API error contract

Standard format:

```json
{
  "error": {
    "code": "PATIENT_DUPLICATE_POSSIBLE",
    "message": "A similar patient record requires review.",
    "details": [],
    "correlationId": "01J..."
  }
}
```

Do not expose internal stack traces to clients.

## 9.5 Pagination

Use cursor pagination for high-volume operational lists where practical.

Offset pagination is permitted for small administrative tables.

---

# 10. Database Architecture

## 10.1 Primary database

PostgreSQL 18.

## 10.2 Database organization

Use one primary database cluster per environment for the modular monolith, with domain-oriented schemas only when they improve access control and ownership.

Preferred starting model:

```text
public / application schema
  |
  +---- tenant / identity
  +---- clinical
  +---- operational
  +---- financial
  +---- quality
  +---- integration
  +---- audit
```

Do not create a separate database for every module in the initial architecture.

## 10.3 Tenant isolation

Every tenant-owned row must carry a tenant context.

Recommended layers:

1. Application-level tenant enforcement.
2. Repository-level tenant predicates.
3. PostgreSQL Row-Level Security for defense in depth on sensitive multi-tenant tables.
4. Automated tests verifying cross-tenant access denial.

## 10.4 Facility hierarchy

Recommended hierarchy:

```text
Tenant
  |
  +---- Organization Group
          |
          +---- Facility
                 |
                 +---- Building
                        |
                        +---- Floor
                               |
                               +---- Department
                                      |
                                      +---- Ward / Clinic / Room
                                             |
                                             +---- Bed / Resource
```

## 10.5 Audit columns

Operational entities should generally include:

- `id`
- `tenant_id`
- `facility_id` where relevant
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`
- `version`
- `deleted_at` only where soft deletion is permitted

Clinical final records should additionally include explicit author/finalizer metadata where relevant.

## 10.6 Soft deletion

Do not use generic soft deletion for clinical records merely to make UI deletion possible.

Each domain must classify records as:

- immutable historical
- amendable/versioned
- deactivatable
- deletable

The data lifecycle policy shall be domain-specific.

## 10.7 Transaction boundaries

Critical workflows must complete atomically.

Example admission:

```text
BEGIN
  validate patient
  validate bed
  create encounter
  create admission
  assign bed
  update bed state
  write audit event
  write domain event to outbox
COMMIT
```

External calls must not be made inside long database transactions.

---

# 11. Core Data Domains

## 11.1 Identity domain

Core tables/entities:

- Patient
- PatientIdentifier
- ABHAIdentifier
- PatientMergeCase
- PatientConsent
- PatientContact
- RelatedPerson
- Practitioner
- Staff
- Organization
- Facility
- Location

## 11.2 Clinical domain

- Encounter
- ClinicalNote
- Diagnosis
- Problem
- Allergy
- Medication
- MedicationOrder
- MedicationAdministration
- Procedure
- CarePlan
- Goal
- ClinicalObservation
- VitalObservation
- ServiceRequest
- DiagnosticReport
- ClinicalDocument

## 11.3 Operational domain

- Appointment
- QueueToken
- Bed
- BedAssignment
- Ward
- OperatingRoom
- SurgeryCase
- NursingTask
- HousekeepingTask
- Asset
- MaintenanceTicket
- InventoryItem
- StockLot
- StockTransaction
- PurchaseOrder
- GoodsReceipt

## 11.4 Financial domain

- PriceList
- Charge
- Invoice
- InvoiceLine
- Payment
- Refund
- Payer
- InsurancePolicy
- Authorization
- Claim
- ClaimLine
- Remittance
- Adjustment
- Account

## 11.5 Quality domain

- QualityIndicator
- IndicatorMeasurement
- Incident
- Investigation
- RootCause
- CAPA
- Audit
- AuditFinding
- Evidence
- InfectionCase
- InfectionEvent

---

# 12. Canonical Patient Record Architecture

Patient 360 must not be an independent denormalized copy of the hospital database.

It is a read-optimized aggregation of domain data.

```text
Patient ID
    |
    +---- Identity
    +---- ABHA
    +---- Allergies
    +---- Problems
    +---- Medications
    +---- Encounters
    +---- Admissions
    +---- Investigations
    +---- Imaging
    +---- Procedures
    +---- Prescriptions
    +---- Bills
    +---- Claims
    +---- Documents
    +---- Consent
    +---- Communication
```

The backend should provide a Patient 360 query service that composes authoritative domain sources.

For very high-volume environments, maintain a projection/read model for Patient 360 rather than executing many joins on every screen load.

---

# 13. Event-Driven Architecture

## 13.1 Domain events

Examples:

```text
PatientRegistered
PatientMerged
AppointmentBooked
AppointmentCheckedIn
EncounterStarted
EncounterFinalized
OrderCreated
SampleCollected
ResultVerified
CriticalResultRaised
PrescriptionSigned
MedicationDispensed
AdmissionCreated
BedAssigned
TransferCompleted
DischargeStarted
DischargeCompleted
InvoiceFinalized
PaymentCaptured
ClaimSubmitted
ClaimRejected
IncidentReported
CAPACreated
```

## 13.2 Transactional outbox

For any transaction that changes authoritative business state and needs asynchronous downstream effects:

```text
Business Transaction
       |
       +---- Domain state change
       |
       +---- Outbox row
       |
       v
Transaction commits
       |
       v
Outbox publisher
       |
       v
Event bus
       |
       +---- Notifications
       +---- Search
       +---- Analytics
       +---- Integration
       +---- AI triggers
```

Do not publish directly to a message broker before committing the database transaction.

## 13.3 Messaging technology

Initial implementation may use:

- PostgreSQL outbox
- Redis/BullMQ for background jobs

As throughput and integration complexity grow, introduce a durable broker such as Kafka or NATS according to the workload.

Do not introduce Kafka solely because the product has many modules.

---

# 14. Real-Time Architecture

Real-time data is necessary for:

- queue boards
- ED triage
- bed status
- ICU alerts
- OT board
- lab critical results
- pharmacy dispensing status
- claim processing state
- command center dashboards

Recommended architecture:

```text
Domain event
   |
   v
Event handler
   |
   v
Realtime publisher
   |
   v
WebSocket gateway / SSE
   |
   +---- Web
   +---- Mobile
```

The realtime channel is never the source of truth.

Clients must be able to resynchronize from the API after connection loss.

---

# 15. Authentication Architecture

## 15.1 Identity provider

Use a standards-based identity provider supporting:

- OpenID Connect
- OAuth 2.0
- MFA
- SSO where required
- session/device management
- password policies
- account recovery

Enterprise customers should eventually be able to integrate their identity provider through OIDC/SAML where appropriate.

## 15.2 Authentication factors

Support configurable:

- password
- OTP
- authenticator application
- biometric unlock on mobile
- enterprise SSO

Never use SMS OTP as the only authentication mechanism for privileged administrative roles where stronger alternatives are practical.

## 15.3 Access token model

Prefer short-lived access tokens with refresh-token rotation.

Sensitive actions may require step-up authentication.

Examples:

- break-glass access
- high-value refund
- user privilege escalation
- bulk data export
- irreversible configuration change

---

# 16. Authorization Architecture

Use a hybrid model:

```text
RBAC
  +
ABAC
  +
Contextual clinical policy
```

RBAC answers:

> What can this role normally do?

ABAC answers:

> Under which facility, department, encounter, patient relationship, shift and context can the action occur?

Example:

```text
Doctor
  |
  +---- Facility A
  +---- Department Cardiology
  +---- Active encounter
  +---- Treating relationship
        |
        +---- Read clinical record
        +---- Write encounter note
        +---- Prescribe
```

A doctor should not automatically access every patient record merely because the role has clinical permissions.

---

# 17. Break-Glass Access

Emergency access must be explicit.

Workflow:

```text
User requests restricted patient record
        |
        v
Reason required
        |
        v
Break-glass permission granted
        |
        v
Access logged at elevated severity
        |
        v
Security / compliance review queue
```

The system must capture:

- actor
- patient
- reason
- timestamp
- facility
- device/session
- resources accessed
- duration where applicable

---

# 18. Document Architecture

Documents include:

- prescriptions
- lab reports
- radiology reports
- discharge summaries
- consent forms
- invoices
- claim documents
- accreditation evidence
- scanned identity documents

## 18.1 Storage

Binary files belong in object storage, not PostgreSQL large-object fields in normal operation.

PostgreSQL stores:

- document metadata
- version
- object key
- content type
- checksum
- author
- patient/encounter association
- retention classification

## 18.2 Document processing pipeline

```text
Upload
  |
  v
Virus / malware scan
  |
  v
Metadata validation
  |
  v
Object storage
  |
  +---- OCR if permitted
  +---- thumbnail
  +---- text extraction
  +---- classification
  |
  v
Audit event
```

## 18.3 Document immutability

Final clinical documents must be versioned.

Any amendment must preserve the original version.

---

# 19. Search Architecture

Initial phase:

- PostgreSQL full-text search
- indexed identifiers
- trigram matching where appropriate

Scale phase:

- OpenSearch or equivalent search engine

Search use cases:

- patient lookup
- practitioner lookup
- medicine search
- diagnosis search
- lab test search
- claims
- incidents
- audit evidence

Patient search must use carefully controlled fuzzy matching to avoid returning the wrong patient's record.

Potential matches must show enough identifiers for safe human confirmation.

---

# 20. Integration Architecture

## 20.1 Integration gateway

```text
                 Integration Gateway
                         |
       +-----------------+-----------------+
       |        |        |        |        |
     ABDM     FHIR     HL7      DICOM    Payers
       |        |        |        |        |
     UHI      HIE     LIS/EMS   PACS     Claims
```

## 20.2 FHIR strategy
### FHIR version compatibility

Use an adapter/profiling layer so the core domain model is not coupled to one external FHIR release. The generic HL7 published specification is currently R5, but ABDM/NRCeS integration must follow the FHIR release and India-specific profiles required by the applicable ABDM production contract. The system should therefore maintain a validated ABDM-compatible FHIR profile layer and permit future R5/R6 interoperability without rewriting core clinical modules.


FHIR should be an external interoperability representation.

The integration layer should provide mapping functions:

```text
Internal Patient
       |
       v
FHIR Patient
```

and reverse transformations when receiving external data.

The system should initially prioritize the FHIR resources required by product integrations, then broaden coverage.

Common resources anticipated:

- Patient
- Practitioner
- Organization
- Location
- Encounter
- Observation
- Condition
- AllergyIntolerance
- MedicationRequest
- Medication
- ServiceRequest
- DiagnosticReport
- Procedure
- CarePlan
- DocumentReference
- Consent
- Provenance
- AuditEvent

HL7's FHIR specification defines resources and APIs intended for interoperability, including security, consent, provenance and audit concepts. [HL7 FHIR R4](https://www.hl7.org/fhir/R4/)

## 20.3 ABDM adapter

The ABDM adapter must isolate ABDM-specific protocols from core business logic.

```text
Core Domain
   |
   v
ABDM Application Adapter
   |
   v
ABDM Protocol Client
   |
   v
External ABDM APIs
```

Store external transaction identifiers and statuses.

Never use the external system's status as the only representation of internal workflow state.

## 20.4 HL7 integration

The integration platform should support HL7 v2 message handling where required by legacy devices and hospital systems.

Support must include:

- parsing
- validation
- message acknowledgements
- mapping
- retry
- dead-letter handling
- replay
- message audit

## 20.5 DICOM/PACS integration

Radiology must integrate with PACS using DICOM and/or DICOMweb according to the hospital environment.

Do not store large imaging studies directly in the HIMS database.

Store identifiers and launch information while relying on PACS/VNA for imaging storage where deployed.

---

# 21. Notification Architecture

Channels:

- SMS
- WhatsApp
- email
- push notification
- in-app notification

Notification pipeline:

```text
Domain Event
    |
    v
Notification Rule Engine
    |
    v
Template Resolver
    |
    v
Channel Router
    |
    +---- SMS provider
    +---- WhatsApp provider
    +---- Email provider
    +---- Push provider
```

Notifications must support:

- template versioning
- localization
- consent/preferences
- retry
- provider failover where appropriate
- delivery status
- rate limiting
- audit trail

---

# 22. Workflow Automation Engine

This is a strategic differentiator.

The system should provide configuration-driven hospital workflow automation.

Examples:

```text
Trigger:
Discharge finalized

Actions:
1. Generate discharge packet
2. Notify billing
3. Notify pharmacy
4. Create housekeeping task
5. Change bed state to cleaning
6. Schedule follow-up notification
7. Send patient satisfaction message
```

## 22.1 Architecture

```text
Event / Trigger
      |
      v
Rule evaluator
      |
      v
Workflow definition
      |
      +---- Task
      +---- Notification
      +---- Integration
      +---- Approval
      +---- Document
      +---- Data update
```

## 22.2 Safety

Clinical automation must be constrained.

The engine must distinguish:

- informational automation
- operational automation
- financial automation
- clinical-support automation
- high-risk clinical actions requiring human authorization

The workflow engine must never autonomously issue a high-risk clinical order without a separately approved and validated clinical governance process.

---

# 23. AI Architecture

## 23.1 AI is an internal platform capability

Use an AI gateway rather than embedding model calls into individual modules.

```text
HIMS Domain
   |
   v
AI Use Case Service
   |
   v
AI Gateway
   |
   +---- Policy / authorization
   +---- Redaction
   +---- Prompt assembly
   +---- Model routing
   +---- Tool permission
   +---- Output validation
   |
   +---- Model provider A
   +---- Model provider B
```

## 23.2 AI copilots

Initial production candidates:

- Doctor Copilot
- Nursing Handover Copilot
- Quality Copilot
- CFO Copilot
- Hospital Superintendent Copilot
- Pharmacy Copilot
- Claims Copilot
- Patient Communication Copilot

## 23.3 AI safety rules

AI must:

- identify itself as AI assistance where appropriate
- show provenance where feasible
- avoid unsupported clinical certainty
- never silently modify medical records
- require human confirmation for clinical actions
- log model/version/prompt policy metadata for governed use cases
- respect authorization boundaries
- minimize patient data sent to external models

## 23.4 Tool-based AI

AI should not be given unrestricted database access.

Prefer controlled tools:

```text
get_patient_summary(patient_id)
get_recent_labs(patient_id)
get_medications(patient_id)
get_quality_indicator(indicator_id)
get_claim_status(claim_id)
get_inventory_item(item_id)
```

Each tool enforces authorization independently.

---

# 24. Analytics Architecture

Transactional database is not the long-term analytics platform.

Target evolution:

```text
PostgreSQL
    |
    v
CDC / Event stream
    |
    v
Data Lake / Warehouse
    |
    +---- BI
    +---- Command Center
    +---- ML
    +---- Regulatory reporting
```

The first production release may use PostgreSQL reporting replicas and curated materialized views.

Later introduce a warehouse when analytical load threatens transactional workloads.

## 24.1 Metrics classes

Operational:

- bed occupancy
- queue time
- lab TAT
- OT utilization
- pharmacy turnaround

Financial:

- revenue
- AR ageing
- claim rejection
- collection
- revenue per bed

Clinical:

- readmission
- mortality
- length of stay
- critical-result acknowledgement

Quality:

- indicator performance
- CAPA ageing
- incidents
- infection rates

---

# 25. Hospital Command Center Architecture

The command center is a read-optimized application.

It should not calculate every metric live from the primary transactional tables.

Recommended pattern:

```text
Transactions
    |
    v
Domain Events
    |
    v
Metric pipelines / projections
    |
    v
Operational metric store
    |
    v
Command Center API
    |
    v
Dashboard
```

Dashboards should indicate:

- timestamp
- source
- freshness
- calculation definition
- facility scope

A metric without a clear definition should not be presented as a management KPI.

---

# 26. Quality and Accreditation Architecture

Quality is a first-class domain, not a reporting module.

Core components:

```text
Quality Indicator Engine
      |
      +---- Definitions
      +---- Numerator
      +---- Denominator
      +---- Target
      +---- Measurement period
      +---- Owner
      +---- Evidence
      +---- Trend

Incident Management
      |
      +---- Report
      +---- Investigation
      +---- RCA
      +---- CAPA
      +---- Closure

Audit Management
      |
      +---- Audit plan
      +---- Checklist
      +---- Finding
      +---- Evidence
      +---- CAPA

Accreditation Workspace
      |
      +---- Requirement mapping
      +---- Evidence repository
      +---- Status
      +---- Responsible owner
```

NABH references must remain configuration and evidence-management content rather than hard-coded assumptions inside clinical services.

---

# 27. Security Architecture

## 27.1 Security layers

```text
Edge
  WAF
  DDoS protection
  TLS

Application
  Authentication
  Authorization
  Input validation
  Rate limiting
  CSRF protection where applicable
  Security headers

Data
  Encryption at rest
  Encryption in transit
  KMS
  Secrets management
  Tenant isolation

Operations
  Audit logging
  SIEM integration
  Monitoring
  Vulnerability management
  Backup
```

## 27.2 Threat model

At minimum model:

- credential theft
- privilege escalation
- patient-record snooping
- tenant breakout
- insecure direct object references
- injection
- XSS
- CSRF
- SSRF
- malicious file uploads
- token theft
- replay attacks
- integration credential compromise
- insider threat
- data exfiltration
- ransomware
- supply-chain compromise

## 27.3 Secrets

No secrets in source control.

No secrets in frontend bundles.

No API keys in mobile source code.

Use environment injection through secret-management systems.

## 27.4 Logging

Do not log:

- passwords
- access tokens
- full authentication secrets
- unnecessary patient identifiers
- full clinical notes
- full payment card data

Logging policies must explicitly classify protected data.

---

# 28. Audit Architecture

Audit logging is mandatory for high-value actions.

Audit event fields should include:

- event ID
- timestamp
- tenant
- facility
- actor
- actor role
- patient/resource target
- action
- result
- reason where required
- source IP where permitted
- device/session identifier
- correlation ID
- previous/new state references where applicable

Clinical record changes must be auditable.

Audit storage should be append-oriented and protected against ordinary application-level deletion.

---

# 29. Observability

Use OpenTelemetry-compatible tracing.

Three pillars:

1. Metrics.
2. Logs.
3. Distributed traces.

## 29.1 Required metrics

API:

- request rate
- error rate
- latency p50/p95/p99
- endpoint saturation

Database:

- connection pool usage
- query latency
- locks
- slow queries
- replication lag where relevant

Jobs:

- queue depth
- processing latency
- retry count
- dead-letter count

Integrations:

- success rate
- latency
- timeout rate
- provider error rate

Clinical safety:

- unacknowledged critical-result count
- medication verification exceptions
- failed notification count

## 29.2 Correlation IDs

Every incoming request receives a correlation ID.

The ID must propagate to:

- logs
- database audit events
- jobs
- integration requests
- notification events
- trace spans

---

# 30. CI/CD Architecture

## 30.1 Git strategy

Recommended:

- trunk-based development
- short-lived feature branches
- protected main branch
- mandatory pull requests
- CODEOWNERS
- required checks
- conventional commit style if useful

Avoid long-lived environment branches.

## 30.2 Pipeline

```text
Developer
   |
   v
Pull Request
   |
   +---- format
   +---- lint
   +---- typecheck
   +---- unit tests
   +---- dependency scan
   +---- SAST
   +---- build
   +---- API contract tests
   +---- migration validation
   |
   v
Review
   |
   v
Merge
   |
   v
Container build
   |
   +---- image scan
   +---- SBOM
   +---- sign artifact
   |
   v
Deploy Dev
   |
   v
Integration Tests
   |
   v
Staging
   |
   +---- E2E
   +---- performance
   +---- security gates
   |
   v
Production approval
   |
   v
Canary / phased release
```

## 30.3 Database migrations

Every schema change must:

- have a versioned migration
- be backward compatible where rolling deployments are possible
- have a rollback or forward-fix strategy
- be tested against representative data volumes

Use expand/contract migrations.

Example:

```text
Release N
Add new column nullable

Release N+1
Write both old and new fields

Release N+2
Read new field

Release N+3
Stop old writes

Release N+4
Remove old field
```

Never deploy an incompatible database migration before the application version that can safely handle it.

---

# 31. Environment Strategy

Required environments:

```text
local
  |
ci
  |
dev
  |
qa
  |
staging
  |
production
```

Optional:

- demo
- customer sandbox
- performance
- disaster recovery

## 31.1 Local environment

Use Docker Compose or developer containers for:

- PostgreSQL
- Redis
- object-storage emulator
- mail catcher
- message infrastructure as needed

## 31.2 Development

Shared cloud development environment for integration testing.

Use synthetic patients only.

## 31.3 QA

Stable automated-test environment.

## 31.4 Staging

Production-like infrastructure and configuration.

Use synthetic or properly de-identified data.

## 31.5 Production

Strict access controls.

No developer direct database access by default.

---

# 32. Infrastructure as Code

Use Terraform or an equivalent declarative IaC tool.

Recommended structure:

```text
infra/
  modules/
    network/
    rds/
    redis/
    storage/
    compute/
    observability/
    security/
  environments/
    dev/
    qa/
    staging/
    production/
```

All production infrastructure changes should be reviewable through version control.

---

# 33. Container Strategy

Each deployable application has a production container.

Containers:

```text
web
api
worker
realtime
integration-worker
ai-gateway
```

Early releases may combine some processes to reduce infrastructure complexity, but process boundaries should remain explicit in the codebase.

## 33.1 Container requirements

Images must:

- use minimal trusted base images
- run as non-root where possible
- define resource requests/limits
- contain no credentials
- generate SBOMs
- be vulnerability scanned
- be signed where feasible

---

# 34. File and Repository Structure

Recommended monorepo:

```text
hims/
├── apps/
│   ├── web/
│   ├── patient-mobile/
│   ├── clinician-mobile/
│   ├── api/
│   ├── worker/
│   └── ai-gateway/
│
├── packages/
│   ├── api-client/
│   ├── domain-types/
│   ├── validation/
│   ├── design-system/
│   ├── auth/
│   ├── localization/
│   ├── date-time/
│   ├── telemetry/
│   ├── clinical-safety/
│   └── config/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── fixtures/
│   └── scripts/
│
├── integrations/
│   ├── abdm/
│   ├── fhir/
│   ├── hl7/
│   ├── dicom/
│   └── payers/
│
├── infra/
│   ├── terraform/
│   ├── kubernetes/
│   └── policies/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   ├── clinical-safety/
│   ├── security/
│   └── runbooks/
│
├── tests/
│   ├── contract/
│   ├── e2e/
│   ├── performance/
│   ├── security/
│   └── fixtures/
│
├── scripts/
├── .github/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Use pnpm and a monorepo orchestrator such as Turborepo if the team benefits from incremental builds and shared packages.

---

# 35. Shared Package Rules

Shared packages must be small and stable.

Good shared packages:

- API types
- design system
- validation primitives
- authentication client
- date/time utilities
- telemetry

Avoid creating a giant `utils` package containing unrelated logic.

Domain logic belongs with the domain.

---

# 35A. shadcn/ui Adoption Standard

shadcn/ui is an explicit architecture decision for the web frontend. It shall be used as the foundational component implementation model, not as a generic theme. The code generated/installed from shadcn/ui shall live in the repository and be treated as first-party UI code.

### 35A.1 Required layers

```text
Tailwind design tokens
        ↓
shadcn/ui primitives
        ↓
HIMS shared components
        ↓
Clinical / Operations / Finance / Quality screens
```

### 35A.2 Primitive strategy

The project shall select one shadcn/ui primitive family at project bootstrap and pin it. New projects currently default to Base UI while Radix remains supported. The selected primitive family shall be recorded in the architecture decision log and must not be changed casually during feature development. [shadcn/ui Base UI default, July 2026](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)

### 35A.3 HIMS components built above shadcn/ui

The design system shall include reusable components such as:

- `PatientHeader`
- `PatientIdentityCard`
- `PatientSearch`
- `ClinicalAlert`
- `VitalsPanel`
- `MedicationMAR`
- `MedicationOrderTable`
- `LabResultGrid`
- `ClinicalTimeline`
- `BedBoard`
- `EDTriageBoard`
- `OTScheduleBoard`
- `NursingFlowsheet`
- `DischargeChecklist`
- `NABHIndicatorCard`
- `CAPAWorkflow`
- `ClaimTimeline`
- `HospitalCommandCenter`

These are first-party HIMS components and must not be replaced by ad-hoc page-local copies.

# 36. UI Design System

A dedicated healthcare design system should be created before a large number of screens are built. It shall be implemented as a first-party layer on top of shadcn/ui and Tailwind CSS. shadcn/ui provides the foundational interaction primitives; the HIMS layer owns clinical semantics, visual states, accessibility behavior and domain-specific components.

Required components:

- buttons
- fields
- combobox
- date/time picker
- autocomplete
- patient search
- medication search
- diagnosis search
- table
- clinical timeline
- status badge
- alert banner
- confirmation modal
- consent modal
- audit drawer
- command palette
- keyboard shortcuts
- notification center
- work queue
- dashboard card
- chart
- empty state
- error state

Clinical components must be tested for accessibility and predictable keyboard interaction.

---

# 37. Frontend Accessibility

Target WCAG 2.2 AA where practical for the general product UI.

Healthcare workflows must additionally support:

- keyboard navigation
- visible focus states
- sufficient contrast
- screen-reader labels
- error summaries
- large touch targets on tablets/mobile
- no reliance on color alone

---

# 38. Localization

The system should be localization-ready from day one.

Initial language:

- English

Architecture-ready for:

- Hindi
- Assamese
- Bengali
- Malayalam
- Marathi
- Tamil
- Telugu
- Kannada
- Gujarati
- Punjabi
- other regional languages as required

Do not hard-code user-visible strings inside components.

Clinical terminology should be separated from interface language.

---

# 39. Printing and Document Generation

Hospitals still require printable documents.

The system must support controlled PDF generation for:

- prescriptions
- invoices
- receipts
- lab reports
- radiology reports
- discharge summaries
- consent documents
- certificates
- quality reports

PDF generation must happen server-side for authoritative documents.

The browser should not be responsible for the final legal/clinical rendering of a finalized document.

---

# 40. Barcode and Device Integration

The mobile/web system should support barcode/QR workflows for:

- patient identification
- sample identification
- medication dispensing
- inventory
- asset management
- blood products where applicable

Device integration should use adapters.

Never embed one manufacturer's device protocol into core clinical services.

---

# 41. Payment Architecture

Payment gateways must be abstracted.

```text
Billing Domain
     |
     v
Payment Service
     |
     v
Gateway Adapter
     |
     +---- Provider A
     +---- Provider B
```

Payment state must be reconciled asynchronously.

A browser redirect returning successfully does not alone prove final settlement.

---

# 42. Insurance and Claims Architecture

Claims are a state machine.

Example:

```text
Draft
  -> Ready for Submission
  -> Submitted
  -> Acknowledged
  -> Under Review
  -> Approved
  -> Partially Approved
  -> Rejected
  -> Resubmission
  -> Settled
```

Every state transition must be logged.

Claims should support document completeness rules before submission.

---

# 43. Bed Management State Machine

Beds should have explicit states:

```text
AVAILABLE
RESERVED
OCCUPIED
DISCHARGE_PENDING
CLEANING
BLOCKED
MAINTENANCE
ISOLATION
```

State transitions must be validated by domain rules.

Example:

```text
OCCUPIED -> AVAILABLE
```

should not occur directly when a cleaning workflow is required.

---

# 44. Appointment and Queue Architecture

Appointment state:

```text
REQUESTED
CONFIRMED
RESCHEDULED
CHECKED_IN
IN_QUEUE
CALLED
IN_CONSULTATION
COMPLETED
CANCELLED
NO_SHOW
```

The queue engine must support configurable rules without changing code.

Queue events should be timestamped to enable operational analytics.

---

# 45. Laboratory Architecture

Laboratory workflow:

```text
Order
 -> Accession
 -> Sample Collection
 -> Received
 -> Processing
 -> Result Entry
 -> Verification
 -> Final Report
 -> Release
```

Support:

- test catalogue
- specimen catalogue
- container types
- barcode
- reference ranges
- critical ranges
- delta checks
- result verification
- analyser integration
- quality control
- amended report

Critical results should generate explicit acknowledgement workflows.

---

# 46. Radiology Architecture

Workflow:

```text
Order
 -> Schedule
 -> Worklist
 -> Acquisition
 -> Interpretation
 -> Draft Report
 -> Verification
 -> Final Report
```

PACS integration must not require copying entire studies through the HIMS backend unless operationally necessary.

---

# 47. Pharmacy Architecture

Pharmacy must track inventory by lot/batch where required.

Key flows:

```text
Purchase
 -> GRN
 -> Stock
 -> Dispense
 -> Return
 -> Adjustment
 -> Expiry
 -> Recall
```

Use FEFO where appropriate.

Medication safety warnings must be configurable and clinically governed.

---

# 48. Inventory and Procurement

Workflow:

```text
Demand
 -> Requisition
 -> Approval
 -> Purchase Order
 -> Goods Receipt
 -> Quality / Quantity Check
 -> Stock
 -> Consumption
```

Support:

- min/max levels
- reorder points
- lead time
- vendor performance
- price history
- wastage
- expiry
- stock transfer

---

# 49. Nursing and ICU Architecture

Nursing must be an independent domain with shared Patient 360 access.

Components:

- ward board
- nursing assessment
- care plan
- vitals
- intake/output
- medication administration record
- task list
- escalation
- handover
- clinical observations
- device readings where integrated

ICU adds:

- flowsheets
- ventilator-related data where integrated
- lines/tubes/drains
- sedation/monitoring fields
- intensive monitoring
- escalation rules

---

# 50. Emergency Architecture

Emergency workflow:

```text
Arrival
 -> Registration / identification
 -> Triage
 -> Acuity
 -> Bed
 -> Clinician
 -> Orders
 -> Diagnostics
 -> Treatment
 -> Disposition
```

The ED board must show live status and timers.

---

# 51. OT Architecture

OT workflow:

```text
Surgery Request
 -> Review
 -> Scheduling
 -> Pre-op
 -> Checklist
 -> Anaesthesia
 -> Procedure
 -> Recovery
 -> Documentation
 -> Billing
 -> Consumables
```

The OT scheduler must account for:

- room availability
- surgeon
- anaesthesia team
- nursing team
- equipment
- implants/consumables
- case duration
- turnover

---

# 52. Data Migration Architecture

Migration from legacy HIMS products must be treated as a product feature.

Migration pipeline:

```text
Legacy Export
    |
    v
Landing Zone
    |
    v
Profiling
    |
    v
Mapping
    |
    v
Validation
    |
    v
Transformation
    |
    v
Dry Run
    |
    v
Reconciliation
    |
    v
Production Import
```

Required migration classes:

- demographics
- patients
- practitioners
- appointments
- encounters
- diagnoses
- prescriptions
- lab reports
- invoices
- payments
- inventory
- reference data

Every migrated dataset needs reconciliation counts and exception reports.

---

# 53. Data Import and Export

Exports must be permission-controlled and auditable.

Supported formats may include:

- CSV
- XLSX where appropriate
- JSON
- FHIR JSON
- PDF reports

Bulk exports containing patient data require higher privilege and potentially step-up authentication.

---

# 54. API Documentation

All APIs must publish machine-readable OpenAPI documentation.

Documentation must include:

- examples
- authentication
- error responses
- pagination
- idempotency
- versioning
- rate limits

FHIR APIs require separate conformance documentation and mapping documentation.

---

# 55. Testing Strategy

Testing is divided into:

```text
Unit
Component
Integration
Contract
E2E
Security
Performance
Clinical Safety
Migration
Disaster Recovery
```

## 55.1 Unit tests

Target domain logic, rules, state machines and transformations.

Do not pursue arbitrary percentage coverage; prioritize business-critical logic.

## 55.2 Integration tests

Validate:

- database persistence
- transactions
- authorization
- event publishing
- external adapter behaviour

## 55.3 Contract tests

All internal/external API contracts should be tested.

## 55.4 E2E tests

Critical journeys:

1. Registration → appointment → consultation → billing.
2. Admission → bed assignment → nursing → discharge.
3. Order → lab → result → clinician acknowledgement.
4. Prescription → pharmacy dispensing.
5. Invoice → payment → receipt.
6. Claim → submission → rejection → resubmission.
7. Incident → RCA → CAPA → closure.
8. ABDM transaction flow.

## 55.5 Clinical safety tests

A dedicated test suite must verify:

- wrong-patient prevention
- allergy visibility
- medication warnings
- critical result escalation
- authorization boundaries
- amendment behaviour
- break-glass behaviour
- immutable final documents

---

# 56. Performance Engineering

## 56.1 Initial targets

These are engineering targets, subject to workload validation:

- p95 normal API response under 500 ms for ordinary reads.
- p95 command response under 800 ms for ordinary transactional workflows where no external dependency is involved.
- Critical dashboard interactions should normally render usable data within 2 seconds on a strong network.
- Search suggestions should normally respond within 300 ms at the application layer.
- Background jobs must expose queue latency and processing latency separately.

Clinical workflows must not be tuned only for average response time.

## 56.2 Load profiles

Test separately for:

- clinic
- 50-bed hospital
- 100-bed hospital
- 300-bed hospital
- 500+ bed hospital
- multi-facility group

## 56.3 Load testing

Use k6 or equivalent for API load.

Simulate realistic concurrency rather than synthetic identical requests.

---

# 57. Capacity Planning

Track:

- active users
- concurrent users
- transactions/minute
- database CPU
- database connections
- storage growth
- document growth
- event throughput
- API request rate
- websocket connections

Capacity plans must model at least 3x expected peak traffic for major enterprise customers.

---

# 58. Disaster Recovery

Production must have:

- automated database backups
- point-in-time recovery
- object storage versioning where appropriate
- backup integrity checks
- documented restore procedures
- tested disaster-recovery runbooks

## 58.1 Initial targets

Suggested starting targets:

- RPO: 15 minutes or better for transactional data.
- RTO: 2 hours or better for standard SaaS deployment.

Enterprise contracts may require stricter values.

## 58.2 DR testing

At least quarterly:

- restore database to isolated environment
- verify application startup
- verify object availability
- verify encryption keys/access
- verify migration compatibility
- run critical workflow checks

---

# 59. Backup Architecture

Backups must include:

- PostgreSQL
- object storage metadata/data according to retention
- critical configuration
- infrastructure state
- encryption metadata/configuration

Secrets themselves should not be backed up as ordinary database data.

---

# 60. Incident Management

Severity model:

```text
SEV-1
Patient safety / widespread production outage / major data risk

SEV-2
Major business disruption / significant functional outage

SEV-3
Limited functional degradation

SEV-4
Minor defect / low-impact issue
```

SEV-1 incidents require a clinical-safety escalation path in addition to the engineering incident path.

---

# 61. Release Management

Use semantic product releases where useful, but deployment versions should be traceable to immutable build artifacts.

Recommended channels:

- internal alpha
- customer sandbox
- pilot
- stable
- enterprise controlled release

Never force all customers onto a breaking release without an upgrade policy.

---

# 62. Feature Flags

Use feature flags for:

- incomplete features
- staged rollout
- enterprise-specific features
- risky workflow changes
- AI features
- integration pilots

Clinical safety features must have explicit governance and should not depend on an uncontrolled remote feature flag without fallback behaviour.

---

# 63. Configuration Management

Configuration categories:

```text
System configuration
Tenant configuration
Facility configuration
Department configuration
Clinical configuration
Billing configuration
Integration configuration
Notification configuration
Quality configuration
```

Configuration changes must be auditable.

High-impact configuration changes can require approval.

---

# 64. Multi-Tenancy Strategy
### 64.1 Shared-SaaS isolation model

Standard SaaS topology:

```text
Shared Next.js / NestJS
        │
        ├── tenant context
        ├── authorization
        └── transaction-scoped RLS context
                │
        Shared PostgreSQL cluster
                │
        tenant_id + RLS + indexes
```

Enterprise topology may use a dedicated application/database/object-storage stack per tenant. The same domain code and migrations should remain deployable in both modes.

Do not use database-per-module. Use domain ownership within a common transactional boundary until independent scaling is demonstrated.


The SaaS model should use logical tenant isolation initially.

Recommended topology:

```text
Shared application
      |
      +---- Shared PostgreSQL cluster
             |
             +---- tenant_id separation
             +---- RLS defense in depth
```

For high-regulation enterprise customers, support a dedicated deployment:

```text
Customer
  |
  +---- Dedicated application stack
  +---- Dedicated DB
  +---- Dedicated object storage
  +---- Customer-specific keys
```

The application code should remain the same.

---

# 65. On-Premise / Private Deployment

Enterprise hospital groups may require private deployment.

The application must therefore avoid unnecessary dependence on:

- proprietary SaaS-only database APIs
- vendor-specific authentication
- cloud-specific business logic
- cloud-only object semantics

Cloud adapters belong behind interfaces.

Example:

```text
ObjectStoragePort
    |
    +---- S3Adapter
    +---- MinIOAdapter
```

---

# 66. Edge / Hospital LAN Architecture

For hospitals with intermittent internet connectivity:

```text
Hospital LAN
    |
    +---- HIMS Edge Connector
             |
             +---- local device integrations
             +---- printer services
             +---- lab analyser links
             +---- PACS/local systems
             |
             v
        Secure outbound tunnel
             |
             v
          Cloud HIMS
```

The edge component should not become a second HIMS database.

Its role is integration and controlled local continuity where required.

---

# 67. Printing and Peripheral Architecture

Hospital peripherals often require local access.

Use a controlled print/desktop bridge rather than exposing local network printers directly to the public cloud.

Potential bridge functions:

- receipt printing
- label printing
- barcode printing
- report printing
- document scanning

---

# 68. Security and Compliance Development Gates

Before production of any major module:

### Gate 1: Architecture

- domain boundary reviewed
- threat model reviewed
- data classification completed

### Gate 2: Engineering

- authorization implemented
- audit events implemented
- tests implemented

### Gate 3: Security

- dependency scan
- static analysis
- secret scan
- DAST where applicable

### Gate 4: Clinical safety

For clinical modules:

- workflow review
- failure-mode review
- wrong-patient review
- safety test suite

### Gate 5: Production readiness

- observability
- runbook
- backup/restore
- alerting
- rollback plan

---

# 69. Development Roadmap Philosophy

This roadmap intentionally extends well beyond MVP.

The goal is a production-grade HIMS capable of supporting real hospitals and later enterprise hospital groups.

The phases are capability-based, not arbitrary monthly promises.

Actual calendar dates should be assigned only after team size, engineering capacity, implementation partners and target hospital profile are fixed.

---

# 69A. Production Repository and Workspace Layout

Recommended Turborepo/pnpm monorepo:

```text
hims/
├── apps/
│   ├── web/                         # Next.js + shadcn/ui HIMS web
│   ├── patient-mobile/              # Expo patient app
│   ├── clinician-mobile/            # Expo clinician/nurse app
│   ├── api/                         # NestJS canonical backend
│   ├── worker/                      # BullMQ jobs/workers
│   ├── integration-worker/          # external integration jobs
│   └── docs/                        # technical/product documentation
│
├── packages/
│   ├── ui/                          # HIMS design system built on shadcn/ui
│   ├── domain-types/
│   ├── api-client/
│   ├── validation/
│   ├── auth/
│   ├── date-time/
│   ├── localization/
│   ├── telemetry/
│   └── config/
│
├── supabase/
│   ├── migrations/
│   ├── seed/
│   ├── functions/                   # limited platform functions
│   └── tests/                       # pgTAP/RLS tests
│
├── infra/
│   ├── docker/
│   ├── compose/
│   ├── k8s/
│   ├── terraform/
│   ├── monitoring/
│   └── backup/
│
├── integrations/
│   ├── abdm/
│   ├── fhir/
│   ├── hl7/
│   ├── dicom/
│   ├── nhcx/
│   ├── payers/
│   └── messaging/
│
├── tests/
│   ├── e2e/
│   ├── integration/
│   ├── security/
│   ├── performance/
│   └── clinical-safety/
│
└── docs/
    ├── PRD.md
    ├── SRS.md
    ├── development.md
    ├── ADR/
    ├── runbooks/
    └── threat-model/
```

### Dependency and API rule

The frontend must never import backend persistence code. The web/mobile clients consume typed API contracts. Domain packages may contain types and validation schemas but not database clients that create an uncontrolled path around the NestJS application layer.

---

# 69B. Department-to-Service Data Flow Matrix

| Source | Action | Destination | Authoritative source |
|---|---|---|---|
| OPD | Prescription finalization | Pharmacy | OPD prescription |
| OPD | Lab order | LIS | Clinical order |
| OPD | Imaging order | RIS | Clinical order |
| OPD | Admission request | IPD | Admission request |
| IPD | Medication order | Pharmacy | IPD medication order |
| IPD | Medication administration | EMR/MAR | MAR event |
| IPD | Lab order | LIS | Clinical order |
| IPD | Imaging order | RIS | Clinical order |
| IPD | ICU transfer | ICU | Transfer request |
| IPD | OT request | OT | Procedure/surgery request |
| Emergency | Medication order | Pharmacy | Emergency order |
| Emergency | Lab/imaging order | LIS/RIS | Emergency order |
| Emergency | Admission | IPD/ICU | Admission/transfer event |
| ICU | Medication order | Pharmacy | ICU order |
| ICU | Lab/imaging order | LIS/RIS | ICU order |
| OT | Medication/consumable requirement | Pharmacy/Inventory | OT case requirement |
| LIS | Result release | EMR | Verified result |
| RIS | Report release | EMR | Verified report |
| Pharmacy | Dispensing | EMR/Billing/Inventory | Dispensing transaction |
| Insurance | Pre-auth/claim status | Billing/encounter | Payer transaction |
| All clinical modules | Clinical events | EMR timeline | Source event provenance |

A failed downstream consumer must produce a retry/reconciliation state rather than duplicate the source event.

---

# 70. Phase 0 — Product and Architecture Foundation

Objectives:

- finalize product name later
- validate target customer profile
- finalize architecture
- establish engineering standards
- identify first pilot hospital
- define clinical governance

Deliverables:

- approved PRD
- approved SRS
- this development blueprint
- ADR register
- threat model
- data classification policy
- clinical safety framework
- UI design system foundation
- repository
- CI/CD skeleton
- environments
- infrastructure baseline

Exit criteria:

- production architecture approved
- core engineering team onboarded
- pilot hospital workflows mapped

---

# 71. Phase 1 — Platform Foundation

Build:

- authentication
- authorization
- tenants
- facilities
- departments
- users
- roles
- permissions
- configuration
- audit
- documents
- notifications
- Patient 360 foundation

Technical completion:

- PostgreSQL
- Redis
- object storage
- API gateway/BFF
- web shell
- mobile shell
- CI/CD
- observability

Exit criteria:

- secure login
- tenant isolation tested
- audit events operational
- deployment automated
- DR backup operational

---

# 72. Phase 2 — Core Patient and OPD Platform

Build:

- patient registration
- MPI
- duplicate detection
- appointments
- scheduling
- queues
- OPD encounters
- clinical notes
- diagnosis/problem list
- allergy
- medication history
- prescriptions
- basic billing
- receipts
- patient portal

Production gate:

At least one pilot facility must complete a full OPD day using the platform.

---

# 73. Phase 3 — Diagnostics and Pharmacy

Build:

- lab orders
- sample workflow
- lab catalogue
- result verification
- critical results
- radiology workflow
- PACS integration layer
- pharmacy dispensing
- inventory basics
- batch/expiry
- purchase
- stock movements

Exit criteria:

- real lab workflow completed
- real pharmacy workflow completed
- stock reconciliation tested

---

# 74. Phase 4 — IPD and Nursing

Build:

- admissions
- bed management
- transfers
- discharge
- nursing assessment
- vitals
- medication administration
- care plans
- handover
- ICU foundation

Production readiness:

- ward dashboard
- bed lifecycle
- nursing task engine
- discharge flow

---

# 75. Phase 5 — Emergency and OT

Build:

- emergency registration
- triage
- ED board
- emergency orders
- MLC workflows as applicable
- OT request
- scheduling
- pre-op
- checklist
- anaesthesia documentation
- procedure record
- recovery
- OT billing/consumables

---

# 76. Phase 6 — Revenue Cycle Management

Build:

- estimates
- payer configuration
- authorization
- TPA
- insurance
- claims
- rejection management
- remittance
- ageing
- reconciliation
- revenue dashboards

Exit criteria:

- complete claim lifecycle demonstrated
- finance team validates reconciliation

---

# 77. Phase 7 — Quality OS

Build:

- quality indicators
- CQI
- incident reporting
- investigation
- RCA
- CAPA
- audit programme
- evidence management
- infection control
- accreditation mapping

This phase converts the HIMS from a conventional operational system into a hospital quality platform.

---

# 77A. Phase 7A — Current India Quality/Safety Pack

This phase should be treated as a production requirement for Indian hospital deployment, not a later cosmetic compliance add-on.

Build:

- NABH 6th Edition evidence mapping.
- NQAS 2024 public-facility framework support where applicable.
- Risk register and risk-management workflows.
- Clinical death audit.
- Prescription audit.
- Medication reconciliation.
- HAI surveillance.
- Infection-control audit tools.
- Patient-safety incident and near-miss workflows.
- Quality indicator calculation engine.
- Evidence repository linked to source records.
- CAPA effectiveness verification.
- LaQshya/MusQan-integrated NQAS configuration where applicable to DH/SDH/CHC customers.

Current NHSRC materials show active NQAS work on medical-college hospitals, integrated public-health laboratories, HAI surveillance and risk management; a January 2026 NHM directive states LaQshya and MusQan criteria are integrated into NQAS for DH/SDH/CHC from 1 April 2026. The software should therefore model quality as reusable structured data instead of static checklists.

# 78. Phase 8 — ABDM and Interoperability Platform

Build:

- ABDM integration layer
- identity/ABHA workflows
- consent workflows
- FHIR layer
- HL7 adapter framework
- DICOM/PACS integration
- integration monitoring console
- replay/dead-letter mechanisms

Exit criteria:

- external interoperability test suite passes
- external transactions are observable and replayable

---

# 79. Phase 9 — Patient Engagement Platform

Build:

- patient mobile app
- appointments
- payments
- prescriptions
- reports
- notifications
- telemedicine
- family profiles
- consent management
- communication preferences

---

# 79A. Production Hardening Track — Runs Across All Phases

The following track is continuous rather than deferred to the end:

### Security

- threat model refresh per major release
- SAST/dependency/container scanning
- DAST
- tenant-isolation regression suite
- secrets rotation
- privileged-access review
- security incident runbook
- periodic penetration testing

### Clinical safety

- wrong-patient test suite
- medication safety tests
- critical-result escalation tests
- amendment/versioning tests
- authorization boundary tests
- fail-safe behavior for automation/AI

### Reliability

- backup verification
- restore drills
- queue replay
- dead-letter handling
- integration reconciliation
- chaos/failure testing for critical external dependencies

### Data governance

- retention policies
- data export
- data correction/amendment
- consent audit
- privacy request workflows
- de-identification for non-production

# 80. Phase 10 — Automation Platform

Build:

- trigger framework
- rule builder
- workflow templates
- approval workflows
- escalation rules
- scheduled tasks
- SLA timers
- automated document workflows

Example automation:

```text
Discharge completed
 -> Bed cleaning task
 -> Billing finalization
 -> Patient communication
 -> Follow-up schedule
 -> Quality feedback
```

---

# 81. Phase 11 — Hospital Command Center

Build:

- operations dashboard
- bed command center
- ED command center
- OT command center
- lab TAT
- pharmacy status
- financial command center
- quality command center
- executive alerts

Introduce read-optimized projections.

---

# 82. Phase 12 — AI Platform

Start with lower-risk administrative and summarization workloads.

Order:

1. administrative assistant
2. operational analytics assistant
3. quality assistant
4. claims assistant
5. documentation assistance
6. clinical decision-support augmentation

Do not begin with autonomous medical recommendations.

All AI releases require:

- evaluation set
- hallucination testing
- authorization tests
- latency/cost measurement
- clinical governance where applicable

---

# 83. Phase 13 — Enterprise Scale

Build:

- multi-facility enterprise dashboard
- centralized configuration
- enterprise identity integration
- advanced audit
- data warehouse
- advanced analytics
- enterprise claims
- central procurement
- cross-facility inventory
- centralized quality
- advanced SSO
- dedicated tenant deployments

---

# 84. Phase 14 — Ecosystem and Marketplace

Build an integration ecosystem:

- partner API portal
- sandbox
- developer documentation
- webhook management
- integration marketplace
- app-level OAuth
- external clinical services
- device connectors
- payment connectors
- analytics connectors

---

# 85. Phase 15 — Internationalization / Exportable Platform

Only after India-specific workflows are mature.

Potential future capabilities:

- configurable local billing/tax rules
- country-specific interoperability
- multilingual content
- configurable regulatory mappings
- international deployment topology

The India-first architecture should remain the core product identity even when internationalization is added.

---

# 86. Production Roadmap by Engineering Workstream

The capability roadmap must run in parallel across workstreams.

## Frontend

- design system
- web shell
- patient 360
- workbenches
- mobile apps
- offline capability
- command center

## Backend

- platform modules
- clinical domains
- operational domains
- financial domains
- quality domains
- integrations
- workflow engine

## Data

- schema
- migration
- reporting
- analytics
- warehouse

## DevOps

- infrastructure
- CI/CD
- monitoring
- backup
- DR
- security automation

## QA

- unit
- integration
- E2E
- clinical safety
- performance
- security

## Security

- threat modelling
- IAM
- audit
- vulnerability management
- penetration testing

## Clinical governance

- workflow validation
- terminology governance
- medication safety
- AI safety

---

# 87. Definition of Done

A feature is not complete when the UI works.

A production feature is complete only when:

- requirements are traceable
- UI is implemented
- domain logic is implemented
- API is documented
- authorization is enforced
- audit requirements are implemented
- tests pass
- observability exists
- error states exist
- accessibility is tested
- localization is considered
- migration impact is assessed
- security review is complete
- clinical safety review is complete where applicable
- rollback/deployment strategy exists
- documentation is updated

---

# 88. Clinical Feature Definition of Done

For clinical features, additionally require:

- patient-context validation
- encounter-context validation
- wrong-patient testing
- medication/allergy interaction impact assessment
- audit event validation
- amendment behavior
- permission review
- downtime workflow
- user acceptance by representative clinicians

---

# 89. Production Readiness Checklist

Before a major production launch:

### Product

- requirements signed off
- workflow validated
- user acceptance completed

### Engineering

- tests pass
- migrations verified
- performance target met
- no critical static-analysis issues

### Security

- security scan passed
- secrets verified
- access matrix validated
- penetration test appropriate to release risk

### Operations

- dashboards configured
- alerts configured
- runbooks available
- backups verified
- restore tested

### Clinical

- clinical safety review
- workflow sign-off
- downtime process

### Customer

- onboarding completed
- training completed
- migration reconciled
- support process activated

---

# 90. Pilot Hospital Deployment Strategy

Never use the first hospital as a passive customer.

Use it as a structured product validation environment.

Pilot stages:

```text
Sandbox
  |
  v
Read-only migration validation
  |
  v
Parallel operation
  |
  v
Limited department go-live
  |
  v
OPD full go-live
  |
  v
IPD / diagnostics
  |
  v
Hospital-wide rollout
```

The pilot hospital should provide:

- clinical champions
- nursing champion
- laboratory champion
- pharmacy champion
- billing/RCM champion
- quality champion
- hospital IT representative

---

# 91. Training Architecture

The application should minimize classroom training through embedded guidance.

Provide:

- contextual help
- onboarding tours
- role-based task guides
- searchable help
- workflow checklists
- embedded SOP links
- administrative documentation

Create role-specific training tracks:

- reception
- doctor
- nurse
- lab
- radiology
- pharmacy
- billing
- quality
- admin
- executive

---

# 92. Support Architecture

Production support should include:

- ticketing
- severity routing
- system-health dashboard
- customer status page
- integration monitoring
- deployment history
- incident communication

Support staff must have limited diagnostic privileges and should not receive unrestricted access to patient clinical information.

---

# 93. Customer Isolation in Support Tools

Support tools must separate:

- customer metadata
- technical logs
- patient data

A support engineer should not be able to browse arbitrary patient records merely to investigate an infrastructure problem.

Temporary elevated support access must use approval and audit trails.

---

# 94. Data Retention Architecture

Retention must be configurable by data class and legal/contractual policy.

Do not hard-code a universal deletion period.

Data categories include:

- clinical record
- audit record
- billing record
- integration message
- notification event
- support log
- analytics copy
- document

Retention policy changes require governance.

---

# 95. Privacy Architecture

The product must support:

- privacy notices
- consent capture
- purpose linkage where required
- data access history
- export workflows
- correction/amendment workflows
- retention policies
- breach-response workflow
- data minimization

Privacy workflows should be configurable because deployment context and applicable requirements may vary.

---

# 96. Vendor and Dependency Governance

Every significant dependency must have:

- owner
- version
- license
- security posture
- upgrade strategy
- business criticality

Maintain a Software Bill of Materials for production artifacts.

Dependencies with abandoned maintenance status must be reviewed.

---

# 97. Upgrade Strategy

Framework upgrades must be treated as planned engineering work.

For example:

```text
Dependency release
      |
      v
Compatibility review
      |
      v
Automated test suite
      |
      v
Security review
      |
      v
Staging validation
      |
      v
Canary production
```

Do not automatically upgrade React Native/Expo, Next.js or major backend dependencies directly in production.

---

# 98. React Native Upgrade Policy

Because mobile builds have strong coupling between Expo SDK, React Native, native platform requirements and store policies, mobile upgrades shall follow a dedicated release process.

At upgrade time validate:

- Expo SDK
- React Native version
- native modules
- Android target SDK
- iOS minimum version
- push notifications
- deep links
- biometric integration
- camera/scanner functionality
- offline storage
- EAS build
- app-store submission

Expo's current SDK reference states that each SDK maps to a specific React Native version and records platform compatibility; the project should therefore upgrade the Expo SDK as a coordinated unit rather than independently upgrading React Native. [Expo SDK reference](https://docs.expo.dev/versions/latest/)

---

# 99. Web Upgrade Policy

Next.js and React upgrades must validate:

- SSR/CSR behaviour
- authentication/session behavior
- caching
- middleware
- server/client boundaries
- data fetching
- bundle size
- accessibility
- browser compatibility
- security advisories

---

# 100. Backend Upgrade Policy

NestJS and Node.js upgrades must validate:

- module loading
- database drivers
- ORM/client
- queues
- WebSockets
- OpenAPI generation
- authentication
- file uploads
- external SDKs

Node runtime versions should be pinned through the repository/toolchain configuration and updated only after staging validation.

---

# 101. Database Upgrade Policy

PostgreSQL upgrades must include:

- extension compatibility
- migration rehearsal
- backup verification
- performance benchmark
- query plan review
- application compatibility
- rollback/restore plan

PostgreSQL documentation recommends staying on the current minor release for supported major versions; production should therefore track security and bug-fix releases rather than remaining indefinitely on an early minor. [PostgreSQL versioning](https://www.postgresql.org/support/versioning/)

---

# 102. Architecture Decision Records

An ADR must be created for major decisions including:

- frontend framework
- backend framework
- database
- cloud provider
- Kubernetes adoption
- event broker selection
- FHIR server strategy
- authentication provider
- AI model provider
- object storage
- search engine
- analytics warehouse
- mobile offline model

ADR template:

```text
# ADR-XXXX: Decision title

Status:
Date:
Context:
Decision:
Alternatives:
Consequences:
Security impact:
Clinical safety impact:
Operational impact:
Rollback / reversal strategy:
```

---

# 103. Engineering Team Structure

An initial serious production team should ideally cover:

- Product Manager
- Solution Architect / Tech Lead
- Frontend engineers
- React Native engineer
- Backend engineers
- QA automation engineer
- DevOps/SRE engineer
- UI/UX designer
- Security engineer/shared security function
- Data/analytics engineer
- Clinical domain advisors

The exact team size can vary, but clinical software should not be built entirely as a generic CRUD application team.

---

# 104. Code Review Policy

Pull requests must answer:

- What business capability changed?
- What domain owns the behaviour?
- What authorization rules changed?
- What audit events changed?
- What migrations changed?
- What tests were added?
- What operational impact exists?
- Does this change clinical safety?

Critical clinical features require domain-owner approval in addition to engineering approval.

---

# 105. API and Domain Naming Standards

Use consistent names.

Prefer:

```text
patientId
facilityId
encounterId
appointmentId
```

Avoid:

```text
pid
facId
encNo
```

Domain names should be explicit because healthcare systems have long maintenance lifetimes.

---

# 106. Time and Timezone Standard

Canonical rule:

- store event timestamps as UTC
- preserve source timezone where clinically meaningful
- use facility timezone for operational display
- use patient timezone for patient communications where appropriate
- distinguish `date`, `localDateTime`, and `instant`

Never assume all hospital events occur in a single timezone for a multi-state hospital group.

---

# 107. Currency and Financial Precision

Do not use floating-point values for monetary amounts.

Use fixed-precision decimal or integer minor units according to the financial model.

Currency must be explicit.

Rates, taxes, discounts and rounding rules must be configuration-driven and auditable.

---

# 108. Clinical Terminology Architecture

Do not hard-code clinical terminology in UI dropdowns.

Use a terminology service/configuration layer for:

- diagnosis codes
- laboratory codes
- medication catalogue
- procedure codes
- units
- specimen types
- clinical value sets

Terminology versions must be tracked.

---

# 109. Master Data Management

Master data includes:

- departments
- physicians
- locations
- test catalogue
- medicine catalogue
- pricing
- payer contracts
- suppliers
- quality indicators
- units
- tax configuration

Master data changes must be audited and may require approval depending on category.

---

# 110. Reporting Architecture

Reports fall into three categories:

1. Operational.
2. Financial.
3. Regulatory/quality.

Reports requiring exact historical reproducibility should use versioned definitions and frozen time windows.

Report definitions should record:

- owner
- formula
- data source
- version
- effective date

---

# 111. Regulatory Reporting

Regulatory outputs should be treated as controlled products.

Each regulatory report should have:

- specification
- mapping
- source fields
- transformation rules
- validation
- reconciliation
- submission workflow

Do not rely on manually edited spreadsheets as the system of record.

---

# 112. Downtime Mode

Hospitals cannot always assume perfect connectivity.

Define downtime procedures for:

- patient registration
- emergency
- medication administration
- critical lab communication
- discharge

The software should support controlled downtime packs where appropriate.

Do not claim full offline clinical operation until it has been specifically implemented and validated.

---

# 113. Data Reconciliation

Critical integrations must have reconciliation screens.

Examples:

Payment gateway:

```text
Gateway transactions
vs
HIMS payments
vs
Bank settlement
```

Lab:

```text
HIMS orders
vs
analyser results
vs
verified reports
```

Claims:

```text
Submitted
vs
payer acknowledgement
vs
approved
vs
settled
```

---

# 114. Migration Verification

Every migration must produce:

- source count
- imported count
- rejected count
- duplicates
- unmapped records
- financial reconciliation
- document reconciliation
- random sample validation

The migration cannot be declared complete solely because the import job returned success.

---

# 115. Performance Regression Policy

Every major release should maintain baseline benchmarks.

Track:

- API p95
- common page load
- patient search
- dashboard load
- large table performance
- report generation
- background-job throughput

A regression beyond agreed thresholds blocks release or requires explicit approval.

---

# 116. Security Testing Schedule

At minimum:

- dependency scanning continuously
- SAST continuously
- secret scanning continuously
- container scanning per build
- DAST regularly
- penetration testing before major external release and periodically thereafter
- tenant isolation tests on every major authorization change

High-risk findings require documented disposition.

---

# 117. Data Protection Testing

Test:

- unauthorized patient lookup
- cross-tenant lookup
- export privilege escalation
- audit deletion attempts
- document direct-object access
- expired sessions
- revoked users
- break-glass access
- mobile token revocation

---

# 118. AI Evaluation Infrastructure

Create dedicated AI test datasets.

Evaluate:

- factuality
- hallucination rate
- instruction adherence
- unsafe recommendations
- missing uncertainty
- privacy leakage
- authorization bypass
- prompt injection
- tool abuse

AI features cannot be considered production-ready merely because users find the generated text useful.

---

# 119. Prompt Injection Defense

External and patient-provided text must be treated as untrusted input.

AI system prompts must clearly separate:

- policy/instructions
- application context
- patient-provided content
- retrieved documents
- tool outputs

Tool execution must require explicit permissions independent of model output.

---

# 120. AI Cost Governance

Track:

- requests
- tokens
- model
- latency
- cost
- user/tenant
- feature

Introduce budgets and alerts.

Do not allow a badly designed clinical summary screen to make hundreds of LLM calls per page load.

---

# 121. Production Analytics Governance

Analytics users should not receive direct unrestricted access to the clinical production database.

Prefer:

```text
Production DB
  |
  v
Controlled extraction
  |
  v
Analytics store
  |
  v
BI / Data science
```

De-identification or restricted views should be used when full identifiers are unnecessary.

---

# 122. Mobile Security

Mobile apps must implement:

- secure token storage
- certificate validation/pinning only where operationally justified
- screen-lock awareness
- biometric unlock
- app version enforcement where necessary
- remote session revocation
- encrypted local storage
- minimal offline data

Sensitive patient data should not appear in notification previews by default.

---

# 123. Web Security

Web application must implement:

- secure headers
- CSP strategy
- SameSite cookies where applicable
- secure cookie flags
- CSRF protection for cookie-authenticated state changes
- output encoding
- input validation
- dependency controls

---

# 124. Secure SDLC

Security begins before implementation.

For every major feature:

```text
Requirements
 -> Threat model
 -> Design
 -> Implementation
 -> Security tests
 -> Deploy
 -> Monitor
 -> Review
```

---

# 125. Production Rollback Strategy

Application deployments should support rollback to previous known-good artifacts.

Database changes must favor forward-compatible migrations because database rollback can be substantially harder than application rollback.

For high-risk clinical workflows, release toggles should permit safe disablement where technically possible.

---

# 126. Blue/Green vs Canary

Use:

- canary for high-risk application releases
- blue/green for environments where infrastructure cost and state management permit it

Database migrations must be compatible with both versions during rolling deployment.

---

# 127. Hospital Go-Live Process

Recommended go-live sequence:

```text
Configuration freeze
       |
Data migration
       |
Reconciliation
       |
User acceptance
       |
Training completion
       |
Downtime rehearsal
       |
Go-live
       |
Hypercare
       |
Stabilization
       |
Operational sign-off
```

---

# 128. Hypercare

Initial customer hypercare should monitor:

- login failures
- appointment flow
- patient duplicates
- billing exceptions
- lab result issues
- pharmacy stock issues
- printer/device failures
- integration failures
- user access issues

Daily review during initial go-live should be formalized.

---

# 129. SRE Error Budgets

For mature production operations, define service-level objectives.

Initial examples:

- API availability target: 99.9% or contract-specific higher value.
- Critical integration availability target defined per integration.
- Command center freshness target defined per metric.

If an SLO is repeatedly missed, feature velocity should give way to reliability work.

---

# 130. Production Monitoring Dashboards

Engineering dashboard:

- API latency
- errors
- database
- queue
- CPU/memory
- infrastructure

Clinical safety dashboard:

- critical alerts
- failed result acknowledgements
- medication exception counts

Integration dashboard:

- ABDM
- lab
- PACS
- payer
- payment

Business dashboard:

- active tenants
- active facilities
- adoption
- feature usage
- subscription metrics when commercial model is finalized

---

# 131. Development Milestone Structure

Every major capability should produce five artifacts:

1. UX specification.
2. Domain specification.
3. API specification.
4. Test specification.
5. Deployment/runbook specification.

This prevents a feature from becoming UI-only code.

---

# 132. Recommended Build Sequence for Developers

For each domain:

```text
1. Domain vocabulary
2. State machine
3. Data model
4. Authorization matrix
5. API contract
6. Domain logic
7. Persistence
8. Events
9. Frontend workflow
10. Audit
11. Tests
12. Observability
13. Documentation
14. Deployment
```

Do not start with database CRUD endpoints before understanding the workflow/state machine.

---

# 133. Example: Building Admission

### Step 1
Define states.

```text
PLANNED
REQUESTED
APPROVED
ADMITTED
TRANSFERRED
DISCHARGED
CANCELLED
```

### Step 2
Define invariants.

- active admission must belong to an existing patient
- bed must be available
- a bed cannot have two active assignments
- authorization must match role/facility

### Step 3
Define transaction.

Patient + encounter + admission + bed assignment.

### Step 4
Emit events.

```text
AdmissionCreated
BedAssigned
```

### Step 5
Update projections.

Ward board and command center.

### Step 6
Test failure paths.

- bed no longer available
- duplicate admission
- authorization failure
- database timeout

This pattern should be reused across modules.

---

# 134. Recommended Build Sequence for Frontend Screens

For each screen:

```text
Context
  -> State
  -> User goal
  -> Data requirements
  -> Permission requirements
  -> Actions
  -> Validation
  -> Loading state
  -> Empty state
  -> Error state
  -> Success state
  -> Audit impact
```

Every important screen must define all states before production approval.

---

# 135. Recommended Build Sequence for Mobile Screens

For mobile:

- minimize typing
- prioritize task completion
- use scanning where appropriate
- preserve safe local state
- handle network loss explicitly
- show synchronization state
- protect notifications
- optimize for one-handed use where relevant

---

# 136. Architecture Anti-Patterns to Avoid

Do not build:

- a giant `components/` folder without domain boundaries
- a giant `utils.ts`
- direct ORM access from controllers
- business logic inside React components
- direct SQL from mobile/web
- frontend calls to third-party healthcare APIs
- LLM calls from random modules
- customer-specific branches
- raw JSON blobs as the only clinical model
- arbitrary soft deletion of clinical data
- hard-coded accreditation rules throughout application code
- dozens of microservices before product-market validation
- a separate database per module without a real reason

---

# 137. What Should Be a Microservice Later?

Candidates for eventual extraction:

### Strong candidates

- notification service
- document processing
- integration gateway
- search service
- AI gateway
- analytics ingestion

### Conditional candidates

- claims/RCM
- laboratory integration
- radiology integration
- pharmacy supply-chain

### Keep together longer

- Patient 360
- encounter/EMR core
- appointment/queue
- authorization
- shared hospital configuration

The rule is to extract based on scaling, security, deployment and ownership needs—not based on the number of folders in the repository.

---

# 138. Architecture Evolution

Target progression:

```text
Year 0
Modular monolith

      |
      v
Year 1
Modular monolith + workers + integration gateway

      |
      v
Year 2
Selective services + analytics platform

      |
      v
Year 3+
Enterprise distributed architecture where justified
```

The application should evolve without forcing a rewrite.

---

# 139. Production Success Criteria

The system is considered production-ready when:

1. A hospital can complete its agreed core workflows without fallback to spreadsheets for critical transactional work.
2. Patient identity is controlled centrally.
3. Access is least-privilege and auditable.
4. Clinical changes are traceable.
5. Core integrations are monitored and replayable.
6. Backups can be restored.
7. Critical incidents have documented response procedures.
8. Performance remains acceptable at target hospital scale.
9. Clinical users validate workflows.
10. Security testing has no unresolved critical findings.
11. Migration is reconciled.
12. Support and training are operational.

---

# 140. Immediate Engineering Backlog

The first engineering backlog should contain these epics:

## EPIC A — Monorepo Foundation

- initialize workspace
- TypeScript configs
- lint/format
- build pipeline
- package boundaries
- commit hooks

## EPIC B — Design System

- tokens
- typography
- navigation
- forms
- tables
- alerts
- clinical components

## EPIC C — Platform API

- NestJS
- config
- logging
- database
- migrations
- validation
- OpenAPI

## EPIC D — Auth and RBAC

- identity provider
- sessions
- roles
- permissions
- tenant context
- audit

## EPIC E — Patient 360

- patient
- MPI
- search
- duplicate detection
- identifiers

## EPIC F — Appointment / Queue

- calendar
- slots
- booking
- check-in
- queue

## EPIC G — OPD

- encounter
- notes
- diagnosis
- allergy
- prescription
- follow-up

## EPIC H — Billing

- charges
- invoice
- receipt
- payment

## EPIC I — Mobile Foundation

- Expo
- authentication
- patient dashboard
- clinician dashboard
- push notifications

---

# 141. First 100 Engineering Deliverables

The team should progressively create:

1. Repository
2. ADR system
3. CI pipeline
4. IaC baseline
5. Development environment
6. QA environment
7. Staging environment
8. Database migration system
9. Logging system
10. Tracing
11. Metrics
12. Error tracking
13. Auth
14. RBAC
15. Tenant isolation
16. Audit
17. File storage
18. Notification abstraction
19. Design system
20. Web shell
21. Mobile shell
22. Patient entity
23. MPI
24. Patient search
25. Patient merge
26. Practitioner
27. Facility
28. Department
29. Appointment
30. Schedule
31. Queue
32. Encounter
33. Clinical note
34. Problem list
35. Allergy
36. Medication
37. Prescription
38. Lab order
39. Sample
40. Lab result
41. Critical-result workflow
42. Pharmacy item
43. Batch/lot
44. Dispensing
45. Price list
46. Charge
47. Invoice
48. Payment
49. Admission
50. Bed
51. Bed assignment
52. Discharge
53. Nursing task
54. Vital
55. Medication administration
56. Document
57. PDF service
58. Notification engine
59. Patient portal
60. Mobile push
61. Integration framework
62. ABDM adapter skeleton
63. FHIR adapter skeleton
64. HL7 adapter skeleton
65. DICOM adapter skeleton
66. Workflow event bus
67. Outbox
68. Worker
69. Search
70. Command center projection
71. Quality indicator
72. Incident
73. RCA
74. CAPA
75. Evidence repository
76. Infection case
77. Claims
78. Authorization
79. Rejection
80. RCM ageing
81. AI gateway
82. AI audit
83. Data warehouse extraction
84. Migration tool
85. Migration validator
86. Support console
87. Feature flags
88. Release dashboard
89. Security dashboard
90. DR backup
91. Restore automation
92. E2E suite
93. Performance suite
94. Security test suite
95. Clinical safety suite
96. Runbooks
97. Customer onboarding flow
98. Training content
99. Pilot go-live checklist
100. Production readiness review

---

# 141A. Production UI Engineering Gates

The frontend roadmap shall treat the design system as a production platform, not a cosmetic activity. Before broad feature development:

1. Bootstrap Next.js, React and TypeScript with strict type checking.
2. Configure Tailwind CSS and initialize shadcn/ui.
3. Select and pin the shadcn/ui primitive family.
4. Create the HIMS theme and semantic tokens.
5. Implement accessibility foundations and keyboard-navigation standards.
6. Build the core shared component set.
7. Create visual regression and interaction tests for the shared components.
8. Establish the HIMS component review process so new domain screens consume shared components instead of introducing one-off UI patterns.
9. Validate complex data-table behavior, long clinical forms, responsive tablet layouts and printing/PDF workflows before production pilot.

No major clinical module should enter pilot merely because its screens are visually complete; its workflows must pass design-system, accessibility, authorization and clinical-safety gates.

# 142. Final Technology Recommendation

The recommended baseline is:

| Layer | Recommendation |
|---|---|
| Web | Next.js + React + TypeScript + Tailwind CSS + shadcn/ui |
| Mobile | React Native + Expo + TypeScript |
| Backend | NestJS + TypeScript |
| Primary DB / data platform | Self-hosted Supabase (PostgreSQL 18 baseline) |
| Cache | Redis |
| Jobs | BullMQ initially |
| Eventing | Transactional outbox; broker later |
| Object storage | S3-compatible |
| Search | PostgreSQL initially; OpenSearch later |
| API | REST + OpenAPI |
| Interoperability | FHIR + ABDM + HL7 + DICOM adapters |
| Realtime | WebSockets/SSE |
| Auth | OIDC/OAuth2 identity provider |
| Web tests | Playwright + Vitest |
| Mobile tests | Jest + React Native Testing Library + Detox where needed |
| API tests | Jest/Vitest + Supertest or equivalent |
| Load tests | k6 |
| Observability | OpenTelemetry + metrics/logging/tracing stack |
| IaC | Terraform |
| Containers | Docker |
| CI/CD | GitHub Actions or equivalent |
| Production hosting | Linux Docker / Kubernetes; AWS or equivalent cloud optional |
| Analytics | PostgreSQL projections first, warehouse later |
| AI | Internal AI gateway + controlled model providers |

React Native is therefore recommended for the **mobile application**, but not for the entire frontend. A web-first Next.js application using Tailwind CSS and shadcn/ui, plus React Native/Expo mobile applications, gives the HIMS the strongest combination of desktop clinical usability, tablet support, mobile reach, design-system consistency and code sharing.

---

# 143. Final Architecture Decision

The HIMS should be built as:

> **A modular, multi-tenant, API-first hospital operating platform with Next.js web clients, React Native/Expo mobile clients, a NestJS domain-oriented backend, PostgreSQL as the transactional source of truth, event-driven asynchronous processing, a dedicated interoperability layer, a first-class quality platform, controlled AI services, and cloud/private deployment portability.**

The architecture must optimize first for:

1. Patient safety.
2. Data integrity.
3. Hospital workflow correctness.
4. Security and privacy.
5. Interoperability.
6. Operational reliability.
7. Maintainability.
8. Scalability.
9. User experience.
10. Cost efficiency.

Only after these foundations are reliable should the platform aggressively expand into advanced AI, analytics and ecosystem capabilities.

---

# 144. Source and Technology References

1. Expo SDK 57 — https://expo.dev/sdk/57
2. Expo SDK reference — https://docs.expo.dev/versions/latest/
3. Expo React Native New Architecture — https://docs.expo.dev/guides/new-architecture/
4. Next.js release channel — https://nextjs.org/blog
5. NestJS modules — https://docs.nestjs.com/modules
6. NestJS documentation — https://docs.nestjs.com/
7. PostgreSQL versioning policy — https://www.postgresql.org/support/versioning/
8. PostgreSQL 18 documentation — https://www.postgresql.org/docs/18/
9. HL7 FHIR — https://www.hl7.org/fhir/R4/
10. HL7 FHIR architecture — https://hl7.org/fhir/R4/overview-arch.html
11. AWS EKS security guidance — https://docs.aws.amazon.com/eks/latest/best-practices/aiml-security.html
12. Supabase self-hosting — https://supabase.com/docs/guides/self-hosting
13. Supabase architecture — https://supabase.com/docs/guides/getting-started/architecture
14. Supabase Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security
15. NQAS Revised Standards 2024 — https://qps.nhsrcindia.org/national-quality-assurance-standards/quality-RNQAS
16. NHSRC NQAS QA Directives — https://qps.nhsrcindia.org/repository-standard/quality-QA-Directives
17. NQAS Integrated LaQshya/MusQan directive (28 Jan 2026) — https://qps.nhsrcindia.org/sites/default/files/2026-02/DO%20LETTER%20NHM-1-integration%20of%20LaQshya%20MusQan%20%20within%20NQAS%20framework%20-%2028.1.26.pdf
18. NHCX — https://nhcx.abdm.gov.in/procedure-type
19. MeitY DPDP Rules 2025 — https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
20. HL7 FHIR R5 — https://hl7.org/fhir/R5/
21. DICOMweb — https://www.dicomstandard.org/

Technology versions in this document are recommendations based on the state of the ecosystem on 2026-09-25. Exact patch versions must be frozen in the repository after dependency compatibility testing and upgraded through the project's release process.

---

# 145. Implementation Note

This document is intentionally more prescriptive than the PRD and SRS because the purpose is to guide actual engineering.

The implementation team should treat `PRD.md`, `SRS.md`, and `development.md` as a three-layer specification:

```text
PRD.md
What / Why
    |
    v
SRS.md
System behavior / Requirements
    |
    v
development.md
Architecture / Engineering / Operations / Delivery
```

Any conflict among the three documents must be resolved through an Architecture Decision Record or Product Decision Record rather than silently changing implementation behavior.
