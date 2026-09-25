import * as React from 'react';
import type { Patient } from '@hims/domain-types';
import { formatClinicalDate, calculateAgeInYears } from '@hims/date-time';
import { Badge } from './badge.js';

export interface PatientHeaderProps {
  patient: Patient;
  currentEncounterId?: string;
  departmentName?: string;
  roomBed?: string;
}

export function PatientHeader({ patient, currentEncounterId, departmentName, roomBed }: PatientHeaderProps) {
  const age = calculateAgeInYears(patient.dateOfBirth);

  return (
    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg text-white">
          {patient.firstName[0]}{patient.lastName[0]}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight">
              {patient.firstName} {patient.middleName ? `${patient.middleName} ` : ''}{patient.lastName}
            </h2>
            {patient.isVip && <Badge variant="warning">VIP</Badge>}
            {patient.isMlc && <Badge variant="destructive">MLC</Badge>}
            {patient.bloodGroup && <Badge variant="secondary">{patient.bloodGroup.replace('_', ' ')}</Badge>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            UHID: <span className="font-mono text-emerald-400 font-semibold">{patient.uhid}</span> • {patient.gender} • {age !== null ? `${age} Y` : '—'} (DOB: {formatClinicalDate(patient.dateOfBirth)}) • Mobile: {patient.mobile}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-6 text-sm">
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
        {patient.abhaAddress && (
          <div>
            <span className="text-xs text-slate-400 block">ABHA</span>
            <span className="font-mono text-xs text-sky-400">{patient.abhaAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}
