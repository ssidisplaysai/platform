import { AppShell } from "@/components/layout/app-shell";
import { SiteCreateFoundationForm } from "@/modules/foundation/SiteCreateFoundationForm";

export default function NewSitePage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Site Creation Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Add New Site (Bounded)</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This route validates non-secret configuration only and does not activate publishing.
          </p>
        </header>

        <SiteCreateFoundationForm />
      </section>
    </AppShell>
  );
}
