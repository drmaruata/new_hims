import { describe, expect, it } from 'vitest';
import { ClinicalSafetyEngine } from './index';
import type { OpdPrescriptionItem, PatientAllergy } from '@hims/domain-types';

const allergy: PatientAllergy = {
  id: 'allergy-1',
  allergenType: 'MEDICATION',
  allergenName: 'Penicillin',
  severity: 'SEVERE',
  verified: true,
};

const item: OpdPrescriptionItem = {
  id: 'item-1',
  drugId: 'drug-1',
  drugName: 'Penicillin V',
  dosage: '500 mg',
  frequency: 'TDS',
  route: 'ORAL',
  durationDays: 5,
};

describe('ClinicalSafetyEngine', () => {
  it('flags a prescription that matches a recorded allergy', () => {
    const warnings = ClinicalSafetyEngine.checkPrescriptionAllergies([allergy], [item]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      allergenName: 'Penicillin',
      drugName: 'Penicillin V',
      severity: 'SEVERE',
    });
  });

  it('does not flag an unrelated medication', () => {
    const unrelated = { ...item, drugName: 'Paracetamol' };
    expect(ClinicalSafetyEngine.checkPrescriptionAllergies([allergy], [unrelated])).toHaveLength(0);
  });
});
