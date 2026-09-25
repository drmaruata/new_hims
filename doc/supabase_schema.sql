-- HIMS Supabase/PostgreSQL baseline schema
-- Version: 1.0
-- Date: 2026-09-25
-- NOTE: Apply through a controlled migration pipeline. This file is a bootstrap
-- baseline for the logical model; production should use numbered migrations.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS hims_core;
CREATE SCHEMA IF NOT EXISTS hims_patient;
CREATE SCHEMA IF NOT EXISTS hims_catalog;
CREATE SCHEMA IF NOT EXISTS hims_clinical;
CREATE SCHEMA IF NOT EXISTS hims_opd;
CREATE SCHEMA IF NOT EXISTS hims_ipd;
CREATE SCHEMA IF NOT EXISTS hims_lab;
CREATE SCHEMA IF NOT EXISTS hims_rad;
CREATE SCHEMA IF NOT EXISTS hims_emergency;
CREATE SCHEMA IF NOT EXISTS hims_ot;
CREATE SCHEMA IF NOT EXISTS hims_icu;
CREATE SCHEMA IF NOT EXISTS hims_pharmacy;
CREATE SCHEMA IF NOT EXISTS hims_inventory;
CREATE SCHEMA IF NOT EXISTS hims_billing;
CREATE SCHEMA IF NOT EXISTS hims_insurance;
CREATE SCHEMA IF NOT EXISTS hims_emr;
CREATE SCHEMA IF NOT EXISTS hims_documents;
CREATE SCHEMA IF NOT EXISTS hims_quality;
CREATE SCHEMA IF NOT EXISTS hims_workflow;
CREATE SCHEMA IF NOT EXISTS hims_integration;
CREATE SCHEMA IF NOT EXISTS hims_audit;
CREATE SCHEMA IF NOT EXISTS hims_ai;

CREATE OR REPLACE FUNCTION hims_current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION hims_current_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

-- ========================= CORE / TENANCY ================================

CREATE TABLE hims_core.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  default_locale text NOT NULL DEFAULT 'en-IN',
  default_currency char(3) NOT NULL DEFAULT 'INR',
  data_region text,
  plan_code text,
  settings_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE hims_core.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_code text NOT NULL,
  name text NOT NULL,
  facility_type text NOT NULL,
  hfr_id text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  status text NOT NULL DEFAULT 'ACTIVE',
  address_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version bigint NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, facility_code)
);

CREATE TABLE hims_core.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_code text NOT NULL,
  name text NOT NULL,
  department_type text NOT NULL,
  parent_department_id uuid REFERENCES hims_core.departments(id),
  clinical_service_flag boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE',
  settings_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version bigint NOT NULL DEFAULT 1,
  UNIQUE (facility_id, department_code)
);

CREATE TABLE hims_core.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  parent_location_id uuid REFERENCES hims_core.locations(id),
  location_type text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  is_clinical boolean NOT NULL DEFAULT false,
  metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facility_id, code)
);

CREATE TABLE hims_core.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  employee_code text,
  display_name text NOT NULL,
  mobile text,
  email text,
  professional_category text,
  status text NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version bigint NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE hims_core.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  system_role boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE hims_core.permissions (
  code text PRIMARY KEY,
  description text NOT NULL,
  risk_level text NOT NULL DEFAULT 'NORMAL'
);

CREATE TABLE hims_core.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  role_id uuid NOT NULL REFERENCES hims_core.roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES hims_core.permissions(code),
  UNIQUE (tenant_id, role_id, permission_code)
);

CREATE TABLE hims_core.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_status text NOT NULL DEFAULT 'ACTIVE',
  is_tenant_admin boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE hims_core.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES hims_core.roles(id),
  facility_id uuid REFERENCES hims_core.facilities(id),
  department_id uuid REFERENCES hims_core.departments(id),
  active_from timestamptz,
  active_to timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE'
);

CREATE UNIQUE INDEX ux_user_roles_scope
ON hims_core.user_roles (
  tenant_id,
  user_id,
  role_id,
  COALESCE(facility_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE hims_core.user_facility_access (
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, user_id, facility_id)
);

CREATE TABLE hims_core.user_department_access (
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES hims_core.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, user_id, department_id)
);

-- ========================= CATALOG ======================================

CREATE TABLE hims_catalog.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE hims_catalog.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  service_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  department_id uuid REFERENCES hims_core.departments(id),
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, service_code)
);

CREATE TABLE hims_catalog.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  medication_code text NOT NULL,
  generic_name text NOT NULL,
  brand_name text,
  strength text,
  dosage_form text,
  route text,
  high_alert_flag boolean NOT NULL DEFAULT false,
  controlled_flag boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, medication_code)
);

CREATE TABLE hims_catalog.lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  test_code text NOT NULL,
  name text NOT NULL,
  category text,
  specimen_type_code text,
  unit text,
  turnaround_minutes integer,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, test_code)
);

-- ========================= PATIENT ======================================

CREATE TABLE hims_patient.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  uhid text NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text,
  display_name text NOT NULL,
  date_of_birth date,
  dob_precision text,
  sex_at_birth text,
  gender_identity text,
  marital_status text,
  blood_group text,
  primary_mobile text,
  secondary_mobile text,
  email text,
  address_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_language text,
  communication_preference text,
  deceased_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE',
  merged_into_patient_id uuid REFERENCES hims_patient.patients(id),
  mastering_status text NOT NULL DEFAULT 'MASTER',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version bigint NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, uhid)
);

CREATE TABLE hims_patient.patient_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id) ON DELETE CASCADE,
  identifier_type text NOT NULL,
  system text,
  value_hash text,
  value_encrypted text,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_patient_identifier_hash
ON hims_patient.patient_identifiers(tenant_id, identifier_type, value_hash)
WHERE value_hash IS NOT NULL;

