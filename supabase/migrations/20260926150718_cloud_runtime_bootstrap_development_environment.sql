-- Cloud runtime bootstrap: create a non-production HIMS development environment.
-- This migration deliberately does not create an auth user. Supabase Auth users
-- must be created through the Auth service/Admin API so identity/session state is
-- managed by GoTrue. After the first Auth user exists, the membership/access
-- bootstrap can be applied against its real UUID.

BEGIN;

INSERT INTO hims_core.tenants
  (id, code, legal_name, display_name, status, timezone, default_locale, default_currency, data_region, plan_code)
VALUES
  ('11111111-1111-4111-8111-111111111111',
   'HIMSDEV',
   'HIMS Development Environment',
   'HIMS Development Hospital',
   'ACTIVE',
   'Asia/Kolkata',
   'en-IN',
   'INR',
   'ap-south-1',
   'development')
ON CONFLICT (code) DO UPDATE
SET legal_name = EXCLUDED.legal_name,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    timezone = EXCLUDED.timezone,
    default_locale = EXCLUDED.default_locale,
    default_currency = EXCLUDED.default_currency,
    data_region = EXCLUDED.data_region,
    plan_code = EXCLUDED.plan_code;

INSERT INTO hims_core.facilities
  (id, tenant_id, facility_code, name, facility_type, status, timezone, address_jsonb, contact_jsonb)
VALUES
  ('22222222-2222-4222-8222-222222222221',
   '11111111-1111-4111-8111-111111111111',
   'MAIN_CAMPUS',
   'HIMS Development Hospital - Main Campus',
   'HOSPITAL',
   'ACTIVE',
   'Asia/Kolkata',
   '{}'::jsonb,
   '{}'::jsonb)
ON CONFLICT (tenant_id, facility_code) DO UPDATE
SET name = EXCLUDED.name,
    facility_type = EXCLUDED.facility_type,
    status = EXCLUDED.status,
    timezone = EXCLUDED.timezone;

INSERT INTO hims_core.departments
  (id, tenant_id, facility_id, department_code, name, department_type, clinical_service_flag)
VALUES
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'MED', 'General Medicine', 'CLINICAL', true),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'SURG', 'General Surgery', 'CLINICAL', true),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'CARDIO', 'Cardiology', 'CLINICAL', true),
  ('33333333-3333-4333-8333-333333333304', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'EMERGENCY', 'Emergency Department', 'EMERGENCY', true),
  ('33333333-3333-4333-8333-333333333305', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'ICU', 'Intensive Care Unit', 'ICU', true),
  ('33333333-3333-4333-8333-333333333306', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'OT', 'Operation Theatre', 'SURGERY', true),
  ('33333333-3333-4333-8333-333333333307', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'LAB', 'Central Pathology & Laboratory', 'DIAGNOSTIC', true),
  ('33333333-3333-4333-8333-333333333308', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'RAD', 'Radiology & Imaging', 'DIAGNOSTIC', true),
  ('33333333-3333-4333-8333-333333333309', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'PHARM', 'Central Pharmacy', 'PHARMACY', true),
  ('33333333-3333-4333-8333-333333333310', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'BILLING', 'Billing & Revenue Cycle', 'ADMIN', false)
ON CONFLICT (facility_id, department_code) DO UPDATE
SET name = EXCLUDED.name,
    department_type = EXCLUDED.department_type,
    clinical_service_flag = EXCLUDED.clinical_service_flag;

INSERT INTO hims_core.roles
  (id, tenant_id, code, name, description, system_role)
VALUES
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 'DOCTOR', 'Consultant Physician / Surgeon', 'Clinical examination, notes, prescriptions and orders', true),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111', 'NURSE', 'Staff Nurse / Ward Incharge', 'Vitals, MAR, triage and nursing notes', true),
  ('44444444-4444-4444-8444-444444444403', '11111111-1111-4111-8111-111111111111', 'PATHOLOGIST', 'Clinical Pathologist', 'Laboratory result verification and release', true),
  ('44444444-4444-4444-8444-444444444404', '11111111-1111-4111-8111-111111111111', 'RADIOLOGIST', 'Radiologist', 'Imaging review and diagnostic reporting', true),
  ('44444444-4444-4444-8444-444444444405', '11111111-1111-4111-8111-111111111111', 'PHARMACIST', 'Hospital Pharmacist', 'Medication verification and dispensing', true),
  ('44444444-4444-4444-8444-444444444406', '11111111-1111-4111-8111-111111111111', 'RECEPTIONIST', 'Front Desk / Registration Executive', 'Patient registration, search, queue and appointments', true),
  ('44444444-4444-4444-8444-444444444407', '11111111-1111-4111-8111-111111111111', 'BILLING_EXECUTIVE', 'Billing & Insurance Officer', 'Billing, claims, tariffs and payments', true),
  ('44444444-4444-4444-8444-444444444408', '11111111-1111-4111-8111-111111111111', 'ADMIN', 'Hospital Administrator', 'Facility governance, authorization and audit oversight', true)
ON CONFLICT (tenant_id, code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_role = EXCLUDED.system_role,
    status = 'ACTIVE';

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT
  '11111111-1111-4111-8111-111111111111',
  r.id,
  p.code
FROM hims_core.roles r
JOIN hims_core.permissions p
  ON p.code IN (
    'PLATFORM:TENANT:READ:TENANT',
    'PLATFORM:TENANT:UPDATE:TENANT',
    'PLATFORM:FACILITY:READ:TENANT',
    'PLATFORM:FACILITY:CREATE:TENANT',
    'PLATFORM:FACILITY:READ:FACILITY',
    'PLATFORM:FACILITY:UPDATE:FACILITY',
    'PLATFORM:DEPARTMENT:READ:TENANT',
    'PLATFORM:DEPARTMENT:CREATE:TENANT',
    'PLATFORM:DEPARTMENT:READ:FACILITY',
    'PLATFORM:DEPARTMENT:UPDATE:FACILITY',
    'PLATFORM:LOCATION:READ:FACILITY',
    'PLATFORM:USER:READ:TENANT',
    'PLATFORM:USER:UPDATE:TENANT',
    'PLATFORM:ROLE:READ:TENANT',
    'PLATFORM:ROLE:CREATE:TENANT',
    'PLATFORM:ROLE:UPDATE:TENANT',
    'SYSTEM:AUDIT:READ:TENANT',
    'SYSTEM:USER:MANAGE:TENANT',
    'SYSTEM:ROLE:MANAGE:TENANT',
    'SYSTEM:FACILITY:MANAGE:TENANT',
    'SYSTEM:DEPARTMENT:MANAGE:FACILITY',
    'SYSTEM:INTEGRATION:MANAGE:TENANT',
    'SYSTEM:EXPORT:MANAGE:TENANT'
  )
WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND r.code = 'ADMIN'
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

COMMIT;
