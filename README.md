# Next-Generation Hospital Information Management System (HIMS)

> **One patient. One longitudinal record. One operational truth. One hospital command center.**

An enterprise-grade, India-first Hospital Information Management System & Hospital Operating System engineered to connect clinical care, nursing, diagnostics, pharmacy, operations, finance, quality, accreditation, interoperability, and AI.

---

## 🏛️ Architecture Overview

The system is structured as a high-performance modular monolith with strict domain boundaries and a modern two-surface frontend architecture:

```text
                           ┌──────────────────────────────┐
                           │          FRONTENDS           │
                           │ Next.js Web + React Native   │
                           │ Expo Mobile (Clinician/User) │
                           │ Tailwind v4 + shadcn/ui      │
                           └──────────────┬───────────────┘
                                          │ HTTPS / WebSocket
                               ┌──────────▼──────────┐
                               │  NestJS Backend API │
                               │  Canonical Business │
                               │  Logic & Security   │
                               └──────────┬──────────┘
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       │                                  │                                  │
┌──────▼──────┐                  ┌────────▼────────┐                 ┌───────▼──────┐
│  CLINICAL   │                  │  OPERATIONAL    │                 │  FINANCIAL   │
│  OPD / IPD  │                  │  Orders / Queue │                 │  Billing     │
│  Emergency  │                  │  Bed Board      │                 │  Insurance   │
│  ICU / OT   │                  │  Workflow       │                 │  Claims      │
│  LIS / RIS  │                  │  Notifications  │                 │  RCM         │
│  Pharmacy   │                  │  Quality OS     │                 │  Tariffs     │
│  EMR (360)  │                  │  Command Center │                 │  Packages    │
└──────┬──────┘                  └────────┬────────┘                 └───────┬──────┘
       │                                  │                                  │
       └──────────────────────────────────┼──────────────────────────────────┘
                                          │
                    ┌─────────────────────▼──────────────────────┐
                    │            SELF-HOSTED SUPABASE            │
                    │ PostgreSQL 18 | Auth | Realtime | Storage  │
                    └─────────────────────┬──────────────────────┘
                                          │
               ┌──────────────────────────┼───────────────────────────┐
               │                          │                           │
         ┌─────▼──────┐             ┌─────▼─────┐              ┌──────▼─────┐
         │ Redis 7    │             │ BullMQ    │              │ Integrations
         │ Cache/Lock │             │ Workers   │              │ ABDM/FHIR  │
         └────────────┘             └───────────┘              │ HL7/DICOM  │
```

---

## 📦 Monorepo Workspace Layout

```text
hims/
├── apps/
│   ├── api/                    # NestJS modular backend API
│   ├── web/                    # Next.js 16 + React 19 + shadcn/ui + Tailwind v4 Web App
│   ├── worker/                 # BullMQ asynchronous background worker process
│   ├── clinician-mobile/       # Expo React Native App for Doctors and Nurses
│   └── patient-mobile/         # Expo React Native App for Patients & Portals
│
├── packages/
│   ├── domain-types/           # TypeScript interfaces & types across all 10 core domains
│   ├── validation/             # Zod validation schemas for all commands and entities
│   ├── api-client/             # Type-safe API client for web and mobile
│   ├── ui/                     # HIMS Design System built on Tailwind v4 & shadcn/ui primitives
│   ├── auth/                   # RBAC/ABAC authorization policies & token utilities
│   ├── date-time/              # Safe date/time helpers and clinical formatting
│   ├── localization/           # Multi-lingual dictionaries & Indian locale/currency helpers
│   ├── telemetry/              # OpenTelemetry instrumentation, correlation IDs & structured logging
│   ├── clinical-safety/        # Allergy checks, drug interactions & critical alert rules
│   └── config/                 # Shared TypeScript, ESLint and Prettier configs
│
├── integrations/
│   ├── abdm/                   # Ayushman Bharat Digital Mission (ABDM) M1/M2/M3 Adapter
│   ├── fhir/                   # HL7 FHIR R4/R5 Profiles and resource converters
│   ├── hl7/                    # HL7 v2 Message Parsers and integration bridges
│   ├── dicom/                  # Orthanc PACS & DICOMweb Imaging bridge
│   └── payers/                 # NHCX and Insurance TPA gateway clients
│
├── supabase/
│   ├── migrations/             # 131-table authoritative relational PostgreSQL 18 schema
│   └── seed/                   # Bootstrap seed data for tenants, facilities, catalogues
│
├── infra/
│   ├── docker/                 # Docker Compose development infrastructure
│   ├── k8s/                    # Kubernetes manifests & Helm charts
│   └── terraform/              # Infrastructure-as-Code definitions
│
├── doc/                        # Architecture blueprints, SRS, PRD, API contract, schemas
├── package.json                # Turborepo and pnpm workspace configuration
└── docker-compose.yml          # Local developer stack (Postgres, Redis, Orthanc, Gotenberg, etc.)
```

---

## 🚀 Ten Mandatory Core Modules

1. **OPD (Outpatient Department):** Department-specific registration, queue management, consultations, clinical notes, prescriptions, and OPD-to-IPD admission orders.
2. **IPD (Inpatient Department):** Department bed pools, ward stations, nursing assessments, daily vitals, doctor notes, medication administration records (MAR), and discharge summaries.
3. **LIS (Laboratory Information System):** Pre-analytical, analytical, and post-analytical workflows, sample accessioning, analyzer integration, QC, delta checks, critical values, and verification.
4. **RIS (Radiology Information System):** Modality worklists, PACS/DICOM integration, study management, radiologist diagnostic reporting, and report verification.
5. **Emergency (ED):** Rapid registration, triage acuity scoring (ESI), resuscitation, emergency orders, observation, and MLC tracking.
6. **OT Management (Operating Theatre):** Surgical case scheduling, WHO surgical safety checklists, anesthesia records, intra-operative documentation, recovery, and implant tracking.
7. **ICU (Intensive Care Unit):** Bed management, critical care observations, intensive flowsheets, infusion monitoring, ventilator parameters, and step-down workflows.
8. **Pharmacy Management:** OPD & IPD medication queues, verification, batch/expiry FEFO dispensing, substitutions, returns, and inventory stock ledgers.
9. **EMR (Electronic Medical Record):** Unified Patient 360 longitudinal record with source provenance from all clinical departments.
10. **Insurance & Claims:** Government schemes (PM-JAY, state plans) and private payers, pre-authorizations, package tariff rules, claim submissions, queries, and remittances.

---

## 🛠️ Quick Start

### Prerequisites
- Node.js >= 22.0.0 (v24 LTS recommended)
- pnpm >= 10.0.0
- Docker Desktop or Linux Docker Engine

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Infrastructure
```bash
docker-compose up -d
```

### 3. Initialize Database Migrations & Seeds
```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Start Development Servers
```bash
pnpm dev
```
- **Web Portal:** `http://localhost:3000`
- **Backend API:** `http://localhost:4000/api/v1`
- **Swagger Documentation:** `http://localhost:4000/api/docs`
- **Mailpit Web UI:** `http://localhost:8025`
- **Orthanc PACS:** `http://localhost:8042`
- **OpenSearch:** `http://localhost:9200`
