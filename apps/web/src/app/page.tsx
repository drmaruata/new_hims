import { CommandCenterWidget } from '@hims/ui';
import { apiClient } from '@/lib/api';

export default async function CommandCenterPage() {
  const metricsResponse = await apiClient.commandCenter.getMetrics();
  const metrics = metricsResponse.data;

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
        <div className="text-xs text-slate-400 font-mono">
          Last synced: {new Date(metrics.timestamp).toLocaleString()}
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
            Diagnostics & Workload
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Lab Samples</span>
              <span className="font-bold text-rose-600">{metrics.diagnostics.pendingLabSamples}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Critical Lab Alerts</span>
              <span className="font-bold text-amber-600">{metrics.diagnostics.criticalLabAlerts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Radiology Reads</span>
              <span className="font-bold text-blue-600">{metrics.diagnostics.pendingRadiologyReads}</span>
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
              <span className="font-bold text-slate-900">₹{metrics.revenue.grossBilledToday.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Collections</span>
              <span className="font-bold text-emerald-600">₹{metrics.revenue.collectionsToday.toLocaleString()}</span>
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
