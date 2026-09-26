# HIMS Authorization & Permission Matrix

**Status:** Engineering baseline  
**Version:** 1.0  
**Date:** 2026-09-25

## 1. Authorization model

```text
User
 + authenticated identity
 + tenant membership
 + facility scope
 + department scope
 + role permissions
 + resource state
 + assignment/relationship
 + purpose/break-glass rules
 = authorization decision
```

The frontend can hide unavailable actions for usability but is never the security boundary.

## 2. Scope codes

| Code | Scope                                       |
| ---- | ------------------------------------------- |
| T    | tenant-wide                                 |
| F    | facility                                    |
| D    | department/unit                             |
| P    | patient/resource in authorized care context |
| S    | own work/task                               |
| A    | elevated approval                           |

## 3. Action codes

| Code | Action                        |
| ---- | ----------------------------- |
| R    | read                          |
| C    | create                        |
| U    | update                        |
| F    | finalize/sign/release         |
| X    | execute/perform               |
| A    | approve                       |
| E    | export                        |
| M    | configuration/manage          |
| D    | cancel/delete where permitted |

For clinical records, ordinary delete should be disabled; amendment/versioning replaces destructive mutation.

## 4. Permission namespaces

```text
patient.*
opd.*
ipd.*
nursing.*
lab.*
radiology.*
emergency.*
ot.*
icu.*
pharmacy.*
inventory.*
billing.*
insurance.*
quality.*
document.*
workflow.*
integration.*
report.*
audit.*
ai.*
system.*
```

## 5. Baseline roles

Receptionist  
Registration Supervisor  
OPD Nurse  
Doctor/Consultant  
Department Head  
IPD Nurse  
Head Nurse  
ICU Nurse  
Emergency Nurse  
Pharmacist  
Pharmacy Manager  
Lab Technician  
Pathologist  
Radiology Technician  
Radiologist  
OT Nurse/Technician  
Surgeon  
Anaesthetist  
Emergency Physician  
Billing Executive  
Cashier  
Insurance/TPA Executive  
Finance Manager  
Storekeeper/Procurement Officer  
Quality Manager  
Infection Control Officer  
Hospital Administrator  
Medical Superintendent  
Tenant Administrator  
System Administrator  
Auditor/Compliance Reviewer  
Support Engineer

---

# 6. Role-to-domain baseline matrix

`R` = read; `W` = operational write/create/update; `F` = finalize/sign/release; `A` = approve; `X` = execute/perform; `E` = export; `M` = manage. Scope is further constrained by facility/department/patient context.

