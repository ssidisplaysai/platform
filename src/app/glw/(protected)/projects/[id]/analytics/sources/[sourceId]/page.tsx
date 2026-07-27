import Link from "next/link";
import { notFound } from "next/navigation";
import { createPrismaGmpAnalyticsRepository } from "@/lib/gmp/analytics-repository";
import { createGmpAnalyticsServices } from "@/lib/gmp/analytics-services";
import { createPrismaGmpRepository } from "@/lib/gmp/repository";
import { GmpAnalyticsSourceOperatorControls } from "@/components/gmp/gmp-analytics-operator-controls";
import { resolveAnalyticsPermissions } from "../../access";

type PageProps = {
  params: Promise<{ id: string; sourceId: string }>;
};

export default async function ProjectAnalyticsSourceDetailPage({ params }: PageProps) {
  const { id, sourceId } = await params;
  if (!id || !sourceId || id.trim().length < 4 || sourceId.trim().length < 4) notFound();

  const permissions = await resolveAnalyticsPermissions("/glw/projects/[id]/analytics/sources/[sourceId]");
  const analyticsRepository = createPrismaGmpAnalyticsRepository();
  const projectRepository = createPrismaGmpRepository();
  const services = createGmpAnalyticsServices({ analyticsRepository, projectRepository });

  const [detail, health, validation, eligibility] = await Promise.all([
    services.getSourceDetail(sourceId),
    services.getSourceHealth(sourceId),
    services.validateSource(sourceId),
    services.evaluateCollectionEligibility({
      projectId: id,
      analyticsSourceId: sourceId,
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: [],
    }),
  ]);

  if (!detail || detail.source.projectId !== id) {
    notFound();
  }

  const validationPayload = validation && typeof validation === "object" && "validation" in validation
    ? (validation.validation as { ok?: unknown } | undefined)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Analytics Source</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{detail.source.sourceName}</h1>
        <p className="mt-1 text-sm text-zinc-400">{detail.source.sourceType} • {detail.source.analyticsSourceId}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">{detail.source.sourceStatus}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">{detail.source.connectionStatus}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">{detail.source.collectionMode}</span>
        </div>
      </section>

      <GmpAnalyticsSourceOperatorControls
        workspaceId="glw-led-display-warehouse"
        projectId={id}
        sourceId={sourceId}
        canValidateSource={permissions.canValidateSource}
        canRunCollection={permissions.canRunCollection}
        canViewCapabilities={permissions.canViewCapabilities}
        canViewHealth={permissions.canViewHealth}
      />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Capabilities</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(detail.capabilities).length === 0 ? (
            <p className="text-sm text-zinc-400">No capabilities discovered.</p>
          ) : (
            Object.entries(detail.capabilities).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{key}</p>
                <p className="mt-1 text-xs text-zinc-400">{value ? "Supported" : "Unsupported"}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Validation Diagnostics</h2>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
          <p>Eligibility: {eligibility?.eligible ? "Eligible" : "Blocked"}</p>
          <p className="mt-1">Blocking issues: {eligibility?.blockingIssues.length ? eligibility.blockingIssues.join(" | ") : "None"}</p>
          <p className="mt-1">Warnings: {eligibility?.warnings.length ? eligibility.warnings.join(" | ") : "None"}</p>
          <p className="mt-1">Validation status: {validationPayload?.ok ? "Connection validated" : "Validation failed or unavailable"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Health</h2>
        {!permissions.canViewHealth ? (
          <p className="mt-2 text-sm text-zinc-400">Health diagnostics are restricted by policy.</p>
        ) : (
          <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
      </section>

      <div>
        <Link href={`/glw/projects/${id}/analytics/sources`} className="text-sm text-cyan-300 hover:text-cyan-200">Back to sources</Link>
      </div>
    </div>
  );
}
