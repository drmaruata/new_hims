# HIMS Database Schema & Multi-Tenant Data Architecture

**Status:** Engineering baseline  
**Version:** 1.0  
**Date:** 2026-09-25  
**Related:** `PRD.md`, `SRS.md`, `development.md`  
**Database:** PostgreSQL, as provisioned and versioned by the Supabase Cloud project. Confirm the exact version with `show server_version` after linking; this repository does not select it.

## 1. Scope and architecture decisions

This document defines the authoritative relational model for the multi-tenant HIMS. The accompanying `supabase_schema.sql` currently establishes 131 tables across the HIMS domain schemas. The model is organized around one canonical patient identity and shared clinical transactions. The ten mandatory departmental domains are:

1. OPD
2. IPD
3. Laboratory Information System (LIS)
4. Radiology Information System (RIS)
5. Emergency
6. OT Management
7. ICU
8. Pharmacy Management
9. EMR
10. Insurance / Claims

The following cross-cutting domains are also first-class: tenant/facility administration, identity and authorization, billing/RCM, inventory/procurement, documents, workflow, notifications, audit, interoperability, analytics and AI.

### 1.1 Canonical data rule

`Patient` is the single master identity. No departmental module may create a parallel patient master.

A patient can have many encounters. An encounter has a type and lifecycle, for example OPD, IPD, Emergency, ICU or post-operative. Orders, prescriptions, medication administrations, specimens, imaging studies, procedures, invoices and claims reference the patient and, where clinically meaningful, the encounter.

### 1.2 EMR rule

The EMR is not an independent copy of every module's records. The authoritative source remains the domain that created the event. EMR maintains:

- a longitudinal document/timeline index;
- normalized patient-summary projections;
- clinical-document references;
- cross-domain search/read models;
- provenance back to source domain and source record.

This prevents OPD, IPD, LIS, RIS, OT and Pharmacy from maintaining competing versions of the same medical history.

### 1.3 Transaction rule

A business transaction is executed by the NestJS backend. Frontend clients do not write business data directly to PostgreSQL/PostgREST.

Supabase provides infrastructure services—Auth, PostgreSQL, Storage and Realtime—but the HIMS business API remains the NestJS API. RLS is mandatory as tenant-isolation defense in depth.

The platform is a managed Supabase Cloud project. Supabase operates the database's backups, upgrades, monitoring and availability; the deployment is responsible for access control, credential management, data residency and verifying that the project's backup retention meets the hospital's recovery objectives. Supabase's connection pooler (Supavisor) is the documented access path and distinguishes session and transaction modes; this deployment uses session mode over IPv4, because a direct connection to the project database is IPv6-only without the paid IPv4 add-on. citeturn863674search0turn863674search1turn863674search4

---

# 2. PostgreSQL schema namespaces

Use separate schemas for domain ownership while keeping one transactional database for the modular-monolith phase.

```text
hims_core          tenant, facility, department, location, user/profile, provider
hims_patient       patient, identifier, contact, consent, allergy, history
hims_catalog       services, departments, specialties, drugs, lab tests, modalities, tariffs
hims_clinical      encounters, diagnoses, notes, orders, observations, medication orders
hims_opd           appointments, queues, referrals
hims_ipd           admissions, bed assignments, nursing, discharge
hims_lab           lab orders, specimens, results, QC
hims_rad           imaging orders, studies, reports, PACS references
hims_emergency     ED encounters, triage, resuscitation, observation, dispositions
hims_ot            OT rooms, cases, scheduling, safety checklist, anaesthesia, specimens
hims_icu           ICU units, ICU episodes, flowsheets, devices, infusions
hims_pharmacy      prescriptions, dispensing, stock, purchase, returns, recalls
hims_inventory     warehouses, lots, stock ledger, procurement, vendors, assets
hims_billing       charges, invoices, payments, refunds, adjustments, packages
hims_insurance     payers, plans, policies, eligibility, pre-auth, claims, remittances
hims_quality       incidents, CQI, CAPA, audits, indicators, HAI, accreditation evidence
hims_workflow      workflow definitions, instances, tasks, rules, approvals, outbox
hims_integration   interfaces, external identifiers, messages, retries, DLQ
hims_documents     metadata, versions, templates, signatures, OCR/index references
hims_audit         append-only audit events and access logs
hims_analytics     reporting dimensions, snapshots/projections where required
hims_ai            AI requests, provenance, feedback, safety review
```

`auth.*` remains owned by Supabase Auth. The application stores a local profile and tenant memberships keyed to `auth.users.id`.

---

# 3. Common column conventions

All tenant-owned tables use:

```text
id                 uuid primary key
tenant_id          uuid not null
created_at         timestamptz not null default now()
created_by         uuid null
updated_at         timestamptz not null default now()
updated_by         uuid null
version            bigint not null default 1
```

Clinical and financially material tables may add:

```text
facility_id
encounter_id
patient_id
status
finalized_at
finalized_by
source_system
source_reference
```

### 3.1 UUIDs

Use UUIDs for internal primary keys. Human-readable business numbers are separate unique identifiers.

### 3.2 Business identifiers

Examples:

- UHID
- OPD encounter number
- IPD admission number
- emergency visit number
- lab accession number
- radiology accession number
- surgery/case number
- invoice number
- claim number
- prescription number
- purchase order number
- incident number
- CAPA number

Business-number generation must be concurrency-safe and configurable by tenant/facility.

### 3.3 Money

