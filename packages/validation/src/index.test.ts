import { describe, expect, it } from 'vitest';
import { RegisterPatientDtoSchema } from './index';

/**
 * A real RFC 9562 v4 UUID.
 *
 * The all-ones placeholder is the trap: `11111111-1111-1111-1111-111111111111`
 * looks like a UUID but is not one, because Zod 4 checks the variant nibble
 * against `[89abAB]` and that nibble is `1`. It is why the repository's seed
 * tenant is `11111111-1111-4111-8111-111111111111` — the same readable shape
 * with a real version (`4`) and variant (`8`) nibble. Any placeholder used in a
 * fixture here has to be a genuine UUID.
 */
const FACILITY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/** The all-ones shape, kept as the canonical example of an invalid UUID. */
const NOT_A_UUID = '11111111-1111-1111-1111-111111111111';

const valid = {
  firstName: 'Test',
  lastName: 'Patient',
  dateOfBirth: '1990-01-01',
  gender: 'UNKNOWN' as const,
  mobile: '9876543210',
  facilityId: FACILITY_ID,
};

describe('RegisterPatientDtoSchema', () => {
  it('accepts a valid Indian patient registration payload', () => {
    const result = RegisterPatientDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isVip).toBe(false);
  });

  it('rejects invalid mobile numbers and dates', () => {
    expect(RegisterPatientDtoSchema.safeParse({ ...valid, mobile: '12345' }).success).toBe(false);
    expect(
      RegisterPatientDtoSchema.safeParse({ ...valid, dateOfBirth: '01-01-1990' }).success
    ).toBe(false);
  });

  it('rejects a facility id that is UUID-shaped but not a real UUID', () => {
    // Guards the fixture above: a placeholder that only looks like a UUID fails
    // validation, so the failure cannot be mistaken for a schema regression.
    expect(RegisterPatientDtoSchema.safeParse({ ...valid, facilityId: NOT_A_UUID }).success).toBe(
      false
    );
  });

  it('treats email as optional but still validates it when present', () => {
    expect(RegisterPatientDtoSchema.safeParse({ ...valid, email: null }).success).toBe(true);
    expect(
      RegisterPatientDtoSchema.safeParse({ ...valid, email: 'patient@example.com' }).success
    ).toBe(true);
    expect(RegisterPatientDtoSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(
      false
    );
  });
});
