import { Injectable, Logger } from '@nestjs/common';
import type { IntegrationAdapter, IntegrationTarget } from './adapter.types.js';

/**
 * HTTP/REST outbound adapter.
 *
 * A placeholder that resolves to `fetch`. In production it would be swapped
 * for a protocol-specific adapter (HL7 MLLP, FHIR DSTU3/R4, DICOM C-STORE,
 * etc.) registered here at build time.
 */
@Injectable()
export class HttpAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(HttpAdapter.name);

  async send(integration: IntegrationTarget, payload: unknown): Promise<unknown> {
    if (!integration.endpoint) {
      throw new Error('Integration has no endpoint configured');
    }

    this.logger.log(`Sending to ${integration.endpoint} via HTTP`);

    const response = await fetch(integration.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In production, the secret_ref would come from a vault.
        'X-HIMS-Signature': 'STUB',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json().catch(() => ({}));
  }
}
