import { describe, expect, it } from 'vitest';
import { PolicyEngine, type UserAuthContext } from './index';

const context: UserAuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  facilityId: 'facility-1',
  roles: ['DOCTOR'],
  permissions: ['patient.read', 'opd.encounter.create'],
};

describe('PolicyEngine', () => {
  it('checks exact permissions without granting unrelated actions', () => {
    expect(PolicyEngine.hasPermission(context, 'patient.read')).toBe(true);
    expect(PolicyEngine.hasPermission(context, 'patient.export')).toBe(false);
  });

  it('honours tenant-admin wildcard semantics', () => {
    expect(
      PolicyEngine.hasPermission({ ...context, isTenantAdmin: true }, 'system.user.manage'),
    ).toBe(true);
  });

  it('checks facility scope', () => {
    expect(PolicyEngine.validateFacilityAccess(context, 'facility-1')).toBe(true);
    expect(PolicyEngine.validateFacilityAccess(context, 'facility-2')).toBe(false);
  });
});
