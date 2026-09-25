import { OpdAppointment, OpdPrescription } from '@hims/domain-types';
import { apiClient } from '@/lib/api';
import { PatientHeader } from '@hims/ui';

export default async function OpdPage() {
  const data = await apiClient.opd.getAppointments();
  const appointments = data.data;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">OPD Consultation Queue</h1>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
          Department-Aware Registration Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Queue Token</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {appointments.map((appt: OpdAppointment) => (
                <tr key={appt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-blue-600">{appt.queueToken}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">UHID-{appt.patientId.substring(0, 8)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">General Medicine</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      appt.status === 'CHECKED_IN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Today's Summary</h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Registered</span>
              <span className="font-bold text-slate-900">142</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">In Consultation</span>
              <span className="font-bold text-emerald-600">18</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Dispensations</span>
              <span className="font-bold text-blue-600">7</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-2 font-semibold">Prescription &amp; Pharmacy Queue</div>
            <div className="space-y-2">
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs flex justify-between">
                <span>Rx: Paracetamol 500mg</span>
                <span className="font-bold text-amber-800">PENDING</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
