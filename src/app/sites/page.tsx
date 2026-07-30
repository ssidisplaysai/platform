import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { MultiSiteListView } from "@/modules/foundation/MultiSiteListView";

export default function SitesPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Multi-Site Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Site Registry Experience</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Manage site context, readiness, and integration references without introducing publishing runtime side effects.
          </p>
          <div className="mt-4">
            <Link
              href="/sites/new"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500 hover:text-white"
            >
              New Site Foundation
            </Link>
          </div>
        </header>

        <MultiSiteListView />
      </section>
    </AppShell>
  );
}
