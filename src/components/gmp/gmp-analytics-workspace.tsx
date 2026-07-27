import React from "react";
import Link from "next/link";
import { createPrismaGmpAnalyticsRepository } from "@/lib/gmp/analytics-repository";
import { createGmpAnalyticsServices } from "@/lib/gmp/analytics-services";
import { createPrismaGmpEvidenceRepository } from "@/lib/gmp/evidence-repository";
import { createGmpEvidenceServices } from "@/lib/gmp/evidence-services";
import { createPrismaGmpRecommendationRepository } from "@/lib/gmp/recommendation-repository";
import { createGmpRecommendationServices } from "@/lib/gmp/recommendation-services";
import { createPrismaGmpRepository } from "@/lib/gmp/repository";
import { createPrismaGmpPublishingRepository } from "@/lib/gmp/publishing-repository";

type AnalyticsMode =
  | "overview"
  | "sources"
  | "collections"
  | "performance"
  | "evidence"
  | "evidence-snapshots"
  | "compiler-runs"
  | "correlation-review"
  | "metric-catalog"
  | "recommendations"
  | "attribution"
  | "decision-support"
  | "rule-catalog"
  | "recommendation-detail";

type AnalyticsPermissions = {
  canManageSources: boolean;
  canRunCollection: boolean;
  canViewConfiguration: boolean;
  canManageConfiguration: boolean;
  canValidateSource?: boolean;
  canViewCapabilities?: boolean;
  canViewHealth?: boolean;
  canViewCollections?: boolean;
  canViewCollectionDetail?: boolean;
  canRetryCollection?: boolean;
  canViewCollectionTimeline?: boolean;
  canViewEvidence?: boolean;
  canViewEvidenceSnapshots?: boolean;
  canViewCompilerRuns?: boolean;
  canRunEvidenceCompiler?: boolean;
  canReplayCompilation?: boolean;
  canViewMetricCatalog?: boolean;
  canViewRecommendations?: boolean;
  canReviewRecommendations?: boolean;
  canDismissRecommendations?: boolean;
  canReplayRecommendationEngine?: boolean;
  canViewAttribution?: boolean;
  canViewRuleCatalog?: boolean;
  canViewDecisionSupport?: boolean;
};

const modeLabel: Record<AnalyticsMode, string> = {
  overview: "Overview",
  sources: "Sources",
  collections: "Collections",
  performance: "Performance",
  evidence: "Evidence",
  "evidence-snapshots": "Evidence Snapshots",
  "compiler-runs": "Compiler Runs",
  "correlation-review": "Correlation Review",
  "metric-catalog": "Metric Catalog",
  recommendations: "Recommendations",
  attribution: "Attribution",
  "decision-support": "Decision Support",
  "rule-catalog": "Rule Catalog",
  "recommendation-detail": "Recommendation Detail",
};

function StatusPill({ value }: { value: string }) {
  return <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">{value}</span>;
}

