import { describe, expect, it, vi } from 'vitest';
import { TelemetryLogger } from './index';

describe('TelemetryLogger', () => {
  it('emits structured JSON with protected envelope fields', () => {
    const sink = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      new TelemetryLogger('test-service').info('hello', {
        tenantId: 'tenant-1',
        level: 'spoofed',
      });
      const payload = JSON.parse(String(sink.mock.calls[0]?.[0]));
      expect(payload).toMatchObject({
        level: 'info',
        service: 'test-service',
        message: 'hello',
        tenantId: 'tenant-1',
      });
      expect(payload.level).toBe('info');
    } finally {
      sink.mockRestore();
    }
  });

  it('serialises Error values with useful diagnostic fields', () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      new TelemetryLogger('test-service').error('failed', new Error('boom'));
      const payload = JSON.parse(String(sink.mock.calls[0]?.[0]));
      expect(payload.error).toMatchObject({ name: 'Error', message: 'boom' });
    } finally {
      sink.mockRestore();
    }
  });
});
