# Product Requirements Document (PRD)

## Next-Generation Hospital Information Management System (HIMS)

**Working product name:** TBD  
**Product category:** Hospital Information Management / Hospital Operating System  
**Document status:** Product baseline / implementation blueprint  
**Version:** 2.0  
**Date:** 2026-09-25  
**Owner:** Product & Engineering  
**Pricing:** TBD  
**Final product name:** TBD

---

## 1. Executive Summary

This PRD defines a modern, India-first HIMS intended to compete with and materially improve upon products such as Bharat HIMS. The system must not be designed as a loose collection of hospital modules. It must operate as a unified hospital operating system connecting clinical care, nursing, diagnostics, pharmacy, operations, finance, quality, accreditation, interoperability, patient engagement, automation, and AI.

The product vision is:

> **One patient. One longitudinal record. One operational truth. One hospital command center.**

The system shall support clinics, nursing homes, small hospitals, mid-sized hospitals, multi-specialty hospitals, hospital groups, diagnostic centres, and satellite facilities through configuration rather than separate codebases.

The product must be:

- India-first and ABDM-ready.
- Workflow-first rather than module-first.
- API-first and interoperability-oriented.
- Cloud-native but deployable in private/on-premise environments for suitable customers.
- Multi-tenant and multi-facility.
- Privacy, security, audit, and consent aware.
- Accreditation-supportive rather than making unsupported claims of accreditation compliance.
- Automation-centric.
- AI-assisted, with human oversight and safety controls.
- Usable by clinicians and hospital staff with minimal training.

## 1.1 Frontend and Design-System Decision

The web application shall use **Next.js + React + TypeScript + Tailwind CSS + shadcn/ui** as the standard frontend foundation. shadcn/ui is adopted as the source-owned component system rather than as an unmodified third-party visual theme. Its components are composed into a proprietary HIMS Design System covering clinical, operational, financial, quality and administrative workflows.

The project shall use shadcn/ui components for foundational controls such as buttons, inputs, forms, comboboxes, calendars, dialogs, drawers, sheets, tabs, badges, alerts, command interfaces, navigation, tables and data-table primitives. The official shadcn documentation supports Tailwind v4 and React 19, and its data-table guidance is designed to be composed with TanStack Table. citeturn571449search0turn571449search1

The HIMS shall **not** treat shadcn/ui as the complete clinical UI. Domain-specific components shall be built on top of the foundation, including PatientHeader, PatientIdentityCard, ClinicalAlert, VitalSignsPanel, MedicationMAR, LabResultGrid, BedBoard, EDTriageBoard, OTBoard, NursingFlowsheet, DischargeChecklist, NABHIndicatorCard, CAPAWorkflow, ClaimTimeline and HospitalCommandCenter.

The mobile applications shall use **React Native + Expo + TypeScript** with a mobile-native implementation of the same HIMS design tokens and interaction semantics. shadcn/ui components shall not be forced directly into React Native.

This decision provides code ownership, accessibility-oriented primitives, visual consistency and extensive customization while keeping dense hospital workflows optimized for desktop/tablet web interfaces. shadcn/ui supports multiple primitive implementations; new projects currently default to Base UI while Radix remains supported. The implementation team shall select and pin one primitive family during project bootstrap and shall not switch primitive families mid-release. citeturn571449search5

---

## 1.2 Audited Scope Baseline — Ten Core Departments/Modules

The production product baseline is explicitly defined around the following ten core departmental/clinical modules. Cross-cutting platform services such as identity, Patient 360, orders, notifications, documents, audit, workflow, interoperability, analytics and AI are not counted as additional clinical departments; they are shared platform capabilities used by all ten modules.

| #   | Core module   | Mandatory scope                                                                                                                                                                                        | Required cross-module links                                                                                |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | OPD           | Department-specific registration, appointments, queue, consultation, diagnosis, orders, prescription, OPD-to-IPD admission request                                                                     | Patient 360, IPD, LIS, RIS, Pharmacy, Insurance, Billing, EMR                                              |
| 2   | IPD           | Admission, department-wise bed pools, ward/nursing station, doctor notes, vitals, nursing notes, MAR, medication orders, lab/imaging orders, transfers, ICU transfer, discharge                        | Patient 360, LIS, RIS, Pharmacy, ICU, OT, Insurance, Billing, EMR                                          |
| 3   | LIS           | Pre-analytical, analytical and post-analytical workflows; sample/accession/barcode, analyser interfaces, QC, result validation/release, critical values, pathology/microbiology where configured       | OPD, IPD, Emergency, ICU, EMR, Billing, Insurance                                                          |
| 4   | RIS           | Imaging order, scheduling, modality worklist, acquisition status, radiologist reporting, report verification, DICOM/PACS integration, critical findings                                                | OPD, IPD, Emergency, ICU, OT, EMR, Billing, Insurance                                                      |
| 5   | Emergency     | Rapid registration, triage, acuity, clinical care, orders, diagnostics, resuscitation, observation, admission/discharge/transfer, MLC workflows where configured                                       | Patient 360, IPD, ICU, LIS, RIS, Pharmacy, Insurance, Billing, EMR                                         |
| 6   | OT Management | Surgical/procedure request, scheduling, OT resource management, pre-op, consent/checklist, anaesthesia, intra-op record, implants/consumables, recovery, cancellation and utilization analytics        | IPD, OPD, Surgery/ENT/Dental and other specialties, Pharmacy, Inventory, LIS, RIS, Insurance, Billing, EMR |
| 7   | ICU           | ICU bed management, ICU admission/transfer from IPD/Emergency, observations, flowsheets, infusions, ventilator/device documentation, scores, critical events, discharge/step-down                      | IPD, Emergency, LIS, RIS, Pharmacy, OT, EMR, Insurance, Billing                                            |
| 8   | Pharmacy      | Prescription/medication-order queues, verification, dispensing, batch/expiry/FEFO, substitutions, returns, stock, purchase, controlled/high-alert medicine workflows where configured                  | OPD, IPD, ICU, Emergency, OT, Inventory, Billing, Insurance, EMR                                           |
| 9   | EMR           | Unified longitudinal record; all source data from OPD, IPD, Emergency, ICU, LIS, RIS, OT, Pharmacy and other configured clinical services with provenance and versioning                               | All modules                                                                                                |
| 10  | Insurance     | Government schemes (central/state), PM-JAY where applicable, private payers, eligibility, pre-authorisation, package/tariff rules, claims, query/rejection/resubmission, settlement and reconciliation | OPD, IPD, Emergency, OT, ICU, Pharmacy, LIS, RIS, Billing, EMR                                             |

### Mandatory departmental registration rule

A patient registration encounter shall be associated with the department/service being visited. For example, a patient presenting for a Medicine consultation is registered into the Medicine OPD; the same UHID is then reused for all subsequent encounters and services. Registration must never create a separate patient identity merely because the patient changes department, ward, diagnostic service, pharmacy, payer or facility within the same tenant.

The system shall separate **patient identity** from **encounter/service identity**. A patient may have multiple encounters and multiple department affiliations over time, but the canonical UHID remains stable within the tenant according to the tenant's configured identity policy.

### Shared order-to-fulfilment contract

Orders are a first-class cross-module object. Every order has a patient, encounter, requesting department/service, requesting practitioner, priority, status, timestamps, authorization context and downstream fulfilment target.