Do not use floating-point types for money. Use `numeric(18,2)` or integer minor units where a payment provider contract requires it. Currency must be explicit, defaulting to INR for India deployments.

### 3.4 Clinical values

Do not store clinically meaningful measured values only as strings. Where appropriate, store:

- numeric value;
- normalized unit;
- reference range;
- observed date/time;
- performer;
- method;
- status;
- interpretation;
- source device.

---

# 4. Multi-tenant organization model

## 4.1 Tables

### `hims_core.tenants`

- `id`
- `code` unique
- `legal_name`
- `display_name`
- `status`
- `timezone`
- `default_locale`
- `default_currency`
- `data_region`
- `plan_code`
- `settings_jsonb`

### `hims_core.facilities`

- `id`
- `tenant_id` FK → tenants
- `facility_code`
- `name`
- `facility_type`
- `hfr_id` nullable
- address/contact
- timezone
- status
- settings_jsonb

Unique: `(tenant_id, facility_code)`.

RLS/authorization must never assume a Supabase user belongs to only one tenant.

### `hims_core.departments`

- `id`
- `tenant_id`
- `facility_id`
- `department_code`
- `name`
- `department_type`
- `parent_department_id` nullable
- `clinical_service_flag`
- `status`

Unique: `(facility_id, department_code)`.

### `hims_core.locations`

Hierarchical physical/logical locations:

`facility → building → floor → block → ward/unit → room → bed/room-resource`.

Columns:

- `id`
- `tenant_id`
- `facility_id`
- `parent_location_id`
- `location_type`
- `code`
- `name`
- `status`
- `is_clinical`
- `metadata_jsonb`

### `hims_core.user_profiles`

Tenant-scoped profile for a Supabase identity. One Supabase user may belong to multiple tenants.

- `id`
- `user_id` FK → `auth.users(id)`
- `tenant_id`
- `employee_code`
- `display_name`
- `mobile`
- `email`
- `professional_category`
- `status`
- `last_login_at`

### `hims_core.roles`

Tenant-configurable role definitions.

### `hims_core.permissions`

Stable permission catalogue, e.g. `patient.read`, `ipd.admit`, `lab.result.finalize`.

### `hims_core.role_permissions`

Many-to-many role/permission mapping.

### `hims_core.tenant_memberships`

Maps a Supabase authenticated user to a tenant.

### `hims_core.user_facility_access`

Explicit user-to-facility access.

### `hims_core.user_department_access`

Explicit user-to-department access.

The backend authorization layer evaluates tenant + facility + department + role + action + resource state.

---

# 5. Patient master / MPI

## `hims_patient.patients`

Authoritative patient identity.

Key columns:

- `id`
- `tenant_id`
- `uhid`
- `first_name`
- `middle_name`
- `last_name`
- `display_name`
- `date_of_birth`
- `dob_precision`
- `sex_at_birth`
- `gender_identity` nullable/configurable
- `marital_status`
- `blood_group`
- `photo_document_id`
- `primary_mobile`
- `secondary_mobile`
- `email`
- address fields
- `preferred_language`
- `communication_preference`
- `deceased_at`
- `status`
- `merged_into_patient_id` nullable
- `mastering_status`

Unique: `(tenant_id, uhid)`.

## `hims_patient.patient_identifiers`

For ABHA and other identities.

- `patient_id`
- `identifier_type`
- `system`
- `value_encrypted` or tokenized representation
- `value_hash`
- `is_primary`
- `verified_at`
- `verified_by`
- `valid_from`
- `valid_to`

Create a non-reversible hash index for duplicate/lookup use when raw values are sensitive.

## `hims_patient.patient_contacts`

- relationship
- name
- mobile
- address
- emergency_contact_flag
- authorized_caregiver_flag

## `hims_patient.patient_merge_events`

Immutable merge history:

- source_patient_id
- target_patient_id
- reason
- approved_by
- merged_at
- merge_manifest_jsonb

## `hims_patient.allergies`

- patient_id
- allergen_code
- allergen_name
- reaction
- severity
- verification_status
- onset
- recorded_by
- source

## `hims_patient.conditions`

Longitudinal problem/condition list.

## `hims_patient.medical_histories`

Surgical, family, social and other structured histories.

## `hims_patient.consent_records`

- consent_type
- purpose
- notice_version
- status
- granted_at
- withdrawn_at
- source
- evidence_document_id
- external_consent_reference

The data model must support separate consent contexts rather than one global boolean.

---

# 6. Shared clinical model

## `hims_clinical.practitioners`

- user_id
- registration_number
- professional_type
- speciality
- hpr_id nullable
- department/facility relationships
- credential status

## `hims_clinical.practitioner_assignments`

Authoritative practitioner-to-facility/department assignments used to enforce OPD/IPD/OT/ICU departmental scope.

## `hims_clinical.encounters`

Central clinical encounter table.

- `id`
- `tenant_id`
- `facility_id`
- `patient_id`
- `encounter_number`
- `encounter_type` = OPD/IPD/ED/ICU/OT/TELE/OTHER
- `status`
- `department_id`
- `attending_practitioner_id`
- `started_at`
- `ended_at`
- `parent_encounter_id`
- `source_encounter_id`
- `reason`
- `metadata_jsonb`

This is the principal cross-module join point.

## `hims_clinical.diagnoses`

- encounter_id
- patient_id
- code_system
- code
- description
- diagnosis_type
- certainty
- onset_date
- recorded_by
- status

## `hims_clinical.clinical_notes`