CREATE TABLE hims_patient.patient_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id) ON DELETE CASCADE,
  relationship text,
  name text NOT NULL,
  mobile text,
  address_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency_contact_flag boolean NOT NULL DEFAULT false,
  authorized_caregiver_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_patient.allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id) ON DELETE CASCADE,
  allergen_code text,
  allergen_name text NOT NULL,
  reaction text,
  severity text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED',
  onset_date date,
  source text,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_patient.conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id) ON DELETE CASCADE,
  code_system text,
  code text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  onset_date date,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_patient.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  purpose text NOT NULL,
  notice_version text,
  status text NOT NULL,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  source text,
  evidence_document_id uuid,
  external_consent_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_patient.patient_merge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  source_patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  target_patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  reason text NOT NULL,
  approved_by uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  merge_manifest_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========================= CLINICAL =====================================

CREATE TABLE hims_clinical.practitioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  registration_number text,
  professional_type text NOT NULL,
  specialty_id uuid REFERENCES hims_catalog.specialties(id),
  hpr_id text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE hims_clinical.practitioner_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  practitioner_id uuid NOT NULL REFERENCES hims_clinical.practitioners(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  specialty_id uuid REFERENCES hims_catalog.specialties(id),
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, practitioner_id, facility_id, department_id)
);

CREATE TABLE hims_clinical.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_number text NOT NULL,
  encounter_type text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  attending_practitioner_id uuid REFERENCES hims_clinical.practitioners(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  parent_encounter_id uuid REFERENCES hims_clinical.encounters(id),
  source_encounter_id uuid REFERENCES hims_clinical.encounters(id),
  reason text,
  metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version bigint NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, encounter_number)
);

CREATE TABLE hims_clinical.diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  code_system text,
  code text,
  description text NOT NULL,
  diagnosis_type text,
  certainty text,
  onset_date date,
  status text NOT NULL DEFAULT 'ACTIVE',
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_clinical.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  note_type text NOT NULL,
  body_structured_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_rendered text,
  status text NOT NULL DEFAULT 'DRAFT',
  author_id uuid NOT NULL,
  signed_by uuid,
  signed_at timestamptz,
  amendment_of_id uuid REFERENCES hims_clinical.clinical_notes(id),
  amendment_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE hims_clinical.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  observation_type text NOT NULL,
  code_system text,
  code text,
  value_numeric numeric,
  value_text text,
  unit text,
  interpretation text,
  observed_at timestamptz NOT NULL,
  performer_id uuid,
  source_device_id text,
  status text NOT NULL DEFAULT 'FINAL'
);

CREATE TABLE hims_clinical.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  order_number text NOT NULL,
  ordering_department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  ordering_practitioner_id uuid REFERENCES hims_clinical.practitioners(id),
  order_type text NOT NULL,
  priority text NOT NULL DEFAULT 'ROUTINE',
  status text NOT NULL DEFAULT 'ORDERED',
  requested_at timestamptz NOT NULL DEFAULT now(),
  clinical_indication text,
  instructions text,
  source_module text,
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE hims_clinical.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  order_id uuid NOT NULL REFERENCES hims_clinical.orders(id) ON DELETE CASCADE,
  service_catalog_id uuid REFERENCES hims_catalog.services(id),
  item_type text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  priority text,
  status text NOT NULL DEFAULT 'ORDERED',
  instructions text
);

CREATE TABLE hims_clinical.medication_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  order_id uuid NOT NULL REFERENCES hims_clinical.orders(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  medication_id uuid NOT NULL REFERENCES hims_catalog.medications(id),
  dose numeric(12,4),
  dose_unit text,
  route text,
  frequency text,
  duration_value numeric(10,2),
  duration_unit text,
  start_at timestamptz,
  stop_at timestamptz,
  prn_flag boolean NOT NULL DEFAULT false,
  hold_flag boolean NOT NULL DEFAULT false,
  taper_jsonb jsonb,
  clinical_notes text,
  status text NOT NULL DEFAULT 'ACTIVE',
  prescriber_id uuid REFERENCES hims_clinical.practitioners(id)
);

CREATE TABLE hims_clinical.medication_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  medication_order_id uuid NOT NULL REFERENCES hims_clinical.medication_orders(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  scheduled_at timestamptz,
  administered_at timestamptz,
  administered_dose numeric(12,4),
  dose_unit text,
  route text,
  status text NOT NULL DEFAULT 'SCHEDULED',
  administered_by uuid,
  reason text,
  witness_user_id uuid
);

-- ========================= OPD ==========================================

CREATE TABLE hims_opd.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  practitioner_id uuid REFERENCES hims_clinical.practitioners(id),
  appointment_number text NOT NULL,
  appointment_type text NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED',
  booking_source text,
  UNIQUE (tenant_id, appointment_number)
);

CREATE TABLE hims_opd.queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  queue_type text NOT NULL,
  business_date date NOT NULL,
  current_sequence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE hims_opd.queue_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  queue_id uuid NOT NULL REFERENCES hims_opd.queues(id),
  appointment_id uuid REFERENCES hims_opd.appointments(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  token_number integer NOT NULL,
  priority text NOT NULL DEFAULT 'NORMAL',
  state text NOT NULL DEFAULT 'WAITING',
  called_at timestamptz,
  consultation_started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (queue_id, token_number)
);

CREATE TABLE hims_opd.admission_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  source_encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  requesting_department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  requested_bed_class text,
  clinical_reason text,
  payer_id uuid,
  status text NOT NULL DEFAULT 'REQUESTED',
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================= IPD ==========================================

CREATE TABLE hims_ipd.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  location_id uuid NOT NULL REFERENCES hims_core.locations(id),
  bed_code text NOT NULL,
  bed_class text,
  sex_restriction text,
  isolation_flag boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'AVAILABLE',
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (facility_id, bed_code)
);

CREATE TABLE hims_ipd.admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  admission_number text NOT NULL,
  source_encounter_id uuid REFERENCES hims_clinical.encounters(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  admitting_department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  attending_practitioner_id uuid REFERENCES hims_clinical.practitioners(id),
  admission_type text NOT NULL,
  admission_reason text,
  admission_at timestamptz NOT NULL DEFAULT now(),
  discharge_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, admission_number)
);

CREATE TABLE hims_ipd.bed_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  admission_id uuid NOT NULL REFERENCES hims_ipd.admissions(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  location_id uuid NOT NULL REFERENCES hims_core.locations(id),
  bed_id uuid NOT NULL REFERENCES hims_ipd.beds(id),
  assignment_type text NOT NULL DEFAULT 'PRIMARY',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE',
  transfer_reason text
);

