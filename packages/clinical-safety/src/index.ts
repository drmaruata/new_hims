import type { PatientAllergy, OpdPrescriptionItem } from '@hims/domain-types';

export interface AllergyWarning {
  allergenName: string;
  drugName: string;
  severity: string;
  message: string;
}

export class ClinicalSafetyEngine {
  public static checkPrescriptionAllergies(
    patientAllergies: PatientAllergy[],
    prescriptionItems: OpdPrescriptionItem[]
  ): AllergyWarning[] {
    const warnings: AllergyWarning[] = [];

    for (const item of prescriptionItems) {
      for (const allergy of patientAllergies) {
        if (
          allergy.allergenName.toLowerCase().includes(item.drugName.toLowerCase()) ||
          item.drugName.toLowerCase().includes(allergy.allergenName.toLowerCase())
        ) {
          warnings.push({
            allergenName: allergy.allergenName,
            drugName: item.drugName,
            severity: allergy.severity,
            message: `CRITICAL ALLERGY ALERT: Patient is recorded as allergic to ${allergy.allergenName} (${allergy.severity}). Prescribed: ${item.drugName}`,
          });
        }
      }
    }

    return warnings;
  }
}
