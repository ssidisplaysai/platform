import Link from "next/link";
import {
  getExecutionById,
  listExecutionActivities,
  listExecutionAuditEvents,
  listExecutionPublishedEvents,
  listExecutionTimeline,
} from "./execution-repository";

type DetailSection = "overview" | "timeline" | "audit" | "revisions" | "activities" | "search";

export function ExecutionDetailView(input: { executionId: string; section?: DetailSection }) {
  const execution = getExecutionById(input.executionId);

  if (!execution) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Execution {input.executionId} was not found.
      </div>
    );
  }

  const section = input.section ?? "overview";
  const activities = listExecutionActivities(execution.documentId);
  const auditEvents = listExecutionAuditEvents(execution.documentId);
  const publishedEvents = listExecutionPublishedEvents(execution.documentId);
  const timeline = listExecutionTimeline(execution.documentId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Execution Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{execution.executionNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">{execution.executionName}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{execution.status}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">progress: {execution.progress}%</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">version: {execution.version}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href={`/executions/${execution.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white">Overview</Link>
        <Link href={`/executions/${execution.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white">Timeline</Link>
        <Link href={`/executions/${execution.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white">Revision History</Link>
        <Link href={`/executions/${execution.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white">Audit</Link>
        <Link href={`/executions/${execution.documentId}/search`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white">Search</Link>
      </nav>

      {(section === "overview" || section === "activities") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Execution Activities</h2>
          {activities.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No execution activities recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {activities.map((activity) => (
                <li key={activity.activityId} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                  <p>{activity.sequence}. {activity.status} by {activity.actor}</p>
                  <p className="text-xs text-zinc-500">{activity.timestamp} - {activity.referenceType}:{" "}{activity.referenceId}</p>
                  <p className="text-xs text-zinc-400">{activity.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {section === "overview" && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Execution Lineage</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Schedule ID</dt><dd>{execution.lineage.scheduleId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Production Job ID</dt><dd>{execution.lineage.productionJobId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Operation ID</dt><dd>{execution.lineage.operationId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Routing Version ID</dt><dd>{execution.lineage.routingVersionId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Work Order ID</dt><dd>{execution.lineage.workOrderId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Sales Order ID</dt><dd>{execution.lineage.originSalesOrderId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Quote ID</dt><dd>{execution.lineage.originQuoteId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Organization</dt><dd>{execution.lineage.organizationId}</dd></div>
            <div><dt className="text-zinc-500">Site Reference</dt><dd>{execution.lineage.siteReference ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Correlation</dt><dd>{execution.lineage.correlationId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Causation</dt><dd>{execution.lineage.causationId ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Created By</dt><dd>{execution.lineage.createdBy}</dd></div>
            <div><dt className="text-zinc-500">Created Timestamp</dt><dd>{execution.lineage.createdTimestamp}</dd></div>
          </dl>
        </article>
      )}

      {section === "overview" && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Execution Attributes</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Progress</dt><dd>{execution.progress}%</dd></div>
            <div><dt className="text-zinc-500">Actual Start</dt><dd>{execution.actualStart ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Actual Finish</dt><dd>{execution.actualFinish ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Elapsed Duration</dt><dd>{execution.elapsedDurationMinutes ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Estimated Duration</dt><dd>{execution.estimatedDurationMinutes ?? "none"}</dd></div>
            <div><dt className="text-zinc-500">Notes</dt><dd>{execution.notes ?? "none"}</dd></div>
          </dl>
        </article>
      )}

      {(section === "overview" || section === "revisions") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Revision History</h2>
          {execution.revisionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No revisions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {execution.revisionHistory.map((revision) => (
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

          <h3 className="mt-4 text-sm font-semibold text-zinc-100">Published Execution Events</h3>
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
          Execution search is available at /api/executions/search and in enterprise search.
        </article>
      )}

      {(section === "overview" || section === "search") && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Boundary Scope</h2>
          <p className="mt-2 text-sm text-zinc-300">
            This package certifies execution session tracking only. It intentionally excludes machine control, PLC communication, MES orchestration, hardware drivers, inventory execution, quality execution, maintenance execution, labor scheduling, optimization, and digital twin behavior.
          </p>
        </article>
      )}
    </section>
  );
}