CREATE UNIQUE INDEX ux_active_bed_assignment
ON hims_ipd.bed_assignments(bed_id)
WHERE status = 'ACTIVE';

CREATE TABLE hims_ipd.nursing_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  admission_id uuid NOT NULL REFERENCES hims_ipd.admissions(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  note_type text NOT NULL,
  body_structured_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT',
  author_id uuid NOT NULL,
  signed_at timestamptz
);

CREATE TABLE hims_ipd.nursing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  admission_id uuid NOT NULL REFERENCES hims_ipd.admissions(id),
  department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  assigned_to uuid,
  task_type text NOT NULL,
  priority text NOT NULL DEFAULT 'NORMAL',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'OPEN',
  completed_at timestamptz,
  completion_note text
);

CREATE TABLE hims_ipd.discharge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  admission_id uuid NOT NULL REFERENCES hims_ipd.admissions(id),
  diagnosis_summary text,
  procedures_summary text,
  investigations_summary text,
  medication_summary text,
  condition_at_discharge text,
  follow_up text,
  instructions text,
  status text NOT NULL DEFAULT 'DRAFT',
  prepared_by uuid,
  reviewed_by uuid,
  finalized_at timestamptz
);

-- ========================= LIS ==========================================

CREATE TABLE hims_lab.specimen_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  container text,
  minimum_volume numeric,
  stability_rules_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, code)
);

CREATE TABLE hims_lab.lab_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  instrument_code text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  interface_type text,
  interface_config_ref text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, instrument_code)
);

CREATE TABLE hims_lab.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  order_id uuid NOT NULL REFERENCES hims_clinical.orders(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  accession_number text NOT NULL,
  status text NOT NULL DEFAULT 'ORDERED',
  priority text NOT NULL DEFAULT 'ROUTINE',
  collection_location_id uuid,
  requested_by uuid,
  UNIQUE (tenant_id, accession_number)
);

CREATE TABLE hims_lab.lab_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  lab_order_id uuid NOT NULL REFERENCES hims_lab.lab_orders(id) ON DELETE CASCADE,
  source_order_item_id uuid REFERENCES hims_clinical.order_items(id),
  test_id uuid NOT NULL REFERENCES hims_catalog.lab_tests(id),
  specimen_type_id uuid REFERENCES hims_lab.specimen_types(id),
  status text NOT NULL DEFAULT 'ORDERED',
  requested_at timestamptz NOT NULL DEFAULT now(),
  collected_at timestamptz,
  resulted_at timestamptz
);

CREATE TABLE hims_lab.specimens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  lab_order_item_id uuid NOT NULL REFERENCES hims_lab.lab_order_items(id),
  specimen_barcode text NOT NULL,
  specimen_type_id uuid REFERENCES hims_lab.specimen_types(id),
  collected_by uuid,
  collected_at timestamptz,
  received_by uuid,
  received_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  processing_status text NOT NULL DEFAULT 'COLLECTED',
  storage_location text,
  UNIQUE (tenant_id, specimen_barcode)
);

CREATE TABLE hims_lab.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  lab_order_item_id uuid NOT NULL REFERENCES hims_lab.lab_order_items(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  analyte_code text,
  analyte_name text,
  value_numeric numeric,
  value_text text,
  unit text,
  reference_low numeric,
  reference_high numeric,
  critical_flag boolean NOT NULL DEFAULT false,
  abnormal_flag boolean NOT NULL DEFAULT false,
  instrument_id uuid REFERENCES hims_lab.lab_instruments(id),
  result_status text NOT NULL DEFAULT 'ENTERED',
  performed_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  released_at timestamptz,
  amended_from_id uuid REFERENCES hims_lab.lab_results(id),
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE hims_lab.lab_quality_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  test_id uuid REFERENCES hims_catalog.lab_tests(id),
  instrument_id uuid REFERENCES hims_lab.lab_instruments(id),
  control_lot text,
  control_level text,
  observed_value numeric,
  accepted_flag boolean,
  run_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  action_taken text
);

-- ========================= RIS ==========================================

CREATE TABLE hims_rad.modalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  modality_code text NOT NULL,
  name text NOT NULL,
  modality_type text NOT NULL,
  ae_title text,
  location text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, modality_code)
);

CREATE TABLE hims_rad.pacs_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  system_code text NOT NULL,
  endpoint text,
  base_url text,
  auth_secret_ref text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, system_code)
);

CREATE TABLE hims_rad.imaging_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  order_id uuid NOT NULL REFERENCES hims_clinical.orders(id),
  source_order_item_id uuid REFERENCES hims_clinical.order_items(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  accession_number text NOT NULL,
  modality_id uuid REFERENCES hims_rad.modalities(id),
  body_site text,
  procedure_code text,
  clinical_indication text,
  priority text NOT NULL DEFAULT 'ROUTINE',
  status text NOT NULL DEFAULT 'ORDERED',
  UNIQUE (tenant_id, accession_number)
);

CREATE TABLE hims_rad.imaging_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  imaging_order_id uuid NOT NULL REFERENCES hims_rad.imaging_orders(id),
  study_instance_uid text NOT NULL,
  performed_at timestamptz,
  modality_id uuid REFERENCES hims_rad.modalities(id),
  pacs_system_id uuid REFERENCES hims_rad.pacs_systems(id),
  pacs_url text,
  image_count integer,
  status text NOT NULL DEFAULT 'COMPLETED',
  UNIQUE (tenant_id, study_instance_uid)
);

CREATE TABLE hims_rad.imaging_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  study_id uuid NOT NULL REFERENCES hims_rad.imaging_studies(id),
  findings text,
  impression text,
  report_status text NOT NULL DEFAULT 'DRAFT',
  radiologist_id uuid REFERENCES hims_clinical.practitioners(id),
  verified_at timestamptz,
  released_at timestamptz,
  amendment_of_id uuid REFERENCES hims_rad.imaging_reports(id),
  version bigint NOT NULL DEFAULT 1
);

-- ========================= EMERGENCY ====================================

