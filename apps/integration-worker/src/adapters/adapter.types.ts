/**
 * The integration record an outbound adapter needs in order to send.
 *
 * Deliberately minimal: an adapter may rely only on `endpoint` being present.
 * Every other column of `hims_integration.integrations` stays an internal
 * detail of the platform layer, so declaring the whole row here would couple
 * every future adapter to the current schema.
 */
export interface IntegrationTarget {
  endpoint: string | null;
}

/**
 * A protocol-specific outbound transport — HTTP/REST, HL7 MLLP, FHIR, DICOM,
 * and so on.
 *
 * This contract lives in its own module rather than beside a concrete adapter.
 * The registry needs the type to describe what it returns, and each adapter
 * needs it to declare what it implements; putting it in either file makes the
 * two import each other, which is a circular import with no origin (TypeScript
 * reports it as `TS2303: Circular definition of import alias`).
 */
export interface IntegrationAdapter {
  /** Send `payload` to `target` and resolve with the transport's response. */
  send(target: IntegrationTarget, payload: unknown): Promise<unknown>;
}
