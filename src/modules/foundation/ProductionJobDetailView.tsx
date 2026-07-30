import Link from "next/link";
import {
  getProductionJobById,
  listProductionJobAuditEvents,
  listProductionJobPublishedEvents,
  listProductionJobTimeline,
} from "./production-job-repository";

type DetailSection = "overview" | "timeline" | "audit" | "revisions" | "lineage" | "search";

export function ProductionJobDetailView(input: { productionJobId: string; section?: DetailSection }) {
  const job = getProductionJobById(input.productionJobId);

  if (!job) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Production job {input.productionJobId} was not found.
      </div>
    );
  }

  const section = input.section ?? "overview";
  const auditEvents = listProductionJobAuditEvents(job.documentId);
  const publishedEvents = listProductionJobPublishedEvents(job.documentId);
  const timeline = listProductionJobTimeline(job.documentId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Production Job Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{job.productionJobNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">Customer: {job.customerReference}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{job.status}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">revision: {job.revision}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">version: {job.version}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href={`/production-jobs/${job.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Overview</Link>
        <Link href={`/production-jobs/${job.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Timeline</Link>
        <Link href={`/production-jobs/${job.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Revision History</Link>
        <Link href={`/production-jobs/${job.documentId}/lineage`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Lineage</Link>
        <Link href={`/production-jobs/${job.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Audit</Link>
        <Link href={`/production-jobs/${job.documentId}/search`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Search</Link>
      </nav>

      {(section === "overview" || section === "lineage") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Manufacturing Lineage</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Work Order ID</dt><dd>{job.lineage.workOrderId}</dd></div>
            <div><dt className="text-zinc-500">Work Order Revision</dt><dd>{job.lineage.workOrderRevision}</dd></div>
            <div><dt className="text-zinc-500">Sales Order ID</dt><dd>{job.lineage.originSalesOrderId}</dd></div>
            <div><dt className="text-zinc-500">Sales Order Revision</dt><dd>{job.lineage.originSalesOrderRevision}</dd></div>
            <div><dt className="text-zinc-500">Quote ID</dt><dd>{job.lineage.originQuoteId}</dd></div>
            <div><dt className="text-zinc-500">Quote Revision</dt><dd>{job.lineage.originQuoteRevision}</dd></div>
            <div><dt className="text-zinc-500">Correlation</dt><dd>{job.lineage.correlationId}</dd></div>
            <div><dt className="text-zinc-500">Causation</dt><dd>{job.lineage.causationId}</dd></div>
          </dl>
        </article>
      )}

      {(section === "overview" || section === "revisions") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Revision History</h2>
          {job.revisionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No revisions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {job.revisionHistory.map((revision) => (
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

          <h3 className="mt-4 text-sm font-semibold text-zinc-100">Published Production Job Events</h3>
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
          Production-job search is available at /api/production-jobs/search and in enterprise search.
        </article>
      )}

      {(section === "overview" || section === "lineage") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Boundary Scope</h2>
          <p className="mt-2 text-sm text-zinc-300">
            This package certifies execution-authorizing production jobs only. It intentionally excludes operations, machine execution, scheduling optimization, inventory mutation, quality execution, labor tracking, maintenance, MES, and IoT controls.
          </p>
        </article>
      )}
    </section>
  );
}