CREATE TABLE hims_emergency.emergency_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  arrival_mode text,
  arrival_at timestamptz NOT NULL,
  triage_at timestamptz,
  disposition_at timestamptz,
  acuity text,
  status text NOT NULL DEFAULT 'OPEN',
  mlc_flag boolean NOT NULL DEFAULT false,
  police_intimation_flag boolean NOT NULL DEFAULT false,
  brought_by text,
  referral_source text
);

CREATE TABLE hims_emergency.triage_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  emergency_encounter_id uuid NOT NULL REFERENCES hims_emergency.emergency_encounters(id),
  acuity_level text NOT NULL,
  chief_complaint text,
  pain_score numeric,
  red_flags_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  triaged_by uuid,
  triaged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_emergency.resuscitation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  emergency_encounter_id uuid NOT NULL REFERENCES hims_emergency.emergency_encounters(id),
  event_start timestamptz,
  event_end timestamptz,
  interventions_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  team_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  medications_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text
);

CREATE TABLE hims_emergency.observation_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  emergency_encounter_id uuid NOT NULL REFERENCES hims_emergency.emergency_encounters(id),
  location_id uuid REFERENCES hims_core.locations(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  observations_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE hims_emergency.dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  emergency_encounter_id uuid NOT NULL REFERENCES hims_emergency.emergency_encounters(id),
  disposition_type text NOT NULL,
  target_department_id uuid REFERENCES hims_core.departments(id),
  transfer_facility text,
  disposition_reason text,
  disposition_at timestamptz NOT NULL DEFAULT now()
);

-- ========================= OT ===========================================

CREATE TABLE hims_ot.ot_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid REFERENCES hims_core.departments(id),
  room_code text NOT NULL,
  room_type text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (facility_id, room_code)
);

CREATE TABLE hims_ot.surgery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  source_encounter_id uuid REFERENCES hims_clinical.encounters(id),
  source_admission_id uuid REFERENCES hims_ipd.admissions(id),
  requesting_department_id uuid NOT NULL REFERENCES hims_core.departments(id),
  requested_procedure text NOT NULL,
  priority text NOT NULL DEFAULT 'ROUTINE',
  estimated_duration_minutes integer,
  preferred_ot_room_id uuid REFERENCES hims_ot.ot_rooms(id),
  requested_date date,
  status text NOT NULL DEFAULT 'REQUESTED',
  requested_by uuid
);

CREATE TABLE hims_ot.surgery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  case_number text NOT NULL,
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  admission_id uuid REFERENCES hims_ipd.admissions(id),
  surgery_request_id uuid REFERENCES hims_ot.surgery_requests(id),
  principal_procedure text NOT NULL,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  ot_room_id uuid REFERENCES hims_ot.ot_rooms(id),
  surgeon_id uuid REFERENCES hims_clinical.practitioners(id),
  anaesthetist_id uuid REFERENCES hims_clinical.practitioners(id),
  status text NOT NULL DEFAULT 'SCHEDULED',
  UNIQUE (tenant_id, case_number)
);

CREATE TABLE hims_ot.case_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  surgery_case_id uuid NOT NULL REFERENCES hims_ot.surgery_cases(id) ON DELETE CASCADE,
  practitioner_id uuid REFERENCES hims_clinical.practitioners(id),
  staff_user_id uuid REFERENCES auth.users(id),
  staff_type text NOT NULL,
  role text NOT NULL
);

CREATE TABLE hims_ot.safety_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  surgery_case_id uuid NOT NULL REFERENCES hims_ot.surgery_cases(id),
  checklist_type text NOT NULL,
  stage text NOT NULL,
  item_code text NOT NULL,
  response text,
  completed_by uuid,
  completed_at timestamptz
);

CREATE TABLE hims_ot.anaesthesia_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  surgery_case_id uuid NOT NULL REFERENCES hims_ot.surgery_cases(id),
  anaesthesia_type text,
  pre_assessment_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  intraop_record_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  postop_record_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  anaesthetist_id uuid REFERENCES hims_clinical.practitioners(id),
  status text NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE hims_ot.procedure_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  surgery_case_id uuid NOT NULL REFERENCES hims_ot.surgery_cases(id),
  procedure_code text,
  operative_findings text,
  procedure_details text,
  complications text,
  author_id uuid,
  signed_at timestamptz,
  status text NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE hims_ot.surgical_specimens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  surgery_case_id uuid NOT NULL REFERENCES hims_ot.surgery_cases(id),
  specimen_number text NOT NULL,
  description text,
  destination_lab_order_item_id uuid,
  collected_at timestamptz,
  transferred_at timestamptz,
  UNIQUE (tenant_id, specimen_number)
);

-- ========================= ICU ==========================================

CREATE TABLE hims_icu.icu_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid REFERENCES hims_core.departments(id),
  unit_code text NOT NULL,
  name text NOT NULL,
  type text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (facility_id, unit_code)
);

CREATE TABLE hims_icu.icu_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  source_admission_id uuid REFERENCES hims_ipd.admissions(id),
  source_encounter_id uuid REFERENCES hims_clinical.encounters(id),
  icu_encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  unit_id uuid NOT NULL REFERENCES hims_icu.icu_units(id),
  bed_id uuid REFERENCES hims_ipd.beds(id),
  admission_reason text,
  admitted_at timestamptz NOT NULL DEFAULT now(),
  discharged_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE hims_icu.flowsheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  icu_admission_id uuid NOT NULL REFERENCES hims_icu.icu_admissions(id),
  observation_id uuid REFERENCES hims_clinical.observations(id),
  chart_time timestamptz NOT NULL,
  section text,
  value_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid
);

CREATE TABLE hims_icu.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  icu_admission_id uuid NOT NULL REFERENCES hims_icu.icu_admissions(id),
  device_type text NOT NULL,
  device_identifier text,
  inserted_at timestamptz,
  removed_at timestamptz,
  insertion_site text,
  inserted_by uuid
);

CREATE TABLE hims_icu.infusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  icu_admission_id uuid NOT NULL REFERENCES hims_icu.icu_admissions(id),
  medication_order_id uuid REFERENCES hims_clinical.medication_orders(id),
  concentration text,
  rate numeric(12,4),
  started_at timestamptz,
  stopped_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE'
);

