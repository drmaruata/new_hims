/**
 * HIMS Enterprise Domain Type Definitions
 * Version: 1.0 (2026 Baseline)
 * Covers: Ten Core Departments (OPD, IPD, LIS, RIS, ED, OT, ICU, Pharmacy, EMR, Insurance)
 * Plus Core Platform, Billing/RCM, Quality OS, Audit, Workflow, and Events.
 */

// =============================================================================
// 1. COMMON / BASE TYPES
// =============================================================================

export type UUID = string;
export type ISODateString = string; // e.g. "2026-09-25T10:00:00.000Z"
export type DateOnlyString = string; // e.g. "1988-04-12"
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';
export type BloodGroup = 'A_POSITIVE' | 'A_NEGATIVE' | 'B_POSITIVE' | 'B_NEGATIVE' | 'AB_POSITIVE' | 'AB_NEGATIVE' | 'O_POSITIVE' | 'O_NEGATIVE' | 'UNKNOWN';

export interface BaseEntity {
  id: UUID;
  tenantId: UUID;
  createdAt: ISODateString;
  createdBy?: UUID | null;
  updatedAt: ISODateString;
  updatedBy?: UUID | null;
  version: number;
}

export interface ScopedEntity extends BaseEntity {
  facilityId: UUID;
}

export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    correlationId?: string;
    timestamp?: ISODateString;
    totalCount?: number;
    hasMore?: boolean;
    nextCursor?: string;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string; code?: string }>;
    correlationId?: string;
  };
}

// =============================================================================
// 2. TENANCY & ORGANIZATION
// =============================================================================

export interface Tenant extends BaseEntity {
  code: string;
  legalName: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  timezone: string;
  defaultLocale: string;
  defaultCurrency: CurrencyCode;
  settings?: Record<string, any>;
}

export interface Facility extends ScopedEntity {
  facilityCode: string;
  name: string;
  facilityType: 'HOSPITAL' | 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'SATELLITE';
  hfrId?: string | null;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE';
  address?: Record<string, any>;
  contact?: Record<string, any>;
}