| Role                      | Patient | OPD     | IPD/Nursing | LIS     | RIS     | Emergency | OT      | ICU     | Pharmacy  | Billing/Insurance | Quality     | Admin |
| ------------------------- | ------- | ------- | ----------- | ------- | ------- | --------- | ------- | ------- | --------- | ----------------- | ----------- | ----- |
| Receptionist              | R/W     | R/W/X   | R           | -       | -       | R/W       | -       | -       | -         | R/W               | -           | S     |
| Registration Supervisor   | R/W/A   | R/W/X/A | R           | -       | -       | R/W       | -       | -       | -         | R/W/A             | -           | F     |
| OPD Nurse                 | R       | R/W/X   | R           | R       | R       | R/W       | -       | -       | R         | R                 | -           | -     |
| Doctor/Consultant         | R/W*    | R/W/F   | R/W/F*      | R/C/R   | R/C/R   | R/W/F     | R/C     | R/C     | R         | R                 | R           | -     |
| Department Head           | R       | R/W/F/A | R/W/F/A     | R       | R       | R/W/A     | R/W/A   | R       | R         | R                 | R           | -     |
| IPD Nurse                 | R       | R       | R/W/X       | R/C/R   | R/C/R   | R/W       | R       | R/W/X   | R/C/X     | R                 | R           | -     |
| Head Nurse                | R       | R       | R/W/X/A     | R       | R       | R/W       | R       | R/W/A   | R/W       | R                 | R           | -     |
| ICU Nurse                 | R       | R       | R           | R/C/R   | R/C/R   | R/W       | R       | R/W/X   | R/W/X     | R                 | R           | -     |
| Emergency Nurse           | R       | R       | R/W         | R/C/R   | R/C/R   | R/W/X     | R       | R/W     | R/W/X     | R                 | -           | -     |
| Pharmacist                | R       | R       | R           | R       | R       | R         | R       | R       | R/W/X     | R/W               | R           | -     |
| Pharmacy Manager          | R       | R       | R           | -       | -       | -         | -       | -       | R/W/X/A/M | R/W/A             | R           | M     |
| Lab Technician            | R       | R       | R           | R/W/X   | R       | R         | R       | R       | -         | -                 | R           | -     |
| Pathologist               | R       | R       | R           | R/W/F/A | R       | R         | R       | R       | -         | -                 | R           | -     |
| Radiology Technician      | R       | R       | -           | -       | R/W/X   | R         | R       | R       | -         | -                 | R           | -     |
| Radiologist               | R       | R       | -           | R       | R/W/F/A | R         | R       | R       | -         | -                 | R           | -     |
| OT Nurse/Technician       | R       | R       | R           | R/C     | R/C     | R/W       | R/W/X   | R/W     | R/W/X     | R                 | R           | -     |
| Surgeon                   | R       | R/W/F   | R/W/F       | R/C/R   | R/C/R   | R/W       | R/W/F/X | R/W     | R         | R                 | R           | -     |
| Anaesthetist              | R       | R       | R/W/F       | R/C/R   | R/C/R   | R/W       | R/W/F/X | R/W/F   | R         | R                 | R           | -     |
| Emergency Physician       | R       | R/W/F   | R/W         | R/C/R   | R/C/R   | R/W/F/X   | R/C     | R/W     | R/W/X     | R                 | R           | -     |
| Billing Executive         | R       | R       | R           | R       | R       | R         | R       | R       | R         | R/W/X             | R           | -     |
| Cashier                   | R       | R       | R           | -       | -       | R         | -       | -       | R         | R/W/X             | -           | -     |
| Insurance/TPA Executive   | R       | R       | R           | R       | R       | R         | R       | R       | R         | R/W/X             | R           | -     |
| Finance Manager           | R       | R       | R           | R       | R       | R         | R       | R       | R         | R/W/A/E           | R           | M     |
| Storekeeper/Procurement   | R       | R       | R           | -       | -       | -         | R       | R       | R/W/X     | R/W/A             | R           | M     |
| Quality Manager           | R       | R       | R           | R       | R       | R         | R       | R       | R         | R                 | R/W/F/A/E/M | M     |
| Infection Control Officer | R       | R       | R           | R       | R       | R         | R       | R       | R         | R                 | R/W/F/A/E   | -     |
| Hospital Administrator    | R/W*    | R/W/A/E | R/W/A/E     | R/W/A/E | R/W/A/E | R/W/A/E   | R/W/A/E | R/W/A/E | R/W/A/E   | R/W/A/E           | R/W/A/E     | M     |
| Medical Superintendent    | R/W*    | R/W/A/E | R/W/A/E     | R/W/A/E | R/W/A/E | R/W/A/E   | R/W/A/E | R/W/A/E | R/W/A/E   | R/W/A/E           | R/W/A/E     | M     |
| Tenant Administrator      | R       | R       | R           | R       | R       | R         | R       | R       | R         | R                 | R           | M     |
| System Administrator      | R**     | R**     | R**         | R**     | R**     | R**       | R**     | R**     | R**       | R**               | R**         | M     |
| Auditor/Compliance        | R***    | R***    | R***        | R***    | R***    | R***      | R***    | R***    | R***      | R***              | R/E         | R     |
| Support Engineer          | R****   | R****   | R****       | R****   | R****   | R****     | R****   | R****   | R****     | R****             | R****       | -     |

