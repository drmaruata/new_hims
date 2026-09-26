-- HIMS Initial Seed Data
-- Version: 1.0 (2026 Baseline)

BEGIN;

-- 1. Tenants
INSERT INTO hims_core.tenants (id, code, legal_name, display_name, status, timezone, default_currency)
VALUES 
  ('11111111-1111-4111-8111-111111111111', 'APOLLO_GRP', 'Apollo Healthcare Enterprises Ltd.', 'Apollo Central Hospital', 'ACTIVE', 'Asia/Kolkata', 'INR')
ON CONFLICT (code) DO NOTHING;

-- 2. Facilities
INSERT INTO hims_core.facilities (id, tenant_id, facility_code, name, facility_type, status)
VALUES
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'MAIN_CAMPUS', 'Apollo Main Hospital - Jubilee Hills', 'HOSPITAL', 'ACTIVE'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'SATELLITE_CLINIC', 'Apollo Clinic - Gachibowli', 'CLINIC', 'ACTIVE')
ON CONFLICT (tenant_id, facility_code) DO NOTHING;

-- 3. Departments
INSERT INTO hims_core.departments (id, tenant_id, facility_id, department_code, name, department_type, clinical_service_flag)
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
ON CONFLICT (facility_id, department_code) DO NOTHING;

-- 4. Standard Permissions
INSERT INTO hims_core.permissions (code, description, risk_level)
VALUES
  ('PLATFORM:TENANT:READ:TENANT', 'Read tenant configuration', 'NORMAL'),
  ('PLATFORM:TENANT:UPDATE:TENANT', 'Update tenant configuration', 'HIGH'),
  ('PLATFORM:FACILITY:READ:TENANT', 'Read facilities in tenant', 'NORMAL'),
  ('PLATFORM:FACILITY:CREATE:TENANT', 'Create facility', 'HIGH'),
  ('PLATFORM:FACILITY:READ:FACILITY', 'Read active facility', 'NORMAL'),
  ('PLATFORM:FACILITY:UPDATE:FACILITY', 'Update facility configuration', 'HIGH'),
  ('PLATFORM:DEPARTMENT:READ:TENANT', 'Read tenant departments', 'NORMAL'),
  ('PLATFORM:DEPARTMENT:CREATE:TENANT', 'Create department', 'HIGH'),
  ('PLATFORM:DEPARTMENT:READ:FACILITY', 'Read facility departments', 'NORMAL'),
  ('PLATFORM:DEPARTMENT:UPDATE:FACILITY', 'Update facility department', 'HIGH'),
  ('PLATFORM:LOCATION:READ:FACILITY', 'Read facility locations', 'NORMAL'),
  ('PLATFORM:USER:READ:TENANT', 'Read tenant users', 'NORMAL'),
  ('PLATFORM:USER:UPDATE:TENANT', 'Manage tenant user access', 'HIGH'),
  ('PLATFORM:ROLE:READ:TENANT', 'Read tenant roles', 'NORMAL'),
  ('PLATFORM:ROLE:CREATE:TENANT', 'Create tenant role assignment', 'HIGH'),
  ('PLATFORM:ROLE:UPDATE:TENANT', 'Update tenant role assignment', 'HIGH'),
  ('PATIENT:DEMOGRAPHICS:READ:FACILITY', 'Read patient demographics', 'NORMAL'),
  ('PATIENT:DEMOGRAPHICS:CREATE:FACILITY', 'Register patient', 'NORMAL'),
  ('PATIENT:DEMOGRAPHICS:UPDATE:FACILITY', 'Update patient demographics', 'NORMAL'),
  ('CLINICAL:ENCOUNTER:CREATE:FACILITY', 'Create clinical encounter', 'NORMAL'),
  ('CLINICAL:ENCOUNTER:READ:FACILITY', 'Read clinical encounter', 'NORMAL'),
  ('CLINICAL:ENCOUNTER:UPDATE:FACILITY', 'Update clinical encounter', 'NORMAL'),
  ('CLINICAL:ENCOUNTER:START:FACILITY', 'Start clinical encounter', 'HIGH'),
  ('CLINICAL:ENCOUNTER:SIGN:FACILITY', 'Sign clinical encounter', 'HIGH'),
  ('CLINICAL:ENCOUNTER:CLOSE:FACILITY', 'Close clinical encounter', 'HIGH'),
  ('CLINICAL:APPOINTMENT:READ:FACILITY', 'Read OPD appointments', 'NORMAL'),
  ('CLINICAL:APPOINTMENT:UPDATE:FACILITY', 'Update OPD appointment/check-in state', 'NORMAL'),
  ('SYSTEM:AUDIT:READ:TENANT', 'Read audit events', 'HIGH'),
  ('SYSTEM:BREAK_GLASS:USE:FACILITY', 'Execute emergency break-glass access', 'CRITICAL'),
  ('SYSTEM:USER:MANAGE:TENANT', 'Manage tenant users', 'CRITICAL'),
  ('SYSTEM:ROLE:MANAGE:TENANT', 'Manage tenant roles', 'CRITICAL'),
  ('SYSTEM:FACILITY:MANAGE:TENANT', 'Manage tenant facilities', 'CRITICAL'),
  ('SYSTEM:DEPARTMENT:MANAGE:FACILITY', 'Manage facility departments', 'CRITICAL'),
  ('SYSTEM:INTEGRATION:MANAGE:TENANT', 'Manage tenant integrations', 'CRITICAL'),
  ('SYSTEM:EXPORT:MANAGE:TENANT', 'Manage sensitive exports', 'CRITICAL'),
  ('OPD:PRESCRIPTION:SIGN:FACILITY', 'Sign and authorize OPD prescription', 'HIGH'),
  ('IPD:ADMISSION:CREATE:FACILITY', 'Create IPD admission', 'NORMAL'),
  ('IPD:DISCHARGE:SIGN:FACILITY', 'Authorize and finalize discharge', 'HIGH'),
  ('NURSING:VITALS:CREATE:FACILITY', 'Record patient vital signs', 'NORMAL'),
  ('NURSING:MAR:ADMINISTER:FACILITY', 'Administer and record medication', 'HIGH'),
  ('LAB:RESULT:VERIFY:FACILITY', 'Validate and release lab result', 'HIGH'),
  ('RADIOLOGY:REPORT:SIGN:FACILITY', 'Sign and finalize radiology report', 'HIGH'),
  ('OT:SAFETY_CHECKLIST:COMPLETE:FACILITY', 'Complete surgical safety checklist', 'CRITICAL'),
  ('PHARMACY:DISPENSE:EXECUTE:FACILITY', 'Dispense prescription medication', 'HIGH'),
  ('BILLING:INVOICE:CREATE:FACILITY', 'Generate billing invoice', 'NORMAL'),
  ('INSURANCE:CLAIM:SUBMIT:FACILITY', 'Submit insurance claim', 'HIGH'),
  ('QUALITY:INCIDENT:REPORT:FACILITY', 'Report patient safety incident', 'NORMAL')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level;