export interface Department extends ScopedEntity {
  departmentCode: string;
  name: string;
  departmentType: 'CLINICAL' | 'DIAGNOSTIC' | 'PHARMACY' | 'NURSING' | 'ADMIN' | 'EMERGENCY' | 'ICU' | 'SURGERY';
  parentDepartmentId?: UUID | null;
  clinicalServiceFlag: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

// =============================================================================
// 3. USER, ROLES & AUTH
// =============================================================================

export interface UserProfile extends BaseEntity {
  userId: UUID;
  employeeCode?: string | null;
  displayName: string;
  mobile?: string | null;
  email?: string | null;
  professionalCategory: 'DOCTOR' | 'NURSE' | 'PATHOLOGIST' | 'RADIOLOGIST' | 'PHARMACIST' | 'ADMIN' | 'RECEPTIONIST' | 'BILLING' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  lastLoginAt?: ISODateString | null;
}

export interface Role {
  id: UUID;
  tenantId: UUID;
  code: string;
  name: string;
  description?: string | null;
  systemRole: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: {
    id: UUID;
    email: string;
    displayName: string;
    tenantId: UUID;
    facilityId: UUID;
    roles: string[];
    permissions: string[];
  };
}

// =============================================================================
// 4. PATIENT 360 & MPI
// =============================================================================

export interface Patient extends BaseEntity {
  uhid: string; // Canonical unique hospital identity number
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: DateOnlyString;
  gender: Gender;
  bloodGroup?: BloodGroup;
  mobile: string;
  email?: string | null;
  nationalIdType?: 'AADHAAR' | 'PAN' | 'PASSPORT' | 'VOTER_ID' | 'ABHA' | 'OTHER';
  nationalIdNumber?: string | null;
  abhaAddress?: string | null;
  abhaNumber?: string | null;
  isVip?: boolean;
  isMlc?: boolean;
  status: 'ACTIVE' | 'MERGED' | 'DECEASED' | 'INACTIVE';
  mergedIntoPatientId?: UUID | null;
  allergies?: PatientAllergy[];
  contacts?: PatientContact[];
}

export interface PatientAllergy {
  id: UUID;
  allergenType: 'MEDICATION' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
  allergenName: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  reactionDescription?: string;
  verified: boolean;
  diagnosedAt?: ISODateString;
}

export interface PatientContact {
  id: UUID;
  relationship: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'GUARDIAN' | 'OTHER';
  name: string;
  mobile: string;
  isEmergencyContact: boolean;
}

// =============================================================================
// 5. ENCOUNTERS & CLINICAL BASE
// =============================================================================

export type EncounterType = 'OPD' | 'IPD' | 'EMERGENCY' | 'ICU' | 'DAY_CARE' | 'TELECONSULTATION';
export type EncounterStatus = 'PLANNED' | 'ARRIVED' | 'TRIAGED' | 'IN_PROGRESS' | 'ON_HOLD' | 'DISCHARGED' | 'COMPLETED' | 'CANCELLED';

export interface Encounter extends ScopedEntity {
  encounterNumber: string;
  patientId: UUID;
  encounterType: EncounterType;
  departmentId: UUID;
  attendingPractitionerId: UUID;
  status: EncounterStatus;
  startedAt: ISODateString;
  endedAt?: ISODateString | null;
  chiefComplaint?: string | null;
  admissionReason?: string | null;
  dischargeDisposition?: 'HOME' | 'TRANSFERRED' | 'AGAINST_MEDICAL_ADVICE' | 'DECEASED' | 'REFERRED';
}

export interface ClinicalVitals {
  id: UUID;
  encounterId: UUID;
  patientId: UUID;
  recordedAt: ISODateString;
  recordedBy: UUID;
  temperatureCelsius?: number;
  pulseBpm?: number;
  systolicBp?: number;
  diastolicBp?: number;
  respiratoryRate?: number;
  oxygenSaturationSpO2?: number;
  gcsScore?: number;
  painScore?: number;
}

// =============================================================================
// 6. MODULE 1: OPD (OUTPATIENT DEPARTMENT)
// =============================================================================

export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface OpdAppointment extends ScopedEntity {
  appointmentNumber: string;
  patientId: UUID;
  departmentId: UUID;
  practitionerId: UUID;
  scheduledAt: ISODateString;
  durationMinutes: number;
  status: AppointmentStatus;
  queueToken?: string | null;
  checkedInAt?: ISODateString | null;
  reasonForVisit?: string;
}

export interface OpdPrescriptionItem {
  id: UUID;
  drugId: UUID;
  drugName: string;
  dosage: string; // e.g. "500 mg"
  frequency: string; // e.g. "TDS (Thrice daily)"
  route: 'ORAL' | 'IV' | 'IM' | 'SC' | 'TOPICAL' | 'INHALATION';
  durationDays: number;
  instructions?: string;
  isHighAlert?: boolean;
}

export interface OpdPrescription extends ScopedEntity {
  prescriptionNumber: string;
  encounterId: UUID;
  patientId: UUID;
  prescribingDoctorId: UUID;
  prescribedAt: ISODateString;
  status: 'DRAFT' | 'SIGNED' | 'DISPENSED' | 'CANCELLED';
  items: OpdPrescriptionItem[];
  diagnosisText?: string;
  clinicalNotes?: string;
}

// =============================================================================
// 7. MODULE 2: IPD (INPATIENT DEPARTMENT) & NURSING
// =============================================================================

export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE' | 'BLOCKED' | 'ISOLATION';

export interface Bed extends ScopedEntity {
  bedCode: string;
  wardId: UUID;
  departmentId: UUID;
  bedType: 'GENERAL' | 'SEMI_PRIVATE' | 'PRIVATE' | 'ICU' | 'STEP_DOWN' | 'EMERGENCY_OBSERVATION';
  dailyTariff: number;
  status: BedStatus;
  currentPatientId?: UUID | null;
  currentEncounterId?: UUID | null;
}

export interface IpdAdmission extends ScopedEntity {
  admissionNumber: string;
  encounterId: UUID;
  patientId: UUID;
  admittedAt: ISODateString;
  admittingDoctorId: UUID;
  departmentId: UUID;
  wardId: UUID;
  assignedBedId: UUID;
  status: 'ADMITTED' | 'TRANSFERRED' | 'DISCHARGE_PENDING' | 'DISCHARGED';
  dischargeSummary?: IpdDischargeSummary | null;
}

export interface IpdDischargeSummary {
  id: UUID;
  admissionId: UUID;
  finalDiagnosis: string;
  hospitalCourseSummary: string;
  proceduresDone?: string;
  dischargeCondition: 'STABLE' | 'IMPROVED' | 'CRITICAL' | 'LAMA' | 'DECEASED';
  dischargeMedications: OpdPrescriptionItem[];
  followUpInstructions: string;
  finalizedAt: ISODateString;
  finalizedByDoctorId: UUID;
}

export interface MedicationAdministrationRecordItem {
  id: UUID;
  encounterId: UUID;
  patientId: UUID;
  medicationOrderId: UUID;
  scheduledTime: ISODateString;
  administeredTime?: ISODateString;
  administeredByNurseId?: UUID;
  status: 'SCHEDULED' | 'GIVEN' | 'REFUSED' | 'HELD' | 'MISSED';
  dosageGiven?: string;
  routeGiven?: string;
  notes?: string;
}

// =============================================================================
// 8. MODULE 3: LIS (LABORATORY INFORMATION SYSTEM)
// =============================================================================

export type LabOrderStatus = 'ORDERED' | 'COLLECTED' | 'RECEIVED' | 'PROCESSING' | 'RESULT_ENTERED' | 'VERIFIED' | 'RELEASED' | 'CANCELLED';
export type SpecimenStatus = 'COLLECTED' | 'RECEIVED' | 'ACCEPTED' | 'REJECTED';

export interface LabOrder extends ScopedEntity {
  orderNumber: string;
  accessionNumber?: string;
  encounterId: UUID;
  patientId: UUID;
  requestingDoctorId: UUID;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: LabOrderStatus;
  tests: LabTestItem[];
  orderedAt: ISODateString;
}

export interface LabTestItem {
  testCode: string;
  testName: string;
  category: 'BIOCHEMISTRY' | 'HEMATOLOGY' | 'MICROBIOLOGY' | 'PATHOLOGY' | 'SEROLOGY';
  specimenType: 'WHOLE_BLOOD' | 'SERUM' | 'PLASMA' | 'URINE' | 'CSF' | 'SWAB' | 'TISSUE';
  resultValue?: string;
  numericResult?: number;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  isCritical?: boolean;
  verifiedBy?: UUID;
  verifiedAt?: ISODateString;
}

// =============================================================================
// 9. MODULE 4: RIS (RADIOLOGY INFORMATION SYSTEM) & PACS
// =============================================================================

export type RadiologyStatus = 'REQUESTED' | 'SCHEDULED' | 'ACQUIRED' | 'INTERPRETING' | 'REPORTED' | 'VERIFIED' | 'AMENDED';

export interface RadiologyOrder extends ScopedEntity {
  orderNumber: string;
  accessionNumber: string;
  encounterId: UUID;
  patientId: UUID;
  orderingDoctorId: UUID;
  modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'MAMMOGRAPHY' | 'PET_CT';
  bodyPart: string;
  clinicalIndication: string;
  status: RadiologyStatus;
  pacsStudyInstanceUid?: string;
  report?: RadiologyReport | null;
}

export interface RadiologyReport {
  id: UUID;
  radiologistId: UUID;
  findings: string;
  impression: string;
  isCriticalFinding: boolean;
  reportedAt: ISODateString;
  verifiedAt?: ISODateString;
}

// =============================================================================
// 10. MODULE 5: EMERGENCY DEPARTMENT (ED)
// =============================================================================

export type TriageAcuity = 'ESI_1_RESUSCITATION' | 'ESI_2_EMERGENT' | 'ESI_3_URGENT' | 'ESI_4_LESS_URGENT' | 'ESI_5_NON_URGENT';

export interface EmergencyEncounter extends ScopedEntity {
  emergencyNumber: string;
  patientId: UUID;
  arrivedAt: ISODateString;
  arrivalMode: 'WALK_IN' | 'AMBULANCE' | 'POLICE' | 'TRANSFER';
  triageAcuity: TriageAcuity;
  isMlc: boolean;
  mlcNumber?: string;
  triageNurseId: UUID;
  attendingPhysicianId?: UUID;
  disposition?: 'ADMIT_IPD' | 'ADMIT_ICU' | 'TRANSFER_OT' | 'DISCHARGE' | 'REFERRAL' | 'EXPIRED' | 'LAMA';
  dispositionAt?: ISODateString;
}

// =============================================================================
// 11. MODULE 6: OT (OPERATING THEATRE MANAGEMENT)
// =============================================================================

export type OtCaseStatus = 'SCHEDULED' | 'PRE_OP' | 'IN_THEATRE' | 'ANESTHESIA_INDUCED' | 'SURGERY_IN_PROGRESS' | 'RECOVERY' | 'COMPLETED' | 'CANCELLED';

export interface SurgeryCase extends ScopedEntity {
  caseNumber: string;
  encounterId: UUID;
  patientId: UUID;
  otRoomId: UUID;
  scheduledStart: ISODateString;
  scheduledEnd: ISODateString;
  leadSurgeonId: UUID;
  anaesthetistId: UUID;
  procedureName: string;
  status: OtCaseStatus;
  whoChecklistCompleted: boolean;
  preOpDiagnosis?: string;
  postOpDiagnosis?: string;
  implantsUsed?: Array<{ implantCode: string; name: string; serialNumber: string }>;
}

// =============================================================================
// 12. MODULE 7: ICU (INTENSIVE CARE UNIT)
// =============================================================================

export interface IcuEpisode extends ScopedEntity {
  episodeNumber: string;
  encounterId: UUID;
  patientId: UUID;
  icuBedId: UUID;
  admittedAt: ISODateString;
  intubated: boolean;
  ventilatorMode?: string;
  apacheScore?: number;
  sofaScore?: number;
  status: 'ACTIVE' | 'STEP_DOWN_ORDERED' | 'DISCHARGED' | 'DECEASED';
}

// =============================================================================
// 13. MODULE 8: PHARMACY MANAGEMENT & INVENTORY
// =============================================================================

export type DispenseStatus = 'PENDING' | 'VERIFIED' | 'PARTIALLY_DISPENSED' | 'DISPENSED' | 'REJECTED';

export interface PharmacyDispenseOrder extends ScopedEntity {
  dispenseNumber: string;
  prescriptionId?: UUID;
  medicationOrderId?: UUID;
  patientId: UUID;
  status: DispenseStatus;
  items: Array<{
    drugId: UUID;
    drugName: string;
    batchNumber: string;
    expiryDate: DateOnlyString;
    quantityOrdered: number;
    quantityDispensed: number;
    unitPrice: number;
    totalAmount: number;
  }>;
  totalAmount: number;
  dispensedAt?: ISODateString;
  dispensedByPharmacistId?: UUID;
}

// =============================================================================
// 14. MODULE 9: EMR (ELECTRONIC MEDICAL RECORD / PATIENT 360)
// =============================================================================

export interface EmrTimelineItem {
  id: UUID;
  timestamp: ISODateString;
  eventType: 'ENCOUNTER' | 'DIAGNOSIS' | 'PRESCRIPTION' | 'LAB_RESULT' | 'RADIOLOGY_REPORT' | 'SURGERY' | 'VITALS' | 'ADMISSION' | 'DISCHARGE';
  title: string;
  summary: string;
  sourceModule: 'OPD' | 'IPD' | 'LIS' | 'RIS' | 'EMERGENCY' | 'OT' | 'ICU' | 'PHARMACY';
  sourceId: UUID;
  practitionerName?: string;
  departmentName?: string;
  criticalFlag?: boolean;
}

export interface Patient360Record {
  patient: Patient;
  allergies: PatientAllergy[];
  activeEncounters: Encounter[];
  recentVitals: ClinicalVitals[];
  activePrescriptions: OpdPrescription[];
  recentLabResults: LabOrder[];
  recentRadiologyReports: RadiologyOrder[];
  timeline: EmrTimelineItem[];
}

// =============================================================================
// 15. MODULE 10: INSURANCE, CLAIMS & TPA
// =============================================================================

export type ClaimStatus = 'DRAFT' | 'PRE_AUTH_SUBMITTED' | 'PRE_AUTH_APPROVED' | 'PRE_AUTH_REJECTED' | 'CLAIM_SUBMITTED' | 'QUERY_RAISED' | 'APPROVED' | 'SETTLED' | 'REJECTED';

export interface InsuranceClaim extends ScopedEntity {
  claimNumber: string;
  encounterId: UUID;
  patientId: UUID;
  payerType: 'PMJAY' | 'STATE_SCHEME' | 'PRIVATE_TPA' | 'CORPORATE';
  payerName: string;
  policyNumber: string;
  preAuthAmountRequested?: number;
  preAuthAmountApproved?: number;
  totalClaimAmount: number;
  approvedClaimAmount?: number;
  status: ClaimStatus;
  submittedAt?: ISODateString;
  settledAt?: ISODateString;
}

// =============================================================================
// 16. BILLING & RCM
// =============================================================================

export interface Invoice extends ScopedEntity {
  invoiceNumber: string;
  patientId: UUID;
  encounterId?: UUID | null;
  totalGrossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netPayableAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'DRAFT' | 'FINALIZED' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'CANCELLED';
  items: Array<{
    serviceCode: string;
    description: string;
    departmentId: UUID;
    quantity: number;
    unitPrice: number;
    netAmount: number;
  }>;
}

// =============================================================================
// 17. QUALITY OS, INCIDENTS & ACCREDITATION (NABH / NQAS)
// =============================================================================

export interface QualityIndicatorMeasurement extends ScopedEntity {
  indicatorCode: string;
  indicatorName: string;
  category: 'NABH_CLINICAL' | 'NABH_INFECTION_CONTROL' | 'NABH_MEDICATION_SAFETY' | 'NQAS';
  numerator: number;
  denominator: number;
  computedRate: number;
  targetRate: number;
  measurementMonth: string; // "2026-09"
}

export interface IncidentReport extends ScopedEntity {
  incidentNumber: string;
  category: 'MEDICATION_ERROR' | 'FALL' | 'SENTINEL_EVENT' | 'EQUIPMENT_FAILURE' | 'NEAR_MISS';
  severity: 'NEAR_MISS' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'CATASTROPHIC';
  description: string;
  reportedAt: ISODateString;
  rcaSummary?: string;
  capaPlan?: string;
  status: 'REPORTED' | 'UNDER_INVESTIGATION' | 'CAPA_SUBMITTED' | 'CLOSED';
}

// =============================================================================
// 18. DOMAIN EVENTS & AUDIT LOGGING
// =============================================================================

export interface DomainEventEnvelope<T = any> {
  eventId: UUID;
  eventType: string;
  eventVersion: number;
  occurredAt: ISODateString;
  tenantId: UUID;
  facilityId: UUID;
  actorUserId?: UUID | null;
  aggregateType: string;
  aggregateId: UUID;
  correlationId: string;
  causationId?: UUID | null;
  source: string;
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'SENSITIVE';
  data: T;
}

export interface AuditLogEntry extends ScopedEntity {
  actorUserId: UUID;
  actorRole: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'FINALIZE' | 'SIGN' | 'DISPENSE' | 'BREAK_GLASS' | 'EXPORT';
  resourceType: string;
  resourceId: UUID;
  patientId?: UUID;
  reason?: string;
  correlationId: string;
  ipAddress?: string;
}
