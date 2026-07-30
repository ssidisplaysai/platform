import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

export default function NewCustomerPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">New Customer Account</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use the bounded API to create account records with contact and address references only.
          </p>
        </header>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <p>
            Creation is available through API route /api/customers with role-based authorization and secret
            keyword rejection.
          </p>
          <p className="mt-2 text-zinc-400">
            Suggested minimum payload: accountName, accountCode, accountType, lifecycleState, primarySiteId,
            associatedSiteIds, and communicationPreferences.
          </p>
          <div className="mt-4">
            <Link
              href="/customers"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Back To Customer Registry
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
