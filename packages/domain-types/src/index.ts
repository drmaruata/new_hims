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
export type BloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'
  | 'UNKNOWN';

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

// `unknown`, not `any`: an unparameterised `ApiResponse` should force the caller
// to narrow the payload, not hand them values they will read as typed.
export interface ApiResponse<T = unknown> {
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

// The `*_jsonb` columns are `jsonb NOT NULL DEFAULT '{}'` with no documented
// shape. `unknown` values say that honestly; `any` would promise they are
// readable, which nothing in the database guarantees.
export interface Tenant extends BaseEntity {
  code: string;
  legalName: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  timezone: string;
  defaultLocale: string;
  defaultCurrency: CurrencyCode;
  settings?: Record<string, unknown>;
}

export interface Facility extends ScopedEntity {
  facilityCode: string;
  name: string;
  facilityType: 'HOSPITAL' | 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'SATELLITE';
  hfrId?: string | null;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE';
  address?: Record<string, unknown>;
  contact?: Record<string, unknown>;
}

export interface Department extends ScopedEntity {
  departmentCode: string;
  name: string;
  departmentType:
    'CLINICAL' | 'DIAGNOSTIC' | 'PHARMACY' | 'NURSING' | 'ADMIN' | 'EMERGENCY' | 'ICU' | 'SURGERY';
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
  professionalCategory:
    | 'DOCTOR'
    | 'NURSE'
    | 'PATHOLOGIST'
    | 'RADIOLOGIST'
    | 'PHARMACIST'
    | 'ADMIN'
    | 'RECEPTIONIST'
    | 'BILLING'
    | 'OTHER';
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

/**
 * `hims_patient.patients` as it actually exists.
 *
 * Field names, nullability and the identifier split mirror
 * `doc/supabase_schema.sql`, which is the authority for anything the API
 * contract does not contradict. Two consequences are worth stating because they
 * are easy to get wrong:
 *
 *  - `lastName` and `dateOfBirth` are **nullable**. Registrations routinely
 *    lack one or both and the columns are not `NOT NULL`, so a non-null type
 *    here would make the model lie about what can be stored.
 *  - National ID and ABHA are **not columns on `patients`**. They live in
 *    `hims_patient.patient_identifiers`, which holds a hash plus an encrypted
 *    value rather than the identifier in the clear. See {@link PatientIdentifier}.
 *
 * `displayName` is the NOT NULL column that search and display both key off;
 * the first/middle/last parts are the structured form it is derived from.
 */
export interface Patient extends BaseEntity {
  /** Unique per tenant: `UNIQUE (tenant_id, uhid)`. */
  uhid: string;

  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  displayName: string;

  dateOfBirth?: DateOnlyString | null;
  /** How precisely `dateOfBirth` is known: `DAY`, `MONTH`, `YEAR`, `UNKNOWN`. */
  dobPrecision?: 'DAY' | 'MONTH' | 'YEAR' | 'UNKNOWN' | null;
  /**
   * Sex recorded at birth. Distinct from `genderIdentity`, which is the
   * patient's own statement and can differ.
   */
  sexAtBirth?: Gender | null;
  genderIdentity?: Gender | null;
  maritalStatus?: MaritalStatus | null;

  bloodGroup?: BloodGroup | null;
  primaryMobile?: string | null;
  secondaryMobile?: string | null;
  email?: string | null;

  /** Free-form postal address. NOT NULL in the database, defaults to `{}`. */
  address?: Record<string, unknown>;

  preferredLanguage?: string | null;
  communicationPreference?: 'SMS' | 'EMAIL' | 'PUSH' | 'PHONE' | null;

  status: 'ACTIVE' | 'MERGED' | 'DECEASED' | 'INACTIVE';
  deceasedAt?: ISODateString | null;
  mergedIntoPatientId?: UUID | null;
  /**
   * Master Patient Index state: `MASTER`, `DUPLICATE` or `GOLDEN`. A duplicate
   * must be merged before its record is treated as authoritative.
   */
  masteringStatus: 'MASTER' | 'DUPLICATE' | 'GOLDEN' | 'ERROR';

