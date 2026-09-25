import * as React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from './alert';

export interface ClinicalAlertProps {
  type: 'ALLERGY' | 'CRITICAL_LAB' | 'INTERACTION' | 'HIGH_ALERT_DRUG';
  title: string;
  message: string;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
}

export function ClinicalAlert({ type, title, message, acknowledged, onAcknowledge }: ClinicalAlertProps) {
  const isCritical = type === 'ALLERGY' || type === 'CRITICAL_LAB';

  return (
    <Alert variant={isCritical ? 'criticalAlert' : 'clinicalWarning'}>
      {isCritical ? (
        <AlertCircle className="h-4 w-4 text-rose-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <div className="flex justify-between items-start w-full">
        <div>
          <AlertTitle className="font-bold">{title}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
        {onAcknowledge && !acknowledged && (
          <button
            onClick={onAcknowledge}
            className="ml-4 px-2.5 py-1 text-xs font-semibold rounded bg-rose-700 text-white hover:bg-rose-800 transition"
          >
            Acknowledge
          </button>
        )}
      </div>
    </Alert>
  );
}

