'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Monitor,
  Users,
  Stethoscope,
  BedDouble,
  FlaskConical,
  Scan,
  AlertCircle,
  Drama,
  Heart,
  Pill,
  ClipboardList,
  CreditCard,
  Shield,
  BarChart3,
  Settings,
  Zap,
} from 'lucide-react';

/**
 * The sidebar's navigation model.
 *
 * `badge` is optional and part of the item type rather than read off the item
 * with a cast: only the command centre carries one today, and a cast would keep
 * compiling if the field were renamed on one side only.
 */
interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Command & Control',
    items: [{ href: '/command-center', icon: Monitor, label: 'Command Center', badge: 'Live' }],
  },
  {
    title: 'Clinical Modules',
    items: [
      { href: '/opd', icon: Users, label: 'OPD' },
      { href: '/ipd', icon: BedDouble, label: 'IPD & Nursing' },
      { href: '/emergency', icon: AlertCircle, label: 'Emergency (ED)' },
      { href: '/ot', icon: Drama, label: 'OT Management' },
      { href: '/icu', icon: Heart, label: 'ICU' },
      { href: '/lab', icon: FlaskConical, label: 'LIS' },
      { href: '/radiology', icon: Scan, label: 'RIS' },
      { href: '/emr', icon: Stethoscope, label: 'Patient 360 / EMR' },
    ],
  },
  {
    title: 'Operations & Finance',
    items: [
      { href: '/pharmacy', icon: Pill, label: 'Pharmacy' },
      { href: '/billing', icon: CreditCard, label: 'Billing & RCM' },
      { href: '/insurance', icon: ClipboardList, label: 'Insurance & Claims' },
    ],
  },
  {
    title: 'Governance',
    items: [
      { href: '/quality', icon: BarChart3, label: 'Quality OS (NABH/NQAS)' },
      { href: '/ai', icon: Zap, label: 'AI Copilots' },
      { href: '/audit', icon: Shield, label: 'Security & Audit' },
      { href: '/admin', icon: Settings, label: 'Administration' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white h-full overflow-y-auto flex flex-col">
      <nav className="flex-1 px-2 py-4 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition group ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                        />
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