  allergies?: PatientAllergy[];
  contacts?: PatientContact[];
  identifiers?: PatientIdentifier[];
}

/**
 * A government or national identity document held for a patient.
 *
 * The plaintext identifier is never returned by the API. `valueHash` exists so
 * an exact-match lookup can be answered without decrypting anything, and
 * `identifierType` plus `system` is what tells a caller which document it is.
 */
export interface PatientIdentifier {
  id: UUID;
  identifierType: 'AADHAAR' | 'PAN' | 'PASSPORT' | 'VOTER_ID' | 'ABHA' | 'DL' | 'OTHER';
  system?: string | null;
  isPrimary: boolean;
  verifiedAt?: ISODateString | null;
  validFrom?: DateOnlyString | null;
  validTo?: DateOnlyString | null;
  /**
   * Hex digest of the identifier, scoped per tenant by
   * `ux_patient_identifier_hash`. Safe to return; an exact lookup is
   * hash-then-match rather than a scan over plaintext.
   */
  valueHash?: string | null;
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
export type EncounterStatus =
  | 'PLANNED'
  | 'ARRIVED'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'DISCHARGED'
  | 'COMPLETED'
  | 'CANCELLED';

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
  dischargeDisposition?:
    'HOME' | 'TRANSFERRED' | 'AGAINST_MEDICAL_ADVICE' | 'DECEASED' | 'REFERRED';
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

export type OpdAppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

/**
 * One row of the OPD register for a business date.
 *
 * `departmentName`, `patientUhid`, `patientDisplayName` and `queueToken` are
 * **not** columns on `hims_opd.appointments`. They are joined in by the API so
 * the queue screen can render a row without a second round trip per patient —
 * a queue table that shows a UUID where a name belongs gets ignored by the
 * person running it. They are optional because the underlying columns are
 * nullable or may be absent from a projection.
 */
export interface OpdAppointment extends ScopedEntity {
  appointmentNumber: string;
  patientId: UUID;
  departmentId: UUID;
  practitionerId?: UUID | null;
  scheduledAt: ISODateString;
  scheduledEnd: ISODateString;
  durationMinutes: number;
  status: OpdAppointmentStatus;
  queueToken?: string | null;
  checkedInAt?: ISODateString | null;
  reasonForVisit?: string | null;

