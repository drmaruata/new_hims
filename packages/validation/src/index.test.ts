import { describe, expect, it } from 'vitest';
import { RegisterPatientDtoSchema } from './index';

const valid = {
  firstName: 'Test',
  lastName: 'Patient',
  dateOfBirth: '1990-01-01',
  gender: 'UNKNOWN' as const,
  mobile: '9876543210',
  facilityId: '11111111-1111-1111-1111-111111111111',
};

describe('RegisterPatientDtoSchema', () => {
  it('accepts a valid Indian patient registration payload', () => {
    const result = RegisterPatientDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isVip).toBe(false);
  });

  it('rejects invalid mobile numbers and dates', () => {
    expect(
      RegisterPatientDtoSchema.safeParse({ ...valid, mobile: '12345' }).success,
    ).toBe(false);
    expect(
      RegisterPatientDtoSchema.safeParse({ ...valid, dateOfBirth: '01-01-1990' }).success,
    ).toBe(false);
  });
});
