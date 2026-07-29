import Link from "next/link";
import {
  getSalesOrderById,
  listSalesOrderAuditEvents,
  listSalesOrderPublishedEvents,
  listSalesOrderTimeline,
} from "./sales-order-repository";

type DetailSection = "overview" | "timeline" | "audit" | "revisions" | "approval" | "search";

export function SalesOrderDetailView(input: { orderId: string; section?: DetailSection }) {
  const order = getSalesOrderById(input.orderId);

  if (!order) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Sales order {input.orderId} was not found.
      </div>
    );
  }

  const section = input.section ?? "overview";
  const auditEvents = listSalesOrderAuditEvents(order.documentId);
  const publishedEvents = listSalesOrderPublishedEvents(order.documentId);
  const timeline = listSalesOrderTimeline(order.documentId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Sales Order Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{order.orderNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">Customer: {order.customerReference}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{order.status}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">approval: {order.approvalStatus}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">revision: {order.revision}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">version: {order.version}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href={`/orders/${order.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Overview</Link>
        <Link href={`/orders/${order.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Timeline</Link>
        <Link href={`/orders/${order.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Revision History</Link>
        <Link href={`/orders/${order.documentId}/approval`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Approval Panel</Link>
        <Link href={`/orders/${order.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Audit</Link>
        <Link href={`/orders/${order.documentId}/search`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Search</Link>
      </nav>

      {(section === "overview" || section === "approval") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Approval and Lineage</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Quote ID</dt><dd>{order.quoteLineage.quoteId}</dd></div>
            <div><dt className="text-zinc-500">Quote Revision</dt><dd>{order.quoteLineage.quoteRevision}</dd></div>
            <div><dt className="text-zinc-500">Accepted At</dt><dd>{order.quoteLineage.acceptanceTimestamp}</dd></div>
            <div><dt className="text-zinc-500">Accepted By</dt><dd>{order.quoteLineage.acceptedBy}</dd></div>
            <div><dt className="text-zinc-500">Pricing Snapshot</dt><dd>{order.quoteLineage.pricingSnapshotReference}</dd></div>
            <div><dt className="text-zinc-500">Conversion Event</dt><dd>{order.quoteLineage.conversionEventId}</dd></div>
          </dl>
        </article>
      )}

      {(section === "overview" || section === "revisions") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Revision History</h2>
          {order.revisionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No revisions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {order.revisionHistory.map((revision) => (
                <li key={revision.revisionNumber} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                  <p>Revision {revision.revisionNumber} by {revision.author}</p>
                  <p className="text-xs text-zinc-500">{revision.timestamp} - {revision.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {(section === "overview" || section === "timeline") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No timeline entries recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {timeline.map((entry, index) => (
                <li key={`${entry.timestamp}-${entry.category}-${index}`}>
                  <span className="text-zinc-500">{entry.timestamp}</span> - {entry.category} - {entry.title} - {entry.detail}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {(section === "overview" || section === "audit") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Audit and Published Events</h2>
          <h3 className="mt-3 text-sm font-semibold text-zinc-100">Audit</h3>
          {auditEvents.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No audit events recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-zinc-300">
              {auditEvents.map((event) => (
                <li key={event.eventId}>{event.createdAt} - {event.type} - {event.summary}</li>
              ))}
            </ul>
          )}

          <h3 className="mt-4 text-sm font-semibold text-zinc-100">Published Order Events</h3>
          {publishedEvents.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No published events recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-zinc-300">
              {publishedEvents.map((event) => (
                <li key={event.eventId}>{event.createdAt} - {event.type} - actor {event.actor}</li>
              ))}
            </ul>
          )}
        </article>
      )}

      {section === "search" && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Sales order search is available from the endpoint at <code>/api/orders/search</code> and in enterprise search.
        </article>
      )}
    </section>
  );
}