export async function GmpAnalyticsWorkspace({
  projectId,
  mode,
  permissions,
  recommendationId,
}: {
  projectId: string;
  mode: AnalyticsMode;
  permissions: AnalyticsPermissions;
  recommendationId?: string;
}) {
  const analyticsRepository = createPrismaGmpAnalyticsRepository();
  const evidenceRepository = createPrismaGmpEvidenceRepository();
  const recommendationRepository = createPrismaGmpRecommendationRepository();
  const projectRepository = createPrismaGmpRepository();
  const publishingRepository = createPrismaGmpPublishingRepository();
  const services = createGmpAnalyticsServices({ analyticsRepository, projectRepository });
  const evidenceServices = createGmpEvidenceServices({
    projectRepository,
    analyticsRepository,
    publishingRepository,
    evidenceRepository,
  });
  const recommendationServices = createGmpRecommendationServices({
    projectRepository,
    evidenceRepository,
    recommendationRepository,
  });

  const [sources, collections, snapshots, metricDefinitions, foundationConfig, evidenceSnapshots, compilerRuns, evidenceMetrics, evidencePublications, evidenceCatalog, recommendations, attribution, decisionSupport, recommendationCatalog] = await Promise.all([
    services.listSources(projectId),
    services.listCollections(projectId),
    services.listSnapshots(projectId),
    services.listMetricDefinitions(projectId),
    services.ensureFoundationConfig(projectId),
    evidenceServices.listSnapshots(projectId),
    evidenceServices.listCompilerRuns(projectId),
    evidenceServices.listMetrics({ projectId }),
    evidenceServices.listPublications({ projectId }),
    evidenceServices.listMetricCatalog(projectId),
    recommendationServices.listRecommendations({ projectId }),
    recommendationServices.listAttribution({ projectId }),
    recommendationServices.listDecisionSupport({ projectId }),
    recommendationServices.listRuleCatalog(projectId),
  ]);

  const recommendationDetail = mode === "recommendation-detail" && recommendationId
    ? await recommendationServices.getRecommendationDetail(recommendationId)
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Analytics Foundation v1.0</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Project Analytics Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Foundation slice for source onboarding, governed metric collection, immutable snapshots, and measurement lineage.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/glw/projects/${projectId}/analytics`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Overview</Link>
          <Link href={`/glw/projects/${projectId}/analytics/overview`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Overview Detail</Link>
          <Link href={`/glw/projects/${projectId}/analytics/sources`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Sources</Link>
          <Link href={`/glw/projects/${projectId}/analytics/collections`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Collections</Link>
          <Link href={`/glw/projects/${projectId}/analytics/performance`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Performance</Link>
          <Link href={`/glw/projects/${projectId}/analytics/evidence`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Evidence</Link>
          <Link href={`/glw/projects/${projectId}/analytics/evidence/snapshots`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Evidence Snapshots</Link>
          <Link href={`/glw/projects/${projectId}/analytics/evidence/runs`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Compiler Runs</Link>
          <Link href={`/glw/projects/${projectId}/analytics/evidence/correlation`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Correlation Review</Link>
          <Link href={`/glw/projects/${projectId}/analytics/evidence/catalog`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Metric Catalog</Link>
          <Link href={`/glw/projects/${projectId}/analytics/recommendations`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href={`/glw/projects/${projectId}/analytics/recommendations/attribution`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Attribution</Link>
          <Link href={`/glw/projects/${projectId}/analytics/recommendations/decision-support`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Decision Support</Link>
          <Link href={`/glw/projects/${projectId}/analytics/recommendations/catalog`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Rule Catalog</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Active Sources</p><p className="mt-2 text-2xl text-white">{sources.filter((item) => item.sourceStatus === "ACTIVE").length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Collections</p><p className="mt-2 text-2xl text-white">{collections.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Snapshots</p><p className="mt-2 text-2xl text-white">{snapshots.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Metric Definitions</p><p className="mt-2 text-2xl text-white">{metricDefinitions.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{modeLabel[mode]}</h2>

        {mode === "overview" ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <p>Evidence Compiler: {foundationConfig.compilerVersion.compilerVersion}</p>
            <p>Attribution Registry: {foundationConfig.attributionRegistryVersion}</p>
            <p>Recommendation Registry: {foundationConfig.recommendationRegistryVersion}</p>
            <p className="text-zinc-400">
              This surface is intentionally additive and server-driven. Advanced attribution, recommendation logic, and third-party analytics transport remain out of scope for this slice.
            </p>
          </div>
        ) : null}

        {mode === "sources" ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {permissions.canManageSources ? "Source registration is enabled via /api/gmp/analytics/sources." : "Read-only mode: source registration is restricted by policy."}
            </div>
            {sources.length === 0 ? <p className="text-sm text-zinc-400">No analytics sources registered.</p> : sources.map((source) => (
              <article key={source.analyticsSourceId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{source.sourceName}</p>
                <p className="mt-1 text-xs text-zinc-400">{source.sourceType} • {source.analyticsSourceId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={source.sourceStatus} />
                  <StatusPill value={source.connectionStatus} />
                  <StatusPill value={source.collectionMode} />
                </div>
                <div className="mt-3">
                  <Link href={`/glw/projects/${projectId}/analytics/sources/${source.analyticsSourceId}`} className="text-xs text-cyan-300 hover:text-cyan-200">
                    View source detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "collections" ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {permissions.canRunCollection ? "Collection runs are enabled via /api/gmp/analytics/collections." : "Read-only mode: collection execution is restricted by policy."}
            </div>
            {collections.length === 0 ? <p className="text-sm text-zinc-400">No collections recorded.</p> : collections.map((collection) => (
              <article key={collection.analyticsCollectionId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{collection.analyticsCollectionId}</p>
                <p className="mt-1 text-xs text-zinc-400">Source {collection.analyticsSourceId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={collection.collectionStatus} />
                  <StatusPill value={collection.eligibilityVersion} />
                </div>
                {collection.blockingIssues.length > 0 ? <p className="mt-2 text-xs text-rose-300">Blocking: {collection.blockingIssues.join(" | ")}</p> : null}
                <div className="mt-3">
                  <Link href={`/glw/projects/${projectId}/analytics/collections/${collection.analyticsCollectionId}`} className="text-xs text-cyan-300 hover:text-cyan-200">
                    View collection detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "performance" ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {permissions.canViewConfiguration ? "Snapshot visibility is enabled." : "Snapshot visibility is restricted by policy."}
            </div>
            {snapshots.length === 0 ? <p className="text-sm text-zinc-400">No snapshots generated yet.</p> : snapshots.map((snapshot) => (
              <article key={snapshot.performanceSnapshotId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{snapshot.snapshotLabel}</p>
                <p className="mt-1 text-xs text-zinc-400">{snapshot.performanceSnapshotId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={snapshot.snapshotStatus} />
                  <StatusPill value={`${snapshot.totalMetrics} metrics`} />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "evidence" ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {permissions.canRunEvidenceCompiler
                ? "Evidence compiler execution is enabled through /api/gmp/evidence/recompile."
                : "Read-only mode: evidence compiler execution is restricted by policy."}
            </div>
            <p>Evidence snapshots: {evidenceSnapshots.length}</p>
            <p>Compiler runs: {compilerRuns.length}</p>
            <p>Compiled metrics: {evidenceMetrics.length}</p>
            <p>Publication correlations: {evidencePublications.length}</p>
            <p>Metric catalog entries: {evidenceCatalog.length}</p>
          </div>
        ) : null}

        {mode === "evidence-snapshots" ? (
          <div className="mt-4 space-y-3">
            {evidenceSnapshots.length === 0 ? <p className="text-sm text-zinc-400">No evidence snapshots compiled yet.</p> : evidenceSnapshots.map((snapshot) => (
              <article key={snapshot.evidenceSnapshotId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{snapshot.evidenceSnapshotId}</p>
                <p className="mt-1 text-xs text-zinc-400">{snapshot.cadence} • {snapshot.periodStart.slice(0, 10)}..{snapshot.periodEnd.slice(0, 10)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={snapshot.dataQualityStatus} />
                  <StatusPill value={snapshot.evidenceConfidence} />
                  <StatusPill value={`${snapshot.sourceObservationCount} observations`} />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "compiler-runs" ? (
          <div className="mt-4 space-y-3">
            {compilerRuns.length === 0 ? <p className="text-sm text-zinc-400">No compiler runs recorded.</p> : compilerRuns.map((run) => (
              <article key={run.evidenceCompilerRunId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{run.evidenceCompilerRunId}</p>
                <p className="mt-1 text-xs text-zinc-400">{run.triggerType} • {run.cadence} • {run.createdAt}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={run.runStatus} />
                  <StatusPill value={run.qualityStatus} />
                  <StatusPill value={run.confidenceStatus} />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "correlation-review" ? (
          <div className="mt-4 space-y-3">
            {evidencePublications.length === 0 ? <p className="text-sm text-zinc-400">No publication correlations compiled.</p> : evidencePublications.map((reference) => (
              <article key={reference.evidencePublicationReferenceId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{reference.canonicalUrl}</p>
                <p className="mt-1 text-xs text-zinc-400">Publication: {reference.publicationIdentity}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={reference.publicationStatus} />
                  <StatusPill value={reference.correlationQuality} />
                  <StatusPill value={`${reference.matchedObservationIds.length} matches`} />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "metric-catalog" ? (
          <div className="mt-4 space-y-3">
            {evidenceCatalog.length === 0 ? <p className="text-sm text-zinc-400">Metric catalog is empty.</p> : evidenceCatalog.map((metric) => (
              <article key={metric.metricDefinitionId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{metric.displayName}</p>
                <p className="mt-1 text-xs text-zinc-400">{metric.metricKey}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={metric.aggregationMethod} />
                  <StatusPill value={metric.valueType} />
                  <StatusPill value={metric.unit} />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {permissions.canReplayRecommendationEngine
                ? "Recommendation replay execution is enabled through /api/gmp/recommendations/replay."
                : "Read-only mode: recommendation replay execution is restricted by policy."}
            </div>
            {recommendations.length === 0 ? <p className="text-sm text-zinc-400">No recommendations recorded yet.</p> : recommendations.map((recommendation) => (
              <article key={recommendation.recommendationId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{recommendation.ruleId}</p>
                <p className="mt-1 text-xs text-zinc-400">{recommendation.category} • {recommendation.lifecycleState}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={recommendation.severity} />
                  <StatusPill value={recommendation.priority} />
                  <StatusPill value={recommendation.confidence} />
                </div>
                <p className="mt-2 text-xs text-zinc-400">{recommendation.explanation}</p>
                <div className="mt-3">
                  <Link href={`/glw/projects/${projectId}/analytics/recommendations/${recommendation.recommendationId}`} className="text-xs text-cyan-300 hover:text-cyan-200">
                    View recommendation detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "attribution" ? (
          <div className="mt-4 space-y-3">
            {attribution.length === 0 ? <p className="text-sm text-zinc-400">No attribution analyses recorded.</p> : attribution.map((entry) => (
              <article key={entry.analysis.attributionAnalysisId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{entry.analysis.attributionAnalysisId}</p>
                <p className="mt-1 text-xs text-zinc-400">{entry.analysis.attributionVersion} • {entry.analysis.evidenceSnapshotId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={`${entry.results.length} dimensions`} />
                  <StatusPill value={`${entry.analysis.attributionWindowDays} days`} />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "decision-support" ? (
          <div className="mt-4 space-y-3">
            {decisionSupport.length === 0 ? <p className="text-sm text-zinc-400">No decision support summaries recorded.</p> : decisionSupport.map((summary) => (
              <article key={summary.decisionSupportSummaryId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{summary.summaryType}</p>
                <p className="mt-1 text-xs text-zinc-400">{summary.summaryKey}</p>
                <p className="mt-2 text-xs text-zinc-400">Checksum: {summary.summaryChecksum.slice(0, 16)}...</p>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "rule-catalog" ? (
          <div className="mt-4 space-y-3">
            {recommendationCatalog.length === 0 ? <p className="text-sm text-zinc-400">Rule catalog is empty.</p> : recommendationCatalog.map((rule) => (
              <article key={`${rule.ruleId}-${rule.ruleVersion}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{rule.ruleId}</p>
                <p className="mt-1 text-xs text-zinc-400">v{rule.ruleVersion} • {rule.registryVersion}</p>
                <p className="mt-2 text-xs text-zinc-400">{rule.description}</p>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "recommendation-detail" ? (
          <div className="mt-4 space-y-3">
            {!recommendationDetail ? <p className="text-sm text-zinc-400">Recommendation detail not found.</p> : (
              <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-medium text-white">{recommendationDetail.recommendation.ruleId}</p>
                <p className="mt-1 text-xs text-zinc-400">Recommendation {recommendationDetail.recommendation.recommendationId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={recommendationDetail.recommendation.severity} />
                  <StatusPill value={recommendationDetail.recommendation.priority} />
                  <StatusPill value={recommendationDetail.recommendation.confidence} />
                </div>
                <p className="mt-2 text-xs text-zinc-300">{recommendationDetail.recommendation.explanation}</p>
                <p className="mt-2 text-xs text-zinc-400">Action: {recommendationDetail.recommendation.recommendedAction}</p>
                <p className="mt-2 text-xs text-zinc-400">Rule version: {recommendationDetail.recommendation.ruleVersion}</p>
                <p className="mt-2 text-xs text-zinc-400">Snapshot lineage: {recommendationDetail.recommendation.evidenceSnapshotId}</p>
                <p className="mt-2 text-xs text-zinc-400">Lifecycle events: {recommendationDetail.lifecycle.length}</p>
              </article>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6 text-sm text-zinc-400">
        <p>Configuration access: {permissions.canManageConfiguration ? "Manage" : "View only"}</p>
        <p className="mt-1">All analytics and evidence values shown here originate from repository-backed server compilation with immutable raw observations and immutable snapshots.</p>
      </section>
    </div>
  );
}