-- ========================= INVENTORY / PHARMACY ==========================

CREATE TABLE hims_inventory.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  vendor_code text NOT NULL,
  name text NOT NULL,
  contact_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  tax_identifiers_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, vendor_code)
);

CREATE TABLE hims_inventory.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  code text NOT NULL,
  name text NOT NULL,
  warehouse_type text,
  pharmacy_flag boolean NOT NULL DEFAULT false,
  ward_stock_flag boolean NOT NULL DEFAULT false,
  UNIQUE (facility_id, code)
);

CREATE TABLE hims_inventory.stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  medication_id uuid NOT NULL REFERENCES hims_catalog.medications(id),
  warehouse_id uuid NOT NULL REFERENCES hims_inventory.warehouses(id),
  batch_number text NOT NULL,
  expiry_date date,
  manufacture_date date,
  quantity_on_hand numeric(16,3) NOT NULL DEFAULT 0,
  reserved_quantity numeric(16,3) NOT NULL DEFAULT 0,
  unit_cost numeric(18,2),
  mrp numeric(18,2),
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (warehouse_id, medication_id, batch_number)
);

CREATE TABLE hims_inventory.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  transaction_type text NOT NULL,
  medication_id uuid REFERENCES hims_catalog.medications(id),
  warehouse_id uuid REFERENCES hims_inventory.warehouses(id),
  stock_lot_id uuid REFERENCES hims_inventory.stock_lots(id),
  quantity_in numeric(16,3) NOT NULL DEFAULT 0,
  quantity_out numeric(16,3) NOT NULL DEFAULT 0,
  reference_type text,
  reference_id uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  balance_after numeric(16,3)
);

CREATE TABLE hims_inventory.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  po_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES hims_inventory.vendors(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  warehouse_id uuid NOT NULL REFERENCES hims_inventory.warehouses(id),
  status text NOT NULL DEFAULT 'DRAFT',
  requested_by uuid,
  approved_by uuid,
  ordered_at timestamptz,
  UNIQUE (tenant_id, po_number)
);

CREATE TABLE hims_inventory.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  purchase_order_id uuid NOT NULL REFERENCES hims_inventory.purchase_orders(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES hims_catalog.medications(id),
  description text NOT NULL,
  quantity numeric(16,3) NOT NULL,
  unit_price numeric(18,2),
  tax numeric(18,2) NOT NULL DEFAULT 0,
  expected_date date
);

CREATE TABLE hims_inventory.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  grn_number text NOT NULL,
  purchase_order_id uuid NOT NULL REFERENCES hims_inventory.purchase_orders(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid,
  status text NOT NULL DEFAULT 'RECEIVED',
  UNIQUE (tenant_id, grn_number)
);

CREATE TABLE hims_inventory.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  asset_tag text NOT NULL,
  asset_type text NOT NULL,
  serial_number text,
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  location_id uuid REFERENCES hims_core.locations(id),
  vendor_id uuid REFERENCES hims_inventory.vendors(id),
  purchase_date date,
  warranty_end date,
  maintenance_status text,
  UNIQUE (tenant_id, asset_tag)
);

CREATE TABLE hims_pharmacy.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  prescription_number text NOT NULL,
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  prescriber_id uuid REFERENCES hims_clinical.practitioners(id),
  prescription_type text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, prescription_number)
);

CREATE TABLE hims_pharmacy.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  prescription_id uuid NOT NULL REFERENCES hims_pharmacy.prescriptions(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES hims_catalog.medications(id),
  dose numeric(12,4),
  dose_unit text,
  route text,
  frequency text,
  duration_value numeric(10,2),
  duration_unit text,
  quantity numeric(12,3),
  substitution_allowed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE hims_pharmacy.medication_order_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  source_medication_order_id uuid NOT NULL REFERENCES hims_clinical.medication_orders(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  status text NOT NULL DEFAULT 'PENDING',
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_medication_order_id)
);

CREATE TABLE hims_pharmacy.dispensings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  prescription_id uuid REFERENCES hims_pharmacy.prescriptions(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid NOT NULL REFERENCES hims_clinical.encounters(id),
  pharmacy_location_id uuid REFERENCES hims_inventory.warehouses(id),
  pharmacist_id uuid REFERENCES auth.users(id),
  dispensed_at timestamptz,
  status text NOT NULL DEFAULT 'IN_PROGRESS'
);

CREATE TABLE hims_pharmacy.dispensing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  dispensing_id uuid NOT NULL REFERENCES hims_pharmacy.dispensings(id) ON DELETE CASCADE,
  prescription_item_id uuid REFERENCES hims_pharmacy.prescription_items(id),
  medication_order_id uuid REFERENCES hims_clinical.medication_orders(id),
  stock_lot_id uuid NOT NULL REFERENCES hims_inventory.stock_lots(id),
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(18,2),
  discount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DISPENSED'
);

