import Link from "next/link";
import {
  getOperationById,
  listOperationAuditEvents,
  listOperationPublishedEvents,
  listOperationTimeline,
} from "./operation-repository";

type DetailSection = "overview" | "timeline" | "audit" | "revisions" | "lineage" | "search";

export function OperationDetailView(input: { operationId: string; section?: DetailSection }) {
  const operation = getOperationById(input.operationId);

  if (!operation) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Operation {input.operationId} was not found.
      </div>
    );
  }

  const section = input.section ?? "overview";
  const auditEvents = listOperationAuditEvents(operation.documentId);
  const publishedEvents = listOperationPublishedEvents(operation.documentId);
  const timeline = listOperationTimeline(operation.documentId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Operation Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{operation.operationNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">{operation.operationName}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{operation.status}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">sequence: {operation.sequenceNumber}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">type: {operation.operationType}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href={`/operations/${operation.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Overview</Link>
        <Link href={`/operations/${operation.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Timeline</Link>
        <Link href={`/operations/${operation.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Revision History</Link>
        <Link href={`/operations/${operation.documentId}/lineage`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Lineage</Link>
        <Link href={`/operations/${operation.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Audit</Link>
        <Link href={`/operations/${operation.documentId}/search`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">Search</Link>
      </nav>

      {(section === "overview" || section === "lineage") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Manufacturing Lineage</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Production Job ID</dt><dd>{operation.lineage.productionJobId}</dd></div>
            <div><dt className="text-zinc-500">Production Job Revision</dt><dd>{operation.lineage.productionJobRevision}</dd></div>
            <div><dt className="text-zinc-500">Work Order ID</dt><dd>{operation.lineage.workOrderId}</dd></div>
            <div><dt className="text-zinc-500">Work Order Revision</dt><dd>{operation.lineage.workOrderRevision}</dd></div>
            <div><dt className="text-zinc-500">Sales Order ID</dt><dd>{operation.lineage.originSalesOrderId}</dd></div>
            <div><dt className="text-zinc-500">Sales Order Revision</dt><dd>{operation.lineage.originSalesOrderRevision}</dd></div>
            <div><dt className="text-zinc-500">Quote ID</dt><dd>{operation.lineage.originQuoteId}</dd></div>
            <div><dt className="text-zinc-500">Quote Revision</dt><dd>{operation.lineage.originQuoteRevision}</dd></div>
            <div><dt className="text-zinc-500">Organization</dt><dd>{operation.lineage.organizationId}</dd></div>
            <div><dt className="text-zinc-500">Site Reference</dt><dd>{operation.lineage.siteReference ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Correlation</dt><dd>{operation.lineage.correlationId}</dd></div>
            <div><dt className="text-zinc-500">Causation</dt><dd>{operation.lineage.causationId}</dd></div>
            <div><dt className="text-zinc-500">Manufacturing Version</dt><dd>{operation.lineage.manufacturingVersion}</dd></div>
            <div><dt className="text-zinc-500">Created By</dt><dd>{operation.lineage.createdBy}</dd></div>
            <div><dt className="text-zinc-500">Created Timestamp</dt><dd>{operation.lineage.createdTimestamp}</dd></div>
          </dl>
        </article>
      )}

      {(section === "overview" || section === "overview") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Operation Attributes</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Reference Number</dt><dd>{operation.referenceNumber ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Operation Type</dt><dd>{operation.operationType}</dd></div>
            <div><dt className="text-zinc-500">Sequence Number</dt><dd>{operation.sequenceNumber}</dd></div>
            <div><dt className="text-zinc-500">Description</dt><dd>{operation.description ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Required Capability</dt><dd>{operation.requiredCapability ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Estimated Duration</dt><dd>{operation.estimatedDurationMinutes ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Required Work Center</dt><dd>{operation.requiredWorkCenterReference ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Required Machine Type</dt><dd>{operation.requiredMachineTypeReference ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Required Skill</dt><dd>{operation.requiredSkill ?? "none"}</dd></div>
          </dl>
        </article>
      )}

      {(section === "overview" || section === "revisions") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Revision History</h2>
          {operation.revisionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No revisions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {operation.revisionHistory.map((revision) => (
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

          <h3 className="mt-4 text-sm font-semibold text-zinc-100">Published Operation Events</h3>
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
          Operation search is available at /api/operations/search and in enterprise search.
        </article>
      )}

      {(section === "overview" || section === "lineage") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Boundary Scope</h2>
          <p className="mt-2 text-sm text-zinc-300">
            This package certifies discrete manufacturing step definitions only. It intentionally excludes machine execution, telemetry, scheduling, routing optimization, inventory mutation, quality execution, labor tracking, maintenance, MES, and IoT controls.
          </p>
        </article>
      )}
    </section>
  );
}