Notes:

- `*` subject to assignment/department/facility and sensitive action restrictions.
- `**` technical/configuration metadata does not imply unrestricted clinical-content access.
- `***` read-only compliance access is still logged and restricted to the authorized tenant/facility.
- `****` support access should normally be metadata/diagnostics only; patient-content access requires explicit customer-approved support access and dedicated audit.

---

# 7. Core permissions

Runtime permission identifiers use DOMAIN:RESOURCE:ACTION:SCOPE. A trailing * scope means the permission can be bound to a narrower facility/department/patient scope by the role assignment or route policy.

## Patient

```text
PATIENT:READ:*:*
PATIENT:CREATE:*:*
PATIENT:UPDATE:*:*
PATIENT:IDENTIFIER:LINK:*
PATIENT:IDENTIFIER:VERIFY:*
PATIENT:MERGE:REQUEST:*
PATIENT:MERGE:APPROVE:*
PATIENT:MERGE:EXECUTE:*
PATIENT:CONSENT:READ:*
PATIENT:CONSENT:CREATE:*
PATIENT:CONSENT:WITHDRAW:*
PATIENT:EXPORT:*:*
PATIENT:ACCESS-HISTORY:READ:*
```

## OPD

```text
OPD:APPOINTMENT:READ:*
OPD:APPOINTMENT:CREATE:*
OPD:APPOINTMENT:UPDATE:*
OPD:QUEUE:MANAGE:*
OPD:ENCOUNTER:CREATE:*
OPD:ENCOUNTER:UPDATE:*
OPD:ENCOUNTER:SIGN:*
OPD:ORDER:CREATE:*
OPD:PRESCRIPTION:CREATE:*
OPD:PRESCRIPTION:FINALIZE:*
OPD:REFERRAL:CREATE:*
OPD:ADMISSION:REQUEST:*
```

## IPD/Nursing

```text
IPD:ADMISSION:READ:*
IPD:ADMISSION:CREATE:*
IPD:ADMISSION:APPROVE:*
IPD:BED:READ:*
IPD:BED:RESERVE:*
IPD:BED:ASSIGN:*
IPD:BED:TRANSFER:*
IPD:NURSING-NOTE:CREATE:*
IPD:NURSING-NOTE:SIGN:*
IPD:VITALS:CREATE:*
IPD:MEDICATION-ORDER:CREATE:*
IPD:MEDICATION-ORDER:UPDATE:*
IPD:MAR:RECORD:*
IPD:DISCHARGE-SUMMARY:DRAFT:*
IPD:DISCHARGE-SUMMARY:FINALIZE:*
IPD:DISCHARGE:EXECUTE:*
IPD:ICU-TRANSFER:REQUEST:*
IPD:OT-REQUEST:CREATE:*
```

## LIS

```text
LAB:ORDER:READ:*
LAB:ORDER:CREATE:*
LAB:SPECIMEN:COLLECT:*
LAB:SPECIMEN:RECEIVE:*
LAB:SPECIMEN:REJECT:*
LAB:RESULT:ENTER:*
LAB:RESULT:VERIFY:*
LAB:RESULT:RELEASE:*
LAB:RESULT:AMEND:*
LAB:RESULT:CRITICAL_ACKNOWLEDGE:*
LAB:QC:MANAGE:*
LAB:INSTRUMENT:MANAGE:*
```

## RIS

```text
RADIOLOGY:ORDER:READ:*
RADIOLOGY:ORDER:CREATE:*
RADIOLOGY:SCHEDULE:*:*
RADIOLOGY:STUDY:PERFORM:*
RADIOLOGY:REPORT:DRAFT:*
RADIOLOGY:REPORT:VERIFY:*
RADIOLOGY:REPORT:RELEASE:*
RADIOLOGY:REPORT:AMEND:*
RADIOLOGY:PACS:LAUNCH:*
RADIOLOGY:MODALITY:MANAGE:*
```

