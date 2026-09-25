import {
  HIMS_JOB_NAMES,
  HIMS_QUEUES,
  isHimsEventType,
  type HimsEventType,
} from '@hims/domain-types';

/**
 * Where one domain event goes, and how urgently.
 *
 * `queue` and `job` are separate because a queue is a deployment boundary
 * (a consumer lives in a process) while a job name is a behavioural contract
 * (a consumer's `process()` branches on it). Collapsing them would make
 * "add a new kind of work to the notifications queue" look like a queue rename.
 */
export interface EventRoute {
  queue: string;
  job: string;
  /**
   * Expedited jobs skip the shared exponential backoff and start on the first
   * attempt. Reserved for events where a clinician is waiting — a critical lab
   * result, a code-style ICU alert, a rejected claim. Everything else uses the
   * default policy, because a queue where everything is urgent is a queue where
   * nothing is.
   */
  expedite: boolean;
}

const Q = HIMS_QUEUES;

/**
 * The complete routing table.
 *
 * Typed as `Record<HimsEventType, EventRoute>`, not a partial map. That is the
 * entire point of the file: adding an event to `HIMS_EVENT_TYPES` in
 * `@hims/domain-types` without giving it a destination here fails the build,
 * rather than producing an event that is relayed, finds no consumer, and is
 * quietly lost.
 *
 * The trade-offs worth knowing when editing:
 *
 *  * An event can be routed to a queue that does not exist yet. That is
 *    deliberate — a domain can start publishing before the processor is built,
 *    and the job waits in the queue rather than vanishing.
 *  * `*.critical` and `*.rejected` routes are expedited because a human is
 *    blocked behind them. Everything else is not, even when it looks urgent.
 *  * Financial and clinical state changes additionally project into
 *    `hims.emr`, but only as their *own* event: two queues for one event would
 *    need a fan-out the outbox table cannot express, and the projection is
 *    rebuilt from the owning schema anyway.
 */