CREATE TABLE hims_pharmacy.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  dispensing_id uuid REFERENCES hims_pharmacy.dispensings(id),
  patient_id uuid REFERENCES hims_patient.patients(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED',
  quantity numeric(12,3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_pharmacy.recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  medication_id uuid REFERENCES hims_catalog.medications(id),
  batch_number text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  initiated_at timestamptz NOT NULL DEFAULT now()
);

-- ========================= BILLING ======================================

CREATE TABLE hims_billing.tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  service_id uuid NOT NULL REFERENCES hims_catalog.services(id),
  payer_id uuid,
  effective_from date NOT NULL,
  effective_to date,
  amount numeric(18,2) NOT NULL,
  tax_profile text,
  approval_status text NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE hims_billing.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  admission_id uuid REFERENCES hims_ipd.admissions(id),
  service_id uuid NOT NULL REFERENCES hims_catalog.services(id),
  source_module text NOT NULL,
  source_reference uuid,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_rate numeric(18,2) NOT NULL,
  gross_amount numeric(18,2) NOT NULL,
  discount numeric(18,2) NOT NULL DEFAULT 0,
  net_amount numeric(18,2) NOT NULL,
  payer_responsibility numeric(18,2) NOT NULL DEFAULT 0,
  patient_responsibility numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'POSTED',
  posted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_billing.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  invoice_number text NOT NULL,
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  admission_id uuid REFERENCES hims_ipd.admissions(id),
  payer_id uuid,
  invoice_type text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  discount numeric(18,2) NOT NULL DEFAULT 0,
  tax numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  outstanding numeric(18,2) NOT NULL DEFAULT 0,
  issued_at timestamptz,
  finalized_at timestamptz,
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE hims_billing.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  invoice_id uuid NOT NULL REFERENCES hims_billing.invoices(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES hims_billing.charges(id),
  service_id uuid REFERENCES hims_catalog.services(id),
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_rate numeric(18,2) NOT NULL,
  discount numeric(18,2) NOT NULL DEFAULT 0,
  tax numeric(18,2) NOT NULL DEFAULT 0,
  amount numeric(18,2) NOT NULL
);

CREATE TABLE hims_billing.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  payment_number text NOT NULL,
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  invoice_id uuid REFERENCES hims_billing.invoices(id),
  method text NOT NULL,
  provider text,
  external_transaction_id text,
  amount numeric(18,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  UNIQUE (tenant_id, payment_number)
);

CREATE TABLE hims_billing.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  payment_id uuid NOT NULL REFERENCES hims_billing.payments(id),
  amount numeric(18,2) NOT NULL,
  reason text NOT NULL,
  requested_by uuid,
  approved_by uuid,
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'REQUESTED'
);

-- ========================= INSURANCE ====================================

CREATE TABLE hims_insurance.payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  payer_code text NOT NULL,
  payer_type text NOT NULL,
  name text NOT NULL,
  network_identifier text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, payer_code)
);

CREATE TABLE hims_insurance.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  payer_id uuid NOT NULL REFERENCES hims_insurance.payers(id),
  plan_code text NOT NULL,
  name text NOT NULL,
  scheme_family text,
  state_code text,
  effective_from date,
  effective_to date,
  rules_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, plan_code)
);

CREATE TABLE hims_insurance.patient_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  payer_id uuid NOT NULL REFERENCES hims_insurance.payers(id),
  plan_id uuid REFERENCES hims_insurance.plans(id),
  policy_number_encrypted text,
  membership_number text,
  primary_insured_name text,
  relationship text,
  valid_from date,
  valid_to date,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED'
);

CREATE TABLE hims_insurance.eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_policy_id uuid REFERENCES hims_insurance.patient_policies(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  request_reference text,
  response_reference text,
  status text NOT NULL DEFAULT 'PENDING',
  checked_at timestamptz
);

CREATE TABLE hims_insurance.preauthorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  admission_id uuid REFERENCES hims_ipd.admissions(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  patient_policy_id uuid REFERENCES hims_insurance.patient_policies(id),
  authorization_number text,
  requested_amount numeric(18,2),
  approved_amount numeric(18,2),
  status text NOT NULL DEFAULT 'DRAFT',
  requested_at timestamptz,
  approved_at timestamptz,
  expiry_at timestamptz
);

CREATE TABLE hims_insurance.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  claim_number text NOT NULL,
  invoice_id uuid NOT NULL REFERENCES hims_billing.invoices(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  payer_id uuid NOT NULL REFERENCES hims_insurance.payers(id),
  plan_id uuid REFERENCES hims_insurance.plans(id),
  preauth_id uuid REFERENCES hims_insurance.preauthorizations(id),
  claim_type text,
  status text NOT NULL DEFAULT 'DRAFT',
  amount_claimed numeric(18,2) NOT NULL DEFAULT 0,
  amount_approved numeric(18,2) NOT NULL DEFAULT 0,
  amount_rejected numeric(18,2) NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  adjudicated_at timestamptz,
  settled_at timestamptz,
  UNIQUE (tenant_id, claim_number)
);

CREATE TABLE hims_insurance.claim_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  claim_id uuid NOT NULL REFERENCES hims_insurance.claims(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES hims_billing.invoice_items(id),
  service_code text,
  quantity numeric(12,3),
  claimed_amount numeric(18,2),
  approved_amount numeric(18,2),
  rejected_amount numeric(18,2),
  rejection_code text,
  rejection_reason text
);

CREATE TABLE hims_insurance.claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  claim_id uuid NOT NULL REFERENCES hims_insurance.claims(id) ON DELETE CASCADE,
  document_id uuid,
  document_type text,
  mandatory_flag boolean NOT NULL DEFAULT false,
  submitted_at timestamptz
);

CREATE TABLE hims_insurance.remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  payer_id uuid NOT NULL REFERENCES hims_insurance.payers(id),
  claim_id uuid REFERENCES hims_insurance.claims(id),
  external_reference text,
  received_at timestamptz,
  amount_received numeric(18,2),
  status text NOT NULL DEFAULT 'RECEIVED',
  reconciliation_status text NOT NULL DEFAULT 'UNRECONCILED'
);

-- Cross-domain foreign keys whose referenced domain is declared later.
ALTER TABLE hims_billing.tariffs
  ADD CONSTRAINT fk_tariff_payer
  FOREIGN KEY (payer_id) REFERENCES hims_insurance.payers(id);

-- ========================= EMR ==========================================

CREATE TABLE hims_emr.timeline_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  event_type text NOT NULL,
  source_domain text NOT NULL,
  source_table text NOT NULL,
  source_record_id uuid NOT NULL,
  source_event_id uuid,
  occurred_at timestamptz NOT NULL,
  display_summary text,
  clinical_significance text,
  security_classification text NOT NULL DEFAULT 'SENSITIVE'
);

CREATE TABLE hims_emr.patient_summaries (
  patient_id uuid PRIMARY KEY REFERENCES hims_patient.patients(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  allergies_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  medications_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_admissions_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_investigations_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_abnormal_results_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_watermark timestamptz
);

CREATE TABLE hims_emr.document_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  source_domain text NOT NULL,
  source_record_id uuid NOT NULL,
  document_id uuid,
  document_type text,
  occurred_at timestamptz,
  summary text
);

-- ========================= DOCUMENTS ===================================

