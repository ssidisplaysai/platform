import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getQuoteById } from "@/modules/foundation/quote-repository";

type PageProps = {
  params: Promise<{ quoteId: string }>;
};

export default async function CreateOrderFromQuotePage({ params }: PageProps) {
  const { quoteId } = await params;
  const quote = getQuoteById(quoteId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Sales Order Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Sales Order From Quote</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Conversion endpoint: POST /api/orders/from-quote/{quoteId}
          </p>
        </header>

        {!quote ? (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Quote {quoteId} was not found.
          </article>
        ) : (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <p>Quote: {quote.quoteNumber}</p>
            <p className="mt-1">Status: {quote.commercialStatus}</p>
            <p className="mt-1">Customer: {quote.customerReference}</p>
            <p className="mt-1">Revision: {quote.revision}</p>
            <p className="mt-3">
              Use API conversion to create the authoritative sales order record while preserving quote lineage.
            </p>
            <Link
              href="/orders"
              className="mt-4 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Open Sales Orders
            </Link>
          </article>
        )}
      </section>
    </AppShell>
  );
}
