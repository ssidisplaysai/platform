import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function NewCustomerContactPage({ params }: PageProps) {
  const { customerId } = await params;

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">New Contact</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Customer {customerId}</h1>
          <p className="mt-2 text-sm text-zinc-400">POST /api/customers/{customerId}/contacts creates bounded contact references.</p>
        </header>
        <Link href={`/customers/${customerId}/contacts`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Back To Contacts</Link>
      </section>
    </AppShell>
  );
}
