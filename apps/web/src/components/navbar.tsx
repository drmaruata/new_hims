'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Bell, Search, ShieldAlert, User } from 'lucide-react';
import { Badge } from '@hims/ui';

export function Navbar() {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="flex h-16 items-center px-4 md:px-6 justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/command-center" className="flex items-center space-x-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xl text-white shadow">
              H
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline-block">
              HIMS <span className="text-blue-400 font-normal text-sm">Enterprise OS</span>
            </span>
          </Link>
          <div className="h-4 w-px bg-slate-700 mx-2 hidden md:block" />
          <div className="text-xs text-slate-400 hidden md:block">
            Apollo Main Hospital • <span className="text-emerald-400 font-medium">Online</span>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Universal Patient Search (UHID, Name, Mobile, ABHA)..."
              className="w-full bg-slate-800 text-slate-200 pl-9 pr-4 py-1.5 rounded-lg text-sm border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            title="Break-Glass Emergency Access"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold hover:bg-rose-900 transition"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden sm:inline">Break Glass</span>
          </button>

          <button className="relative p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          </button>

          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
              VS
            </div>
            <div className="hidden xl:block text-left text-xs">
              <p className="font-semibold text-slate-200">Dr. Vikram Sarabhai</p>
              <p className="text-slate-400">Chief Consultant</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
