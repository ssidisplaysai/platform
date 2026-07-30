import Link from "next/link";
import { listQuotes } from "./quote-repository";
import type { QuoteCommercialStatus } from "./quote-types";

const STATUS_VALUES: readonly QuoteCommercialStatus[] = [
  "draft",
  "pricing",
  "pending_approval",
  "approved",
  "presented",
  "negotiating",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
  "converted",
];

export function QuotesRegistryView(input: {
  query?: string;
  commercialStatus?: string;
}) {
  const status = STATUS_VALUES.includes(input.commercialStatus as QuoteCommercialStatus)
    ? (input.commercialStatus as QuoteCommercialStatus)
    : undefined;

  const quotes = listQuotes({
    query: input.query,
    commercialStatus: status,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Quote Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Genesis Commercial Quotation System</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Govern quote lifecycle, line pricing snapshots, revision timelines, and approval transitions.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="quote number, customer, sku"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Status
            <select
              name="commercialStatus"
              defaultValue={status ?? ""}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            >
              <option value="">All Statuses</option>
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Apply Filters
            </button>
            <Link
              href="/quotes/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              New Quote
            </Link>
          </div>
        </form>
      </header>

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No quotes matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((quote) => (
            <li
              key={quote.documentId}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{quote.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{quote.quoteNumber}</h2>
                  <p className="text-xs text-zinc-500">{quote.customerReference}</p>
                  <p className="mt-2 text-zinc-400">Owner: {quote.ownerReference}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {quote.commercialStatus}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Approval: {quote.approvalStatus}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Revision: {quote.revision}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Lines: {quote.lines.length}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Total: {quote.totals.grandTotal.toFixed(2)}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Currency: {quote.currency}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/quotes/${quote.documentId}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Open Quote
                </Link>
                <Link
                  href={`/quotes/${quote.documentId}/revisions`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Revisions
                </Link>
                <Link
                  href={`/quotes/${quote.documentId}/audit`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Audit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