-- 5. Standard Roles
INSERT INTO hims_core.roles (id, tenant_id, code, name, description, system_role)
VALUES
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 'DOCTOR', 'Consultant Physician / Surgeon', 'Full clinical examination, note, prescription & orders', true),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111', 'NURSE', 'Staff Nurse / Ward Incharge', 'Vitals, MAR medication administration, triage, notes', true),
  ('44444444-4444-4444-8444-444444444403', '11111111-1111-4111-8111-111111111111', 'PATHOLOGIST', 'Clinical Pathologist', 'Lab accessioning, result entry, verification and release', true),
  ('44444444-4444-4444-8444-444444444404', '11111111-1111-4111-8111-111111111111', 'RADIOLOGIST', 'Radiologist', 'Worklist review, image reading, structured diagnostic reporting', true),
  ('44444444-4444-4444-8444-444444444405', '11111111-1111-4111-8111-111111111111', 'PHARMACIST', 'Hospital Pharmacist', 'Medication order verification, inventory dispensing, returns', true),
  ('44444444-4444-4444-8444-444444444406', '11111111-1111-4111-8111-111111111111', 'RECEPTIONIST', 'Front Desk / Registration Executive', 'Patient search, registration, queue check-in, appointments', true),
  ('44444444-4444-4444-8444-444444444407', '11111111-1111-4111-8111-111111111111', 'BILLING_EXECUTIVE', 'Billing & Insurance Officer', 'Invoicing, claims, tariff estimation, payment receipting', true),
  ('44444444-4444-4444-8444-444444444408', '11111111-1111-4111-8111-111111111111', 'ADMIN', 'Hospital Superintendent / Administrator', 'Facility governance, quality metrics, audit overview', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 6. Role-Permission mappings
INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-4111-8111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'DOCTOR' AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY', 'PATIENT:DEMOGRAPHICS:CREATE:FACILITY', 'CLINICAL:ENCOUNTER:CREATE:FACILITY', 'OPD:PRESCRIPTION:SIGN:FACILITY', 'IPD:ADMISSION:CREATE:FACILITY', 'IPD:DISCHARGE:SIGN:FACILITY', 'OT:SAFETY_CHECKLIST:COMPLETE:FACILITY', 'QUALITY:INCIDENT:REPORT:FACILITY', 'SYSTEM:BREAK_GLASS:USE:FACILITY')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-4111-8111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'NURSE' AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY', 'NURSING:VITALS:CREATE:FACILITY', 'NURSING:MAR:ADMINISTER:FACILITY', 'QUALITY:INCIDENT:REPORT:FACILITY', 'SYSTEM:BREAK_GLASS:USE:FACILITY')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-4111-8111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'PHARMACIST' AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY', 'PHARMACY:DISPENSE:EXECUTE:FACILITY', 'QUALITY:INCIDENT:REPORT:FACILITY')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-4111-8111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'PATHOLOGIST' AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY', 'LAB:RESULT:VERIFY:FACILITY', 'QUALITY:INCIDENT:REPORT:FACILITY')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-4111-8111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'RADIOLOGIST' AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY', 'RADIOLOGY:REPORT:SIGN:FACILITY', 'QUALITY:INCIDENT:REPORT:FACILITY')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

COMMIT;