export const EVENT_ROUTES: Record<HimsEventType, EventRoute> = {
  // --- Patient 360 ---------------------------------------------------------
  'patient.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'patient.updated': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'patient.identifier.linked': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'patient.identifier.verified': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'patient.merge.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'patient.merge.approved': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  // The master record changes identity, so every projection of the patient has
  // to be re-pointed before the merged-away record can be treated as read-only.
  'patient.merge.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'patient.consent.granted': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'patient.consent.withdrawn': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },

  // --- OPD -----------------------------------------------------------------
  'opd.appointment.created': { queue: Q.REMINDERS, job: HIMS_JOB_NAMES[Q.REMINDERS].SCAN, expedite: false },
  'opd.appointment.confirmed': { queue: Q.REMINDERS, job: HIMS_JOB_NAMES[Q.REMINDERS].SCAN, expedite: false },
  'opd.appointment.checked_in': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'opd.queue.ticket.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'opd.queue.ticket.called': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'opd.encounter.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'opd.note.signed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'opd.order.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'opd.prescription.issued': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'opd.encounter.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'opd.admission.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },

  // --- IPD -----------------------------------------------------------------
  'ipd.admission.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.admission.approved': { queue: Q.REMINDERS, job: HIMS_JOB_NAMES[Q.REMINDERS].SCAN, expedite: false },
  'ipd.admission.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.bed.reserved': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'ipd.bed.assigned': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'ipd.bed.released': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'ipd.patient.transferred': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'ipd.note.signed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.vitals.recorded': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.medication.order.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.medication.order.changed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.mar.entry.recorded': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.ot.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ipd.icu.transfer.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  // Finalising a discharge summary is the moment the report becomes renderable.
  'ipd.discharge.summary.finalized': { queue: Q.REPORTS, job: HIMS_JOB_NAMES[Q.REPORTS].GENERATE, expedite: false },
  'ipd.discharge.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },

  // --- LIS -----------------------------------------------------------------
  'lab.order.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'lab.specimen.collected': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'lab.specimen.received': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'lab.specimen.rejected': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'lab.result.entered': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'lab.result.verified': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  // A critical result nobody has been told about is the classic patient-safety
  // failure. It is the one clinical event that gets an expedited job.
  'lab.result.critical': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'lab.result.critical.acknowledged': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'lab.result.released': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'lab.result.amended': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'lab.qc.failed': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },

  // --- RIS -----------------------------------------------------------------
  'radiology.order.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'radiology.order.scheduled': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'radiology.study.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'radiology.study.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'radiology.report.drafted': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'radiology.report.verified': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'radiology.report.released': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'radiology.report.amended': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'radiology.pacs.failed': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },

  // --- Emergency -----------------------------------------------------------
  'ed.encounter.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ed.triage.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ed.resuscitation.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'ed.critical_alert.created': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'ed.admission.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ed.icu.transfer.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'ed.discharge.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ed.transfer.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  // Medico-legal cases are reportable; the notification is the report.
  'ed.mlc.recorded': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },

  // --- OT ------------------------------------------------------------------
  'ot.surgery.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.surgery.approved': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.surgery.scheduled': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.case.checked_in': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.checklist.stage.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.time_out.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.procedure.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.procedure.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.specimen.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ot.case.completed': { queue: Q.REPORTS, job: HIMS_JOB_NAMES[Q.REPORTS].GENERATE, expedite: false },

  // --- ICU -----------------------------------------------------------------
  'icu.transfer.accepted': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'icu.admission.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'icu.vitals.recorded': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'icu.device.inserted': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'icu.device.removed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'icu.infusion.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'icu.critical_alert.created': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'icu.transfer.requested': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'icu.discharge.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },

  // --- Pharmacy and inventory ---------------------------------------------
  'pharmacy.prescription.received': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'pharmacy.medication_order.received': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'pharmacy.prescription.verified': { queue: Q.REMINDERS, job: HIMS_JOB_NAMES[Q.REMINDERS].SCAN, expedite: false },
  'pharmacy.dispensing.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'pharmacy.dispensing.completed': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'pharmacy.stock.decremented': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'pharmacy.stock.adjusted': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'pharmacy.stock.below_threshold': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'pharmacy.stock.expiry_risk': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'pharmacy.recall.created': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'inventory.purchase_order.created': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'inventory.purchase_order.approved': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'inventory.goods_received': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'inventory.stock_transferred': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },

  // --- Billing and insurance ------------------------------------------------
  'billing.charge.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'billing.invoice.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'billing.invoice.finalized': { queue: Q.REPORTS, job: HIMS_JOB_NAMES[Q.REPORTS].GENERATE, expedite: false },
  // Every payment is an external call to a gateway, so it leaves for the
  // integration worker rather than being settled inline.
  'billing.payment.created': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: true },
  'billing.payment.completed': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'billing.payment.reversed': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: true },
  'billing.refund.requested': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'billing.refund.approved': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: true },
  'insurance.eligibility.checked': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'insurance.preauth.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'insurance.preauth.submitted': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: false },
  'insurance.preauth.approved': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'insurance.claim.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'insurance.claim.submitted': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: false },
  'insurance.claim.rejected': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'insurance.claim.resubmitted': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: false },
  'insurance.claim.settled': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'insurance.remittance.received': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'insurance.remittance.reconciled': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },

  // --- Quality -------------------------------------------------------------
  'quality.incident.reported': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.incident.investigation.completed': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.capa.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.capa.action.assigned': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.capa.action.completed': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.capa.effectiveness.verified': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.capa.closed': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.audit.created': { queue: Q.REPORTS, job: HIMS_JOB_NAMES[Q.REPORTS].GENERATE, expedite: false },
  'quality.audit.finding.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.indicator.calculated': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'quality.indicator.below_target': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },

  // --- Documents -----------------------------------------------------------
  'document.created': { queue: Q.DOCUMENTS, job: HIMS_JOB_NAMES[Q.DOCUMENTS].PROCESS, expedite: false },
  'document.uploaded': { queue: Q.DOCUMENTS, job: HIMS_JOB_NAMES[Q.DOCUMENTS].PROCESS, expedite: false },
  'document.scan.completed': { queue: Q.DOCUMENTS, job: HIMS_JOB_NAMES[Q.DOCUMENTS].PROCESS, expedite: false },
  'document.scan.failed': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'document.version.created': { queue: Q.DOCUMENTS, job: HIMS_JOB_NAMES[Q.DOCUMENTS].PROCESS, expedite: false },
  'document.signed': { queue: Q.DOCUMENTS, job: HIMS_JOB_NAMES[Q.DOCUMENTS].PROCESS, expedite: false },
  'document.amended': { queue: Q.DOCUMENTS, job: HIMS_JOB_NAMES[Q.DOCUMENTS].PROCESS, expedite: false },

  // --- Workflow ------------------------------------------------------------
  'workflow.started': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'workflow.task.created': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'workflow.task.assigned': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
  'workflow.task.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'workflow.task.escalated': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'workflow.approval.requested': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'workflow.approval.approved': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'workflow.approval.rejected': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'workflow.failed': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'workflow.completed': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },

  // --- Integration ---------------------------------------------------------
  // The §8.3 boundary: this worker decides *that* an external call is needed,
  // and `apps/integration-worker` decides how to make it.
  'integration.message.created': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: true },
  'integration.message.sent': { queue: Q.ANALYTICS, job: HIMS_JOB_NAMES[Q.ANALYTICS].INGEST, expedite: false },
  'integration.message.acknowledged': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'integration.message.failed': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: true },
  'integration.message.dead_lettered': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'integration.message.replayed': { queue: Q.INTEGRATION, job: HIMS_JOB_NAMES[Q.INTEGRATION].DELIVER, expedite: true },

  // --- AI ------------------------------------------------------------------
  'ai.request.created': { queue: Q.AI, job: HIMS_JOB_NAMES[Q.AI].RUN, expedite: false },
  'ai.output.generated': { queue: Q.AI, job: HIMS_JOB_NAMES[Q.AI].RUN, expedite: false },
  // A safety flag is the AI gateway asking a human to look. It is never
  // auto-cleared, so it is expedited.
  'ai.output.flagged': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: true },
  'ai.output.accepted': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: false },
  'ai.output.rejected': { queue: Q.EMR, job: HIMS_JOB_NAMES[Q.EMR].PROJECT, expedite: true },
  'ai.document.drafted': { queue: Q.AI, job: HIMS_JOB_NAMES[Q.AI].RUN, expedite: false },
  'ai.document.finalized': { queue: Q.NOTIFICATIONS, job: HIMS_JOB_NAMES[Q.NOTIFICATIONS].DISPATCH, expedite: false },
};

/**
 * Resolve an event type to a route.
 *
 * Returns `null` for anything not in the catalogue, which the relay treats as a
 * failure rather than a silent drop: an event nobody can place is either a
 * typo in a publisher or a rollout that added an event without a route, and
 * both need to be visible in `hims_workflow.outbox_events.last_error` rather
 * than vanish into a queue nobody reads.
 */
export function routeEvent(eventType: string): EventRoute | null {
  return isHimsEventType(eventType)
    ? EVENT_ROUTES[eventType]
    : null;
}
