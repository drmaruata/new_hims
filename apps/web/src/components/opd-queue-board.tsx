'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CommandCenterMetrics, OpdAppointment } from '@hims/domain-types';

import { browserApiClient, describeApiError } from '@/lib/api';

/**
 * Today in the facility's timezone.
 *
 * The register is keyed by business date, and the facility may sit in a
 * different zone from the browser. Reading the browser's calendar date would
 * show the registrar tomorrow's list for part of every day, so the caller is
 * required to supply the date and the API resolves the day boundary server-side
 * against `hims_core.facilities.timezone`.
 */
function todayIn(timezone: string): string {
  // `en-CA` formats as YYYY-MM-DD, which is exactly the business-date shape.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const STATUS_STYLES: Record<string, string> = {
  CHECKED_IN: 'bg-amber-100 text-amber-800',
  IN_CONSULTATION: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CONFIRMED: 'bg-slate-100 text-slate-700',
  REQUESTED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-rose-100 text-rose-800 line-through',
  NO_SHOW: 'bg-slate-200 text-slate-600',
};

/**
 * A register page and the dashboard response that dates it.
 */
interface RegisterSnapshot {
  businessDate: string;
  appointments: OpdAppointment[];
  metrics: CommandCenterMetrics;
}

/**
 * Load the register for a business date together with the command-centre
 * dashboard, which is where the facility's timezone comes from.
 *
 * A module-scope function rather than a hook so both effects can call it
 * without one having to depend on the other's state setters.
 */
async function fetchRegister(businessDate: string): Promise<RegisterSnapshot> {
  const [register, dashboard] = await Promise.all([
    browserApiClient.opd.getAppointments({ date: businessDate }),
    browserApiClient.commandCenter.getMetrics(),
  ]);

  return { businessDate, appointments: register.data, metrics: dashboard.data };
}

export function OpdQueueBoard() {
  const [appointments, setAppointments] = useState<OpdAppointment[] | null>(null);
  const [metrics, setMetrics] = useState<CommandCenterMetrics | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail: string } | null>(null);
  const [businessDate, setBusinessDate] = useState<string | null>(null);

  const apply = useCallback((snapshot: RegisterSnapshot) => {
    setAppointments(snapshot.appointments);
    setMetrics(snapshot.metrics);
    setBusinessDate(snapshot.businessDate);
    setFailure(null);
  }, []);

  const load = useCallback(
    async (date: string) => {
      try {
        apply(await fetchRegister(date));
      } catch (error) {
        setFailure(describeApiError(error));
      }
    },
    [apply]
  );

  useEffect(() => {
    // The first render has no facility timezone yet, because it comes from the
    // dashboard response. Load on the browser's date, then correct it to the
    // facility's on the next pass so the two can never silently disagree.
    const browserDate = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    fetchRegister(browserDate)
      .then((snapshot) => apply(snapshot))
      .catch((error: unknown) => setFailure(describeApiError(error)));
  }, [apply]);

  useEffect(() => {
    if (!metrics || !businessDate) return;

    const facilityDate = todayIn(metrics.timezone);
    if (businessDate === facilityDate) return;

    // The second pass is queued behind a promise, so nothing is written during
    // the effect body, and a stale response for a superseded date is dropped
    // rather than overwriting the register that is now on screen.
    let cancelled = false;
    fetchRegister(facilityDate)
      .then((snapshot) => {
        if (!cancelled) apply(snapshot);
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(describeApiError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [metrics, businessDate, apply]);

  if (failure) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900"
      >
        <h2 className="text-base font-bold">{failure.title}</h2>
        <p className="mt-1">{failure.detail}</p>
        {businessDate && (
          <button
            type="button"
            onClick={() => void load(businessDate)}
            className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!appointments) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
      >
        Loading the OPD register…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">OPD Consultation Queue</h1>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
          {businessDate}
          {metrics && ` · ${metrics.timezone}`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <caption className="sr-only">Appointments booked for {businessDate}</caption>
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  Queue Token
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  Patient
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  Department
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    No appointments booked for this date.
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-blue-700">
                      {appointment.queueToken ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                      {/* The UHID is the record. The patient's name is shown
                          beside it because a queue board is read by a human, not
                          an identifier — but the UHID stays the anchor. */}
                      <span className="font-mono text-xs text-emerald-700">
                        {appointment.patientUhid ?? '—'}
                      </span>
                      {appointment.patientDisplayName && (
                        <span className="ml-2">{appointment.patientDisplayName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                      {appointment.departmentName ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          STATUS_STYLES[appointment.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {appointment.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
            Today&apos;s Summary
          </h3>
          {metrics ? (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Registered</span>
                <span className="font-bold text-slate-900">{metrics.opd.registeredToday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">In Consultation</span>
                <span className="font-bold text-emerald-600">{metrics.opd.inConsultation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Waiting in Queue</span>
                <span className="font-bold text-blue-600">{metrics.opd.waitingInQueue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mean Wait</span>
                <span className="font-bold text-slate-900">
                  {metrics.opd.avgWaitTimeMinutes === null
                    ? '—'
                    : `${metrics.opd.avgWaitTimeMinutes} min`}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Summary unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