- encounter_id
- patient_id
- note_type
- template_id
- body_structured_jsonb
- body_rendered
- status
- author_id
- signed_by
- signed_at
- amendment_of_id
- amendment_reason

Finalized notes are versioned; amendments do not overwrite the original clinical meaning.

## `hims_clinical.observations`

Generic structured clinical measurements.

- encounter_id
- patient_id
- observation_type
- code_system
- code
- value_numeric
- value_text
- unit
- interpretation
- observed_at
- performer_id
- source_device_id
- status

## `hims_clinical.orders`

Shared order header.

- id
- order_number
- patient_id
- encounter_id
- ordering_department_id
- ordering_practitioner_id
- order_type
- priority
- status
- requested_at
- clinical_indication
- instructions
- source_module

Order-specific details live in domain tables or order items.

## `hims_clinical.order_items`

- order_id
- service_catalog_id
- item_type
- quantity
- priority
- status
- specimen_required
- instructions

## `hims_clinical.medication_orders`

- order_id
- patient_id
- encounter_id
- medication_id
- dose
- dose_unit
- route
- frequency
- duration_value
- duration_unit
- start_at
- stop_at
- prn_flag
- hold_flag
- taper_jsonb
- clinical_notes
- status
- prescriber_id

---

# 7. OPD schema

## `hims_opd.appointments`

- patient_id
- facility_id
- department_id
- practitioner_id
- appointment_number
- appointment_type
- scheduled_start/end
- status
- booking_source
- referring_provider
- queue_token_id

## `hims_opd.queues`

- facility_id
- department_id
- queue_type
- business_date
- current_sequence
- status

## `hims_opd.queue_tickets`

- queue_id
- appointment_id
- encounter_id
- patient_id
- token_number
- priority
- state
- called_at
- consultation_started_at
- completed_at

## `hims_opd.referrals`

- source_encounter_id
- patient_id
- source_department_id
- target_department_id
- target_practitioner_id
- reason
- urgency
- status

## OPD-to-IPD admission

The OPD module creates an `admission_request`; IPD becomes authoritative for actual admission.

`hims_ipd.admission_requests` stores:

- source_encounter_id
- patient_id
- requesting_department
- requested_bed_class
- clinical_reason
- payer_id
- status
- approved_by

No duplicate patient registration occurs.

---

# 8. IPD schema

## `hims_ipd.admissions`

- patient_id
- admission_number
- source_encounter_id
- encounter_id
- admitting_department_id
- attending_practitioner_id
- admission_type
- admission_reason
- payer_id
- admission_at
- discharge_at
- status

## `hims_ipd.bed_assignments`

- patient_id
- admission_id
- facility_id
- department_id
- location_id
- bed_id
- assignment_type
- start_at
- end_at
- status
- transfer_reason

## `hims_ipd.beds`

- facility_id
- department_id
- location_id
- bed_code
- bed_class
- sex_restriction
- isolation_flag
- state
- status

State machine:

`AVAILABLE → RESERVED → OCCUPIED → DISCHARGE_PENDING → CLEANING → AVAILABLE`

Alternate: `BLOCKED`, `MAINTENANCE`, `OUT_OF_SERVICE`, `ISOLATION`.

## `hims_ipd.nursing_notes`

- admission_id
- encounter_id
- patient_id
- note_type
- body_structured_jsonb
- author_id
- status
- signed_at

## `hims_ipd.nursing_tasks`

- patient_id
- admission_id
- assigned_to
- department_id
- task_type
- priority
- due_at
- status
- completed_at
- completion_note

## `hims_ipd.discharge_summaries`

- admission_id
- patient_id
- diagnosis_summary
- procedures_summary
- investigations_summary
- medication_summary
- condition_at_discharge
- follow_up
- instructions
- draft_document_id
- final_document_id
- status
- prepared_by
- reviewed_by
- finalized_at

---

# 9. Laboratory Information System (LIS)

## `hims_lab.lab_test_catalog`

- test_code
- name
- category
- specimen_type_id
- methodology
- department_id
- unit
- reference_range_strategy
- turnaround_minutes
- price
- active

## `hims_lab.specimen_types`

- code
- name
- container
- minimum_volume
- stability_rules_jsonb

## `hims_lab.lab_orders`

- order_id
- patient_id
- encounter_id
- accession_number
- status
- priority
- collection_location
- requested_by

## `hims_lab.lab_order_items`

- lab_order_id
- test_id
- specimen_type_id
- status
- requested_at
- collected_at
- resulted_at

## `hims_lab.specimens`

- lab_order_item_id
- specimen_barcode
- specimen_type_id
- collected_by
- collected_at
- received_by
- received_at
- rejected_at
- rejection_reason
- processing_status
- storage_location

## `hims_lab.lab_results`

- lab_order_item_id
- analyte/test component
- value_numeric/value_text
- unit
- reference_low/reference_high
- critical_flag
- abnormal_flag
- instrument_id
- result_status
- performed_at
- verified_by
- verified_at
- amended_from_id

## `hims_lab.lab_result_comments`

Clinical/pathologist comments with versioning.

## `hims_lab.lab_quality_controls`

Daily/lot/run QC:

- test_id
- instrument_id
- control_lot
- run_at
- control_level
- observed_value
- accepted_flag
- reviewer
- action_taken

## `hims_lab.lab_instruments`

- instrument_code
- manufacturer
- model
- serial_number
- interface_type
- interface_config_ref
- status

Do not store analyser credentials in the database in plaintext. Store secret references in the secrets manager.