## Emergency

```text
EMERGENCY:ENCOUNTER:CREATE:*
EMERGENCY:TRIAGE:CREATE:*
EMERGENCY:TRIAGE:FINALIZE:*
EMERGENCY:RESUSCITATION:RECORD:*
EMERGENCY:ORDER:CREATE:*
EMERGENCY:DISPOSITION:ADMIT:*
EMERGENCY:DISPOSITION:ICU:*
EMERGENCY:DISPOSITION:TRANSFER:*
EMERGENCY:DISPOSITION:DISCHARGE:*
EMERGENCY:MLC:MANAGE:*
```

## OT

```text
OT:REQUEST:CREATE:*
OT:REQUEST:APPROVE:*
OT:CASE:SCHEDULE:*
OT:CASE:READ:*
OT:CHECKLIST:COMPLETE:*
OT:TIMEOUT:COMPLETE:*
OT:PROCEDURE:RECORD:*
OT:ANAESTHESIA:RECORD:*
OT:CASE:COMPLETE:*
OT:SPECIMEN:CREATE:*
```

## ICU

```text
ICU:TRANSFER:ACCEPT:*
ICU:ADMISSION:CREATE:*
ICU:FLOWSHEET:WRITE:*
ICU:DEVICE:WRITE:*
ICU:INFUSION:WRITE:*
ICU:HANDOVER:READ:*
ICU:TRANSFER:REQUEST:*
ICU:DISCHARGE:*:*
```

## Pharmacy/inventory

```text
PHARMACY:PRESCRIPTION:READ:*
PHARMACY:PRESCRIPTION:VERIFY:*
PHARMACY:DISPENSE:*:*
PHARMACY:MEDICATION-ORDER:READ:*
PHARMACY:STOCK:READ:*
PHARMACY:STOCK:ADJUST:*
PHARMACY:STOCK:TRANSFER:*
PHARMACY:PURCHASE:CREATE:*
PHARMACY:PURCHASE:APPROVE:*
PHARMACY:GOODS-RECEIVE:*:*
PHARMACY:RETURN:CREATE:*
PHARMACY:RECALL:MANAGE:*
INVENTORY:ASSET:MANAGE:*
INVENTORY:VENDOR:MANAGE:*
```

## Billing/insurance

```text
BILLING:CHARGE:READ:*
BILLING:CHARGE:CREATE:*
BILLING:INVOICE:CREATE:*
BILLING:INVOICE:FINALIZE:*
BILLING:PAYMENT:CREATE:*
BILLING:PAYMENT:REVERSE:*
BILLING:REFUND:CREATE:*
BILLING:REFUND:APPROVE:*
INSURANCE:POLICY:READ:*
INSURANCE:ELIGIBILITY:CHECK:*
INSURANCE:PREAUTH:CREATE:*
INSURANCE:PREAUTH:SUBMIT:*
INSURANCE:PREAUTH:APPROVE:*
INSURANCE:CLAIM:CREATE:*
INSURANCE:CLAIM:SUBMIT:*
INSURANCE:CLAIM:RESUBMIT:*
INSURANCE:REMITTANCE:RECONCILE:*
```

## Quality

```text
QUALITY:INCIDENT:CREATE:*
QUALITY:INCIDENT:READ:*
QUALITY:INCIDENT:INVESTIGATE:*
QUALITY:CAPA:CREATE:*
QUALITY:CAPA:ASSIGN:*
QUALITY:CAPA:COMPLETE:*
QUALITY:CAPA:VERIFY:*
QUALITY:CAPA:CLOSE:*
QUALITY:AUDIT:CREATE:*
QUALITY:AUDIT:REVIEW:*
QUALITY:INDICATOR:CONFIGURE:*
QUALITY:INDICATOR:CALCULATE:*
QUALITY:EVIDENCE:MANAGE:*
```

