# HIMS API Contract

**Status:** Engineering baseline  
**Version:** 1.0  
**Date:** 2026-09-25  
**Base path:** `/api/v1`  
**Protocol:** HTTPS JSON REST; WebSocket/SSE for selected realtime channels; FHIR/HL7/DICOM/NHCX adapters at the interoperability boundary.

## 1. Contract objectives

This document is the canonical application-facing API contract for the multi-tenant HIMS. It complements `DATABASE_SCHEMA.md`, `EVENT_CATALOGUE.md`, and `PERMISSION_MATRIX.md`.

The API must preserve these invariants:

- one tenant context per request;
- one canonical patient identity;
- explicit facility and department scope;
- server-side authorization;
- state-machine enforcement on the backend;
- auditability of high-risk changes;
- idempotency for retryable commands;
- provenance for clinical data;
- no direct client write access to business tables.

## 2. Runtime topology

```text
Web (Next.js + shadcn/ui)                 Mobile (React Native/Expo)
              |                                      |
              +------------------+-------------------+
                                 |
                            NestJS API
                                 |
             +-------------------+-------------------+
             |                   |                   |
       Auth validation      Authorization         Audit
             |                   |                   |
             +-------------------+-------------------+
                                 |
                         Domain Application
                                 |
                    PostgreSQL / Supabase
```

Supabase Auth authenticates the user. The NestJS API determines active tenant/facility/department scope. PostgreSQL RLS provides additional tenant-isolation defense in depth.

## 3. Authentication

### 3.1 Web

Use secure, HttpOnly session cookies at the application boundary. Browser code must never receive the Supabase secret/server key.

### 3.2 Mobile

Use a bearer access token issued by Supabase Auth:

```http
Authorization: Bearer <token>
```

### 3.3 Token validation

NestJS validates the JWT using the configured signing key/JWKS. The authenticated subject becomes the internal `user_id`.

The API must not trust these client-supplied values as authority:

- `tenantId` in body;
- arbitrary `facilityId` without membership validation;
- arbitrary role/permission claims from user-editable metadata;
- `X-Tenant-Id` headers.

Supabase's current security guidance warns against user-editable `user_metadata`/`raw_user_meta_data` for authorization and against exposing service-role/secret keys in clients. citeturn863674search3

## 4. Standard request headers

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
X-Correlation-Id: <uuid-or-ulid>
X-Facility-Id: <facility-id>          # optional context selector; server validates
Idempotency-Key: <opaque-key>         # required for specified commands
If-Match: "<resource-version>"        # required for selected high-risk updates
Accept-Language: en-IN
```

Tenant context is derived from the authenticated membership; there is no trusted client-side tenant header.

## 5. Standard response shapes

### Single resource

```json
{
  "data": {},
  "meta": {
    "correlationId": "..."
  }
}
```

### List

```json
{
  "data": [],
  "meta": {
    "nextCursor": "...",
    "hasMore": true,
    "correlationId": "..."
  }
}
```

### Error

```json
{
  "error": {
    "code": "CONCURRENT_UPDATE",
    "message": "The resource was changed by another user.",
    "details": [],
    "correlationId": "..."
  }
}
```

## 6. HTTP semantics

| Status | Use                                  |
| -----: | ------------------------------------ |
|    200 | successful read/update               |
|    201 | created                              |
|    202 | accepted for asynchronous processing |
|    204 | successful empty response            |
|    400 | malformed/invalid request            |
|    401 | authentication missing/invalid       |
|    403 | not authorized                       |
|    404 | resource unavailable/not visible     |
|    409 | state or concurrency conflict        |
|    422 | semantic validation failure          |
|    429 | rate limited                         |
|    500 | internal failure                     |
|    502 | external dependency failed           |
|    503 | service temporarily unavailable      |
|    504 | external dependency timeout          |

Cross-tenant lookup failures must not reveal whether the requested identifier exists.

## 7. Pagination/filtering/sorting

Use cursor pagination for high-volume resources:

```text
?limit=50&cursor=<opaque>&sort=-createdAt&status=ACTIVE
```

Allow standard filters:

- `status`
- `departmentId`
- `facilityId`
- `from`
- `to`
- `patientId`
- `priority`
- domain-specific filters.

The API must cap maximum page size.

## 8. Concurrency and finalization

High-risk resources require optimistic concurrency using `If-Match` or a `version` field.

Finalized resources are not modified by ordinary PATCH operations. Use domain-specific amendment commands.

Examples:

```text
POST /lab/results/{id}/amend
POST /radiology/reports/{id}/amend
POST /clinical-notes/{id}/amend
```

---

# 9. Platform and organization APIs

```text
GET    /tenants/{tenantId}
PATCH  /tenants/{tenantId}
GET    /tenants/{tenantId}/settings
PATCH  /tenants/{tenantId}/settings

