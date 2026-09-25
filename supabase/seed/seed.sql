-- HIMS Initial Seed Data
-- Version: 1.0 (2026 Baseline)

BEGIN;

-- 1. Tenants
INSERT INTO hims_core.tenants (id, code, legal_name, display_name, status, timezone, default_currency)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'APOLLO_GRP', 'Apollo Healthcare Enterprises Ltd.', 'Apollo Central Hospital', 'ACTIVE', 'Asia/Kolkata', 'INR')
ON CONFLICT (code) DO NOTHING;

-- 2. Facilities
INSERT INTO hims_core.facilities (id, tenant_id, facility_code, name, facility_type, status)
VALUES
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'MAIN_CAMPUS', 'Apollo Main Hospital - Jubilee Hills', 'HOSPITAL', 'ACTIVE'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'SATELLITE_CLINIC', 'Apollo Clinic - Gachibowli', 'CLINIC', 'ACTIVE')
ON CONFLICT (tenant_id, facility_code) DO NOTHING;

-- 3. Departments
INSERT INTO hims_core.departments (id, tenant_id, facility_id, department_code, name, department_type, clinical_service_flag)
VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'MED', 'General Medicine', 'CLINICAL', true),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'SURG', 'General Surgery', 'CLINICAL', true),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'CARDIO', 'Cardiology', 'CLINICAL', true),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'EMERGENCY', 'Emergency Department', 'EMERGENCY', true),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'ICU', 'Intensive Care Unit', 'ICU', true),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'OT', 'Operation Theatre', 'SURGERY', true),
  ('33333333-3333-3333-3333-333333333307', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'LAB', 'Central Pathology & Laboratory', 'DIAGNOSTIC', true),
  ('33333333-3333-3333-3333-333333333308', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'RAD', 'Radiology & Imaging', 'DIAGNOSTIC', true),
  ('33333333-3333-3333-3333-333333333309', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'PHARM', 'Central Pharmacy', 'PHARMACY', true),
  ('33333333-3333-3333-3333-333333333310', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'BILLING', 'Billing & Revenue Cycle', 'ADMIN', false)
ON CONFLICT (facility_id, department_code) DO NOTHING;

-- 4. Standard Permissions
INSERT INTO hims_core.permissions (code, description, risk_level)
VALUES
  ('patient.read', 'Read patient demographics and summary', 'NORMAL'),
  ('patient.create', 'Register new patient', 'NORMAL'),
  ('patient.update', 'Update patient demographics', 'NORMAL'),
  ('opd.consultation.create', 'Conduct OPD consultation and notes', 'NORMAL'),
  ('opd.prescription.sign', 'Sign and authorize prescription', 'HIGH'),
  ('ipd.admission.create', 'Create IPD admission', 'NORMAL'),
  ('ipd.discharge.sign', 'Authorize and finalize discharge summary', 'HIGH'),
  ('nursing.vitals.create', 'Record patient vital signs', 'NORMAL'),
  ('nursing.mar.administer', 'Administer and log medication in MAR', 'HIGH'),
  ('lab.result.verify', 'Validate and release lab report', 'HIGH'),
  ('radiology.report.sign', 'Sign and finalize radiology report', 'HIGH'),
  ('ot.safety_checklist.complete', 'Sign WHO surgical safety checklist', 'CRITICAL'),
  ('pharmacy.dispense', 'Dispense prescription medications', 'HIGH'),
  ('billing.invoice.create', 'Generate and finalize billing invoices', 'NORMAL'),
  ('insurance.claim.submit', 'Submit pre-auth and claims to payers', 'HIGH'),
  ('quality.incident.report', 'Report patient safety incident / CAPA', 'NORMAL'),
  ('system.break_glass.use', 'Execute emergency break-glass record access', 'CRITICAL')
ON CONFLICT (code) DO NOTHING;

-- 5. Standard Roles
INSERT INTO hims_core.roles (id, tenant_id, code, name, description, system_role)
VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'DOCTOR', 'Consultant Physician / Surgeon', 'Full clinical examination, note, prescription & orders', true),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'NURSE', 'Staff Nurse / Ward Incharge', 'Vitals, MAR medication administration, triage, notes', true),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', 'PATHOLOGIST', 'Clinical Pathologist', 'Lab accessioning, result entry, verification and release', true),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', 'RADIOLOGIST', 'Radiologist', 'Worklist review, image reading, structured diagnostic reporting', true),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', 'PHARMACIST', 'Hospital Pharmacist', 'Medication order verification, inventory dispensing, returns', true),
  ('44444444-4444-4444-4444-444444444406', '11111111-1111-1111-1111-111111111111', 'RECEPTIONIST', 'Front Desk / Registration Executive', 'Patient search, registration, queue check-in, appointments', true),
  ('44444444-4444-4444-4444-444444444407', '11111111-1111-1111-1111-111111111111', 'BILLING_EXECUTIVE', 'Billing & Insurance Officer', 'Invoicing, claims, tariff estimation, payment receipting', true),
  ('44444444-4444-4444-4444-444444444408', '11111111-1111-1111-1111-111111111111', 'ADMIN', 'Hospital Superintendent / Administrator', 'Facility governance, quality metrics, audit overview', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 6. Role-Permission mappings
INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'DOCTOR' AND p.code IN ('patient.read', 'patient.create', 'opd.consultation.create', 'opd.prescription.sign', 'ipd.admission.create', 'ipd.discharge.sign', 'ot.safety_checklist.complete', 'quality.incident.report', 'system.break_glass.use')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'NURSE' AND p.code IN ('patient.read', 'nursing.vitals.create', 'nursing.mar.administer', 'quality.incident.report', 'system.break_glass.use')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'PHARMACIST' AND p.code IN ('patient.read', 'pharmacy.dispense', 'quality.incident.report')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'PATHOLOGIST' AND p.code IN ('patient.read', 'lab.result.verify', 'quality.incident.report')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'RADIOLOGIST' AND p.code IN ('patient.read', 'radiology.report.sign', 'quality.incident.report')
ON CONFLICT (tenant_id, role_id, permission_code) DO NOTHING;

COMMIT;