CREATE TABLE hims_documents.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  patient_id uuid REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  admission_id uuid REFERENCES hims_ipd.admissions(id),
  document_type text NOT NULL,
  title text NOT NULL,
  classification text NOT NULL DEFAULT 'SENSITIVE',
  storage_object_key text NOT NULL,
  mime_type text NOT NULL,
  checksum_sha256 text,
  status text NOT NULL DEFAULT 'UPLOADING',
  owner_domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE hims_documents.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  document_id uuid NOT NULL REFERENCES hims_documents.documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  object_key text NOT NULL,
  checksum_sha256 text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  supersedes_version_id uuid REFERENCES hims_documents.document_versions(id),
  UNIQUE (document_id, version_number)
);

CREATE TABLE hims_documents.signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  document_id uuid NOT NULL REFERENCES hims_documents.documents(id),
  version_id uuid NOT NULL REFERENCES hims_documents.document_versions(id),
  signer_user_id uuid NOT NULL,
  signing_method text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_reference text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED'
);

-- ========================= QUALITY ======================================

CREATE TABLE hims_quality.quality_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  domain text,
  formula_jsonb jsonb NOT NULL,
  target_value numeric,
  frequency text,
  owner_role text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, code)
);

CREATE TABLE hims_quality.indicator_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  indicator_id uuid NOT NULL REFERENCES hims_quality.quality_indicators(id),
  facility_id uuid NOT NULL REFERENCES hims_core.facilities(id),
  department_id uuid REFERENCES hims_core.departments(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  numerator numeric,
  denominator numeric,
  calculated_value numeric,
  source_query_version text,
  reviewed_by uuid
);

CREATE TABLE hims_quality.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  incident_number text NOT NULL,
  patient_id uuid REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  department_id uuid REFERENCES hims_core.departments(id),
  incident_type text NOT NULL,
  severity text,
  occurred_at timestamptz,
  reported_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  immediate_action text,
  status text NOT NULL DEFAULT 'OPEN',
  reporter_id uuid,
  UNIQUE (tenant_id, incident_number)
);

CREATE TABLE hims_quality.incident_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  incident_id uuid NOT NULL REFERENCES hims_quality.incidents(id) ON DELETE CASCADE,
  investigator uuid,
  analysis_method text,
  findings text,
  conclusion text,
  completed_at timestamptz
);

CREATE TABLE hims_quality.capas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  incident_id uuid REFERENCES hims_quality.incidents(id),
  capa_number text NOT NULL,
  root_cause text,
  action_type text,
  owner_id uuid,
  due_at timestamptz,
  completed_at timestamptz,
  effectiveness_review text,
  status text NOT NULL DEFAULT 'OPEN',
  UNIQUE (tenant_id, capa_number)
);

CREATE TABLE hims_quality.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  audit_number text NOT NULL,
  audit_type text NOT NULL,
  scope text,
  department_id uuid REFERENCES hims_core.departments(id),
  start_at date,
  end_at date,
  auditor uuid,
  status text NOT NULL DEFAULT 'OPEN',
  UNIQUE (tenant_id, audit_number)
);

CREATE TABLE hims_quality.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  audit_id uuid NOT NULL REFERENCES hims_quality.audits(id) ON DELETE CASCADE,
  finding_type text,
  severity text,
  requirement_reference text,
  evidence_summary text,
  action_required text,
  status text NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE hims_quality.accreditation_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  framework_code text NOT NULL,
  version text NOT NULL,
  chapter_domain text,
  requirement_code text NOT NULL,
  requirement_text text NOT NULL,
  software_control_type text,
  evidence_type text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, framework_code, version, requirement_code)
);

CREATE TABLE hims_quality.accreditation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  requirement_id uuid NOT NULL REFERENCES hims_quality.accreditation_requirements(id),
  document_id uuid,
  incident_id uuid REFERENCES hims_quality.incidents(id),
  audit_id uuid REFERENCES hims_quality.audits(id),
  workflow_instance_id uuid,
  period_start date,
  period_end date,
  owner_id uuid,
  verification_status text NOT NULL DEFAULT 'PENDING'
);

-- ========================= WORKFLOW =====================================

CREATE TABLE hims_workflow.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  trigger_type text NOT NULL,
  definition_jsonb jsonb NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  UNIQUE (tenant_id, code, version)
);

CREATE TABLE hims_workflow.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid REFERENCES hims_core.facilities(id),
  definition_id uuid NOT NULL REFERENCES hims_workflow.workflow_definitions(id),
  patient_id uuid REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  subject_type text,
  subject_id uuid,
  status text NOT NULL DEFAULT 'RUNNING',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE hims_workflow.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  workflow_instance_id uuid NOT NULL REFERENCES hims_workflow.workflow_instances(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  assigned_user_id uuid,
  department_id uuid REFERENCES hims_core.departments(id),
  priority text NOT NULL DEFAULT 'NORMAL',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'OPEN',
  completed_at timestamptz,
  outcome_jsonb jsonb
);

CREATE TABLE hims_workflow.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  workflow_instance_id uuid REFERENCES hims_workflow.workflow_instances(id),
  required_role_id uuid REFERENCES hims_core.roles(id),
  requested_by uuid,
  approver_id uuid,
  decision text,
  decision_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE hims_workflow.outbox_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  payload_jsonb jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  status text NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX idx_outbox_pending
ON hims_workflow.outbox_events(status, occurred_at)
WHERE status = 'PENDING';

-- ========================= INTEGRATION ==================================

CREATE TABLE hims_integration.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  integration_code text NOT NULL,
  integration_type text NOT NULL,
  vendor text,
  protocol text,
  endpoint text,
  secret_ref text,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, integration_code)
);

CREATE TABLE hims_integration.external_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  system_code text NOT NULL,
  external_identifier text NOT NULL,
  identifier_type text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, system_code, external_identifier)
);

CREATE TABLE hims_integration.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  integration_id uuid NOT NULL REFERENCES hims_integration.integrations(id),
  message_id text NOT NULL,
  message_type text NOT NULL,
  direction text NOT NULL,
  correlation_id uuid,
  request_payload_ref text,
  response_payload_ref text,
  status text NOT NULL DEFAULT 'PENDING',
  sent_at timestamptz,
  received_at timestamptz,
  error_code text,
  UNIQUE (tenant_id, integration_id, message_id)
);

