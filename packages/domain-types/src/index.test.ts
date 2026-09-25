import { describe, expect, it } from 'vitest';
import { HIMS_QUEUES, isHimsEventType } from './index';

describe('domain contracts', () => {
  it('recognises catalogued events and rejects unknown events', () => {
    expect(isHimsEventType('patient.created')).toBe(true);
    expect(isHimsEventType('patient.this-does-not-exist')).toBe(false);
  });

  it('keeps queue names stable as a shared contract', () => {
    expect(HIMS_QUEUES.OUTBOX).toBe('hims.outbox');
    expect(HIMS_QUEUES.INTEGRATION).toBe('hims.integration');
  });
});
