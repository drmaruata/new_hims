import { describe, expect, it } from 'vitest';
import { assertDatabaseContext } from './context';

describe('database context', () => {
  it('requires a tenant before any transaction can be scoped', () => {
    expect(() => assertDatabaseContext(undefined)).toThrow('tenantId');
    expect(() => assertDatabaseContext({ tenantId: '' })).toThrow('tenantId');
    expect(() => assertDatabaseContext({ tenantId: 'tenant-1' })).not.toThrow();
  });
});