CREATE TABLE hims_integration.message_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  message_record_id uuid NOT NULL REFERENCES hims_integration.messages(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  result_status text NOT NULL,
  error_code text,
  error_message text
);

CREATE TABLE hims_integration.dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  message_record_id uuid NOT NULL REFERENCES hims_integration.messages(id),
  reason text NOT NULL,
  first_failed_at timestamptz,
  last_failed_at timestamptz,
  replay_status text NOT NULL DEFAULT 'PENDING'
);

ALTER TABLE hims_insurance.claim_documents
  ADD CONSTRAINT fk_claim_document_document
  FOREIGN KEY (document_id) REFERENCES hims_documents.documents(id);

ALTER TABLE hims_emr.document_index
  ADD CONSTRAINT fk_emr_document
  FOREIGN KEY (document_id) REFERENCES hims_documents.documents(id);

ALTER TABLE hims_quality.accreditation_evidence
  ADD CONSTRAINT fk_accreditation_evidence_document
  FOREIGN KEY (document_id) REFERENCES hims_documents.documents(id),
  ADD CONSTRAINT fk_accreditation_evidence_workflow
  FOREIGN KEY (workflow_instance_id) REFERENCES hims_workflow.workflow_instances(id);

-- ========================= AUDIT ========================================

CREATE TABLE hims_audit.audit_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  facility_id uuid REFERENCES hims_core.facilities(id),
  actor_user_id uuid,
  actor_type text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  patient_id uuid REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  before_hash text,
  after_hash text,
  metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  correlation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_audit.data_access_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES hims_patient.patients(id),
  reason_code text,
  access_type text NOT NULL,
  module text NOT NULL,
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  break_glass boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ========================= AI ===========================================

CREATE TABLE hims_ai.ai_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  user_id uuid NOT NULL,
  patient_id uuid REFERENCES hims_patient.patients(id),
  encounter_id uuid REFERENCES hims_clinical.encounters(id),
  use_case text NOT NULL,
  model_provider text,
  model_name text,
  prompt_template_version text,
  source_context_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_classification text NOT NULL DEFAULT 'SENSITIVE',
  status text NOT NULL DEFAULT 'REQUESTED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hims_ai.ai_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES hims_core.tenants(id),
  request_id uuid NOT NULL REFERENCES hims_ai.ai_requests(request_id) ON DELETE CASCADE,
  output_version integer NOT NULL DEFAULT 1,
  output_text text,
  citations_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  review_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================= INDEXES ======================================

CREATE INDEX idx_facilities_tenant ON hims_core.facilities(tenant_id);
CREATE INDEX idx_departments_tenant_facility ON hims_core.departments(tenant_id, facility_id);
CREATE INDEX idx_locations_tenant_facility ON hims_core.locations(tenant_id, facility_id);
CREATE INDEX idx_users_tenant ON hims_core.user_profiles(tenant_id);
CREATE INDEX idx_patients_tenant_name ON hims_patient.patients(tenant_id, display_name);
CREATE INDEX idx_patients_tenant_mobile ON hims_patient.patients(tenant_id, primary_mobile);
CREATE INDEX idx_encounters_patient_time ON hims_clinical.encounters(tenant_id, patient_id, started_at DESC);
CREATE INDEX idx_orders_patient_time ON hims_clinical.orders(tenant_id, patient_id, requested_at DESC);
CREATE INDEX idx_lab_orders_status ON hims_lab.lab_orders(tenant_id, status, requested_at DESC);
CREATE INDEX idx_rad_orders_status ON hims_rad.imaging_orders(tenant_id, status, accession_number);
CREATE INDEX idx_stock_expiry ON hims_inventory.stock_lots(tenant_id, expiry_date);
CREATE INDEX idx_claims_status ON hims_insurance.claims(tenant_id, status, submitted_at);
CREATE INDEX idx_emr_timeline_patient_time ON hims_emr.timeline_entries(tenant_id, patient_id, occurred_at DESC);
CREATE INDEX idx_audit_patient_time ON hims_audit.audit_events(tenant_id, patient_id, occurred_at DESC);
CREATE INDEX idx_data_access_patient_time ON hims_audit.data_access_events(tenant_id, patient_id, occurred_at DESC);

-- ========================= RLS ==========================================
-- Apply tenant isolation only to tables that have a tenant_id column.
-- Policies target PUBLIC because the application uses a dedicated NestJS DB role.
-- That role MUST NOT have BYPASSRLS; see deployment provisioning documentation.

DO $$
DECLARE
  rec record;
  policy_name text;
BEGIN
  FOR rec IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema LIKE 'hims_%'
      AND c.column_name = 'tenant_id'
      AND EXISTS (
        SELECT 1
        FROM information_schema.tables t
        WHERE t.table_schema = c.table_schema
          AND t.table_name = c.table_name
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', rec.table_schema, rec.table_name);

    policy_name := rec.table_name || '_tenant_select';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_name, rec.table_schema, rec.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR SELECT TO public USING (tenant_id = hims_current_tenant_id())',
      policy_name, rec.table_schema, rec.table_name
    );

    policy_name := rec.table_name || '_tenant_insert';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_name, rec.table_schema, rec.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR INSERT TO public WITH CHECK (tenant_id = hims_current_tenant_id())',
      policy_name, rec.table_schema, rec.table_name
    );

    policy_name := rec.table_name || '_tenant_update';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_name, rec.table_schema, rec.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR UPDATE TO public USING (tenant_id = hims_current_tenant_id()) WITH CHECK (tenant_id = hims_current_tenant_id())',
      policy_name, rec.table_schema, rec.table_name
    );

  END LOOP;
END $$;

-- Production privilege note:
-- The NestJS database role MUST NOT have BYPASSRLS and should not be a
-- superuser. Audit schemas should grant application users INSERT/SELECT but
-- not UPDATE/DELETE. Schema-level USAGE and table privileges must be granted
-- explicitly during provisioning.

COMMIT;
