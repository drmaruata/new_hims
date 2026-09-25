# HIMS Domain Event Catalogue

**Status:** Engineering baseline  
**Version:** 1.0  
**Date:** 2026-09-25

## 1. Purpose

The HIMS uses domain events for reliable cross-module propagation while keeping transactional ownership inside each domain. Events are published using the transactional outbox pattern.

The event bus is not the database of record. Consumers must be able to rebuild their projections from authoritative data.

## 2. Envelope

```json
{
  "eventId": "uuid",
  "eventType": "opd.prescription.issued",
  "eventVersion": 1,
  "occurredAt": "2026-09-25T11:00:00Z",
  "tenantId": "uuid",
  "facilityId": "uuid",
  "actorUserId": "uuid|null",
  "aggregateType": "prescription",
  "aggregateId": "uuid",
  "correlationId": "uuid",
  "causationId": "uuid|null",
  "source": "hims.api",
  "dataClassification": "SENSITIVE",
  "data": {}
}
```

## 3. Delivery rules

1. Domain transaction and outbox insert commit together.
2. Outbox worker publishes after commit.
3. Publishing is retryable.
4. Consumers are idempotent.
5. Failed messages enter a dead-letter workflow.
6. Replayed messages must not duplicate financial/clinical effects.
7. Sensitive payloads should contain identifiers/references, not large clinical documents.
8. A consumer must re-authorize any user-triggered data access; event receipt is not a user permission.

## 4. Identity/patient events

`patient.created`  
`patient.updated`  
`patient.identifier.linked`  
`patient.identifier.verified`  
`patient.merge.requested`  
`patient.merge.approved`  
`patient.merge.completed`  
`patient.consent.granted`  
`patient.consent.withdrawn`

## 5. OPD events

`opd.appointment.created`  
`opd.appointment.confirmed`  
`opd.appointment.checked_in`  
`opd.queue.ticket.created`  
`opd.queue.ticket.called`  
`opd.encounter.started`  
`opd.note.signed`  
`opd.order.created`  
`opd.prescription.issued`  
`opd.encounter.completed`  
`opd.admission.requested`

## 6. IPD events

`ipd.admission.requested`  
`ipd.admission.approved`  
`ipd.admission.created`  
`ipd.bed.reserved`  
`ipd.bed.assigned`  
`ipd.bed.released`  
`ipd.patient.transferred`  
`ipd.note.signed`  
`ipd.vitals.recorded`  
`ipd.medication.order.created`  
`ipd.medication.order.changed`  
`ipd.mar.entry.recorded`  
`ipd.ot.requested`  
`ipd.icu.transfer.requested`  
`ipd.discharge.summary.finalized`  
`ipd.discharge.completed`

## 7. LIS events

`lab.order.created`  
`lab.specimen.collected`  
`lab.specimen.received`  
`lab.specimen.rejected`  
`lab.result.entered`  
`lab.result.verified`  
`lab.result.critical`  
`lab.result.critical.acknowledged`  
`lab.result.released`  
`lab.result.amended`  
`lab.qc.failed`

## 8. RIS events

`radiology.order.created`  
`radiology.order.scheduled`  
`radiology.study.started`  
`radiology.study.completed`  
`radiology.report.drafted`  
`radiology.report.verified`  
`radiology.report.released`  
`radiology.report.amended`  
`radiology.pacs.failed`

## 9. Emergency events

`ed.encounter.created`  
`ed.triage.completed`  
`ed.resuscitation.started`  
`ed.critical_alert.created`  
`ed.admission.requested`  
`ed.icu.transfer.requested`  
`ed.discharge.completed`  
`ed.transfer.completed`  
`ed.mlc.recorded`

## 10. OT events

`ot.surgery.requested`  
`ot.surgery.approved`  
`ot.surgery.scheduled`  
`ot.case.checked_in`  
`ot.checklist.stage.completed`  
`ot.time_out.completed`  
`ot.procedure.started`  
`ot.procedure.completed`  
`ot.specimen.created`  
`ot.case.completed`

## 11. ICU events

`icu.transfer.accepted`  
`icu.admission.created`  
`icu.vitals.recorded`  
`icu.device.inserted`  
`icu.device.removed`  
`icu.infusion.started`  
`icu.critical_alert.created`  
`icu.transfer.requested`  
`icu.discharge.completed`

## 12. Pharmacy/inventory events

