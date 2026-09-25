import { StateMachine } from '../../core/state-machine/state-machine.js';

/**
 * State graphs declared in SRS Appendix B. These are the single source of truth
 * for legal transitions; the API rejects anything else with 409.
 *
 * Terminal states are omitted from every `from` list, so an attempt to act on a
 * closed encounter is rejected without needing a special case.
 */

export const ENCOUNTER_STATES = [
  'OPEN',
  'IN_PROGRESS',
  'SIGNED',
  'CLOSED',
] as const;
export type EncounterState = (typeof ENCOUNTER_STATES)[number];

export const encounterMachine = new StateMachine<EncounterState, string>(
  'encounter',
  [
    { event: 'start', from: ['OPEN'], to: 'IN_PROGRESS' },
    { event: 'sign', from: ['IN_PROGRESS'], to: 'SIGNED' },
    { event: 'close', from: ['SIGNED'], to: 'CLOSED' },
  ],
);

export const APPOINTMENT_STATES = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_QUEUE',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentState = (typeof APPOINTMENT_STATES)[number];

export const appointmentMachine = new StateMachine<AppointmentState, string>(
  'appointment',
  [
    { event: 'confirm', from: ['SCHEDULED'], to: 'CONFIRMED' },
    { event: 'checkIn', from: ['CONFIRMED', 'SCHEDULED'], to: 'CHECKED_IN' },
    { event: 'queue', from: ['CHECKED_IN'], to: 'IN_QUEUE' },
    { event: 'startConsultation', from: ['IN_QUEUE'], to: 'IN_CONSULTATION' },
    { event: 'complete', from: ['IN_CONSULTATION'], to: 'COMPLETED' },
    { event: 'cancel', from: ['SCHEDULED', 'CONFIRMED'], to: 'CANCELLED' },
    { event: 'noShow', from: ['SCHEDULED', 'CONFIRMED'], to: 'NO_SHOW' },
  ],
);

export const LAB_SPECIMEN_STATES = [
  'ORDERED',
  'COLLECTED',
  'RECEIVED',
  'PROCESSING',
  'COMPLETED',
] as const;
export type LabSpecimenState = (typeof LAB_SPECIMEN_STATES)[number];

export const labSpecimenMachine = new StateMachine<LabSpecimenState, string>(
  'lab specimen',
  [
    { event: 'collect', from: ['ORDERED'], to: 'COLLECTED' },
    { event: 'receive', from: ['COLLECTED'], to: 'RECEIVED' },
    { event: 'process', from: ['RECEIVED'], to: 'PROCESSING' },
    { event: 'complete', from: ['PROCESSING'], to: 'COMPLETED' },
  ],
);

export const CLAIM_STATES = [
  'DRAFT',
  'READY',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'RESUBMITTED',
  'SETTLED',
] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

export const claimMachine = new StateMachine<ClaimState, string>('claim', [
  { event: 'ready', from: ['DRAFT'], to: 'READY' },
  { event: 'submit', from: ['READY', 'RESUBMITTED'], to: 'SUBMITTED' },
  { event: 'acknowledge', from: ['SUBMITTED'], to: 'ACKNOWLEDGED' },
  {
    event: 'approve',
    from: ['ACKNOWLEDGED'],
    to: 'APPROVED',
  },
  {
    event: 'partiallyApprove',
    from: ['ACKNOWLEDGED'],
    to: 'PARTIALLY_APPROVED',
  },
  { event: 'reject', from: ['ACKNOWLEDGED'], to: 'REJECTED' },
  { event: 'resubmit', from: ['REJECTED', 'PARTIALLY_APPROVED'], to: 'RESUBMITTED' },
  { event: 'settle', from: ['APPROVED', 'PARTIALLY_APPROVED'], to: 'SETTLED' },
]);

export const CAPA_STATES = [
  'OPEN',
  'INVESTIGATION',
  'ACTION_ASSIGNED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'CLOSED',
] as const;
export type CapaState = (typeof CAPA_STATES)[number];

export const capaMachine = new StateMachine<CapaState, string>('CAPA', [
  { event: 'investigate', from: ['OPEN'], to: 'INVESTIGATION' },
  { event: 'assignAction', from: ['INVESTIGATION'], to: 'ACTION_ASSIGNED' },
  { event: 'start', from: ['ACTION_ASSIGNED'], to: 'IN_PROGRESS' },
  { event: 'submitForVerification', from: ['IN_PROGRESS'], to: 'PENDING_VERIFICATION' },
  { event: 'close', from: ['PENDING_VERIFICATION'], to: 'CLOSED' },
]);
