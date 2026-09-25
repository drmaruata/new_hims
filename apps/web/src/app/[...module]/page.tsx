import { notFound } from 'next/navigation';

const MODULES: Record<string, { title: string; description: string }> = {
  ipd: { title: 'IPD & Nursing', description: 'Inpatient admission, bed, nursing and discharge workflows.' },
  emergency: { title: 'Emergency (ED)', description: 'Emergency registration, triage, resuscitation and disposition workflows.' },
  ot: { title: 'OT Management', description: 'Operating theatre scheduling and surgical workflow.' },
  icu: { title: 'ICU', description: 'Critical-care beds, observations, devices and handover.' },
  lab: { title: 'Laboratory Information System', description: 'Specimen, result, verification and critical-value workflows.' },
  radiology: { title: 'Radiology Information System', description: 'Imaging orders, worklists, reporting and PACS integration.' },
  emr: { title: 'Patient 360 / EMR', description: 'Longitudinal patient record and clinical provenance.' },
  pharmacy: { title: 'Pharmacy', description: 'Prescription verification, dispensing and medication inventory.' },
  billing: { title: 'Billing & Revenue Cycle', description: 'Charges, invoices, payments and revenue-cycle workflows.' },
  insurance: { title: 'Insurance & Claims', description: 'Eligibility, pre-authorisation, claims and reconciliation.' },
  quality: { title: 'Quality OS', description: 'Quality indicators, incidents, CAPA and accreditation evidence.' },
  ai: { title: 'AI Copilots', description: 'Governed AI-assisted workflows with human review.' },
  audit: { title: 'Security & Audit', description: 'Audit evidence, access history and security operations.' },
  admin: { title: 'Administration', description: 'Tenant, facility, department, user and role administration.' },
};

export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ module: string[] }>;
}) {
  const { module } = await params;
  const key = module.join('/');

  if (!MODULES[key]) notFound();

  const item = MODULES[key];

  return (
    <section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Phase 0 shell</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{item.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{item.description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        This route is intentionally wired during Phase 0 so navigation never lands on a dead 404. The
        domain workflow is implemented in its Phase 1+ workstream.
      </div>
    </section>
  );
}