---

# 10. Radiology Information System (RIS)

## `hims_rad.modalities`

- modality_code
- name
- modality_type
- ae_title
- location
- status

## `hims_rad.imaging_orders`

- order_id
- patient_id
- encounter_id
- accession_number
- modality_id
- body_site
- procedure_code
- clinical_indication
- priority
- status

## `hims_rad.imaging_studies`

- imaging_order_id
- study_instance_uid
- accession_number
- performed_at
- modality_id
- pacs_system_id
- pacs_url
- image_count
- status

## `hims_rad.imaging_reports`

- study_id
- template_id
- findings
- impression
- voice_transcript_ref
- report_status
- radiologist_id
- verified_at
- amendment_of_id

The HIMS stores radiology metadata and report references. Image pixel data belongs in PACS/object storage, not normal transactional tables.

## `hims_rad.pacs_systems`

- system_code
- endpoint
- base_url
- auth_secret_ref
- status

---

# 11. Emergency Department schema

## `hims_emergency.emergency_encounters`

- encounter_id
- patient_id
- arrival_mode
- arrival_at
- triage_at
- disposition_at
- acuity
- status
- mlc_flag
- police_intimation_flag
- brought_by
- referral_source

## `hims_emergency.triage_assessments`

- emergency_encounter_id
- acuity_level
- chief_complaint
- vitals_observation_refs
- pain_score
- red_flags_jsonb
- triaged_by
- triaged_at

## `hims_emergency.resuscitation_records`

- emergency_encounter_id
- event_start/end
- interventions_jsonb
- team_jsonb
- medications_jsonb
- outcome

## `hims_emergency.observation_stays`

- emergency_encounter_id
- bed/location
- start_at
- end_at
- observations_jsonb

## `hims_emergency.dispositions`

- emergency_encounter_id
- disposition_type = ADMIT/ICU/OT/TRANSFER/DISCHARGE/DEATH/ABSCONDED/etc.
- target_department
- target_admission_id
- transfer_facility
- disposition_reason
- disposition_at

Emergency registration creates a patient if absent, otherwise uses existing UHID.

---

# 12. OT Management System

## `hims_ot.ot_rooms`

- facility_id
- department_id
- room_code
- room_type
- status

## `hims_ot.surgery_requests`

- patient_id
- source_encounter_id
- source_admission_id
- requesting_department_id
- requested_procedure
- priority
- estimated_duration
- preferred_ot_room
- requested_date
- status
- requested_by

## `hims_ot.surgery_cases`

- case_number
- patient_id
- encounter_id
- admission_id
- surgery_request_id
- principal_procedure
- scheduled_start/end
- actual_start/end
- ot_room_id
- surgeon_id
- anaesthetist_id
- status

## `hims_ot.case_team`

- surgery_case_id
- practitioner_id
- staff_type
- role

## `hims_ot.safety_checklists`

- surgery_case_id
- checklist_type
- stage
- item_code
- response
- completed_by
- completed_at

Stages may include sign-in, time-out and sign-out.

## `hims_ot.anaesthesia_records`

- surgery_case_id
- anaesthesia_type
- pre_assessment
- intraop_record_jsonb
- postop_record_jsonb
- anaesthetist_id
- status

## `hims_ot.procedure_notes`

- surgery_case_id
- procedure_code
- operative_findings
- procedure_details
- complications
- specimen_refs
- author_id
- signed_at

## `hims_ot.surgical_specimens`

- surgery_case_id
- specimen_number
- description
- destination_lab_order_item_id
- collected_at
- transferred_at

OT requests can originate from Surgery, ENT, Dental or any configured procedural department. IPD exposes OT scheduling as a command into the OT domain.

---

# 13. ICU schema

## `hims_icu.icu_units`

- facility_id
- department_id
- unit_code
- name
- type
- status

## `hims_icu.icu_admissions`

- patient_id
- source_admission_id
- source_encounter_id
- icu_encounter_id
- unit_id
- bed_id
- admission_reason
- severity
- admitted_at
- discharged_at
- status

## `hims_icu.flowsheets`

- icu_admission_id
- observation_id
- chart_time
- section
- value_jsonb
- recorded_by

## `hims_icu.devices`

- patient_id
- icu_admission_id
- device_type
- device_identifier
- inserted_at
- removed_at
- insertion_site
- inserted_by

## `hims_icu.infusions`

- patient_id
- icu_admission_id
- medication_order_id
- concentration
- rate
- started_at
- stopped_at
- status

ICU transfer from IPD creates an ICU transfer request and an ICU episode; it does not create another patient record.

---

# 14. Pharmacy Management

## `hims_pharmacy.medications`

- medication_code
- generic_name
- brand_name
- strength
- dosage_form
- route
- schedule_class
- high_alert_flag
- controlled_flag
- status

## `hims_pharmacy.formularies`

Tenant/facility-specific prescribing/dispensing formulary.

## `hims_pharmacy.prescriptions`

- prescription_number
- patient_id
- encounter_id
- prescriber_id
- prescription_type = OPD/IPD/DISCHARGE/ED/OTHER
- status
- issued_at

## `hims_pharmacy.prescription_items`

- prescription_id
- medication_id
- dose
- route
- frequency
- duration
- quantity
- substitution_allowed
- status

## `hims_pharmacy.dispensings`

- prescription_id
- patient_id
- encounter_id
- pharmacy_location_id
- pharmacist_id
- dispensed_at
- status

## `hims_pharmacy.dispensing_items`