Examples:

`OPD consultation → medication prescription → Pharmacy dispensing queue`

`IPD doctor order → medication order → Pharmacy medication queue`

`IPD doctor order → laboratory order → LIS accession/collection queue`

`Emergency order → imaging order → RIS/modality worklist`

`IPD surgery request → OT scheduling → OT case → downstream Pharmacy/Inventory/LIS/RIS/Billing events`

### Shared patient record contract

All modules shall read/write against the same Patient 360 identity and encounter model. Module-specific records must retain the source module, author, encounter, facility, department and timestamp so that the EMR can present a provenance-aware longitudinal timeline rather than simply copying records into another table.

### Cross-module orchestration principles

1. No module may maintain a separate patient master.
2. No module may invent a second UHID for an existing patient.
3. Downstream queues are generated from authoritative source transactions, not duplicate manual entry.
4. Clinical state transitions and financial state transitions are separately controlled but linked through shared encounter/order/charge references.
5. Every cross-module action must be traceable through an event, audit record, or both.
6. A failure in a downstream integration must not silently alter the authoritative source transaction; it must create a retry/reconciliation state.

---

## 1.3 Multi-Tenant Product Model

The HIMS is a true multi-tenant SaaS/platform product.

```text
Platform
  └── Tenant / Hospital Group
        ├── Facility / Hospital A
        │     ├── Departments
        │     ├── Wards / Nursing Stations
        │     ├── Beds / Rooms
        │     ├── OT / ICU / Emergency
        │     └── Diagnostics / Pharmacy / Billing
        ├── Facility / Hospital B
        └── Shared tenant-level configuration
```

Tenant isolation is mandatory. A user, patient, encounter, document, order, result, billing transaction, claim, audit event or configuration record belonging to one tenant must never be exposed to another tenant. Facility-level permissions must additionally restrict users where a tenant operates multiple facilities.

The architecture must support both a shared SaaS deployment and dedicated tenant deployment without changing the business-domain code.

---

## 1.4 Self-Hosted Supabase Baseline

The planned backend/data platform shall use **self-hosted Supabase deployed with Docker for development and controlled environments**, with the following boundary:

**Supabase is the data platform; NestJS remains the business/application backend.**

