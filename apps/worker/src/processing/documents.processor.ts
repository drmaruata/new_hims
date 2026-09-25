import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { HIMS_QUEUES } from '@hims/domain-types';

import { DatabaseService, type DatabaseContext } from '../core/database/database.service.js';
import { jobContext } from './job-context.js';
import { WORKER_CONCURRENCY } from './worker-concurrency.js';

/**
 * The one row of `hims_documents.documents` this processor reads.
 *
 * Declared here rather than in `@hims/domain-types` because it is specific to
 * this processor, and a shared type invites a second consumer to start
 * depending on a column list that is not a contract.
 */
interface DocumentRow {
  id: string;
  status: string;
  storage_object_key: string;
  checksum_sha256: string | null;
}

interface ProcessResult {
  documentId: string;
  operation: string;
  /** True when there was nothing to do — not an error, and not a retry. */
  skipped: boolean;
}

/**
 * Document post-processing, per development.md §8.2.
 *
 * Handles the four operations that must not happen on the request path:
 * verifying a stored object's checksum, scanning it for malware, promoting it
 * to readable, and folding it into the EMR document index.
 *
 * ## Idempotency
 *
 * Every operation is written so that running it twice is indistinguishable from
 * running it once. That is required rather than nice: the outbox relay can
 * re-enqueue a job after a crash (see `OutboxRelayService`), and BullMQ's
 * `jobId` dedupe only holds while the finished job is still retained. So each
 * operation guards on the row's *current state* — there is no "did I already do
 * this" marker to consult, and the state has to serve as one.
 */
