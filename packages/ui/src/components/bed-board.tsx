import * as React from 'react';
import type { Bed } from '@hims/domain-types';
import { Badge } from './badge.js';

export interface BedBoardProps {
  beds: Bed[];
  onSelectBed?: (bed: Bed) => void;
}

export function BedBoard({ beds, onSelectBed }: BedBoardProps) {
  const getStatusBadge = (status: Bed['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge variant="success">Available</Badge>;
      case 'OCCUPIED':
        return <Badge variant="destructive">Occupied</Badge>;
      case 'RESERVED':
        return <Badge variant="warning">Reserved</Badge>;
      case 'CLEANING':
        return <Badge variant="secondary">Cleaning</Badge>;
      case 'MAINTENANCE':
      case 'BLOCKED':
        return <Badge variant="outline">Maintenance</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {beds.map((bed) => (
        <div
          key={bed.id}
          onClick={() => onSelectBed?.(bed)}
          className={`p-3 rounded-xl border transition cursor-pointer hover:shadow-md ${
            bed.status === 'AVAILABLE'
              ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400'
              : bed.status === 'OCCUPIED'
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-800 text-sm">{bed.bedCode}</span>
            {getStatusBadge(bed.status)}
          </div>
          <p className="text-xs text-slate-500 font-medium">{bed.bedType.replace('_', ' ')}</p>
          <div className="mt-2 text-xs text-slate-400 font-mono">₹{bed.dailyTariff}/day</div>
        </div>
      ))}
    </div>
  );
}