GET    /facilities
POST   /facilities
GET    /facilities/{facilityId}
PATCH  /facilities/{facilityId}
GET    /facilities/{facilityId}/departments
GET    /facilities/{facilityId}/locations

GET    /departments
POST   /departments
GET    /departments/{departmentId}
PATCH  /departments/{departmentId}

GET    /users
POST   /users/invite
GET    /users/{userId}
PATCH  /users/{userId}
POST   /users/{userId}/deactivate
POST   /users/{userId}/reactivate

GET    /roles
POST   /roles
PATCH  /roles/{roleId}
PUT    /roles/{roleId}/permissions
GET    /permissions
PUT    /users/{userId}/facility-access
PUT    /users/{userId}/department-access
```

Tenant/facility management endpoints are restricted to appropriate administrative roles.

---

# 10. Patient / MPI APIs

```text
GET    /patients?q=
POST   /patients
GET    /patients/{patientId}
PATCH  /patients/{patientId}
GET    /patients/{patientId}/identifiers
POST   /patients/{patientId}/identifiers
PATCH  /patients/{patientId}/identifiers/{identifierId}
GET    /patients/{patientId}/contacts
POST   /patients/{patientId}/contacts
PATCH  /patients/{patientId}/contacts/{contactId}
GET    /patients/{patientId}/allergies
POST   /patients/{patientId}/allergies
PATCH  /patients/{patientId}/allergies/{allergyId}
GET    /patients/{patientId}/conditions
POST   /patients/{patientId}/conditions
GET    /patients/{patientId}/history
GET    /patients/{patientId}/consents
POST   /patients/{patientId}/consents
POST   /patients/{patientId}/consents/{consentId}/withdraw
GET    /patients/{patientId}/merge-candidates
POST   /patients/{patientId}/merge
GET    /patients/{patientId}/access-history
POST   /patients/{patientId}/export
```

### Create patient contract

Required/conditional fields:

```json
{
  "firstName": "string",
  "lastName": "string|null",
  "dateOfBirth": "YYYY-MM-DD|null",
  "dobPrecision": "EXACT|YEAR|APPROXIMATE|null",
  "sexAtBirth": "string|null",
  "mobile": "string|null",
  "identifiers": [],
  "facilityId": "uuid"
}
```

Response:

```json
{
  "data": {
    "patientId": "uuid",
    "uhid": "TENANT-000001",
    "duplicateReviewRequired": false,
    "duplicateCandidates": []
  }
}
```

Patient creation from Emergency, OPD or other modules invokes the same patient creation/search service. No module has a separate patient register.

---

# 11. Practitioner/catalog APIs

```text
GET    /practitioners
POST   /practitioners
GET    /practitioners/{id}
PATCH  /practitioners/{id}
GET    /specialties
GET    /services
POST   /services
GET    /medications
GET    /lab/tests
GET    /radiology/procedures
GET    /tariffs
```

Catalog masters are tenant/facility configurable where appropriate; national/reference codes should support controlled global master data.

---

# 12. Encounter APIs

```text
POST   /encounters
GET    /encounters/{encounterId}
GET    /patients/{patientId}/encounters
PATCH  /encounters/{encounterId}
POST   /encounters/{encounterId}/start
POST   /encounters/{encounterId}/sign
POST   /encounters/{encounterId}/close
GET    /patients/{patientId}/timeline
```

Creation requires:

- patient;
- facility;
- department;
- encounter type;
- practitioner when required;
- source encounter when this is a child/derived encounter.

---

# 13. OPD API contract

### Appointment

```text
POST   /opd/appointments
GET    /opd/appointments
GET    /opd/appointments/{appointmentId}
PATCH  /opd/appointments/{appointmentId}
POST   /opd/appointments/{appointmentId}/confirm
POST   /opd/appointments/{appointmentId}/check-in
POST   /opd/appointments/{appointmentId}/cancel
POST   /opd/appointments/{appointmentId}/no-show
```

### Queue

```text
GET    /opd/queues
GET    /opd/queues/{queueId}/tickets
POST   /opd/queues/{queueId}/tickets
POST   /opd/tickets/{ticketId}/call
POST   /opd/tickets/{ticketId}/start-consultation
POST   /opd/tickets/{ticketId}/complete
```

### Consultation

```text
POST   /opd/encounters
GET    /opd/encounters/{encounterId}
POST   /opd/encounters/{encounterId}/notes
POST   /opd/encounters/{encounterId}/diagnoses
POST   /opd/encounters/{encounterId}/observations
POST   /opd/encounters/{encounterId}/orders
POST   /opd/encounters/{encounterId}/prescriptions
POST   /opd/encounters/{encounterId}/referrals
POST   /opd/encounters/{encounterId}/admission-request
```

### Department rule

A Medicine OPD encounter must carry the Medicine department context. ENT, Dental, Surgery and other specialties follow the same model. The API validates practitioner-to-department authorization.

---

# 14. IPD API contract

### Admission

```text
POST   /ipd/admission-requests
GET    /ipd/admission-requests
GET    /ipd/admission-requests/{id}
POST   /ipd/admission-requests/{id}/approve
POST   /ipd/admissions
GET    /ipd/admissions/{admissionId}
POST   /ipd/admissions/{admissionId}/admit
POST   /ipd/admissions/{admissionId}/transfer
GET    /ipd/admissions/{admissionId}/movements
```

### Beds

```text
GET    /ipd/beds
GET    /ipd/beds/board
POST   /ipd/beds/{bedId}/reserve
POST   /ipd/beds/{bedId}/assign
POST   /ipd/beds/{bedId}/release
POST   /ipd/beds/{bedId}/block
POST   /ipd/beds/{bedId}/unblock
```

### Nursing

```text
GET    /ipd/wards/{departmentId}/workbench
GET    /ipd/admissions/{admissionId}/nursing-notes
POST   /ipd/admissions/{admissionId}/nursing-notes
POST   /ipd/admissions/{admissionId}/vitals
GET    /ipd/admissions/{admissionId}/tasks
POST   /ipd/admissions/{admissionId}/tasks
POST   /ipd/tasks/{taskId}/complete
GET    /ipd/admissions/{admissionId}/handover
POST   /ipd/admissions/{admissionId}/handover/finalize
```

### Doctor/discharge

```text
GET    /ipd/admissions/{id}/doctor-notes
POST   /ipd/admissions/{id}/doctor-notes
GET    /ipd/admissions/{id}/discharge-summary
POST   /ipd/admissions/{id}/discharge-summary/draft
POST   /ipd/admissions/{id}/discharge-summary/finalize
POST   /ipd/admissions/{id}/discharge
```

### IPD → ICU

```text
POST   /ipd/admissions/{admissionId}/icu-transfer-request
GET    /icu/transfer-requests
POST   /icu/transfer-requests/{id}/accept
POST   /icu/transfer-requests/{id}/reject
```

### IPD → OT

```text
POST   /ipd/admissions/{admissionId}/ot-request
```

The IPD command creates an OT request; OT owns scheduling and case lifecycle.

---

# 15. LIS API contract

```text
GET    /lab/tests
POST   /lab/orders
GET    /lab/orders/{labOrderId}
GET    /lab/worklists
POST   /lab/orders/{labOrderId}/collect
POST   /lab/specimens/{specimenId}/receive
POST   /lab/specimens/{specimenId}/reject
GET    /lab/results/{resultId}
POST   /lab/results/{resultId}/enter
POST   /lab/results/{resultId}/verify
POST   /lab/results/{resultId}/release
POST   /lab/results/{resultId}/amend
POST   /lab/results/{resultId}/critical-acknowledgement
GET    /lab/instruments
POST   /lab/instruments/{id}/test-connection
GET    /lab/qc/runs
POST   /lab/qc/runs
```

Released result amendment must create a new version and preserve the original result.

---

# 16. RIS API contract

```text
GET    /radiology/modalities
GET    /radiology/worklist
POST   /radiology/orders
GET    /radiology/orders/{id}
POST   /radiology/orders/{id}/schedule
POST   /radiology/orders/{id}/start
POST   /radiology/studies
GET    /radiology/studies/{id}
PATCH  /radiology/studies/{id}
POST   /radiology/reports/{studyId}/draft
POST   /radiology/reports/{studyId}/verify
POST   /radiology/reports/{studyId}/release
POST   /radiology/reports/{studyId}/amend
POST   /radiology/studies/{studyId}/open-pacs
```

PACS/DICOM credentials remain server-side.

---

# 17. Emergency API contract

```text
POST   /emergency/encounters
GET    /emergency/board
GET    /emergency/encounters/{id}
POST   /emergency/encounters/{id}/triage
POST   /emergency/encounters/{id}/resuscitation
POST   /emergency/encounters/{id}/orders
POST   /emergency/encounters/{id}/observation
POST   /emergency/encounters/{id}/disposition/admit
POST   /emergency/encounters/{id}/disposition/icu
POST   /emergency/encounters/{id}/disposition/transfer
POST   /emergency/encounters/{id}/disposition/discharge
POST   /emergency/encounters/{id}/mlc
POST   /emergency/encounters/{id}/close
```

Emergency can create a patient if no matching patient exists, using the same MPI service.

---

# 18. OT API contract

```text
GET    /ot/rooms
GET    /ot/board
POST   /ot/surgery-requests
GET    /ot/surgery-requests
GET    /ot/surgery-requests/{id}
POST   /ot/surgery-requests/{id}/approve
POST   /ot/surgery-requests/{id}/schedule
POST   /ot/cases
GET    /ot/cases/{caseId}
POST   /ot/cases/{caseId}/sign-in
POST   /ot/cases/{caseId}/time-out
POST   /ot/cases/{caseId}/procedure-note
POST   /ot/cases/{caseId}/anaesthesia-record
POST   /ot/cases/{caseId}/sign-out
POST   /ot/cases/{caseId}/complete
POST   /ot/cases/{caseId}/specimens
```

OT scheduling must support cases originating from any configured procedural department, not only Surgery.

---

# 19. ICU API contract

```text
GET    /icu/units
GET    /icu/board
GET    /icu/transfer-requests
POST   /icu/admissions
GET    /icu/admissions/{id}
POST   /icu/admissions/{id}/flowsheet
POST   /icu/admissions/{id}/device
POST   /icu/admissions/{id}/infusion
POST   /icu/admissions/{id}/transfer-out
POST   /icu/admissions/{id}/discharge
GET    /icu/admissions/{id}/handover
```

---

# 20. Pharmacy API contract

```text
GET    /pharmacy/prescriptions/queue
GET    /pharmacy/prescriptions/{id}
POST   /pharmacy/prescriptions/{id}/verify
POST   /pharmacy/prescriptions/{id}/dispense
POST   /pharmacy/dispensings/{id}/complete
POST   /pharmacy/dispensings/{id}/cancel
GET    /pharmacy/medication-orders/queue
GET    /pharmacy/stock
GET    /pharmacy/stock/expiring
POST   /pharmacy/stock/transfer
POST   /pharmacy/stock/adjustment
GET    /pharmacy/purchases
POST   /pharmacy/purchases
POST   /pharmacy/purchases/{id}/approve
POST   /pharmacy/goods-receipts
POST   /pharmacy/returns
POST   /pharmacy/recalls
```

The `medication-orders/queue` endpoint must surface active IPD medication orders. Re-entry is prohibited.

A successful dispensing transaction atomically links:

`patient + encounter + prescription/order + medication + batch + pharmacist + quantity + charge/reference`.

---

# 21. EMR API contract

```text
GET    /emr/patients/{patientId}/summary
GET    /emr/patients/{patientId}/timeline
GET    /emr/patients/{patientId}/encounters
GET    /emr/patients/{patientId}/conditions
GET    /emr/patients/{patientId}/allergies
GET    /emr/patients/{patientId}/medications
GET    /emr/patients/{patientId}/lab-results
GET    /emr/patients/{patientId}/imaging
GET    /emr/patients/{patientId}/procedures
GET    /emr/patients/{patientId}/surgeries
GET    /emr/patients/{patientId}/admissions
GET    /emr/patients/{patientId}/prescriptions
GET    /emr/patients/{patientId}/documents
GET    /emr/patients/{patientId}/access-history
```

Responses include `sourceDomain`, `sourceRecordId`, `sourceEventId` and timestamps for traceability.

---

# 22. Billing / RCM API contract

```text
GET    /billing/services
GET    /billing/tariffs
POST   /billing/tariffs
GET    /billing/charges
POST   /billing/charges
POST   /billing/invoices
GET    /billing/invoices
GET    /billing/invoices/{id}
POST   /billing/invoices/{id}/finalize
POST   /billing/payments
POST   /billing/payments/{id}/reverse
POST   /billing/refunds
POST   /billing/refunds/{id}/approve
GET    /billing/outstanding