- dispensing_id
- prescription_item_id
- stock_lot_id
- quantity
- unit_price
- discount
- status

The integration contract is explicit:

`OPD consultation → prescription → prescription queue → Pharmacy`

`IPD medication order → pharmacy medication queue → dispensing → MAR availability`

The Pharmacy UI must never require manual re-entry of an active OPD prescription or IPD medication order.

---

# 15. Inventory / procurement

## `hims_inventory.warehouses`

- facility_id
- code
- name
- warehouse_type
- pharmacy_flag
- ward_stock_flag

## `hims_inventory.vendors`

- tenant_id
- vendor_code
- name
- tax identifiers
- contact
- status

## `hims_inventory.stock_lots`

- item_id
- warehouse_id
- batch_number
- expiry_date
- manufacture_date
- quantity_on_hand
- reserved_quantity
- unit_cost
- mrp
- receipt_id
- status

## `hims_inventory.stock_transactions`

Immutable inventory ledger:

- transaction_type
- item_id
- warehouse_id
- stock_lot_id
- quantity_in
- quantity_out
- reference_type
- reference_id
- performed_at
- performed_by
- balance_after

## `hims_inventory.purchase_orders`

- po_number
- vendor_id
- facility_id
- warehouse_id
- requested_by
- approved_by
- status
- ordered_at

## `hims_inventory.purchase_order_items`

- purchase_order_id
- item_id
- quantity
- unit_price
- tax
- expected_date

## `hims_inventory.goods_receipts`

- grn_number
- purchase_order_id
- received_at
- received_by
- status

## `hims_inventory.assets`

- asset_tag
- asset_type
- serial_number
- facility_id
- location_id
- vendor_id
- purchase_date
- warranty_end
- maintenance_status

---

# 16. Billing and Revenue Cycle

## `hims_billing.service_catalog`

- service_code
- name
- category
- department_id
- clinical_flag
- tariffable_flag
- status

## `hims_billing.tariffs`

- service_id
- payer_id nullable
- facility_id
- effective_from
- effective_to
- amount
- tax_profile
- approval_status

## `hims_billing.charges`

- patient_id
- encounter_id
- admission_id
- service_id
- source_module
- source_reference
- quantity
- unit_rate
- gross_amount
- discount
- net_amount
- payer_responsibility
- patient_responsibility
- status
- posted_at

## `hims_billing.invoices`

- invoice_number
- patient_id
- encounter_id
- admission_id
- payer_id
- invoice_type
- status
- subtotal
- discount
- tax
- total
- outstanding
- issued_at
- finalized_at

## `hims_billing.invoice_items`

- invoice_id
- charge_id
- service_id
- description
- quantity
- unit_rate
- discount
- tax
- amount

## `hims_billing.payments`

- payment_number
- patient_id
- invoice_id
- method
- provider
- external_transaction_id
- amount
- currency
- status
- paid_at

## `hims_billing.refunds`

- payment_id
- amount
- reason
- requested_by
- approved_by
- processed_at
- status

All payment creation must be idempotent.

---

# 17. Insurance / TPA / Claims / Government schemes

## `hims_insurance.payers`

- payer_code
- payer_type = CENTRAL_GOVT/STATE_GOVT/PRIVATE/TPA/EMPLOYER/OTHER
- name
- network_identifier
- contact
- status

## `hims_insurance.plans`

- payer_id
- plan_code
- name
- scheme_family
- state_code
- effective dates
- rules_jsonb

Examples may include centrally administered schemes, state schemes and private insurance. Do not hard-code individual scheme names into business logic.

## `hims_insurance.patient_policies`

- patient_id
- payer_id
- plan_id
- policy_number_encrypted
- membership_number
- primary_insured_name
- relationship
- validity
- verification_status

## `hims_insurance.eligibility_checks`

- patient_policy_id
- encounter_id
- request_reference
- response_reference
- status
- checked_at

## `hims_insurance.pre_authorizations`

- admission_id
- encounter_id
- patient_policy_id
- authorization_number
- requested_amount
- approved_amount
- status
- requested_at
- approved_at
- expiry_at

## `hims_insurance.claims`

- claim_number
- invoice_id
- patient_id
- payer_id
- plan_id
- preauth_id
- claim_type
- status
- amount_claimed
- amount_approved
- amount_rejected
- submitted_at
- adjudicated_at
- settled_at

## `hims_insurance.claim_items`

- claim_id
- invoice_item_id
- service_code
- quantity
- claimed_amount
- approved_amount
- rejected_amount
- rejection_code
- rejection_reason

## `hims_insurance.remittances`

- payer_id
- claim_id
- external_reference
- received_at
- amount_received
- status
- reconciliation_status

## `hims_insurance.claim_documents`

- claim_id
- document_id
- document_type
- mandatory_flag
- submitted_at

The integration layer may expose NHCX/other payer-specific exchange through adapters. Internal claim state must not be coupled to one external gateway.

---

# 18. EMR / longitudinal record

## `hims_emr.timeline_entries`

A read-optimized timeline projection:

- patient_id
- encounter_id
- event_type
- source_domain
- source_table
- source_record_id
- occurred_at
- display_summary
- clinical_significance
- security_classification

## `hims_emr.patient_summaries`

Materialized/read model of:

- allergies
- active conditions
- active medications
- recent admissions
- major procedures
- pending investigations
- recent abnormal/critical results
- insurance summary
- care-team summary

The summary is rebuildable from authoritative sources.

## `hims_emr.document_index`

