import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getCustomerById } from "@/modules/foundation/customer-repository";

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerSettingsPage({ params }: PageProps) {
  const { customerId } = await params;
  const customer = getCustomerById(customerId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Settings</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{customer?.accountName ?? customerId}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Configure bounded account metadata, lifecycle state, and communication preferences.
          </p>
        </header>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <p>PATCH /api/customers/{customerId} updates lifecycle, communication preferences, and site associations.</p>
          <p className="mt-2 text-zinc-400">Immutable fields: customerId, organizationId, createdAt.</p>
          <div className="mt-4">
            <Link href={`/customers/${customerId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Back To Customer</Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