GET    /rcm/workqueue
GET    /rcm/claims
POST   /rcm/claims/{id}/prepare
POST   /rcm/claims/{id}/submit
POST   /rcm/claims/{id}/resubmit
POST   /rcm/claims/{id}/reconcile
GET    /rcm/ageing
GET    /rcm/rejections
```

---

# 23. Insurance API contract

```text
GET    /insurance/payers
POST   /insurance/payers
GET    /insurance/plans
POST   /insurance/plans
GET    /insurance/policies/{patientId}
POST   /insurance/policies/verify
POST   /insurance/eligibility-checks
POST   /insurance/preauthorizations
GET    /insurance/preauthorizations/{id}
POST   /insurance/preauthorizations/{id}/submit
POST   /insurance/preauthorizations/{id}/approve
POST   /insurance/claims
GET    /insurance/claims/{id}
POST   /insurance/claims/{id}/submit
POST   /insurance/claims/{id}/resubmit
POST   /insurance/claims/{id}/documents
POST   /insurance/remittances
POST   /insurance/remittances/{id}/reconcile
```

Government and private scheme differences are expressed through payer/plan configuration and external adapters. Do not create one hard-coded endpoint family per scheme.

---

# 24. Quality API contract

```text
GET    /quality/indicators
POST   /quality/indicators
POST   /quality/indicator-observations
GET    /quality/dashboard
POST   /quality/incidents
GET    /quality/incidents
GET    /quality/incidents/{id}
POST   /quality/incidents/{id}/investigate
POST   /quality/incidents/{id}/capa
POST   /quality/capas/{id}/actions
POST   /quality/capas/{id}/verify
POST   /quality/capas/{id}/close
POST   /quality/audits
GET    /quality/audits/{id}
POST   /quality/audits/{id}/findings
GET    /quality/accreditation/requirements
POST   /quality/accreditation/evidence
```

---

# 25. Documents API contract

```text
POST   /documents/presign-upload
POST   /documents/complete-upload
GET    /documents/{id}
GET    /documents/{id}/download-url
POST   /documents/{id}/new-version
POST   /documents/{id}/sign
POST   /documents/{id}/amend
```

Use signed object-storage URLs. Do not expose storage credentials.

---

# 26. Workflow API contract

```text
GET    /workflows/definitions
POST   /workflows/definitions
GET    /workflows/instances/{id}
POST   /workflows/instances
GET    /tasks/my
POST   /tasks/{id}/claim
POST   /tasks/{id}/complete
POST   /approvals
POST   /approvals/{id}/approve
POST   /approvals/{id}/reject
```

---

# 27. Integration API contract

```text
GET    /integrations
GET    /integrations/{id}
GET    /integrations/{id}/health
POST   /integrations/{id}/test
GET    /integrations/{id}/messages
POST   /integrations/messages/{messageId}/retry
POST   /integrations/messages/{messageId}/replay
GET    /integrations/dead-letters
POST   /integrations/dead-letters/{id}/replay
```

External adapters:

```text
ABDM/HIE
FHIR
HL7
DICOM/DICOMweb
NHCX/payer
Payment
SMS/WhatsApp/Email
Legacy migration
```

Exact external payloads must come from the current authoritative implementation guides at integration time.

---

# 28. Realtime API/channels

Use WebSockets or SSE for:

```text
facility:{facilityId}:opd-queue
facility:{facilityId}:bed-board
facility:{facilityId}:emergency
facility:{facilityId}:icu
facility:{facilityId}:ot-board
department:{departmentId}:lab-worklist
department:{departmentId}:radiology-worklist
user:{userId}:alerts
```

Every subscription is server-authorized against tenant/facility/department scope.

## 28.1 Message example

```json
{
  "type": "bed.updated",
  "version": 1,
  "occurredAt": "2026-09-25T11:00:00Z",
  "facilityId": "...",
  "resourceId": "...",
  "data": {
    "state": "CLEANING"
  }
}
```

---

# 29. Core cross-module commands

## 29.1 OPD consultation → Pharmacy

```text
POST /opd/encounters/{encounterId}/prescriptions
       ↓
