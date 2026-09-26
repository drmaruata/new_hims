import * as React from 'react';
import type { ClinicalVitals } from '@hims/domain-types';
import { formatClinicalDateTime } from '@hims/date-time';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import { Activity, Heart, Thermometer, Droplet } from 'lucide-react';

export interface VitalsPanelProps {
  vitals?: ClinicalVitals | null;
}

export function VitalsPanel({ vitals }: VitalsPanelProps) {
  if (!vitals) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" /> Vital Signs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500">No recorded vitals for this encounter.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600" /> Vital Signs
        </CardTitle>
        <span className="text-xs text-slate-500">{formatClinicalDateTime(vitals.recordedAt)}</span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Heart className="h-3 w-3 text-rose-500" /> Pulse
            </span>
            <span className="text-lg font-bold text-slate-800">
              {vitals.pulseBpm ?? '—'}{' '}
              <span className="text-xs font-normal text-slate-500">bpm</span>
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Activity className="h-3 w-3 text-blue-500" /> BP
            </span>
            <span className="text-lg font-bold text-slate-800">
              {vitals.systolicBp && vitals.diastolicBp
                ? `${vitals.systolicBp}/${vitals.diastolicBp}`
                : '—'}{' '}
              <span className="text-xs font-normal text-slate-500">mmHg</span>
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Droplet className="h-3 w-3 text-sky-500" /> SpO₂
            </span>
            <span className="text-lg font-bold text-slate-800">
              {vitals.oxygenSaturationSpO2 ?? '—'}{' '}
              <span className="text-xs font-normal text-slate-500">%</span>
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Thermometer className="h-3 w-3 text-amber-500" /> Temp
            </span>
            <span className="text-lg font-bold text-slate-800">
              {vitals.temperatureCelsius ?? '—'}{' '}
              <span className="text-xs font-normal text-slate-500">°C</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