  departmentName?: string;
  patientUhid?: string;
  patientDisplayName?: string;
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

export type BedStatus =
  'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE' | 'BLOCKED' | 'ISOLATION';

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

export type LabOrderStatus =
  | 'ORDERED'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'RESULT_ENTERED'
  | 'VERIFIED'
  | 'RELEASED'
  | 'CANCELLED';
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

export type RadiologyStatus =
  'REQUESTED' | 'SCHEDULED' | 'ACQUIRED' | 'INTERPRETING' | 'REPORTED' | 'VERIFIED' | 'AMENDED';

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

export type TriageAcuity =
  | 'ESI_1_RESUSCITATION'
  | 'ESI_2_EMERGENT'
  | 'ESI_3_URGENT'
  | 'ESI_4_LESS_URGENT'
  | 'ESI_5_NON_URGENT';

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
  disposition?:
    'ADMIT_IPD' | 'ADMIT_ICU' | 'TRANSFER_OT' | 'DISCHARGE' | 'REFERRAL' | 'EXPIRED' | 'LAMA';
  dispositionAt?: ISODateString;
}

// =============================================================================
// 11. MODULE 6: OT (OPERATING THEATRE MANAGEMENT)
// =============================================================================

export type OtCaseStatus =
  | 'SCHEDULED'
  | 'PRE_OP'
  | 'IN_THEATRE'
  | 'ANESTHESIA_INDUCED'
  | 'SURGERY_IN_PROGRESS'
  | 'RECOVERY'
  | 'COMPLETED'
  | 'CANCELLED';

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

export type DispenseStatus =
  'PENDING' | 'VERIFIED' | 'PARTIALLY_DISPENSED' | 'DISPENSED' | 'REJECTED';

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

/**
 * One row of `hims_emr.timeline_entries`, the append-only longitudinal index
 * that Patient 360 renders.
 *
 * `eventType`, `sourceDomain` and `sourceTable` are free-text `text NOT NULL`
 * columns in the schema, written by whichever domain module emitted the event
 * (`hims_clinical`, `hims_lab`, `hims_rad`, …). The unions below are the values
 * the platform itself emits; the trailing `string` keeps a new emitter from
 * becoming a type error in the read path, which is where new event sources will
 * appear first.
 *
 * `eventType` is also carried as `title` because the schema has no separate
 * human-readable label — `display_summary` is the clinician-facing text and is
 * surfaced as `summary`.
 */
export interface EmrTimelineItem {
  id: UUID;
  timestamp: ISODateString;
  eventType:
    | 'ENCOUNTER'
    | 'DIAGNOSIS'
    | 'PRESCRIPTION'
    | 'LAB_RESULT'
    | 'RADIOLOGY_REPORT'
    | 'SURGERY'
    | 'VITALS'
    | 'ADMISSION'
    | 'DISCHARGE'
    | (string & {});
  title: string;
  summary: string;
  /** Owning domain, e.g. `hims_lab`. */
  sourceModule:
    'OPD' | 'IPD' | 'LIS' | 'RIS' | 'EMERGENCY' | 'OT' | 'ICU' | 'PHARMACY' | (string & {});
  sourceId: UUID;
  practitionerName?: string;
  departmentName?: string;
  criticalFlag?: boolean;
}

/**
 * A problem list entry from `hims_patient.conditions`.
 *
 * Kept separate from `Encounter`-scoped `diagnoses`: the problem list outlives
 * any single encounter and is what a clinician scans before prescribing.
 */
export interface PatientCondition {
  id: UUID;
  codeSystem?: string | null;
  code?: string | null;
  description: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CHRONIC' | 'INACTIVE';
  onsetDate?: DateOnlyString | null;
  recordedAt: ISODateString;
}

/**
 * The longitudinal view assembled for the Patient 360 screen.
 *
 * Assembled from the owning schemas at read time rather than from
 * `hims_emr.patient_summaries`, which is a projection maintained by the worker
 * and can lag a transaction behind the clinical record.
 */
export interface Patient360Record {
  patient: Patient;
  allergies: PatientAllergy[];
  contacts: PatientContact[];
  conditions: PatientCondition[];
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

export type ClaimStatus =
  | 'DRAFT'
  | 'PRE_AUTH_SUBMITTED'
  | 'PRE_AUTH_APPROVED'
  | 'PRE_AUTH_REJECTED'
  | 'CLAIM_SUBMITTED'
  | 'QUERY_RAISED'
  | 'APPROVED'
  | 'SETTLED'
  | 'REJECTED';

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
// 17. COMMAND CENTER
// =============================================================================

/**
 * The operational dashboard roll-up.
 *
 * Every field is a count or a sum the API computes from the owning table, not a
 * stored snapshot — a cached dashboard that drifts from the record is worse
 * than a slow one, because a hospital operates its surge plan off it.
 *
 * All day-boundary figures (`opd`, `revenue`, `ot.casesScheduledToday`) are
 * resolved in the **facility's** timezone, not the server's. A server running
 * UTC would otherwise report a different "today" than the hospital for seven
 * hours a day, which is exactly when the number is being watched.
 */
export interface CommandCenterMetrics {
  /** When the roll-up was computed. */
  timestamp: ISODateString;
  facilityId: UUID;
  facilityName: string;
  /** IANA zone the day boundaries above were resolved in. */
  timezone: string;

  occupancy: {
    totalBeds: number;
    occupiedBeds: number;
    /** `occupiedBeds / totalBeds` as a percentage, to one decimal. */
    occupancyRate: number;
    icuBedsOccupied: number;
    icuBedsTotal: number;
  };

  opd: {
    registeredToday: number;
    inConsultation: number;
    waitingInQueue: number;
    /** Mean minutes from `scheduled_start` to `consultation_started_at`. */
    avgWaitTimeMinutes: number | null;
  };

  emergency: {
    activePatients: number;
    esi1Resuscitation: number;
    esi2Emergent: number;
    /** Mean minutes from `arrival_at` to `triage_at` for cases seen today. */
    avgTriageTimeMinutes: number | null;
  };

  ot: {
    casesScheduledToday: number;
    casesCompleted: number;
    theatresRunning: number;
    theatresTotal: number;
  };