pharmacy prescription queue
```

No manual re-entry.

## 29.2 OPD consultation → LIS

```text
POST /opd/encounters/{encounterId}/orders
       ↓
lab order queue
```

## 29.3 OPD → IPD

```text
POST /opd/encounters/{encounterId}/admission-request
       ↓
POST /ipd/admission-requests/{id}/approve
       ↓
POST /ipd/admissions
```

Source encounter remains linked.

## 29.4 IPD → ICU

```text
POST /ipd/admissions/{id}/icu-transfer-request
       ↓
POST /icu/transfer-requests/{id}/accept
       ↓
POST /icu/admissions
```

## 29.5 IPD → OT

```text
POST /ipd/admissions/{id}/ot-request
       ↓
POST /ot/surgery-requests/{id}/schedule
```

## 29.6 Lab/Radiology → EMR

Results/report release emits domain events. EMR projections consume them and create timeline/read-model entries.

## 29.7 Pharmacy → EMR/Billing

Dispensing produces medication history/provenance and, where configured, a billable charge.

## 29.8 Insurance → Billing

```text
policy → eligibility → pre-auth → claim → remittance → reconciliation
```

---

# 30. Query/read-model APIs

The following can use denormalized read projections without changing authoritative data ownership:

```text
GET /dashboard/command-center
GET /dashboard/opd
GET /dashboard/ipd
GET /dashboard/emergency
GET /dashboard/icu
GET /dashboard/ot
GET /dashboard/lab
GET /dashboard/radiology
GET /dashboard/pharmacy
GET /dashboard/rcm
GET /dashboard/quality
```

Dashboards must not execute expensive cross-domain transactional joins on every page render. Prefer projections/materialized views for high-use operational screens.

---

# 31. File upload contract

```text
POST /documents/presign-upload
      ↓
