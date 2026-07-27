import Link from "next/link";
import { notFound } from "next/navigation";
import { createPrismaGmpAnalyticsRepository } from "@/lib/gmp/analytics-repository";
import { createGmpAnalyticsServices } from "@/lib/gmp/analytics-services";
import { createPrismaGmpRepository } from "@/lib/gmp/repository";
import { GmpAnalyticsCollectionOperatorControls } from "@/components/gmp/gmp-analytics-operator-controls";
import { resolveAnalyticsPermissions } from "../../access";

type PageProps = {
  params: Promise<{ id: string; collectionId: string }>;
};

export default async function ProjectAnalyticsCollectionDetailPage({ params }: PageProps) {
  const { id, collectionId } = await params;
  if (!id || !collectionId || id.trim().length < 4 || collectionId.trim().length < 4) notFound();

  const permissions = await resolveAnalyticsPermissions("/glw/projects/[id]/analytics/collections/[collectionId]");
  const analyticsRepository = createPrismaGmpAnalyticsRepository();
  const projectRepository = createPrismaGmpRepository();
  const services = createGmpAnalyticsServices({ analyticsRepository, projectRepository });

  const detail = await services.getCollectionDetail(collectionId);
  if (!detail || detail.collection.projectId !== id) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Collection Detail</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{detail.collection.analyticsCollectionId}</h1>
        <p className="mt-1 text-sm text-zinc-400">Source {detail.source.sourceName} • {detail.source.sourceType}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">{detail.collection.collectionStatus}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">Attempt {detail.collection.attemptNumber}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">Observations {detail.collection.observationCount}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">Rejected {detail.collection.rejectedObservationCount}</span>
        </div>
        <div className="mt-3 text-xs text-zinc-400">
          <p>Parent Collection: {detail.collection.parentCollectionId ?? "None"}</p>
          <p className="mt-1">Safe Failure Reason: {detail.collection.errorSummary ?? "None"}</p>
          <p className="mt-1">Cursor Progression: {JSON.stringify({ sourceCursor: detail.collection.sourceCursor ?? null, nextCursor: detail.collection.nextCursor ?? null })}</p>
        </div>
      </section>

      <GmpAnalyticsCollectionOperatorControls
        workspaceId="glw-led-display-warehouse"
        collectionId={collectionId}
        canRetryCollection={permissions.canRetryCollection}
        retryEligible={detail.retryEligibility.eligible}
        retryReason={detail.retryEligibility.reason}
      />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Timeline</h2>
        {!permissions.canViewCollectionTimeline ? (
          <p className="mt-2 text-sm text-zinc-400">Timeline access is restricted by policy.</p>
        ) : detail.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No timeline events available.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.timeline.map((event) => (
              <article key={event.analyticsCollectionEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{event.eventType}</p>
                <p className="mt-1 text-xs text-zinc-400">{event.occurredAt} • {event.operation} • {event.status}</p>
                {event.outcomeSummary ? <p className="mt-2 text-xs text-zinc-300">{event.outcomeSummary}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Observations</h2>
        {detail.observations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No observations persisted.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {detail.observations.slice(0, 12).map((obs) => (
              <article key={obs.analyticsObservationId} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
                <p className="font-medium text-white">{obs.observationType}</p>
                <p className="mt-1 text-zinc-400">{obs.sourceRecordIdentity}</p>
                <p className="mt-1 text-zinc-400">Quality: {obs.dataQualityStatus}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Retry Lineage</h2>
        {!permissions.canRetryCollection ? (
          <p className="mt-2 text-sm text-zinc-400">Retry controls are restricted by policy.</p>
        ) : detail.children.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No child retry collections yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.children.map((child) => (
              <article key={child.analyticsCollectionId} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{child.analyticsCollectionId}</p>
                <p className="mt-1 text-xs text-zinc-400">Attempt {child.attemptNumber} • {child.collectionStatus}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div>
        <Link href={`/glw/projects/${id}/analytics/collections`} className="text-sm text-cyan-300 hover:text-cyan-200">Back to collections</Link>
      </div>
    </div>
  );
}