## System

```text
SYSTEM:USER:MANAGE:*
SYSTEM:ROLE:MANAGE:*
SYSTEM:PERMISSION:MANAGE:*
SYSTEM:FACILITY:MANAGE:*
SYSTEM:DEPARTMENT:MANAGE:*
SYSTEM:INTEGRATION:MANAGE:*
SYSTEM:FEATURE-FLAG:MANAGE:*
SYSTEM:AUDIT:READ:*
SYSTEM:SECURITY:MANAGE:*
SYSTEM:EXPORT:MANAGE:*
```

---

# 8. Break-glass

Break-glass is allowed only where the organization has defined the clinical/legal policy.

Workflow:

1. User requests emergency access.
2. User provides mandatory reason.
3. Server validates role eligibility.
4. Access is granted for a defined window.
5. Dedicated audit event is created.
6. Supervisor/compliance review may be required.

Break-glass never bypasses tenant isolation.

# 9. Approval matrix

| Operation                           | Requester                             | Approver                                     |
| ----------------------------------- | ------------------------------------- | -------------------------------------------- |
| Patient merge                       | Authorized registration/clinical user | Registration Supervisor / MS per policy      |
| High-value refund                   | Cashier/Billing                       | Finance Manager                              |
| Tariff change                       | Billing/Admin                         | Finance/Admin/M.S. per policy                |
| Stock write-off above threshold     | Storekeeper                           | Pharmacy/Finance/Admin                       |
| Claim write-off                     | RCM                                   | Finance Manager                              |
| Released lab result amendment       | Lab authorized user                   | Pathologist/defined senior role              |
| Released radiology report amendment | Radiology user                        | Radiologist                                  |
| Privileged role change              | Tenant Admin                          | Higher admin / controlled dual approval      |
| Bulk clinical export                | Authorized analyst/admin              | Data protection/privacy authority per policy |
| Break-glass review                  | Clinical user                         | Supervisor/Compliance                        |

# 10. Authorization evaluation order

Recommended server sequence:

```text
Authenticate
  ↓
Resolve active tenant
  ↓
Resolve facility/department scope
  ↓
Resolve role/permission
  ↓
Load resource state/ownership
  ↓
Evaluate patient/context relationship
  ↓
Evaluate special approval/break-glass
  ↓
Allow/deny
  ↓
Audit if sensitive
```

# 11. Tenant/facility isolation tests

Every release must test:

- cross-tenant read blocked;
- cross-tenant write blocked;
- cross-facility read blocked;
- cross-department restricted records blocked;
- role self-escalation blocked;
- facility self-grant blocked;
- export privilege isolation;
- break-glass cannot cross tenant boundary;
- support access cannot silently bypass customer controls.

# 12. Supabase/RLS rules

1. Every tenant-owned table has `tenant_id`.
2. Tenant-owned exposed schemas use RLS.
3. Application DB role does not have `BYPASSRLS`.
4. RLS `USING` and `WITH CHECK` both enforce tenant identity on updates.
5. Do not use `user_metadata` as authorization source.
6. Secret/service keys stay server-side.
7. High-risk facility/department restrictions may be duplicated in SQL policies as defense in depth.

Supabase's security guidance explicitly calls out the dangers of user-editable authorization metadata, UPDATE policies without `WITH CHECK`, and service-role key exposure. citeturn863674search3

# 13. Permission maintenance

Platform permissions are immutable product capabilities. Tenant administrators may assign them through approved role templates but cannot create arbitrary SQL-level wildcards.

Recommended lifecycle:

```text
Product permission catalogue
        ↓
Tenant role templates
        ↓
Facility/department scope
        ↓
User assignment
        ↓
Periodic access review
```

High-risk access should have periodic recertification.