  diagnostics: {
    pendingLabSamples: number;
    /** Results flagged as critical that no clinician has acknowledged. */
    criticalLabAlerts: number;
    pendingRadiologyReads: number;
  };

  revenue: {
    grossBilledToday: number;
    collectionsToday: number;
    claimsSubmitted: number;
    preAuthPending: number;
  };
}

// =============================================================================
// 18. QUALITY OS, INCIDENTS & ACCREDITATION (NABH / NQAS)
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

// `unknown` by default for the same reason as ApiResponse: a domain event's
// payload shape depends on `eventType`, so an unparameterised envelope must not
// hand the subscriber a value it will read as typed.
export interface DomainEventEnvelope<T = unknown> {
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

/**
 * `facilityId` is deliberately **not** inherited from {@link ScopedEntity}.
 *
 * `ScopedEntity` requires a facility because a bed, an encounter or an invoice
 * belongs to exactly one. An audit event does not: `hims_audit.audit_events.facility_id`
 * is a nullable foreign key, and `logBreakGlass` writes `ctx.facilityId ?? null`
 * because a break-glass can be raised before a facility is known. Typing it as
 * required would force the mapper to invent an identifier, and a fabricated one
 * in an audit trail is worse than an honest gap.
 *
 * `Omit` rather than a redeclared property because TypeScript rejects widening
 * an inherited required member to optional (TS2430).
 */
export interface AuditLogEntry extends Omit<ScopedEntity, 'facilityId'> {
  /** Absent for tenant-scoped events raised before a facility was established. */
  facilityId?: UUID | null;
  actorUserId: UUID;
  actorRole: string;
  action:
    | 'READ'
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'FINALIZE'
    | 'SIGN'
    | 'DISPENSE'
    | 'BREAK_GLASS'
    | 'EXPORT';
  resourceType: string;
  resourceId: UUID;
  patientId?: UUID;
  reason?: string;
  correlationId: string;
  ipAddress?: string;
}

// =============================================================================
// 19. BACKGROUND QUEUE AND JOB CONTRACT
// =============================================================================

/**
 * BullMQ queue names.
 *
 * These strings are the seam between three processes: `apps/worker` produces,
 * `apps/integration-worker` consumes, and `apps/api` produces. They live here
 * rather than in either worker so the two ends cannot drift — a queue name is a
 * bare string, so a typo on the producing side does not fail the build or the
 * type-checker, it fails as a job nobody ever picks up, days later, in
 * production.
 *
 * One queue per development.md §8.2 responsibility. `HIMS_INTEGRATION` is the
 * boundary §8.3 asks for: the worker decides *that* an external call is needed,
 * the integration gateway decides *how* to make it.
 */
export const HIMS_QUEUES = {
  /** Relay of `hims_workflow.outbox_events` into the queues below. */
  OUTBOX: 'hims.outbox',
  NOTIFICATIONS: 'hims.notifications',
  REPORTS: 'hims.reports',
  DOCUMENTS: 'hims.documents',
  EXPORTS: 'hims.exports',
  REMINDERS: 'hims.reminders',
  ANALYTICS: 'hims.analytics',
  /**
   * Maintains the Patient 360 projections in `hims_emr` — `timeline_entries`,
   * `patient_summaries`, `document_index`. These are derived: the owning domain
   * schema stays authoritative and the projection can be rebuilt from it.
   */
  EMR: 'hims.emr',
  AI: 'hims.ai',
  BULK_IMPORT: 'hims.bulk-import',
  INTEGRATION: 'hims.integration',
} as const;

export type HimsQueueName = (typeof HIMS_QUEUES)[keyof typeof HIMS_QUEUES];

/**
 * Job names, per queue.
 *
 * BullMQ routes on `(queue, name)`, so a job name is as much of a contract as
 * the queue name. Kept as one flat union because a worker subscribes to one
 * name and the producer names the other; the pairing is enforced by
 * `HIMS_JOB_NAMES[queue]` rather than by 200 lines of per-queue interfaces.
 */
export const HIMS_JOB_NAMES = {
  [HIMS_QUEUES.OUTBOX]: {
    RELAY: 'outbox.relay',
    SWEEP: 'outbox.sweep',
  },
  [HIMS_QUEUES.NOTIFICATIONS]: {
    DISPATCH: 'notifications.dispatch',
  },
  [HIMS_QUEUES.REPORTS]: {
    GENERATE: 'reports.generate',
  },
  [HIMS_QUEUES.DOCUMENTS]: {
    PROCESS: 'documents.process',
  },
  [HIMS_QUEUES.EXPORTS]: {
    BUILD: 'exports.build',
  },
  [HIMS_QUEUES.REMINDERS]: {
    SCAN: 'reminders.scan',
  },
  [HIMS_QUEUES.ANALYTICS]: {
    INGEST: 'analytics.ingest',
  },
  [HIMS_QUEUES.EMR]: {
    PROJECT: 'emr.project',
  },
  [HIMS_QUEUES.AI]: {
    RUN: 'ai.run',
  },
  [HIMS_QUEUES.BULK_IMPORT]: {
    IMPORT: 'bulk-import.import',
  },
  [HIMS_QUEUES.INTEGRATION]: {
    DELIVER: 'integration.deliver',
  },
} as const satisfies Record<HimsQueueName, Record<string, string>>;

export type HimsQueueJobName<Q extends HimsQueueName> =
  (typeof HIMS_JOB_NAMES)[Q][keyof (typeof HIMS_JOB_NAMES)[Q]];

/**
 * Fields every job carries.
 *
 * `tenantId` is not decoration: the worker re-applies it as the `app.tenant_id`
 * GUC before every statement, so a processor cannot accidentally read another
 * hospital's data even if it forgets a `WHERE` clause. A job with no resolvable
 * `tenantId` is rejected rather than run unscoped.
 *
 * `actorUserId` is for the audit trail only. Per EVENT_CATALOGUE.md §3.8, being
 * handed a job is not a permission — a processor that acts on behalf of a user
 * must re-authorize rather than trust this field.
 */
export interface JobScope {
  tenantId: UUID;
  facilityId?: UUID | null;
  actorUserId?: UUID | null;
  /** Propagated from the originating request so a job's logs join its trace. */
  correlationId: string;
  /**
   * The `event_id` this job was relayed from, when there was one. The
   * recommended consumer idempotency key is `(consumer, eventId)`
   * (EVENT_CATALOGUE.md §20).
   */
  eventId?: UUID;
}

/** One `hims_workflow.outbox_events` row, shaped for a processor. */
export interface OutboxRelayJob extends JobScope {
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: UUID;
  occurredAt: ISODateString;
  payload: Record<string, unknown>;
}

export interface NotificationDispatchJob extends JobScope {
  notificationId: UUID;
  channel: 'SMS' | 'EMAIL' | 'PUSH' | 'WHATSAPP';
}

export interface ReportGenerateJob extends JobScope {
  reportCode: string;
  format: 'PDF' | 'CSV' | 'XLSX';
  /** Report parameters, validated by the processor against a Zod schema. */
  parameters: Record<string, unknown>;
}

export type DocumentOperation =
  'VERIFY_CHECKSUM' | 'MALWARE_SCAN' | 'RENDER_PREVIEW' | 'AMEND_EMR_INDEX';

export interface DocumentProcessJob extends JobScope {
  documentId: UUID;
  versionId?: UUID | null;
  operation: DocumentOperation;
}

export interface ExportBuildJob extends JobScope {
  exportCode: string;
  format: 'CSV' | 'XLSX';
  parameters: Record<string, unknown>;
}

export interface ReminderScanJob extends JobScope {
  /** Reminder family to scan for, e.g. `FOLLOW_UP` or `EXPIRY_RISK`. */
  reminderCode: string;
  /** IANA zone the day boundary is resolved in, per tenant. */
  timezone: string;
  businessDate: DateOnlyString;
}

export interface AnalyticsIngestJob extends JobScope {
  dataset: string;
  from: ISODateString;
  to: ISODateString;
}

/** A non-critical AI task; the gateway still owns model selection. */
export interface AiRunJob extends JobScope {
  requestId: UUID;
  useCase: string;
  patientId?: UUID | null;
  encounterId?: UUID | null;
}

export interface BulkImportJob extends JobScope {
  importBatchId: UUID;
  /** Object key in the document bucket; the payload never travels in the job. */
  objectKey: string;
  format: 'CSV' | 'NDJSON';
}

/**
 * One external call, carried by the integration gateway.
 *
 * `messageRecordId` is the row in `hims_integration.messages`; the payload is a
 * storage reference, never inline, so a job in Redis holds no clinical data.
 */
export interface IntegrationDeliverJob extends JobScope {
  messageRecordId: UUID;
  integrationCode: string;
  messageId: string;
  messageType: string;
  direction: 'OUTBOUND' | 'INBOUND';
  /** 1-based; also written to `hims_integration.message_attempts`. */
  attemptNumber: number;
}

// =============================================================================
// 20. DOMAIN EVENT TYPE CATALOGUE
// =============================================================================

/**
 * Every event name in `doc/EVENT_CATALOGUE.md`, as a compile-time contract.
 *
 * This exists for one reason: an event type that no queue handles must not
 * disappear. The worker's routing table is typed as
 * `Record<HimsEventType, EventRoute>`, so adding an event to the catalogue
 * without giving it a destination is a type error at build time, not a support
 * ticket weeks later.
 *
 * Kept grouped by domain rather than flattened so a reviewer diffing it against
 * the catalogue can do so section by section. Keep the order and the spelling
 * of the catalogue — `labs.result.critical` and `lab.result.critical` are two
 * different events, and only one of them is ever published.
 */
export const HIMS_EVENT_TYPES = {
  /** Catalogue §4. */
  patient: [
    'patient.created',
    'patient.updated',
    'patient.identifier.linked',
    'patient.identifier.verified',
    'patient.merge.requested',
    'patient.merge.approved',
    'patient.merge.completed',
    'patient.consent.granted',
    'patient.consent.withdrawn',
  ],
  /** Catalogue §5. */
  opd: [
    'opd.appointment.created',
    'opd.appointment.confirmed',
    'opd.appointment.checked_in',
    'opd.queue.ticket.created',
    'opd.queue.ticket.called',
    'opd.encounter.started',
    'opd.note.signed',
    'opd.order.created',
    'opd.prescription.issued',
    'opd.encounter.completed',
    'opd.admission.requested',
  ],
  /** Catalogue §6. */
  ipd: [
    'ipd.admission.requested',
    'ipd.admission.approved',
    'ipd.admission.created',
    'ipd.bed.reserved',
    'ipd.bed.assigned',
    'ipd.bed.released',
    'ipd.patient.transferred',
    'ipd.note.signed',
    'ipd.vitals.recorded',
    'ipd.medication.order.created',
    'ipd.medication.order.changed',
    'ipd.mar.entry.recorded',
    'ipd.ot.requested',
    'ipd.icu.transfer.requested',
    'ipd.discharge.summary.finalized',
    'ipd.discharge.completed',
  ],
  /** Catalogue §7. */
  lab: [
    'lab.order.created',
    'lab.specimen.collected',
    'lab.specimen.received',
    'lab.specimen.rejected',
    'lab.result.entered',
    'lab.result.verified',
    'lab.result.critical',
    'lab.result.critical.acknowledged',
    'lab.result.released',
    'lab.result.amended',
    'lab.qc.failed',
  ],
  /** Catalogue §8. */
  radiology: [
    'radiology.order.created',
    'radiology.order.scheduled',
    'radiology.study.started',
    'radiology.study.completed',
    'radiology.report.drafted',
    'radiology.report.verified',
    'radiology.report.released',
    'radiology.report.amended',
    'radiology.pacs.failed',
  ],
  /** Catalogue §9. */
  ed: [
    'ed.encounter.created',
    'ed.triage.completed',
    'ed.resuscitation.started',
    'ed.critical_alert.created',
    'ed.admission.requested',
    'ed.icu.transfer.requested',
    'ed.discharge.completed',
    'ed.transfer.completed',
    'ed.mlc.recorded',
  ],
  /** Catalogue §10. */
  ot: [
    'ot.surgery.requested',
    'ot.surgery.approved',
    'ot.surgery.scheduled',
    'ot.case.checked_in',
    'ot.checklist.stage.completed',
    'ot.time_out.completed',
    'ot.procedure.started',
    'ot.procedure.completed',
    'ot.specimen.created',
    'ot.case.completed',
  ],
  /** Catalogue §11. */
  icu: [
    'icu.transfer.accepted',
    'icu.admission.created',
    'icu.vitals.recorded',
    'icu.device.inserted',
    'icu.device.removed',
    'icu.infusion.started',
    'icu.critical_alert.created',
    'icu.transfer.requested',
    'icu.discharge.completed',
  ],
  /** Catalogue §12. */
  pharmacy: [
    'pharmacy.prescription.received',
    'pharmacy.medication_order.received',
    'pharmacy.prescription.verified',
    'pharmacy.dispensing.started',
    'pharmacy.dispensing.completed',
    'pharmacy.stock.decremented',
    'pharmacy.stock.adjusted',
    'pharmacy.stock.below_threshold',
    'pharmacy.stock.expiry_risk',
    'pharmacy.recall.created',
  ],
  /** Catalogue §12. */
  inventory: [
    'inventory.purchase_order.created',
    'inventory.purchase_order.approved',
    'inventory.goods_received',
    'inventory.stock_transferred',
  ],
  /** Catalogue §13. */
  billing: [
    'billing.charge.created',
    'billing.invoice.created',
    'billing.invoice.finalized',
    'billing.payment.created',
    'billing.payment.completed',
    'billing.payment.reversed',
    'billing.refund.requested',
    'billing.refund.approved',
  ],
  /** Catalogue §13. */
  insurance: [
    'insurance.eligibility.checked',
    'insurance.preauth.created',
    'insurance.preauth.submitted',
    'insurance.preauth.approved',
    'insurance.claim.created',
    'insurance.claim.submitted',
    'insurance.claim.rejected',
    'insurance.claim.resubmitted',
    'insurance.claim.settled',
    'insurance.remittance.received',
    'insurance.remittance.reconciled',
  ],
  /** Catalogue §14. */
  quality: [
    'quality.incident.reported',
    'quality.incident.investigation.completed',
    'quality.capa.created',
    'quality.capa.action.assigned',
    'quality.capa.action.completed',
    'quality.capa.effectiveness.verified',
    'quality.capa.closed',
    'quality.audit.created',
    'quality.audit.finding.created',
    'quality.indicator.calculated',
    'quality.indicator.below_target',
  ],
  /** Catalogue §15. */
  document: [
    'document.created',
    'document.uploaded',
    'document.scan.completed',
    'document.scan.failed',
    'document.version.created',
    'document.signed',
    'document.amended',
  ],
  /** Catalogue §16. */
  workflow: [
    'workflow.started',
    'workflow.task.created',
    'workflow.task.assigned',
    'workflow.task.completed',
    'workflow.task.escalated',
    'workflow.approval.requested',
    'workflow.approval.approved',
    'workflow.approval.rejected',
    'workflow.failed',
    'workflow.completed',
  ],
  /** Catalogue §17. */
  integration: [
    'integration.message.created',
    'integration.message.sent',
    'integration.message.acknowledged',
    'integration.message.failed',
    'integration.message.dead_lettered',
    'integration.message.replayed',
  ],
  /** Catalogue §18. */
  ai: [
    'ai.request.created',
    'ai.output.generated',
    'ai.output.flagged',
    'ai.output.accepted',
    'ai.output.rejected',
    'ai.document.drafted',
    'ai.document.finalized',
  ],
} as const;

export type HimsEventType = (typeof HIMS_EVENT_TYPES)[keyof typeof HIMS_EVENT_TYPES][number];

/**
 * Every catalogue event name, flattened once at module load.
 *
 * A `Set` rather than an array `includes`: the relay calls this for every event
 * it claims, and an array is a linear scan across 160 strings per event.
 */
const ALL_EVENT_TYPES: ReadonlySet<string> = new Set(Object.values(HIMS_EVENT_TYPES).flat());

/**
 * Narrow an arbitrary string to a catalogue event type.
 *
 * The relay receives `event_type` as a bare `text` column — the database does
 * not constrain it — so this is the check that decides whether the event is
 * routable or has to be dead-lettered.
 */
export function isHimsEventType(value: string): value is HimsEventType {
  return ALL_EVENT_TYPES.has(value);
}
