import { Button } from "@/components/ui/button";

const domains = ["OPD", "IPD", "Laboratory", "Radiology", "Emergency", "OT", "ICU", "Pharmacy", "EMR", "Insurance"];

export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh max-w-7xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b pb-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Hospital Operating Platform</p>
            <h1 className="text-2xl font-semibold tracking-tight">HIMS</h1>
          </div>
          <Button>Open Command Center</Button>
        </header>
        <section className="grid flex-1 content-center gap-8 py-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight">One patient. One longitudinal record. One operational truth.</h2>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">Production foundation for a multi-tenant, interoperable hospital information management system.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {domains.map((domain) => <div key={domain} className="rounded-xl border bg-card p-4 text-sm font-medium shadow-sm">{domain}</div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