References clinical documents from all modules. It stores metadata and provenance, not necessarily document binary content.

Every EMR entry should retain:

`source_domain + source_record_id + event_id + author + timestamp`.

---

# 19. Documents and signatures

## `hims_documents.documents`

- document_number
- patient_id nullable
- encounter_id nullable
- admission_id nullable
- document_type
- title
- classification
- storage_object_key
- mime_type
- checksum_sha256
- status
- owner_domain

## `hims_documents.document_versions`

- document_id
- version_number
- object_key
- checksum
- created_by
- created_at
- supersedes_version_id

## `hims_documents.signatures`

- document_id
- version_id
- signer_user_id
- signing_method
- signed_at
- signature_reference
- verification_status

Use object storage for files; do not store large PDFs/images as database blobs unless a specific use case requires it.

---

# 20. Quality, patient safety and accreditation

## `hims_quality.quality_indicators`

- code
- name
- domain
- formula_jsonb
- target_value
- frequency
- owner_role
- status

## `hims_quality.indicator_observations`

- indicator_id
- facility_id
- department_id
- period_start
- period_end
- numerator
- denominator
- calculated_value
- source_query_version
- reviewed_by

## `hims_quality.incidents`

- incident_number
- patient_id nullable
- encounter_id nullable
- department_id
- incident_type
- severity
- occurred_at
- reported_at
- description
- immediate_action
- status
- reporter_id

## `hims_quality.incident_investigations`

- incident_id
- investigator
- analysis_method
- findings
- conclusion
- completed_at

## `hims_quality.capas`

- incident_id
- capa_number
- root_cause
- action_type
- owner_id
- due_at
- completed_at
- effectiveness_review
- status

## `hims_quality.audits`

- audit_number
- audit_type
- scope
- department_id
- start/end
- auditor
- status

## `hims_quality.audit_findings`

- audit_id
- finding_type
- severity
- requirement_reference
- evidence_summary
- action_required
- status

## `hims_quality.accreditation_requirements`

Configured mappings for NABH/NQAS and other customer-selected frameworks.

Fields:

- framework_code
- version
- chapter/domain
- requirement_code
- requirement_text
- software_control_type
- evidence_type

## `hims_quality.accreditation_evidence`

- requirement_id
- document_id
- incident_id
- audit_id
- workflow_instance_id
- period
- owner
- verification_status

NQAS-related configuration should be able to represent current programme guidance and the integration of LaQshya/MusQan where applicable. NHSRC currently publishes the 2026 guidance for integration of LaQshya and MusQan with NQAS. citeturn164546search2turn164546search4

---

# 21. Workflow and automation

## `hims_workflow.workflow_definitions`

- code
- version
- trigger_type
- definition_jsonb
- status

## `hims_workflow.workflow_instances`

- definition_id
- tenant_id
- facility_id
- patient_id nullable
- encounter_id nullable
- subject_type
- subject_id
- status
- started_at
- completed_at

## `hims_workflow.tasks`

- workflow_instance_id
- task_type
- assigned_user_id/role
- department_id
- priority
- due_at
- status
- completed_at
- outcome_jsonb

## `hims_workflow.approvals`

- subject_type
- subject_id
- workflow_instance_id
- required_role
- requested_by
- approver_id
- decision
- decision_reason
- decided_at

## `hims_workflow.outbox_events`

Reliable event publication table.

- event_id
- tenant_id
- aggregate_type
- aggregate_id
- event_type
- event_version
- payload_jsonb
- occurred_at
- published_at
- attempt_count
- last_error
- status

The business transaction and outbox insert must commit atomically.

---

# 22. Integration layer

## `hims_integration.integrations`

- integration_code
- integration_type
- vendor
- protocol
- endpoint
- secret_ref
- status

## `hims_integration.external_identifiers`

Maps internal IDs to external system IDs.

- entity_type
- entity_id
- system_code
- external_identifier
- identifier_type
- first_seen_at
- last_seen_at

## `hims_integration.messages`

- integration_id
- message_id
- message_type
- direction
- correlation_id
- request_payload_ref
- response_payload_ref
- status
- sent_at
- received_at
- error_code

## `hims_integration.message_attempts`

Retry history.

## `hims_integration.dead_letters`

- message_id
- reason
- payload_reference
- first_failed_at
- last_failed_at
- replay_status

The integration layer covers ABDM/HIE, FHIR, HL7, DICOM/DICOMweb, NHCX/payer interfaces, payments, messaging, device integrations and legacy HIMS migration.

ABDM describes standardized identity and longitudinal health-record linking concepts through Health ID/ABHA, HFR, HPR and PHR, with record sharing controlled by consent. citeturn164546search6

---

# 23. Audit and access logging

## `hims_audit.audit_events`

Append-only.

- event_id
- tenant_id
- facility_id
- actor_user_id
- actor_type
- action
- resource_type
- resource_id
- patient_id nullable
- encounter_id nullable
- before_hash/reference
- after_hash/reference
- metadata_jsonb
- ip_address
- user_agent
- correlation_id
- occurred_at

Do not use ordinary CRUD APIs to update/delete audit rows.

## `hims_audit.data_access_events`

For sensitive patient-record access:

- user
- patient
- reason_code
- access_type
- module
- encounter_id
- occurred_at

Support break-glass access with mandatory reason and elevated audit handling.

---

# 24. AI data model

## `hims_ai.ai_requests`