object storage upload
      ↓
POST /documents/complete-upload
      ↓
checksum + mime + size validation
      ↓
malware/OCR pipeline
      ↓
AVAILABLE
```

Do not mark documents available before integrity/security checks where those controls are required.

---

# 32. AI API contract

All AI functions are mediated through the internal AI gateway:

```text
POST /ai/requests
GET  /ai/requests/{id}
POST /ai/requests/{id}/review
POST /ai/requests/{id}/accept
POST /ai/requests/{id}/reject
```

Example use cases:

```text
doctor.longitudinal_summary
doctor.note_draft
doctor.discharge_draft
nurse.handover_draft
quality.capa_summary
finance.revenue_variance
claims.rejection_summary
admin.daily_brief
```

No client sends patient context directly to a third-party model endpoint.

---

# 33. Audit contract

The following commands must emit audit records:

- patient creation/update/merge;
- clinical finalization/amendment;
- result verification/release/amendment;
- medication dispensing;
- payment/reversal/refund;
- claim submission/resubmission/settlement;
- role/permission changes;
- bulk exports;
- break-glass access;
- AI use involving patient data;
- workflow approvals;
- integration replay.

Audit references `tenantId`, `facilityId`, `actorUserId`, resource, patient/encounter where applicable, correlation ID, timestamp and reason.

---

# 34. Security contract

The API implementation must enforce:

- TLS in production;
- secure HTTP headers;
- authentication expiration/refresh policy;
- rate limiting;
- input/schema validation;
- object-level authorization;
- tenant isolation;
- no mass-assignment of privileged fields;
- safe file upload;
- audit logging;
- no secret leakage in logs/responses;
- CSRF protection where cookie-based web sessions are used;
- CORS allowlisting.

## 34.1 Direct database access rule

Application clients must not call PostgREST endpoints such as `/rest/v1/hims_patient_patients` for business writes. Domain writes happen through NestJS to preserve business rules, transactions, audit and workflow orchestration.

---

# 35. OpenAPI repository structure

```text
contracts/
  openapi.yaml
  schemas/
    common.yaml
    patient.yaml
    encounter.yaml
    opd.yaml
    ipd.yaml
    lab.yaml
    radiology.yaml
    emergency.yaml
    ot.yaml
    icu.yaml
    pharmacy.yaml
    billing.yaml
    insurance.yaml
    quality.yaml
    documents.yaml
    workflow.yaml
    integration.yaml
    ai.yaml
```

TypeScript clients and server DTO validation schemas should be generated/derived from the OpenAPI contract where practical.

---

# 36. API definition-of-done

An endpoint is production-ready when:

1. Its authorization policy is defined.
2. Tenant/facility/department scope is defined.
3. Request and response schemas are in OpenAPI.
4. Error codes are documented.
5. State transitions are server-enforced.
6. Audit behaviour is documented.
7. Idempotency/concurrency strategy is defined.
8. Cross-module events are defined.
9. Unit + integration tests exist.
10. E2E test exists for critical clinical/financial workflows.
11. Observability includes correlation IDs.
12. Documentation is updated.
