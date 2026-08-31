import { AppShell } from "@/components/layout/app-shell";
import { SiteCreateFoundationForm } from "@/modules/foundation/SiteCreateFoundationForm";

export default function NewSitePage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">GLW Site Onboarding</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Add a New Website</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connect a WordPress website to GLW, test the connection, and prepare it for page generation.
          </p>
        </header>

        <SiteCreateFoundationForm />
      </section>
    </AppShell>
  );
}