Supabase provides PostgreSQL, Auth, Realtime, Storage and supporting services. The HIMS backend owns business rules, domain transactions, orchestration, authorization policy composition and integration workflows. Self-hosted Supabase documentation notes that operators are responsible for server maintenance, security, backups, disaster recovery, monitoring, availability and scalability; these responsibilities must therefore be part of the product deployment plan rather than assumed to be handled by Supabase. (https://supabase.com/docs/guides/self-hosting)

Docker Desktop is appropriate for local developer environments and functional testing. Production hospital deployments shall use Linux Docker Engine or an orchestrator such as Kubernetes, with persistent storage, backup, monitoring and disaster-recovery controls. The self-hosted Supabase documentation explicitly distinguishes production self-hosting from local development stacks and identifies backups, DR, monitoring and scalability as operator responsibilities. (https://supabase.com/docs/guides/self-hosting)

---

## 2. Product Context and Competitive Benchmark

Bharat HIMS publicly presents a broad integrated HIMS covering areas such as OPD, IPD/ICU, laboratory/radiology, pharmacy, inventory/assets, billing/compliance, EMR/EHR, OT/emergency, MIS/administration and telemedicine/mobile. Its package structure further describes enterprise capabilities such as revenue-cycle management, predictive analytics, audit trails, human-resource functionality, supply-chain management, asset maintenance and specialty workflows. [Bharat HIMS public package information](https://www.bharathims.com/hospital-management-system-bharat-hims-packages)

The new product therefore must not compete simply by adding another list of modules. The core differentiation must be:

1. A true Patient 360 longitudinal record.
2. Role-based workbenches instead of generic module screens.
3. End-to-end workflow automation.
4. A dedicated Quality & Accreditation operating layer.
5. A real-time Hospital Command Center.
6. Deep revenue-cycle and claims intelligence.
7. First-class nursing, ICU, emergency and OT workflows.
8. Standards-oriented interoperability.
9. An explicit privacy and consent layer.
10. Role-specific AI copilots rather than generic AI text generation.

ABDM states that HMIS/HIS solutions can integrate with core ABDM modules through APIs and describes HIE/consent mechanisms for identity verification, consent logging and controlled health-record sharing. The product architecture shall therefore make ABDM an integration layer, not an afterthought. [ABDM FAQ](https://abdm.gov.in/faqs)

NABH's Hospital Accreditation Standards, effective 1 January 2025, organize hospital quality requirements across clinical care, medication, patient rights, infection control, quality improvement, facilities, human resources and information management. The product shall map software workflows and evidence management to these domains where applicable, while never asserting that use of the software itself grants accreditation. [NABH Hospital Accreditation Standards, 6th Edition](https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf)

The Digital Personal Data Protection Rules, 2025 and their published enforcement framework require the architecture to account for privacy governance, notices, consent/legitimate-use flows, security safeguards, breach handling, rights workflows and data lifecycle controls as applicable to the deployment. [MeitY DPDP Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025)

---

## 3. Problem Statement

Hospitals frequently operate disconnected systems for registration, appointments, EMR, billing, laboratory, radiology, pharmacy, inventory, OT, nursing and quality. Even integrated HIMS products often expose these functions as separate modules with inconsistent workflows.

The target product must solve the following problems:

- Duplicate patient records and identity fragmentation.
- Excessive clinical documentation burden.
- Poor interoperability between HIMS, LIS, PACS, insurance and external systems.
- Manual claims and revenue leakage.
- Limited real-time visibility for hospital leadership.
- Quality/accreditation work that remains spreadsheet and paper driven.
- Weak medication and inventory traceability.
- Fragmented nursing and ICU workflows.
- Poor emergency and OT operational visibility.
- Patient communication dependent on manual staff effort.
- Limited automation across departments.
- AI features that produce text but do not execute safe workflows.
- Inadequate auditability and privacy controls.

---

## 4. Product Vision

Create the operating layer through which a hospital can run its daily clinical, operational, financial and quality activities with a shared patient and organization model.

### 4.1 Product pillars

**CARE** — clinical care and continuity  
**OPERATIONS** — beds, nursing, OT, emergency, pharmacy, supply chain  
**FINANCE** — billing, claims, collections, profitability  
**QUALITY** — incidents, CQI, CAPA, audits, infection control, accreditation evidence  
**INTELLIGENCE** — dashboards, analytics, prediction and AI copilots  
**TRUST** — security, privacy, consent, audit, resilience  
**INTEROPERABILITY** — ABDM, FHIR, HL7, DICOM, APIs and external integrations

---

## 5. Goals

### 5.1 Business goals

- Become a credible alternative to established Indian HIMS platforms.
- Support multiple facility types without maintaining separate products.
- Reduce administrative effort through workflow automation.
- Create clear operational and financial visibility for hospital leadership.
- Build expansion capability through integrations and an API platform.
- Support SaaS, private cloud and selected on-premise deployments.

### 5.2 User goals

- Doctors should find the patient context quickly and document efficiently.
- Nurses should manage tasks and handovers from a ward-centric workspace.
- Lab users should minimize specimen and result-entry errors.
- Pharmacists should maintain traceable inventory and dispensing.
- Billing teams should capture charges and manage claims without duplicate entry.
- Quality teams should manage incidents, indicators and CAPA in one place.
- Administrators should see what requires attention now.
- Patients should manage appointments, reports, payments and communication digitally.

### 5.3 Engineering goals

- Modular architecture with shared domain services.
- Strong tenant and facility isolation.
- Auditable state transitions.
- API-first integration.
- Automated testing and CI/CD.
- Observability by default.
- Safe evolution of clinical and financial schemas.

---

## 6. Non-Goals for Initial Release

The first production release shall not attempt to provide a complete ERP, payroll suite, PACS implementation, biomedical-device firmware, national health information exchange, autonomous diagnosis, or autonomous medical treatment decisions.

Where third-party specialist systems are more appropriate, the HIMS shall integrate through documented interfaces.

---

## 7. Target Customers

### 7.1 Primary

- 10–50 bed hospitals.
- 50–250 bed hospitals.
- Multi-specialty hospitals.
- Nursing homes.
- Polyclinics.
- Hospital groups.
- Diagnostic centres.

### 7.2 Secondary

- Specialty centres.
- Day-care surgery centres.
- Telemedicine-enabled practices.
- Hospital chains requiring a common operating model.

### 7.3 Deployment archetypes

1. Single-site clinic.
2. Single hospital.
3. Hospital + diagnostics.
4. Multi-facility hospital group.
5. Hospital + external labs/pharmacies.
6. Hybrid/public-private or mission-driven organization.

---

## 8. Personas and Roles

Core roles shall include:

- Patient.
- Attendant/caregiver.
- Receptionist.
- Registration operator.
- Appointment executive.
- Doctor.
- Consultant.
- Surgeon.
- Anaesthetist.
- Nurse.
- Head nurse.
- ICU nurse.
- Emergency nurse.
- Pharmacist.
- Lab technician.
- Pathologist.
- Radiologist.
- Radiology technician.
- OT technician.
- OT nurse.
- Billing executive.
- Cashier.
- Claims/TPA executive.
- Finance officer.
- Procurement officer.
- Storekeeper.
- Biomedical/asset officer.
- Housekeeping supervisor.
- Infection-control nurse/officer.
- Quality manager.
- Accreditation coordinator.
- HR manager.
- IT administrator.
- Security/audit administrator.
- Medical superintendent.
- Hospital administrator.
- CFO.
- CIO/CTO.
- Super administrator.

Role permissions must be composed from granular permissions and scope constraints, not hard-coded to a single role name.

---

## 9. Product Principles

1. **Patient-first navigation:** users can reach the patient record from every relevant workflow.
2. **Action over navigation:** surfaces should expose tasks, queues and alerts rather than forcing users to browse modules.
3. **Single source of truth:** avoid duplicate master data.
4. **Every important action is auditable.**
5. **Configuration before customization:** support customer variation with configuration and workflow rules.
6. **Safe defaults:** especially for clinical, financial and privacy-sensitive actions.
7. **Human-in-the-loop AI:** the product does not independently make high-risk clinical decisions.
8. **Interoperability by design.**
9. **Offline tolerance where operationally important.**
10. **Accessibility and low cognitive load.**

---

## 10. Information Architecture

The top-level information architecture shall use role-based workspaces over a common domain model.

### 10.1 Major domains

1. Patient 360.
2. Registration & Front Office.
3. Appointments & Queue.
4. OPD & EMR.
5. IPD & Bed Management.
6. Nursing & ICU.
7. Emergency.
8. OT & Anaesthesia.
9. Laboratory.
10. Radiology & Imaging.
11. Pharmacy.
12. Inventory & Procurement.
13. Billing & Revenue Cycle.
14. Finance.
15. Quality & Accreditation.
16. Patient Engagement.
17. Workforce & Administration.
18. Analytics & Command Center.
19. Integration Hub.
20. AI Copilots.
21. System Administration.

---

# 11. Functional Requirements by Domain

## 11.1 Patient 360

### Purpose

Provide a unified longitudinal patient identity and record.

### Core capabilities

- Master Patient Index (MPI).
- UHID generation.
- ABHA association where applicable.
- Duplicate detection and merge workflow.
- Demographics.
- Contact and address history.
- Emergency contacts.
- Caregiver/attendant relationships.
- Allergies.
- Problem list.
- Medical history.
- Surgical history.
- Medication history.
- Immunization history.
- Family history.
- Social history.
- Clinical alerts.
- Insurance/payer details.
- Documents.
- Consent records.
- Encounters.
- Investigations.
- Reports.
- Prescriptions.
- Admissions.
- Procedures.
- Bills and payments.
- Claims.

### Patient banner

The patient context header shall optionally display:

- Name.
- Age/sex.
- UHID.
- ABHA link state.
- Allergies.
- Critical alerts.
- Isolation status.
- Current encounter.
- Attending physician.
- Bed/ward.
- Outstanding balance.

### Acceptance criteria

- Duplicate patients cannot be silently created when configurable matching rules identify a likely duplicate.
- Merging requires permission and a complete audit trail.
- Historical encounters remain attributable after merge.
- Patient context is available from OPD, IPD, lab, pharmacy, billing and emergency screens.

---

## 11.2 Registration & Front Office

### Department-aware registration requirements

Registration shall support a configurable hierarchy of facility → clinical department → service/clinic → practitioner/resource. The registration operator must select or resolve the service being accessed for the encounter. The encounter shall therefore carry the department context used for queueing, reporting, tariffs, clinical templates and authorization.

Returning patients are identified by UHID/MPI search. A new registration transaction may create a new encounter but must not create a new patient master when a matching identity exists.

Features:

- Walk-in registration.
- Returning patient search.
- Fast registration.
- Document capture.
- Appointment conversion.
- Insurance verification fields.
- Referral source.
- Queue token.
- Language preference.
- Communication preference.
- Consent capture.
- Cashless eligibility workflow.
- Registration kiosk support.
- QR/barcode support.

---

## 11.3 Appointments & Queue Management

Capabilities:

- Doctor schedules.
- Department schedules.
- Resource schedules.
- Appointment types.
- Walk-in slots.
- Recurring clinics.
- Blocked time.
- Holiday calendars.
- Token generation.
- Queue board.
- Priority queues.
- Appointment confirmation.
- Rescheduling.
- Cancellation.
- No-show classification.
- Wait-time analytics.
- Online booking API.

### Queue automation

Example:

Appointment created → confirmation → reminder → arrival check-in → queue position → doctor notification → consultation → billing → follow-up scheduling.

---

## 11.4 OPD & EMR

### Encounter management

- Chief complaints.
- Vitals.
- History.
- Examination.
- Assessment.
- Diagnosis.
- Orders.
- Procedures.
- Prescriptions.
- Clinical instructions.
- Referral.
- Follow-up.
- Certificates.
- Clinical attachments.

### Configurable templates

Templates shall support specialty-specific documentation without modifying core application code.

### Clinical decision support

The system may provide:

- allergy alerts.
- duplicate therapy alerts.
- abnormal-value alerts.
- interaction warnings where a verified knowledge source is configured.
- preventive-care reminders.
- overdue-investigation alerts.
- care-pathway reminders.

Warnings shall be explainable, configurable and auditable.

---

## 11.5 Prescription and Medication Management

Capabilities:

- e-Prescription.
- Dose/frequency/duration.
- Route.
- PRN medication.
- Tapering.
- Instructions.
- Substitution rules.
- Allergy checks.
- Duplicate medication checks.
- Medication reconciliation.
- Discontinue/hold/resume.
- Printable prescription.
- QR-verifiable prescription option.

AI-assisted prescription functions shall not silently alter a physician's prescription.

---

## 11.6 IPD & Bed Management

### Department-wise bed ownership

Beds shall belong to a facility location and a configurable clinical/administrative pool (for example Medicine, Surgery, Paediatrics, ICU). Bed occupancy and availability must be visible by department, ward and bed class.

### IPD order orchestration

The IPD order-entry workflow shall support medication, laboratory, imaging, procedure, dietary and nursing-related orders. Medication orders must generate the Pharmacy queue automatically after required authorization/verification; laboratory and imaging orders must generate downstream LIS/RIS work without re-entry.

### Transfer to ICU

An authorized IPD clinician shall be able to initiate an ICU transfer request directly from the IPD encounter. The workflow shall support indication, urgency, target ICU, accepting clinician, bed availability, transfer checklist, handover, movement event and financial/insurance implications.

Capabilities:

- Admission request.
- Approval.
- Bed assignment.
- Admission against payer authorization.
- Transfer.
- Bed blocking.
- Cleaning status.
- Isolation status.
- Discharge planning.
- Discharge summary workflow.
- Patient movement history.
- Bed occupancy board.
- Room/ward configuration.
- Bed class.
- Tariff configuration.
- Temporary beds.

### Bed state model

`AVAILABLE → RESERVED → OCCUPIED → DISCHARGE_PENDING → CLEANING → AVAILABLE`

Additional states may include `BLOCKED`, `MAINTENANCE`, `ISOLATION`, `OUT_OF_SERVICE`.

---

## 11.7 Nursing & ICU

### Detailed MAR

The medication administration record shall support scheduled, PRN, STAT, infusion and one-time medications as configured. Each administration event shall capture medication, dose, route, time, administering user, status, omission/withhold reason and relevant observations. The MAR must reconcile with the active medication orders and pharmacy dispensing transactions.

### ICU transfer lifecycle

`IPD Transfer Request → ICU Assessment/Acceptance → ICU Bed Assignment → Patient Movement → ICU Encounter → ICU Orders/Flowsheets → Step-down/Discharge`

The original clinical history remains linked; transfer does not create a new patient identity.

### Nursing workbench

- My ward.
- Assigned patients.
- Vitals.
- Nursing notes.
- Intake/output.
- Pain assessment.
- Fall-risk assessment.
- Pressure-injury assessment.
- Device/catheter tracking.
- Medication administration record.
- Nursing tasks.
- Care plans.
- Escalations.
- Patient education.
- Handover.

### ICU

- ICU bed board.
- Ventilator-related documentation.
- Critical-care flowsheets.
- Infusions.
- Intake/output.
- Device days.
- Nursing observations.
- Clinical scores configurable by institution.
- Critical-result alerts.
- Escalation workflow.

### Shift handover

System-generated handover must identify configured high-priority items such as unstable patients, pending investigations, critical medications, devices, risks and outstanding tasks.

---

## 11.8 Emergency Department

### Emergency admission/disposition

Emergency care shall support disposition to discharge, observation, IPD admission, ICU admission, OT/procedure pathway, referral/transfer, or death documentation as applicable. Admission must reuse the same patient/UHID and create the appropriate encounter/admission records without duplicate registration.

Workflow:

`Arrival → Registration → Triage → Acuity → Bed → Clinician → Orders → Treatment → Disposition`

Capabilities:

- Rapid registration.
- Triage.
- Acuity levels.
- Emergency queue.
- Resuscitation record.
- Emergency medication.
- Lab/imaging orders.
- Observation area.
- Admission.
- Discharge.
- Referral/transfer.
- Medico-legal case workflow where enabled.
- Ambulance/arrival source.
- Door-to-event timers.

---

## 11.9 OT & Anaesthesia

### Cross-specialty OT integration

OT must support requests from all configured surgical/procedural departments, including Surgery, ENT, Dental and other specialties. The source department remains the clinical owner of the case while OT owns theatre/resource scheduling and peri-operative workflow.

### Scheduling from IPD

From the IPD patient record, an authorized user shall be able to create an OT request and propose/schedule an OT slot. The workflow shall carry patient, admission, diagnosis/procedure, surgeon, anaesthesia requirements, priority, expected duration, payer/authorization state and required resources into the OT board.

Capabilities:

- Surgery request.
- Case approval.
- Scheduling.
- OT resource allocation.
- Surgeon allocation.
- Anaesthesia planning.
- Pre-op checklist.
- Consent verification.
- Surgical safety checklist.
- Procedure documentation.
- Implants.
- Consumables.
- Specimen tracking.
- Post-op recovery.
- OT billing capture.
- Cancellation and delay reasons.
- Utilization analytics.

---

## 11.10 Laboratory

### Complete LIS baseline

The LIS shall cover the full laboratory lifecycle:

`Order → Registration/Accession → Barcode → Collection → Acceptance/Rejection → Aliquoting → Processing → Analyzer/Manual Entry → QC → Technical Validation → Clinical Validation → Release → Critical Result Handling → Amended/Corrected Result`

Supported capabilities shall include test catalogue, specimen types, collection rules, container/volume requirements, sample routing, worklists, batch processing, analyzer interfaces, auto-verification rules, reference ranges, age/sex-specific ranges, delta checks, panic/critical values, result comments, pathology/microbiology workflows where configured, report templates, result amendment/versioning, quality-control records, calibration/maintenance records, turnaround-time monitoring and complete auditability.

### LIS functionality

- Test catalog.
- Panels.
- Profiles.
- Order management.
- Sample collection.
- Barcode generation.
- Accession number.
- Sample rejection.
- Aliquoting.
- Worklists.
- Analyzer integration.
- Manual entry.
- Result validation.
- Critical-result workflow.
- Delta checks.
- Reference ranges.
- Pathologist approval.
- Result release.
- Amended reports.
- QC records.
- TAT analytics.

The system shall distinguish collected, received, processing, validated, released and amended states.

---

## 11.11 Radiology & Imaging

### Complete RIS baseline

The RIS shall cover:

`Order → Clinical screening → Scheduling → Modality Worklist → Procedure/Acquisition status → Reporting → Verification → Release → Follow-up/Communication`

It shall support configurable imaging modalities, DICOM worklists, accession numbers, contrast/safety checks, reporting templates, critical findings, addenda/amendments, peer review where enabled, radiologist workload, turnaround times, PACS launch and DICOMweb integration. Imaging data shall remain accessible from the EMR through the RIS/PACS metadata and study reference.

Capabilities:

- Imaging order.
- Scheduling.
- Modality worklist.
- Technician workflow.
- Reporting templates.
- Preliminary/final report.
- Critical findings workflow.
- DICOM/PACS integration.
- Report attachments.
- Result release.
- TAT analytics.

The HIMS shall integrate with PACS rather than attempting to replace a mature PACS unless explicitly scoped.

---

## 11.12 Pharmacy

### Automatic prescription/medication-order queue

Pharmacy shall receive authoritative medication transactions automatically:

```text
OPD Doctor Consultation
        ↓
Prescription finalized
        ↓
Pharmacy prescription queue

IPD Doctor / Authorized Clinician
        ↓
Medication order finalized
        ↓
Pharmacy inpatient medication queue
```

The pharmacist shall not need to re-enter medication details. Dispensing shall validate medication, dose/quantity where applicable, available batches, expiry/FEFO, substitution rules and payer restrictions before finalization. For inpatient medications, pharmacy status shall remain linked to the originating medication order and MAR where configured.

Capabilities:

- Drug master.
- Brand/generic mapping.
- Formulations.
- Batch.
- Expiry.
- Manufacturer.
- Schedule/classification attributes.
- Purchase.
- GRN.
- Stock receipt.
- Stock transfer.
- Dispensing.
- Return.
- Ward stock.
- Emergency stock.
- FEFO.
- Stock adjustment.
- Recall.
- Expiry alerts.
- Reorder levels.
- Barcode scanning.
- Controlled/high-risk medicine registers as configured.
- Margin analysis.

### Safety

Dispensing must capture the dispensing event, quantity, batch where configured, dispenser and timestamp.

---

## 11.13 Inventory, Procurement & Asset Management

### Procurement

- Purchase request.
- Approval matrix.
- RFQ.
- Vendor quotation.
- Comparative statement.
- Purchase order.
- GRN.
- Invoice matching.
- Returns.
- Vendor performance.

### Inventory

- Item master.
- Units.
- Locations.
- Min/max levels.
- Reorder rules.
- Stock transfers.
- Stock counts.
- Consumption.
- Wastage.
- Expiry.

### Asset management

- Asset master.
- Asset tag.
- Location.
- Custodian.
- Warranty.
- AMC/CMC.
- Preventive maintenance.
- Breakdown ticket.
- Downtime.
- Service history.
- Asset lifecycle.

---

## 11.14 Billing & Revenue Cycle Management

### Cross-module charge capture

Charges shall be generated from authoritative service transactions where configured, including consultation, admission, room/bed occupancy, investigations, imaging, procedures, OT, pharmacy and other billable services. Manual charge entry remains available for authorized exceptions but must not be required for routine downstream workflows.

### Charge capture

- Consultation.
- Procedure.
- Lab.
- Radiology.
- Pharmacy.
- Bed/day.
- Nursing.
- Consumables.
- OT.
- Packages.
- Professional fees.
- Miscellaneous charges.

### Billing

- Estimates.
- Invoices.
- Receipts.
- Refunds.
- Discounts.
- Adjustments.
- Credit notes.
- Deposits.
- Advances.
- Split payments.
- Payment gateways.
- Cashier shift close.

### Payer/insurance/TPA

- Payer master.
- Corporate contracts.
- Rate cards.
- Preauthorization.
- Document checklist.
- Claim preparation.
- Submission.
- Status.
- Rejection.
- Resubmission.
- Settlement.
- Reconciliation.
- Outstanding ageing.
- Government central/state scheme configuration.
- Private insurer configuration.
- PM-JAY/NHCX-ready claim workflows where enabled.
- Eligibility and package verification.
- Pre-authorisation query/approval tracking.
- Claim document completeness.

### Revenue leakage controls

The system shall identify potential missing charges, mismatched packages, unbilled services and unresolved authorization gaps.

---

## 11.15 Finance

This domain shall provide hospital-finance operational visibility without necessarily replacing a full accounting ERP.

Capabilities:

- Revenue summary.
- Collection summary.
- Payer-wise collections.
- Department profitability inputs.
- Cost centres.
- Expense categories.
- Reconciliation.
- Cash management.
- Refund monitoring.
- Receivable ageing.
- Interface to external accounting systems.

A future accounting ledger module can be added without changing core billing APIs.

---

## 11.16 Quality & Accreditation OS

This is a flagship differentiator.

### Capabilities

- Accreditation framework configuration.
- Standard/domain library.
- Policy repository.
- Document control.
- SOP acknowledgement.
- KPI library.
- Indicator definitions.
- Numerator/denominator configuration.
- Data-source mapping.
- Indicator calculation.
- Target setting.
- Trend visualization.
- Benchmarking.
- Clinical audit.
- Incident reporting.
- Near-miss reporting.
- RCA.
- CAPA.
- Risk register.
- Internal audit.
- Evidence repository.
- Observation tracking.
- Action ownership.
- Due dates.
- Escalation.
- Closure verification.

### Framework support

Initial framework packs should support hospital quality workflows aligned to the current NABH structure and configurable local quality programs such as NQAS, without implying endorsement by the issuing organization.

### Incident workflow

`Report → Triage → Investigation → RCA → CAPA → Owner → Deadline → Evidence → Verification → Closure`

---

## 11.17 Infection Prevention & Control

Capabilities:

- HAI surveillance.
- Device-associated infection tracking.
- SSI surveillance.
- Isolation status.
- Hand-hygiene audits.
- Environmental audit checklist.
- Sterilization monitoring.
- Antimicrobial-use reporting inputs.
- Infection alerts.
- Outbreak investigation.

Metrics must be configurable and institution-defined.

---

## 11.18 Patient Engagement

### Patient portal/app

- Registration.
- Appointment booking.
- Appointment history.
- Queue position.
- Reports.
- Prescriptions.
- Bills.
- Payment.
- Discharge summary.
- Follow-up reminders.
- Teleconsultation entry.
- Family/dependent profiles.
- Consent management.
- Communication preferences.

### Communication engine

Channels:

- Push notifications.
- SMS.
- Email.
- WhatsApp through approved provider integration.

Events:

- Appointment confirmation.
- Reminder.
- Queue notification.
- Report release.
- Payment reminder.
- Discharge notification.
- Follow-up reminder.
- Patient-feedback request.

---

## 11.19 Workforce & Administration

Capabilities:

- Staff master.
- Department assignment.
- Role assignment.
- Credentials.
- License/certification expiry.
- Training.
- Shift roster.
- Leave interface.
- Attendance interface.
- User lifecycle.
- Credentialing records.

Payroll is out of scope for MVP but integrations shall be supported.

---

## 11.20 Hospital Command Center

A role-based operational console shall present real-time or near-real-time KPIs.

### Core executive views

- Census.
- Occupancy.
- ICU occupancy.
- Emergency load.
- OPD throughput.
- OT utilization.
- Lab TAT.
- Imaging TAT.
- Pharmacy stock risks.
- Revenue.
- Receivables.
- Claims.
- Incidents.
- CAPA.
- Infection indicators.
- Patient experience.

### Alert center

Alerts shall be prioritized by severity, owner and SLA.

Example categories:

- Clinical.
- Operational.
- Financial.
- Quality.
- Security.
- Integration.

---

## 11.21 Analytics & Reporting

### Reporting layers

1. Operational dashboards.
2. Department dashboards.
3. Management dashboards.
4. Quality dashboards.
5. Financial dashboards.
6. Regulatory/export reports.
7. Ad-hoc analytics.

### Analytics requirements

- Date filters.
- Facility filters.
- Department filters.
- Doctor filters.
- Payer filters.
- Drill-down.
- Export.
- Scheduled reports.
- Saved views.
- Data dictionary.
- Metric definition.

Every executive metric must have an inspectable definition and data provenance.

---

## 11.22 Integration Hub

The Integration Hub shall be a first-class subsystem.

Potential integrations:

- ABDM.
- ABHA.
- HFR/HPR.
- Consent mechanisms.
- FHIR APIs.
- HL7 v2 where required.
- DICOM.
- PACS.
- LIS analyzers.
- Payment gateways.
- SMS.
- WhatsApp providers.
- Email.
- Accounting systems.
- ERP.
- Insurance/TPA interfaces.
- External appointment portals.

### Integration controls

- API credentials.
- Secret rotation.
- Mapping tables.
- Transformations.
- Retry policy.
- Dead-letter queue.
- Monitoring.
- Reconciliation.
- Message audit.
- Versioning.

---

## 11.23 AI Copilots

AI shall be deployed as controlled assistance features.

### Doctor Copilot

- Summarize longitudinal history.
- Summarize recent admission.
- Summarize abnormal results.
- Draft clinical notes.
- Draft discharge summary.
- Draft referral note.
- Suggest documentation completeness checks.

### Nurse Copilot

- Shift handover draft.
- Task prioritization.
- Patient-risk summary.

### Quality Copilot

- KPI anomaly explanation.
- CAPA summary.
- Audit evidence indexing.
- Draft RCA structure.

### Finance Copilot

- Revenue variance explanation.
- Claim rejection categorization.
- Ageing summary.

### Administrator Copilot

- Daily operational briefing.
- Bottleneck detection.
- Department comparison.

### AI safety constraints

- AI output must be labelled.
- Human review required for clinical documents before finalization.
- Source/context references should be available where feasible.
- AI must not make an autonomous diagnosis or treatment decision.
- Sensitive data shall not be sent to unapproved external AI providers.
- Prompt/output access must follow authorization rules.
- AI actions affecting durable records must require explicit confirmation unless specifically configured as low-risk automation.
- AI events shall be auditable.

---

# 12. Workflow Automation Engine

The workflow engine is a strategic differentiator.

### Trigger types

- Record created.
- Record updated.
- Result released.
- Critical result.
- Payment pending.
- Stock below threshold.
- Bed discharge.
- Appointment approaching.
- CAPA due.
- License expiry.
- Claim rejected.

### Actions

- Notification.
- Task creation.
- Assignment.
- Status transition.
- Approval request.
- Document generation.
- API call.
- Webhook.
- Queue insertion.
- Escalation.

### Automation example

`Discharge completed → billing finalization request → pharmacy notification → housekeeping task → bed cleaning state → patient discharge notification → survey → follow-up task`

### Automation safety

Critical workflows require authorization, idempotency and a visible execution history.

---

# 13. Configuration Engine

Hospital administrators shall be able to configure without source-code changes:

- Departments.
- Services.
- Tariffs.
- Appointment slots.
- Forms.
- Clinical templates.
- Lab reference ranges.
- Workflows.
- Approval rules.
- Roles.
- Notifications.
- Alerts.
- Quality indicators.
- Incident categories.
- Payers.
- Packages.
- Communication templates.
- Document templates.

Configuration changes shall be versioned and audited.

---

# 14. Security, Privacy and Governance

### Requirements

- Tenant isolation.
- Facility-level isolation.
- RBAC.
- Optional attribute-based constraints.
- MFA.
- Session management.
- Device/session revocation.
- Encryption in transit.
- Encryption at rest.
- Secrets management.
- Audit logs.
- Break-glass access.
- Data export controls.
- Data retention configuration.
- Consent records.
- Privacy requests workflow.
- Breach-response support.
- Security incident logging.

The system shall be designed to support applicable DPDP obligations and customer-specific legal policies; legal compliance shall be assessed with qualified counsel before production claims are made.

---

# 15. Audit Framework

Auditability is mandatory for:

- Authentication events.
- Patient creation.
- Patient merge.
- Clinical record creation/edit/sign.
- Prescription changes.
- Lab result changes.
- Report release/amendment.
- Medication dispensing.
- Billing changes.
- Refunds.
- Claims status changes.
- User/role changes.
- Consent changes.
- Privacy actions.
- Configuration changes.
- AI actions.
- Automation execution.
- Integration failures.

Audit logs shall be append-only from the application perspective and protected against ordinary user modification.

---

# 16. Non-Functional Product Requirements

### Performance

- Typical page interaction target: <= 2 seconds for common cached operations under agreed reference load.
- Patient search target: <= 1.5 seconds at p95 for standard indexed searches under agreed benchmark load.
- API target: <= 500 ms p95 for common synchronous read/write endpoints, excluding external dependencies.
- Heavy reports must run asynchronously.

### Availability

- Production SaaS target: 99.9% monthly service availability for mature production tier, excluding agreed maintenance.
- Critical hospital functions shall have documented recovery procedures.

### Scalability

The architecture should support:

- 1 facility to 100+ facilities per tenant/group.
- 100 to tens of thousands of registered users per enterprise tenant.
- High-volume encounter, order and result workloads.
- Horizontal scaling of stateless services.

### Reliability

- Idempotent integration endpoints.
- Retry-safe jobs.
- Transactional boundaries for billing/clinical state changes.
- Backups.
- Restore testing.
- Disaster-recovery runbooks.

---

# 17. UX Requirements

- Desktop-first web application for clinical/administrative workflows.
- Responsive mobile web for selected workflows.
- Native or cross-platform patient/mobile application where justified.
- Keyboard-efficient workflows for data-entry-heavy users.
- Search-first navigation.
- Persistent patient context.
- Clear status chips.
- Minimal unnecessary modal dialogs.
- Accessible colour contrast.
- Iconography accompanied by text where ambiguity is possible.
- Localization-ready text and date/number formatting.
- Indian numbering and currency conventions.

---

# 18. MVP Definition

### Phase 1 MVP

1. Tenant/facility administration.
2. Authentication/RBAC.
3. Patient 360/MPI.
4. Registration.
5. Appointments/queues.
6. OPD/EMR.
7. Prescription.
8. Basic billing.
9. Pharmacy dispensing/inventory.
10. Laboratory orders/results.
11. Basic IPD/bed management.
12. Patient portal.
13. Basic dashboards.
14. Audit framework.
15. Notification engine.
16. Core API gateway.

### Phase 2

- Nursing.
- ICU.
- Emergency.
- OT.
- Advanced inventory/procurement.
- RCM/claims.
- Finance interfaces.
- Quality/CAPA.
- Integration hub.

### Phase 3

- NABH/NQAS framework packs.
- Infection control.
- Advanced analytics.
- AI copilots.
- ABDM integrations.
- PACS/DICOM/HL7/FHIR integrations.
- Multi-facility command center.

---

# 19. Success Metrics

### Product adoption

- Monthly active clinical users.
- Percentage of encounters completed digitally.
- Percentage of prescriptions digitally finalized.
- Portal activation rate.
- Mobile engagement.

### Operational

- OPD cycle time.
- Registration time.
- Doctor wait time.
- Bed turnover time.
- Lab TAT.
- OT utilization.
- Emergency door-to-provider time.

### Financial

- Charge capture rate.
- Claim rejection rate.
- Outstanding ageing.
- Collection efficiency.
- Revenue leakage detected/resolved.

### Quality

- Incident closure time.
- CAPA closure rate.
- Indicator completion.
- Clinical audit closure.
- Medication error reporting/closure.

### Product quality

- Crash-free sessions.
- API success rate.
- p95 response time.
- Defect escape rate.
- Deployment frequency.
- Mean time to recovery.

---

# 20. Reporting Governance

Every metric used in an executive dashboard must have:

- Name.
- Description.
- Formula.
- Data sources.
- Inclusion criteria.
- Exclusion criteria.
- Time grain.
- Owner.
- Version.

No dashboard should contain an unexplained KPI.

---

# 21. Data Ownership and Exit Strategy

The product shall provide customer-controlled export mechanisms.

Exports should support, as applicable:

- Patient demographics.
- Encounters.
- Clinical observations.
- Reports.
- Prescriptions.
- Billing.
- Claims.
- Inventory.
- Quality data.
- Audit data subject to policy/legal restrictions.

Export must be documented and testable so customers are not unnecessarily locked into the system.

---

# 22. Disaster Recovery

Production services shall have:

- Automated backups.
- Backup encryption.
- Cross-zone or equivalent resilience where applicable.
- Restore validation.
- Recovery Point Objective (RPO) defined by deployment tier.
- Recovery Time Objective (RTO) defined by deployment tier.
- Periodic disaster-recovery drills.

Suggested targets for mature SaaS tier:

- RPO <= 15 minutes for critical transactional data.
- RTO <= 4 hours.

Targets remain subject to infrastructure and contract decisions.

---

# 23. Observability

The platform shall provide:

- Structured logs.
- Metrics.
- Distributed tracing.
- Error tracking.
- Queue/job monitoring.
- Integration monitoring.
- Security-event monitoring.
- Audit event monitoring.
- SLO dashboards.

Hospital administrators need application-level operational dashboards; engineering needs infrastructure/service-level dashboards.

---

# 24. Implementation Strategy

Build the platform incrementally around stable domain boundaries.

Recommended order:

1. Identity/tenant/security foundation.
2. Patient/MPI.
3. Appointment/registration.
4. OPD/EMR.
5. Pharmacy.
6. Billing.
7. Laboratory.
8. IPD/bed.
9. Patient portal.
10. Nursing/ICU.
11. OT/emergency.
12. Quality.
13. RCM/claims.
14. Integration hub.
15. AI and command centre.

Every phase must be deployable independently where practical.

---

# 25. Product Acceptance Gate

The HIMS is not ready for production at a new facility until the release demonstrates:

- End-to-end patient registration to consultation.
- Consultation to prescription.
- Consultation to lab order/result.
- Prescription to dispensing.
- Admission to discharge.
- Service to billing.
- Billing to payment.
- Claim to settlement workflow where enabled.
- Critical result to acknowledgement.
- Incident to CAPA.
- User action to audit trail.
- Backup to successful restore test.
- Role-based access test.
- Patient data export test.
- Failure/retry behaviour for external integrations.

---

# 26. Future Extensions

Potential future domains:

- Blood bank.
- Dialysis.
- Oncology.
- Cardiology.
- Physiotherapy.
- Dietetics.
- Ambulance fleet.
- Mortuary.
- Blood component traceability.
- Biomedical device data acquisition.
- Remote patient monitoring.
- Home healthcare.
- Population health dashboards.
- Research/data warehouse.
- Provider marketplace/network services.

These shall use the same patient, provider, organization and billing foundations rather than creating parallel identities.

---

# 27. Product Decisions Intentionally Deferred

The following shall remain TBD until commercial/technical discovery:

- Final product name.
- Brand identity.
- Pricing and packaging.
- Production hosting provider/location (cloud, private cloud or customer infrastructure).
- Exact HA topology and capacity tier.
- Accounting ledger scope.
- Exact AI providers/models.
- Supported payment provider(s).
- WhatsApp provider.
- ABDM production onboarding scope and certification milestones.
- Exact on-premise packaging.

---

# 28. Definition of Done for Product Requirements

A feature is product-complete only when it has:

- User story.
- Acceptance criteria.
- Permission model.
- Data model.
- Audit behaviour.
- Error states.
- Loading/empty states.
- Analytics/reporting impact.
- Notification impact.
- API contract where relevant.
- Test cases.
- Security review where required.
- Documentation.

---

## Appendix A — Core End-to-End Journeys

### A1. OPD

`Appointment → Arrival → Registration → Queue → Consultation → Orders → Results → Prescription → Billing → Payment → Follow-up`

### A2. IPD

`Admission → Bed → Initial assessment → Orders → Nursing → Diagnostics → Medication → Procedures → Discharge planning → Final bill → Discharge → Follow-up`

### A3. Emergency

`Arrival → Triage → Immediate assessment → Orders → Treatment → Observation → Admit/Discharge/Transfer`

### A4. Laboratory

`Order → Collection → Accession → Processing → Validation → Result release → Critical-value handling where applicable`

### A5. Pharmacy

`Prescription → Verification → Pick → Dispense → Batch capture → Payment/credit → Stock decrement`

### A6. Quality

`Indicator/Incident → Review → Analysis → Action → CAPA → Evidence → Verification → Closure`

### A7. Revenue cycle

`Authorization → Service → Charge capture → Bill → Claim → Adjudication → Rejection/Resubmission → Settlement → Reconciliation`

---

## Appendix B — Product Positioning

The system should be presented as:

> **A hospital operating system for clinical care, operations, finance, quality and patient engagement.**

Avoid unsupported claims such as "government certified", "NABH compliant", or "ABDM certified" unless the exact claim has been verified and approved for the product release.

---

## Appendix D — Audited Infrastructure Service Boundary

The HIMS application shall be implemented with **self-hosted Supabase as the primary data platform** and external/self-hosted supporting services according to deployment profile.

| Capability               | Supabase provides                                                          | Additional service required?                        | Recommended deployment                                                               |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Transactional PostgreSQL | Yes                                                                        | No                                                  | Self-hosted Supabase PostgreSQL; production persistent Linux storage/HA strategy     |
| Authentication/JWT       | Yes (Supabase Auth)                                                        | Not initially                                       | Self-hosted; optional enterprise IdP/SSO later                                       |
| REST Data API            | Yes (PostgREST)                                                            | No                                                  | Use selectively; NestJS remains canonical business API                               |
| Realtime                 | Yes                                                                        | No                                                  | Supabase Realtime for suitable UI subscriptions; durable events remain outbox-driven |
| Object/file storage      | Yes (Storage)                                                              | Prefer durable S3-compatible backing for production | Self-hosted Supabase Storage + MinIO/S3 where required                               |
| Background jobs          | No dedicated general-purpose queue                                         | Yes                                                 | Redis + BullMQ, Docker/managed equivalent                                            |
| Durable event broker     | No                                                                         | Not initially; later at scale                       | NATS or Kafka, Docker/Kubernetes/managed equivalent                                  |
| Full-text/search         | PostgreSQL search only                                                     | Eventually                                          | OpenSearch, self-hosted or managed                                                   |
| PACS/DICOM               | No                                                                         | Yes for radiology                                   | Orthanc + PostgreSQL + object storage, Docker/Kubernetes                             |
| FHIR server              | No dedicated full FHIR server                                              | Optional                                            | HAPI FHIR or internal FHIR gateway; Docker/Kubernetes                                |
| HL7 interface engine     | No                                                                         | Often                                               | Interface engine such as NextGen Connect where external systems require it           |
| PDF/document rendering   | No complete document-rendering platform                                    | Yes                                                 | Gotenberg or equivalent, Docker                                                      |
| OCR                      | No                                                                         | Optional                                            | Tesseract/OCR service, Docker                                                        |
| Malware scanning         | No                                                                         | Recommended for file ingestion                      | ClamAV, Docker                                                                       |
| Secrets management       | Environment secrets exist but not a full enterprise secrets platform       | Recommended                                         | HashiCorp Vault/self-hosted or cloud secret manager                                  |
| Monitoring               | Basic Supabase logs/metrics vary by self-host deployment                   | Yes                                                 | OpenTelemetry + Prometheus/Grafana/Loki/Tempo, self-hosted                           |
| Backup/DR/PITR           | Managed-platform backup/PITR is not the same as self-hosted responsibility | Yes                                                 | pgBackRest/WAL archiving + off-host object storage; HA strategy later                |
| WAF/edge                 | No                                                                         | Yes for public production                           | Cloud WAF/CDN or self-hosted reverse proxy with appropriate controls                 |
| SMS/WhatsApp/email       | No                                                                         | Yes                                                 | External providers (not self-hosted for core delivery)                               |
| Payments/UPI             | No                                                                         | Yes                                                 | Razorpay/PayU/other approved provider                                                |
| Push notifications       | No                                                                         | Yes                                                 | FCM/APNs                                                                             |
| Video consultation       | No                                                                         | Yes                                                 | Jitsi self-hosted or managed provider                                                |
| Enterprise SIEM          | No                                                                         | Recommended                                         | Wazuh or managed SIEM                                                                |

The exact service list is deployment-dependent, but the following are considered **essential for a serious production HIMS even when Supabase is the data platform**: Redis/background jobs, durable backup/restore, monitoring/alerting, secrets management, secure ingress, document/PDF processing, and radiology PACS/DICOM infrastructure where RIS is deployed. Supabase's current self-hosting documentation explicitly states that high availability, backups/DR, monitoring and scalability are operator responsibilities, and that some managed-platform capabilities are unavailable in self-hosted deployments. (https://supabase.com/docs/guides/self-hosting)

## Appendix D — Audited Infrastructure Service Boundary

The HIMS application shall be implemented with **self-hosted Supabase as the primary data platform** and external/self-hosted supporting services according to deployment profile.

| Capability               | Supabase provides                                                          | Additional service required?                        | Recommended deployment                                                               |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Transactional PostgreSQL | Yes                                                                        | No                                                  | Self-hosted Supabase PostgreSQL; production persistent Linux storage/HA strategy     |
| Authentication/JWT       | Yes (Supabase Auth)                                                        | Not initially                                       | Self-hosted; optional enterprise IdP/SSO later                                       |
| REST Data API            | Yes (PostgREST)                                                            | No                                                  | Use selectively; NestJS remains canonical business API                               |
| Realtime                 | Yes                                                                        | No                                                  | Supabase Realtime for suitable UI subscriptions; durable events remain outbox-driven |
| Object/file storage      | Yes (Storage)                                                              | Prefer durable S3-compatible backing for production | Self-hosted Supabase Storage + MinIO/S3 where required                               |
| Background jobs          | No dedicated general-purpose queue                                         | Yes                                                 | Redis + BullMQ, Docker/managed equivalent                                            |
| Durable event broker     | No                                                                         | Not initially; later at scale                       | NATS or Kafka, Docker/Kubernetes/managed equivalent                                  |
| Full-text/search         | PostgreSQL search only                                                     | Eventually                                          | OpenSearch, self-hosted or managed                                                   |
| PACS/DICOM               | No                                                                         | Yes for radiology                                   | Orthanc + PostgreSQL + object storage, Docker/Kubernetes                             |
| FHIR server              | No dedicated full FHIR server                                              | Optional                                            | HAPI FHIR or internal FHIR gateway; Docker/Kubernetes                                |
| HL7 interface engine     | No                                                                         | Often                                               | Interface engine such as NextGen Connect where external systems require it           |
| PDF/document rendering   | No complete document-rendering platform                                    | Yes                                                 | Gotenberg or equivalent, Docker                                                      |
| OCR                      | No                                                                         | Optional                                            | Tesseract/OCR service, Docker                                                        |
| Malware scanning         | No                                                                         | Recommended for file ingestion                      | ClamAV, Docker                                                                       |
| Secrets management       | Environment secrets exist but not a full enterprise secrets platform       | Recommended                                         | HashiCorp Vault/self-hosted or cloud secret manager                                  |
| Monitoring               | Basic Supabase logs/metrics vary by self-host deployment                   | Yes                                                 | OpenTelemetry + Prometheus/Grafana/Loki/Tempo, self-hosted                           |
| Backup/DR/PITR           | Managed-platform backup/PITR is not the same as self-hosted responsibility | Yes                                                 | pgBackRest/WAL archiving + off-host object storage; HA strategy later                |
| WAF/edge                 | No                                                                         | Yes for public production                           | Cloud WAF/CDN or self-hosted reverse proxy with appropriate controls                 |
| SMS/WhatsApp/email       | No                                                                         | Yes                                                 | External providers (not self-hosted for core delivery)                               |
| Payments/UPI             | No                                                                         | Yes                                                 | Razorpay/PayU/other approved provider                                                |
| Push notifications       | No                                                                         | Yes                                                 | FCM/APNs                                                                             |
| Video consultation       | No                                                                         | Yes                                                 | Jitsi self-hosted or managed provider                                                |
| Enterprise SIEM          | No                                                                         | Recommended                                         | Wazuh or managed SIEM                                                                |

The exact service list is deployment-dependent, but the following are considered **essential for a serious production HIMS even when Supabase is the data platform**: Redis/background jobs, durable backup/restore, monitoring/alerting, secrets management, secure ingress, document/PDF processing, and radiology PACS/DICOM infrastructure where RIS is deployed. Supabase's current self-hosting documentation explicitly states that high availability, backups/DR, monitoring and scalability are operator responsibilities, and that some managed-platform capabilities are unavailable in self-hosted deployments. (https://supabase.com/docs/guides/self-hosting)

## Appendix C — Primary Reference Sources

1. Bharat HIMS public product and package information: https://www.bharathims.com/hospital-management-system-bharat-hims-packages
2. ABDM FAQ: https://abdm.gov.in/faqs
3. NABH Hospital Accreditation Standards, 6th Edition, effective 1 Jan 2025: https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf
4. MeitY Digital Personal Data Protection Rules 2025: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025
5. Supabase self-hosting and architecture: https://supabase.com/docs/guides/self-hosting
6. Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
7. NHSRC Revised NQAS 2024: https://qps.nhsrcindia.org/national-quality-assurance-standards/quality-RNQAS
8. NHSRC NQAS QA Directives: https://qps.nhsrcindia.org/repository-standard/quality-QA-Directives
9. NHCX specifications: https://nhcx.abdm.gov.in/procedure-type