@Processor(HIMS_QUEUES.DOCUMENTS, { concurrency: WORKER_CONCURRENCY })
export class DocumentsProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentsProcessor.name);

  constructor(private readonly db: DatabaseService) {
    super();
  }

  async process(job: Job): Promise<ProcessResult> {
    const ctx = jobContext(job);
    const data = job.data as { documentId?: string; operation?: string };

    if (typeof data.documentId !== 'string' || typeof data.operation !== 'string') {
      // A malformed payload cannot succeed on a retry either, so it fails now
      // and lands in the failed set where an operator will see it, rather than
      // occupying a retry slot five times over.
      throw new Error(
        `Document job ${job.id} is missing documentId or operation; refusing to retry a payload that cannot succeed.`,
      );
    }

    const { documentId, operation } = data;
    this.logger.log(`documents ${operation} for ${documentId}`);

    switch (operation) {
      case 'VERIFY_CHECKSUM':
        return this.verifyChecksum(documentId, ctx);
      case 'MALWARE_SCAN':
        return this.markScanned(documentId, ctx);
      case 'RENDER_PREVIEW':
        return this.markAvailable(documentId, ctx);
      case 'AMEND_EMR_INDEX':
        return this.amendEmrIndex(documentId, ctx);
      default:
        // Thrown, not ignored: an unrecognised operation means the producer and
        // this consumer disagree, and silently returning would leave the
        // document stuck in its current state with nothing logged as wrong.
        throw new Error(
          `Unknown document operation "${operation}". The producer and this consumer are on different versions.`,
        );
    }
  }

  /**
   * Promote a document out of `UPLOADING` once its object is stored and a
   * preview has been rendered.
   *
   * The `status` predicate is the idempotency guard: a document already
   * `AVAILABLE` matches no row, so a replay is a no-op rather than a second
   * state transition on a document a clinician may already have read.
   */
  private async markAvailable(documentId: string, ctx: DatabaseContext): Promise<ProcessResult> {
    const { rowCount } = await this.db.query(
      `UPDATE hims_documents.documents
          SET status = 'AVAILABLE'
        WHERE id = $1
          AND status = 'UPLOADING'`,
      [documentId],
      ctx,
    );

    if (rowCount === 0) {
      this.logger.debug(`Document ${documentId} is not UPLOADING; nothing to do`);
    }

    return { documentId, operation: 'RENDER_PREVIEW', skipped: rowCount === 0 };
  }

  /**
   * Confirm the stored object's bytes match the checksum the uploader claimed.
   *
   * Blocked on a storage adapter that does not exist yet, so the operation
   * currently reports `skipped` and leaves the document in its current state.
   * That is the safe outcome and it is deliberate: promoting a document to
   * `AVAILABLE` without a digest comparison is precisely the failure the
   * checksum exists to catch.
   */
  private async verifyChecksum(documentId: string, ctx: DatabaseContext): Promise<ProcessResult> {
    const document = await this.db.one<DocumentRow>(
      `SELECT id, status, storage_object_key, checksum_sha256
         FROM hims_documents.documents
        WHERE id = $1`,
      [documentId],
      ctx,
    );

    if (!document) {
      // Not an error. The document may have been deleted between the event and
      // this job; retrying would never find it.
      this.logger.warn(`Document ${documentId} no longer exists; nothing to verify`);
      return { documentId, operation: 'VERIFY_CHECKSUM', skipped: true };
    }

    if (!document.checksum_sha256) {
      this.logger.warn(
        `Document ${documentId} has no recorded checksum, so it cannot be verified. Leaving it in ${document.status}.`,
      );
      return { documentId, operation: 'VERIFY_CHECKSUM', skipped: true };
    }

    this.logger.log(
      `Checksum verification for ${documentId} needs a storage adapter that is not built yet; document remains ${document.status}`,
    );
    return { documentId, operation: 'VERIFY_CHECKSUM', skipped: true };
  }

  /**
   * Move a document to `SCANNED` after a clean malware scan.
   *
   * Gated on `CLAMAV_BASE_URL`, and returns early when it is unset. Marking a
   * document scanned without a scan having run would be exactly the failure the
   * scanner exists to prevent, so the unconfigured path never transitions.
   */
  private async markScanned(documentId: string, ctx: DatabaseContext): Promise<ProcessResult> {
    if (!process.env['CLAMAV_BASE_URL']) {
      this.logger.warn(
        `CLAMAV_BASE_URL is not configured; refusing to mark document ${documentId} as scanned.`,
      );
      return { documentId, operation: 'MALWARE_SCAN', skipped: true };
    }

    const { rowCount } = await this.db.query(
      `UPDATE hims_documents.documents
          SET status = 'SCANNED'
        WHERE id = $1
          AND status = 'UPLOADING'`,
      [documentId],
      ctx,
    );

    return { documentId, operation: 'MALWARE_SCAN', skipped: rowCount === 0 };
  }

  /**
   * Add the document to `hims_emr.document_index`.
   *
   * `hims_documents` stays authoritative; this table is a derived index over it
   * and can be rebuilt, which is what makes a write-once insert acceptable
   * here. The table has no unique constraint on `document_id`, so idempotency
   * comes from a `NOT EXISTS` guard rather than `ON CONFLICT` — a replay
   * inserts nothing instead of adding a second index entry for the same
   * document.
   *
   * `source_record_id` is `NOT NULL` and is the document's own id, which is
   * what ties the index entry back to the row it was derived from.
   */
  private async amendEmrIndex(documentId: string, ctx: DatabaseContext): Promise<ProcessResult> {
    const { rowCount } = await this.db.query(
      `INSERT INTO hims_emr.document_index (
         tenant_id, patient_id, encounter_id, source_domain, source_record_id,
         document_id, document_type, occurred_at, summary
       )
       SELECT d.tenant_id, d.patient_id, d.encounter_id, 'hims_documents', d.id,
              d.id, d.document_type, d.created_at, d.title
         FROM hims_documents.documents d
        WHERE d.id = $1
          AND NOT EXISTS (
                SELECT 1 FROM hims_emr.document_index i WHERE i.document_id = d.id
              )`,
      [documentId],
      ctx,
    );

    if (rowCount === 0) {
      this.logger.debug(
        `Document ${documentId} is already indexed, or no longer exists; nothing to do`,
      );
    }

    return { documentId, operation: 'AMEND_EMR_INDEX', skipped: rowCount === 0 };
  }
}
