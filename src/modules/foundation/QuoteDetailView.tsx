import Link from "next/link";
import { getQuoteById, listQuoteAuditEvents } from "./quote-repository";

type DetailSection = "overview" | "revisions" | "history" | "pricing" | "assignment" | "lines" | "audit" | "search";

export function QuoteDetailView(input: { quoteId: string; section?: DetailSection }) {
  const quote = getQuoteById(input.quoteId);

  if (!quote) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Quote {input.quoteId} was not found.
      </div>
    );
  }

  const section = input.section ?? "overview";
  const activity = listQuoteAuditEvents(quote.documentId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Quote Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{quote.quoteNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">{quote.customerReference}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{quote.commercialStatus}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">approval: {quote.approvalStatus}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">revision: {quote.revision}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">version: {quote.version}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href={`/quotes/${quote.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Overview</Link>
        <Link href={`/quotes/${quote.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Revision Timeline</Link>
        <Link href={`/quotes/${quote.documentId}/history`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Commercial History</Link>
        <Link href={`/quotes/${quote.documentId}/pricing`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Pricing Summary</Link>
        <Link href={`/quotes/${quote.documentId}/assignment`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Customer Assignment</Link>
        <Link href={`/quotes/${quote.documentId}/lines`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Line Editor</Link>
        <Link href={`/quotes/${quote.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Audit Viewer</Link>
        <Link href={`/quotes/${quote.documentId}/search`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Search</Link>
      </nav>

      {(section === "overview" || section === "assignment") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-semibold text-white">Customer Assignment</h2>
            <dl className="mt-3 space-y-2 text-sm text-zinc-300">
              <div><dt className="text-zinc-500">Customer</dt><dd>{quote.customerReference}</dd></div>
              <div><dt className="text-zinc-500">Primary Contact</dt><dd>{quote.primaryContactReference ?? "Not assigned"}</dd></div>
              <div><dt className="text-zinc-500">Owner</dt><dd>{quote.ownerReference}</dd></div>
              <div><dt className="text-zinc-500">Sales Representative</dt><dd>{quote.salesRepresentativeReference ?? "Not assigned"}</dd></div>
              <div><dt className="text-zinc-500">Site</dt><dd>{quote.siteReference ?? "Not assigned"}</dd></div>
            </dl>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-semibold text-white">Commercial Terms</h2>
            <p className="mt-2 text-sm text-zinc-300">Currency: {quote.currency}</p>
            <p className="text-sm text-zinc-300">Effective: {quote.effectiveDate}</p>
            <p className="text-sm text-zinc-300">Expiration: {quote.expirationDate}</p>
            <p className="text-sm text-zinc-300">Exchange Rate: {quote.commercialTerms.exchangeRate}</p>
          </article>
        </div>
      )}

      {(section === "overview" || section === "pricing") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Pricing Summary</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-300 lg:grid-cols-3">
            <span className="rounded border border-zinc-700 px-2 py-1">Subtotal: {quote.totals.subtotal.toFixed(2)}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Discount: {quote.totals.discountTotal.toFixed(2)}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Tax: {quote.totals.taxPlaceholder.toFixed(2)}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Freight: {quote.totals.freightPlaceholder.toFixed(2)}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Fees: {quote.totals.fees.toFixed(2)}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Grand Total: {quote.totals.grandTotal.toFixed(2)}</span>
          </div>
        </article>
      )}

      {(section === "overview" || section === "lines") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Line Editor Snapshot</h2>
          {quote.lines.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No quote lines recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {quote.lines.map((line) => (
                <li key={line.lineId} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                  <p>{line.lineId} - {line.sku} - {line.displayName}</p>
                  <p className="text-xs text-zinc-500">
                    qty {line.quantity} x {line.unitPrice.toFixed(2)} - discount {line.discount.toFixed(2)} = {line.extendedPrice.toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {(section === "revisions" || section === "history" || section === "overview") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Revision Timeline</h2>
          {quote.revisionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No revisions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {quote.revisionHistory.map((revision) => (
                <li key={revision.revisionNumber} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                  <p>Revision {revision.revisionNumber} by {revision.author}</p>
                  <p className="text-xs text-zinc-500">{revision.timestamp} - {revision.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {(section === "audit" || section === "history" || section === "overview") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Audit Viewer</h2>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No audit events recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {activity.map((event) => (
                <li key={event.eventId}>
                  {event.createdAt} - {event.type} - {event.summary}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {section === "search" && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Quote search is available from the global search endpoint at <code>/api/quotes/search</code> and in the enterprise search page.
        </article>
      )}
    </section>
  );
}
