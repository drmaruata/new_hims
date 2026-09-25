import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './card.js';
import { LucideIcon } from 'lucide-react';

export interface CommandCenterWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function CommandCenterWidget({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  variant = 'default',
}: CommandCenterWidgetProps) {
  const getBorderColor = () => {
    switch (variant) {
      case 'success':
        return 'border-l-4 border-l-emerald-500';
      case 'warning':
        return 'border-l-4 border-l-amber-500';
      case 'danger':
        return 'border-l-4 border-l-rose-500';
      default:
        return 'border-l-4 border-l-blue-600';
    }
  };

  return (
    <Card className={`shadow-sm ${getBorderColor()}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {(subtitle || trend) && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            {trend && <span className="font-semibold text-emerald-600">{trend}</span>}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