- request_id
- tenant_id
- user_id
- patient_id nullable
- encounter_id nullable
- use_case
- model_provider
- model_name
- prompt_template_version
- source_context_manifest
- request_classification
- status
- created_at

## `hims_ai.ai_outputs`

- request_id
- output_version
- output_text/reference
- confidence_metadata
- citations_jsonb
- safety_flags
- reviewed_by
- review_status
- finalized_document_id nullable

AI records must preserve provenance and should not be silently promoted into authoritative clinical records.

---

# 25. Analytics / reporting model

Operational reporting should initially use read-only SQL views/materialized views or projection tables over PostgreSQL.

For higher volume, introduce an analytics warehouse.

Core dimensions:

- date
- facility
- department
- practitioner
- payer
- service
- patient cohort

Fact examples:

- encounters
- admissions
- bed occupancy
- lab TAT
- imaging TAT
- pharmacy dispensing
- charges
- payments
- claims
- incidents
- CAPA
- quality indicators

Every KPI must retain formula/version metadata.

---

# 26. Key relationship map

```text
TENANT
 ├─ FACILITY
 │   ├─ DEPARTMENT
 │   │   ├─ OPD
 │   │   ├─ IPD
 │   │   ├─ ED
 │   │   ├─ ICU
 │   │   └─ OT
 │   ├─ LOCATION
 │   │   └─ BED
 │   └─ WAREHOUSE
 │
 └─ USERS / ROLES

PATIENT
 ├─ IDENTIFIERS / ABHA
 ├─ CONTACTS / CONSENTS
 ├─ ENCOUNTERS
 │   ├─ OPD
 │   │   ├─ APPOINTMENT
 │   │   ├─ NOTES
 │   │   ├─ ORDERS
 │   │   └─ PRESCRIPTION
 │   ├─ IPD
 │   │   ├─ BED ASSIGNMENTS
 │   │   ├─ NURSING NOTES
 │   │   ├─ MAR
 │   │   ├─ ORDERS
 │   │   └─ DISCHARGE
 │   ├─ ED
 │   └─ ICU
 │
 ├─ LAB ORDERS → SPECIMENS → RESULTS
 ├─ IMAGING ORDERS → STUDIES → REPORTS → PACS
 ├─ OT CASES → PROCEDURES → SPECIMENS
 ├─ PRESCRIPTIONS → DISPENSING → STOCK LEDGER
 ├─ CHARGES → INVOICES → PAYMENTS
 ├─ POLICIES → PREAUTH → CLAIMS → REMITTANCE
 └─ EMR TIMELINE / DOCUMENT INDEX
```

---

# 27. Cross-module invariants

These are non-negotiable database/application invariants.

### INV-001 — One patient identity

An encounter must reference exactly one patient. No module creates a departmental patient ID as a master identity.

### INV-002 — OPD department attribution

An OPD encounter must reference the department under which the service is being delivered. A Medicine consultation therefore belongs to Medicine, an ENT consultation to ENT, etc.

### INV-003 — IPD continuity

Admission from OPD or Emergency must preserve the source encounter and patient ID.

### INV-004 — Bed exclusivity

One active bed assignment cannot represent two occupying patients simultaneously.

### INV-005 — Pharmacy source integrity

An OPD prescription or IPD medication order must be consumable by Pharmacy without re-entry.

### INV-006 — Dispensing traceability

Every stock decrement associated with dispensing must identify the prescription item, dispensing record, stock lot and pharmacist.

### INV-007 — Lab provenance

Every finalized result must resolve to one specimen and one ordered test, with performer and verification history.

### INV-008 — Imaging provenance

Every imaging report resolves to an imaging study and study instance UID/PACS reference where applicable.

### INV-009 — OT linkage

Every surgery case references its originating request/admission/encounter and resulting clinical documents.

### INV-010 — ICU transfer continuity

An ICU episode references the source IPD encounter/admission.

### INV-011 — Claim lineage

Every claim item maps to invoice/charge items.

### INV-012 — EMR provenance

Every projected timeline item has a source domain and source record.

### INV-013 — Finalized record immutability

Finalized clinical documents/results may only be amended through versioned amendment workflows.

### INV-014 — Tenant isolation

No tenant may query, mutate or infer another tenant's patient/business rows through an application/API path.

---

# 28. Indexing strategy

Every tenant-owned high-volume table should begin with a composite tenant-aware index pattern.

Examples:

```sql
CREATE INDEX idx_encounters_tenant_patient_time
  ON hims_clinical.encounters (tenant_id, patient_id, started_at DESC);

CREATE INDEX idx_lab_orders_status
  ON hims_lab.lab_orders (tenant_id, status);

CREATE INDEX idx_queue_tickets_tenant_queue_state
  ON hims_opd.queue_tickets (tenant_id, queue_id, state, token_number);

CREATE INDEX idx_claims_tenant_status_age
  ON hims_insurance.claims (tenant_id, status, submitted_at);
```

Use partial indexes for active records, e.g. active bed assignments.

Avoid indexing every column. Measure query plans with representative hospital data.

---

# 29. Partitioning

Candidates for time-based partitioning at scale:

- audit events
- data access events
- integration messages
- observation/event streams
- high-volume queue events
- stock transaction ledger if volume warrants

Start without partitions unless a benchmark demonstrates the need. Partitioning is a physical optimization, not a domain boundary.

---

# 30. RLS and tenant isolation model

## 30.1 Required transaction context

NestJS must set transaction-local context before executing business SQL:

```sql
SELECT set_config('app.tenant_id', :tenant_id, true);
SELECT set_config('app.user_id', :user_id, true);
SELECT set_config('app.facility_ids', :facility_ids_json, true);
```

Use transaction-local (`true`) settings so pooled connections cannot retain a previous request's context. Because the NestJS API uses a dedicated database role, the RLS policy target must cover that role (the baseline uses `PUBLIC`); the application role must not have `BYPASSRLS`.

## 30.2 Helper functions

Use `SECURITY INVOKER` SQL functions where possible:

```sql
CREATE FUNCTION hims_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;
```

Similarly for current user.

Do not use user-editable JWT metadata as the source of authorization truth. Supabase's current guidance explicitly warns against using `raw_user_meta_data` for authorization and recommends server-controlled application metadata for claims. citeturn863674search3

## 30.3 Base tenant policy

Every exposed tenant-owned table must have `ENABLE ROW LEVEL SECURITY` and tenant policies equivalent to:

```sql
CREATE POLICY tenant_isolation_select
ON hims_patient.patients
FOR SELECT
TO public
USING (tenant_id = hims_current_tenant_id());

CREATE POLICY tenant_isolation_insert
ON hims_patient.patients
FOR INSERT
TO public
WITH CHECK (tenant_id = hims_current_tenant_id());

CREATE POLICY tenant_isolation_update
ON hims_patient.patients
FOR UPDATE
TO public
USING (tenant_id = hims_current_tenant_id())
WITH CHECK (tenant_id = hims_current_tenant_id());
```

The exact Postgres role used by NestJS must not have `BYPASSRLS`.

Supabase's security guidance also notes that UPDATE requires both appropriate SELECT visibility and `WITH CHECK`, and that service-role credentials bypass RLS. citeturn863674search3

## 30.4 Authorization beyond tenant isolation

Tenant RLS proves tenant ownership. The application authorization layer decides whether a user can access:

- a facility;
- a department;
- a specific resource class;
- a patient relationship/work assignment;
- a high-risk operation.

For sensitive tables, add facility/dept predicates in the database where practical.

## 30.5 Deletion policy

Business tables should not receive a normal application `DELETE` capability. Use status/cancellation/retirement/amendment records instead. Physical deletion is an administrative data-lifecycle operation subject to policy and retention controls. The baseline migration therefore does not create generic DELETE RLS policies.

## 30.6 Supabase Data API position

For this project, do not expose the complete HIMS schema through PostgREST as a public application API. Keep domain tables in non-exposed schemas and use NestJS as the application boundary.

Supabase's Data API documentation distinguishes table exposure from RLS; if any schema is exposed, RLS must still be enabled and grants must be explicit. citeturn863674search0

---

# 31. Backup and recovery requirements

The database must support:

- continuous/WAL archiving where production tier justifies it;
- daily full backup;
- off-host backup storage;
- encrypted backups;
- regular restore tests;
- documented RPO/RTO;
- migration backup before destructive schema changes.

Do not treat Docker volumes as backups.

The platform is a managed Supabase Cloud project, so backups and point-in-time recovery are provided by the platform. That moves the obligation rather than removing it: the deployment must verify that the project's region and retention settings meet the hospital's recovery objectives, test restore against the platform's backup, and maintain an application-level export that does not depend on the platform's retention policy. citeturn863674search0

---

# 32. Migration policy

Every schema change is a versioned migration.

Migration rules:

1. Never edit an already-applied migration in production.
2. Prefer additive changes.
3. Backfill data through controlled jobs.
4. Separate schema change from large data migration where feasible.
5. Avoid long table locks.
6. Test on a production-sized dataset.
7. Record release version and migration version.

Supabase Cloud applies migrations through the Supabase CLI, which records each applied version in `supabase_migrations.schema_migrations` and applies only files absent from it. The CLI's command surface changes over time; use the installed CLI's `--help` before relying on command syntax. Migrations must not be applied as plain SQL against a cloud project outside the CLI, because that records nothing and leaves the schema out of step with the platform's history. citeturn863674search1

---

# 33. Data retention and archival

Retention is configured by tenant policy, legal requirements, clinical policy and deployment type.

The system must distinguish:

- active operational data;
- archived clinical data;
- audit evidence;
- deleted/withdrawn content;
- legally held records.

Do not hard-delete clinical records as a normal UI action.

---

# 34. Security classification

Each data family should be classified at least as:

- Public/administrative
- Internal
- Confidential
- Sensitive personal data
- High-risk clinical/financial/security data

The classification drives:

- logging restrictions;
- access review;
- export restrictions;
- retention;
- AI eligibility;
- offline caching eligibility.

The DPDP Rules, 2025 provide a current framework for data notices, consent and protection obligations; legal/compliance teams must map the final deployment against the applicable Act/Rules obligations and customer role. citeturn164546search0turn164546search60

---

# 35. Schema quality rules

Before a table is accepted:

- tenant scope is defined;
- owner domain is defined;
- PK and natural/business identifier rules are defined;
- FKs are declared where appropriate;
- status state machine is documented;
- audit requirements are defined;
- PII/clinical classification is defined;
- indexes are justified;
- RLS policy exists;
- API ownership is defined;
- migration and rollback/forward-fix strategy exists.

---

# 36. Machine-readable migration baseline

`supabase_schema.sql` is the initial executable baseline accompanying this document. The SQL file intentionally establishes the core schemas, common functions, key tables, constraints, indexes, and the base tenant-isolation RLS pattern. Domain expansion should proceed through numbered migrations, not by editing the baseline after production deployment.
