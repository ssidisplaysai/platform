import Link from "next/link";
import {
  getWorkOrderById,
  listWorkOrderAuditEvents,
  listWorkOrderPublishedEvents,
  listWorkOrderTimeline,
} from "./work-order-repository";

type DetailSection = "overview" | "timeline" | "audit" | "revisions" | "lineage" | "search";

export function WorkOrderDetailView(input: { workOrderId: string; section?: DetailSection }) {
  const workOrder = getWorkOrderById(input.workOrderId);

  if (!workOrder) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Work order {input.workOrderId} was not found.
      </div>
    );
  }

  const section = input.section ?? "overview";
  const auditEvents = listWorkOrderAuditEvents(workOrder.documentId);
  const publishedEvents = listWorkOrderPublishedEvents(workOrder.documentId);
  const timeline = listWorkOrderTimeline(workOrder.documentId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Work Order Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{workOrder.workOrderNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">Customer: {workOrder.customerReference}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{workOrder.status}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">revision: {workOrder.revision}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">version: {workOrder.version}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href={`/work-orders/${workOrder.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Overview</Link>
        <Link href={`/work-orders/${workOrder.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Timeline</Link>
        <Link href={`/work-orders/${workOrder.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Revision History</Link>
        <Link href={`/work-orders/${workOrder.documentId}/lineage`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Commerce Lineage</Link>
        <Link href={`/work-orders/${workOrder.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Audit</Link>
        <Link href={`/work-orders/${workOrder.documentId}/search`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Search</Link>
      </nav>

      {(section === "overview" || section === "lineage") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Commerce Lineage</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Sales Order ID</dt><dd>{workOrder.commercialLineage.originSalesOrderId}</dd></div>
            <div><dt className="text-zinc-500">Sales Order Revision</dt><dd>{workOrder.commercialLineage.originSalesOrderRevision}</dd></div>
            <div><dt className="text-zinc-500">Quote ID</dt><dd>{workOrder.commercialLineage.originQuoteId}</dd></div>
            <div><dt className="text-zinc-500">Quote Revision</dt><dd>{workOrder.commercialLineage.originQuoteRevision}</dd></div>
            <div><dt className="text-zinc-500">Pricing Snapshot</dt><dd>{workOrder.commercialLineage.pricingSnapshotReference}</dd></div>
            <div><dt className="text-zinc-500">Correlation</dt><dd>{workOrder.commercialLineage.correlationId}</dd></div>
            <div><dt className="text-zinc-500">Causation</dt><dd>{workOrder.commercialLineage.causationId}</dd></div>
          </dl>
        </article>
      )}

      {(section === "overview" || section === "revisions") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Revision History</h2>
          {workOrder.revisionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No revisions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {workOrder.revisionHistory.map((revision) => (
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
                <li key={event.eventId}>{event.createdAt} - {event.action}</li>
              ))}
            </ul>
          )}

          <h3 className="mt-4 text-sm font-semibold text-zinc-100">Published Work Order Events</h3>
          {publishedEvents.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No published events recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-zinc-300">
              {publishedEvents.map((event) => (
                <li key={event.eventId}>{event.timestamp} - {event.type} - actor {event.actor}</li>
              ))}
            </ul>
          )}
        </article>
      )}

      {section === "search" && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Work-order search is available at /api/work-orders/search and in enterprise search.
        </article>
      )}

      {(section === "overview" || section === "lineage") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Production Scope</h2>
          <p className="mt-2 text-sm text-zinc-300">
            This package certifies work-order commitments only. It intentionally excludes production jobs, operation routing, scheduling, inventory allocation, quality execution, MES, and IoT controls.
          </p>
        </article>
      )}
    </section>
  );
}
