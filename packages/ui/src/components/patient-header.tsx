import * as React from 'react';
import type { Patient } from '@hims/domain-types';
import { calculateAgeInYears, formatClinicalDate } from '@hims/date-time';

import { Badge } from './badge';

export interface PatientHeaderProps {
  patient: Patient;
  currentEncounterId?: string;
  departmentName?: string;
  roomBed?: string;
}

/**
 * Labels for the clinically-significant patient states.
 *
 * The schema has no `is_vip` or `is_mlc` column — those were invented by an
 * earlier version of the model and never existed. What the record does carry is
 * `status` and `mastering_status`, both of which a header must surface, because
 * a record that is a duplicate or a merge source must not be treated as
 * authoritative at a glance.
 */
function statusBadge(patient: Patient): React.ReactElement | null {
  switch (patient.status) {
    case 'DECEASED':
      return <Badge variant="destructive">Deceased</Badge>;
    case 'MERGED':
      return <Badge variant="destructive">Merged</Badge>;
    case 'INACTIVE':
      return <Badge variant="secondary">Inactive</Badge>;
    default:
      return null;
  }
}

function masteringBadge(patient: Patient): React.ReactElement | null {
  if (patient.masteringStatus === 'MASTER') return null;
  return (
    <Badge variant="warning" title="This record is not the master patient index entry">
      {patient.masteringStatus}
    </Badge>
  );
}

/**
 * `sex_at_birth` and `gender_identity` are separate columns in the record.
 *
 * The header shows both when they differ, because a mismatch is clinically
 * relevant and rendering only one of them silently picks a side. Where the
 * record only has one, only that one is shown.
 */
function sexAndGender(patient: Patient): string | null {
  const { sexAtBirth, genderIdentity } = patient;
  if (sexAtBirth && genderIdentity && sexAtBirth !== genderIdentity) {
    return `${humanise(sexAtBirth)} (recorded) / ${humanise(genderIdentity)} (stated)`;
  }
  const value = sexAtBirth ?? genderIdentity;
  return value ? humanise(value) : null;
}

function humanise(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

/**
 * The header deliberately does not render an ABHA or Aadhaar number.
 *
 * `patient_identifiers` stores a digest plus an encrypted value; the API
 * returns the document *type* and the digest, never the plaintext. Rendering
 * `valueHash` under an "ABHA" label would put a 64-character hex string where a
 * clinician expects `name@abdm` and invite them to read it aloud as one. If the
 * ABHA is genuinely needed on screen, the contract has to return a
 * purpose-scoped masked value, which it currently does not.
 */
export function PatientHeader({
  patient,
  currentEncounterId,
  departmentName,
  roomBed,
}: PatientHeaderProps) {
  const age = patient.dateOfBirth ? calculateAgeInYears(patient.dateOfBirth) : null;
  const sexGender = sexAndGender(patient);

  // `lastName` is nullable in the schema, so the initials and the name line
  // both have to tolerate a single-part name.
  const initials = `${patient.firstName.charAt(0)}${(patient.lastName ?? '').charAt(0)}`.toUpperCase();
  const fullName = patient.displayName;

  return (
    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg text-white">
          {initials}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight">{fullName}</h2>
            {statusBadge(patient)}
            {masteringBadge(patient)}
            {patient.bloodGroup && (
              <Badge variant="secondary">{patient.bloodGroup.replace(/_/g, ' ')}</Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            UHID:{' '}
            <span className="font-mono text-emerald-400 font-semibold">{patient.uhid}</span>
            {sexGender && <> • {sexGender}</>}
            {age !== null && <> • {age} Y</>}
            {patient.dateOfBirth && (
              <>
                {' '}
                (DOB: {formatClinicalDate(patient.dateOfBirth)}
                {/* A birth date known only to the month or year must not be
                    rendered as the first of that period and then read as a
                    precise age. */}
                {patient.dobPrecision && patient.dobPrecision !== 'DAY' && (
                  <span className="text-amber-400"> ±{patient.dobPrecision.toLowerCase()}</span>
                )}
                )
              </>
            )}
            {patient.primaryMobile && <> • Mobile: {patient.primaryMobile}</>}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-6 text-sm">
        {currentEncounterId && (
          <div>
            <span className="text-xs text-slate-400 block">Encounter</span>
            <span className="font-mono text-xs text-slate-200">{currentEncounterId}</span>
          </div>
        )}
        {departmentName && (
          <div>
            <span className="text-xs text-slate-400 block">Department</span>
            <span className="font-semibold text-slate-200">{departmentName}</span>
          </div>
        )}
        {roomBed && (
          <div>
            <span className="text-xs text-slate-400 block">Bed / Ward</span>
            <span className="font-semibold text-amber-400">{roomBed}</span>
          </div>
        )}
      </div>
    </div>
  );
}
