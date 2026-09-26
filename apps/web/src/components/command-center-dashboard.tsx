'use client';

import { useCallback, useEffect, useState } from 'react';
import { CommandCenterWidget } from '@hims/ui';
import type { CommandCenterMetrics } from '@hims/domain-types';

import { browserApiClient, describeApiError } from '@/lib/api';

/**
 * The command centre dashboard.
 *
 * A Client Component, and it has to be one. The session is a Supabase access
 * token in browser storage, so a Server Component rendering this page has no
 * credential to present and the API answers 401. The previous version was a
 * Server Component that read `localStorage` — `localStorage` is undefined on
 * the server, so the token was always `null` and the page never had a chance
 * of working.
 *
 * Consequently the first paint is a loading state rather than data, and a
 * failed fetch renders the reason. Neither is cosmetic: a command centre that
 * shows stale or invented numbers during a surge is worse than one that shows
 * nothing.
 */
export function CommandCenterDashboard() {
  const [metrics, setMetrics] = useState<CommandCenterMetrics | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Apply a successful load.
   *
   * Split out from `load` so the mount effect can hand it to a promise
   * callback: a fetch on mount is exactly the external-system synchronisation
   * an effect is for, but the call must not set state synchronously inside the
   * effect body itself, which is what `react-hooks/set-state-in-effect` fails.
   */
  const applyMetrics = useCallback((data: CommandCenterMetrics) => {
    setMetrics(data);
    setFailure(null);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await browserApiClient.commandCenter.getMetrics();
      applyMetrics(response.data);
    } catch (error) {
      setFailure(describeApiError(error));
    } finally {
      setRefreshing(false);
    }
  }, [applyMetrics]);

  useEffect(() => {
    browserApiClient.commandCenter
      .getMetrics()
      .then((response) => applyMetrics(response.data))
      .catch((error: unknown) => setFailure(describeApiError(error)));
  }, [applyMetrics]);

  if (failure) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900"
      >
        <h2 className="text-base font-bold">{failure.title}</h2>
        <p className="mt-1">{failure.detail}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
      >
        Loading live hospital metrics…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Hospital Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time operational and clinical overview for {metrics.facilityName}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-mono">
            {new Date(metrics.timestamp).toLocaleString()}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="mt-1 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CommandCenterWidget
          title="Bed Occupancy"
          value={`${metrics.occupancy.occupiedBeds}/${metrics.occupancy.totalBeds}`}
          subtitle={`${metrics.occupancy.occupancyRate}% occupancy`}
          variant="success"
        />
        <CommandCenterWidget
          title="OPD Today"
          value={metrics.opd.registeredToday}
          subtitle={`${metrics.opd.waitingInQueue} waiting`}
          variant="default"
        />
        <CommandCenterWidget
          title="ED Active"
          value={metrics.emergency.activePatients}
          subtitle={`ESI-1: ${metrics.emergency.esi1Resuscitation}`}
          variant="warning"
        />
        <CommandCenterWidget
          title="OT Today"
          value={metrics.ot.casesScheduledToday}
          subtitle={`${metrics.ot.casesCompleted} completed`}
          variant="danger"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
            Diagnostics &amp; Workload
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Lab Samples</span>
              <span className="font-bold text-rose-600">
                {metrics.diagnostics.pendingLabSamples}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Critical Lab Alerts</span>
              <span className="font-bold text-amber-600">
                {metrics.diagnostics.criticalLabAlerts}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Radiology Reads</span>
              <span className="font-bold text-blue-600">
                {metrics.diagnostics.pendingRadiologyReads}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
            Revenue Cycle (Today)
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Billed</span>
              <span className="font-bold text-slate-900">
                ₹{metrics.revenue.grossBilledToday.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Collections</span>
              <span className="font-bold text-emerald-600">
                ₹{metrics.revenue.collectionsToday.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Claims Submitted</span>
              <span className="font-bold text-slate-900">{metrics.revenue.claimsSubmitted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pre-Auth Pending</span>
              <span className="font-bold text-amber-600">{metrics.revenue.preAuthPending}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