`pharmacy.prescription.received`  
`pharmacy.medication_order.received`  
`pharmacy.prescription.verified`  
`pharmacy.dispensing.started`  
`pharmacy.dispensing.completed`  
`pharmacy.stock.decremented`  
`pharmacy.stock.adjusted`  
`pharmacy.stock.below_threshold`  
`pharmacy.stock.expiry_risk`  
`pharmacy.recall.created`

`inventory.purchase_order.created`  
`inventory.purchase_order.approved`  
`inventory.goods_received`  
`inventory.stock_transferred`

## 13. Billing/insurance events

`billing.charge.created`  
`billing.invoice.created`  
`billing.invoice.finalized`  
`billing.payment.created`  
`billing.payment.completed`  
`billing.payment.reversed`  
`billing.refund.requested`  
`billing.refund.approved`  
`insurance.eligibility.checked`  
`insurance.preauth.created`  
`insurance.preauth.submitted`  
`insurance.preauth.approved`  
`insurance.claim.created`  
`insurance.claim.submitted`  
`insurance.claim.rejected`  
`insurance.claim.resubmitted`  
`insurance.claim.settled`  
`insurance.remittance.received`  
`insurance.remittance.reconciled`

## 14. Quality events

`quality.incident.reported`  
`quality.incident.investigation.completed`  
`quality.capa.created`  
`quality.capa.action.assigned`  
`quality.capa.action.completed`  
`quality.capa.effectiveness.verified`  
`quality.capa.closed`  
`quality.audit.created`  
`quality.audit.finding.created`  
`quality.indicator.calculated`  
`quality.indicator.below_target`

## 15. Document events

`document.created`  
`document.uploaded`  
`document.scan.completed`  
`document.scan.failed`  
`document.version.created`  
`document.signed`  
`document.amended`

## 16. Workflow events

`workflow.started`  
`workflow.task.created`  
`workflow.task.assigned`  
`workflow.task.completed`  
`workflow.task.escalated`  
`workflow.approval.requested`  
`workflow.approval.approved`  
`workflow.approval.rejected`  
`workflow.failed`  
`workflow.completed`

## 17. Integration events

`integration.message.created`  
`integration.message.sent`  
`integration.message.acknowledged`  
`integration.message.failed`  
`integration.message.dead_lettered`  
`integration.message.replayed`

## 18. AI events

`ai.request.created`  
`ai.output.generated`  
`ai.output.flagged`  
`ai.output.accepted`  
`ai.output.rejected`  
`ai.document.drafted`  
`ai.document.finalized`

## 19. Cross-module flows

### 19.1 OPD prescription to pharmacy

```text
opd.prescription.issued
  -> pharmacy.prescription.received
  -> pharmacy.prescription.verified
  -> pharmacy.dispensing.completed
  -> pharmacy.stock.decremented
  -> billing.charge.created (when applicable)
  -> EMR projection update
```

### 19.2 IPD medication order to pharmacy/MAR

```text
ipd.medication.order.created
  -> pharmacy.medication_order.received
  -> pharmacy.dispensing.completed (if pharmacy-dispensed)
  -> ipd.mar.entry.recorded (when administration occurs)
  -> EMR projection update
```

### 19.3 IPD to ICU

```text
ipd.icu.transfer.requested
  -> icu.transfer.accepted
  -> icu.admission.created
  -> ipd.patient.transferred
  -> EMR projection update
```

### 19.4 IPD to OT

```text
ipd.ot.requested
  -> ot.surgery.requested
  -> ot.surgery.scheduled
  -> ot.time_out.completed
  -> ot.procedure.completed
  -> document/procedure events
  -> EMR projection update
```

### 19.5 Lab critical-result flow

```text
lab.result.critical
  -> notification
  -> acknowledgement
  -> escalation if overdue
  -> quality/clinical audit trail
```

## 20. Consumer idempotency

Recommended inbox key: `(consumer_name, event_id)`.

For high-risk side effects also store a domain-specific idempotency key, such as:

- `dispensing_id`
- `payment_id`
- `claim_submission_id`
- `workflow_instance_id`

## 21. Event retention

Keep the outbox until successful publication and reconciliation. Retain published event history according to operational/audit requirements. High-volume operational events may be partitioned by occurred date.

## 22. Versioning

A breaking schema change creates a new event version. During migration, producers may publish both versions if required.
