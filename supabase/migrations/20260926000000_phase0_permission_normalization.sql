-- Phase 0 authorization normalization.
-- The original seed used dotted permission identifiers while the API's
-- RequirePermissions contract uses DOMAIN:RESOURCE:ACTION:SCOPE.

BEGIN;

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

-- Remove old dotted role mappings before deleting their referenced permissions.
DELETE FROM hims_core.role_permissions
WHERE permission_code IN (
  'patient.read','patient.create','opd.consultation.create','opd.prescription.sign',
  'ipd.admission.create','ipd.discharge.sign','ot.safety_checklist.complete',
  'quality.incident.report','system.break_glass.use','nursing.vitals.create',
  'nursing.mar.administer','pharmacy.dispense','lab.result.verify','radiology.report.sign'
);

DELETE FROM hims_core.permissions
WHERE code IN (
  'patient.read','patient.create','opd.consultation.create','opd.prescription.sign',
  'ipd.admission.create','ipd.discharge.sign','ot.safety_checklist.complete',
  'quality.incident.report','system.break_glass.use','nursing.vitals.create',
  'nursing.mar.administer','pharmacy.dispense','lab.result.verify','radiology.report.sign'
);

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'DOCTOR'
  AND p.code IN (
    'PATIENT:DEMOGRAPHICS:READ:FACILITY','PATIENT:DEMOGRAPHICS:CREATE:FACILITY',
    'CLINICAL:ENCOUNTER:CREATE:FACILITY','OPD:PRESCRIPTION:SIGN:FACILITY',
    'IPD:ADMISSION:CREATE:FACILITY','IPD:DISCHARGE:SIGN:FACILITY',
    'OT:SAFETY_CHECKLIST:COMPLETE:FACILITY','QUALITY:INCIDENT:REPORT:FACILITY',
    'SYSTEM:BREAK_GLASS:USE:FACILITY'
  )
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'NURSE'
  AND p.code IN (
    'PATIENT:DEMOGRAPHICS:READ:FACILITY','NURSING:VITALS:CREATE:FACILITY',
    'NURSING:MAR:ADMINISTER:FACILITY','QUALITY:INCIDENT:REPORT:FACILITY',
    'SYSTEM:BREAK_GLASS:USE:FACILITY'
  )
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'PHARMACIST'
  AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY','PHARMACY:DISPENSE:EXECUTE:FACILITY','QUALITY:INCIDENT:REPORT:FACILITY')
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'PATHOLOGIST'
  AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY','LAB:RESULT:VERIFY:FACILITY','QUALITY:INCIDENT:REPORT:FACILITY')
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
SELECT '11111111-1111-1111-1111-111111111111', r.id, p.code
FROM hims_core.roles r, hims_core.permissions p
WHERE r.code = 'RADIOLOGIST'
  AND p.code IN ('PATIENT:DEMOGRAPHICS:READ:FACILITY','RADIOLOGY:REPORT:SIGN:FACILITY','QUALITY:INCIDENT:REPORT:FACILITY')
ON CONFLICT DO NOTHING;

COMMIT;
