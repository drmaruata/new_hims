import { z } from 'zod';

export const GenderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);
export const BloodGroupSchema = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
]);

export const RegisterPatientDtoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  gender: GenderSchema,
  bloodGroup: BloodGroupSchema.optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile number is required'),
  email: z.email().optional().nullable(),
  nationalIdType: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'ABHA', 'OTHER']).optional(),
  nationalIdNumber: z.string().optional().nullable(),
  abhaAddress: z.string().optional().nullable(),
  abhaNumber: z.string().optional().nullable(),
  isVip: z.boolean().default(false),
  isMlc: z.boolean().default(false),
  facilityId: z.string().uuid(),
  initialDepartmentId: z.string().uuid().optional(),
});

export type RegisterPatientDto = z.infer<typeof RegisterPatientDtoSchema>;

export const CreateOpdAppointmentDtoSchema = z.object({
  patientId: z.string().uuid(),
  departmentId: z.string().uuid(),
  practitionerId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(15),
  reasonForVisit: z.string().max(500).optional(),
});

export type CreateOpdAppointmentDto = z.infer<typeof CreateOpdAppointmentDtoSchema>;

export const PrescriptionItemDtoSchema = z.object({
  drugId: z.string().uuid(),
  drugName: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  route: z.enum(['ORAL', 'IV', 'IM', 'SC', 'TOPICAL', 'INHALATION']),
  durationDays: z.number().int().positive(),
  instructions: z.string().optional(),
  isHighAlert: z.boolean().default(false),
});

export const CreatePrescriptionDtoSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  items: z.array(PrescriptionItemDtoSchema).min(1, 'At least one prescription item is required'),
  diagnosisText: z.string().optional(),
  clinicalNotes: z.string().optional(),
});

export type CreatePrescriptionDto = z.infer<typeof CreatePrescriptionDtoSchema>;

export const RecordVitalsDtoSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  temperatureCelsius: z.number().min(30).max(45).optional(),
  pulseBpm: z.number().int().min(20).max(300).optional(),
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  respiratoryRate: z.number().int().min(5).max(100).optional(),
  oxygenSaturationSpO2: z.number().int().min(40).max(100).optional(),
  gcsScore: z.number().int().min(3).max(15).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
});

export type RecordVitalsDto = z.infer<typeof RecordVitalsDtoSchema>;

export const CreateIpdAdmissionDtoSchema = z.object({
  patientId: z.string().uuid(),
  departmentId: z.string().uuid(),
  wardId: z.string().uuid(),
  assignedBedId: z.string().uuid(),
  admittingDoctorId: z.string().uuid(),
  admissionReason: z.string().min(3),
});

export type CreateIpdAdmissionDto = z.infer<typeof CreateIpdAdmissionDtoSchema>;

export const CreateLabOrderDtoSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  testCodes: z.array(z.string()).min(1, 'Select at least one test'),
  clinicalNotes: z.string().optional(),
});

export type CreateLabOrderDto = z.infer<typeof CreateLabOrderDtoSchema>;

export const CreateRadiologyOrderDtoSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  modality: z.enum(['XRAY', 'CT', 'MRI', 'ULTRASOUND', 'MAMMOGRAPHY', 'PET_CT']),
  bodyPart: z.string().min(1),
  clinicalIndication: z.string().min(3),
});

export type CreateRadiologyOrderDto = z.infer<typeof CreateRadiologyOrderDtoSchema>;

export const TriageEmergencyDtoSchema = z.object({
  patientId: z.string().uuid(),
  arrivalMode: z.enum(['WALK_IN', 'AMBULANCE', 'POLICE', 'TRANSFER']),
  triageAcuity: z.enum([
    'ESI_1_RESUSCITATION',
    'ESI_2_EMERGENT',
    'ESI_3_URGENT',
    'ESI_4_LESS_URGENT',
    'ESI_5_NON_URGENT',
  ]),
  isMlc: z.boolean().default(false),
  mlcNumber: z.string().optional(),
  chiefComplaint: z.string().min(1),
});

export type TriageEmergencyDto = z.infer<typeof TriageEmergencyDtoSchema>;

export const CreateSurgeryCaseDtoSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  otRoomId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  leadSurgeonId: z.string().uuid(),
  anaesthetistId: z.string().uuid(),
  procedureName: z.string().min(2),
  preOpDiagnosis: z.string().optional(),
});

export type CreateSurgeryCaseDto = z.infer<typeof CreateSurgeryCaseDtoSchema>;

export const BreakGlassDtoSchema = z.object({
  patientId: z.string().uuid(),
  reason: z
    .string()
    .min(
      10,
      'A valid clinical justification of at least 10 characters is required for break-glass emergency access'
    ),
});

export type BreakGlassDto = z.infer<typeof BreakGlassDtoSchema>;
