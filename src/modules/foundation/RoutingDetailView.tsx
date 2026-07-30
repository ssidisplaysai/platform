import Link from "next/link";
import {
  getRoutingById,
  listRoutingAuditEvents,
  listRoutingPublishedEvents,
  listRoutingTimeline,
  listRoutingVersions,
  searchRoutingRegistry,
} from "./routing-repository";

export function RoutingDetailView(input: { routingId: string; section?: string }) {
  const routing = getRoutingById(input.routingId);

  if (!routing) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Routing not found.
      </section>
    );
  }

  const versions = listRoutingVersions(input.routingId);
  const auditEvents = listRoutingAuditEvents(input.routingId);
  const timeline = listRoutingTimeline(input.routingId);
  const publishedEvents = listRoutingPublishedEvents(input.routingId);
  const searchResults = searchRoutingRegistry({ organizationId: routing.organizationId, query: routing.routingNumber });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Routing Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{routing.routingNumber}</h1>
        <p className="mt-2 text-sm text-zinc-400">{routing.routingName}</p>
        <p className="mt-2 text-sm text-zinc-500">Section: {input.section ?? "overview"}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link href={`/routings/${routing.documentId}/versions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:border-amber-400 hover:text-white">Versions</Link>
          <Link href={`/routings/${routing.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:border-amber-400 hover:text-white">Timeline</Link>
          <Link href={`/routings/${routing.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:border-amber-400 hover:text-white">Audit</Link>
          <Link href={`/routings/${routing.documentId}/revisions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:border-amber-400 hover:text-white">Revisions</Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Lineage</h2>
          <dl className="mt-4 space-y-2 text-zinc-400">
            <div><dt className="inline text-zinc-500">Production Job:</dt> {routing.lineage.productionJobId ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Work Order:</dt> {routing.lineage.workOrderId ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Sales Order:</dt> {routing.lineage.originSalesOrderId ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Quote:</dt> {routing.lineage.originQuoteId ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Organization:</dt> {routing.lineage.organizationId}</div>
            <div><dt className="inline text-zinc-500">Site:</dt> {routing.lineage.siteReference ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Correlation:</dt> {routing.lineage.correlationId ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Causation:</dt> {routing.lineage.causationId ?? "none"}</div>
          </dl>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Routing Definition</h2>
          <dl className="mt-4 space-y-2 text-zinc-400">
            <div><dt className="inline text-zinc-500">Version:</dt> {routing.version}</div>
            <div><dt className="inline text-zinc-500">Status:</dt> {routing.status}</div>
            <div><dt className="inline text-zinc-500">Product:</dt> {routing.productReference ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Assembly:</dt> {routing.assemblyReference ?? "none"}</div>
            <div><dt className="inline text-zinc-500">Operation Count:</dt> {routing.operationSequence.length}</div>
            <div><dt className="inline text-zinc-500">Reference Documents:</dt> {routing.referenceDocuments.join(", ") || "none"}</div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Operation Sequence</h2>
          <ul className="mt-4 space-y-2 text-zinc-400">
            {routing.operationSequence.map((step) => (
              <li key={step.stepId} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="font-medium text-white">{step.sequenceNumber}. {step.operationReference}</div>
                <div className="text-xs text-zinc-500">Step {step.stepId}</div>
                <div className="text-xs text-zinc-500">Predecessors: {step.predecessorOperationIds.join(", ") || "none"}</div>
                <div className="text-xs text-zinc-500">Successors: {step.successorOperationIds.join(", ") || "none"}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Boundary</h2>
          <p className="mt-2 text-zinc-400">
            Routing is declarative and reference-only. It does not schedule, assign, or execute manufacturing activity.
          </p>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
            {searchResults.length > 0 ? `Search confirms ${searchResults.length} routing registry match(es).` : "No search matches returned for this routing number."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Version History</h2>
          <ul className="mt-4 space-y-2 text-zinc-400">
            {versions.map((version) => (
              <li key={version.routingVersionId} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="font-medium text-white">Version {version.versionNumber}</div>
                <div className="text-xs text-zinc-500">{version.reason}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Timeline</h2>
          <ul className="mt-4 space-y-2 text-zinc-400">
            {timeline.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="font-medium text-white">{entry.title}</div>
                <div className="text-xs text-zinc-500">{entry.category}</div>
                <div className="text-xs text-zinc-500">{entry.detail}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Audit</h2>
          <ul className="mt-4 space-y-2 text-zinc-400">
            {auditEvents.map((event) => (
              <li key={event.eventId} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="font-medium text-white">{event.action}</div>
                <div className="text-xs text-zinc-500">{event.previousState} -&gt; {event.resultingState}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        <h2 className="text-base font-semibold text-white">Published Events</h2>
        <ul className="mt-4 space-y-2 text-zinc-400">
          {publishedEvents.map((event) => (
            <li key={event.eventId} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="font-medium text-white">{event.type}</div>
              <div className="text-xs text-zinc-500">Version {event.aggregateVersion}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}