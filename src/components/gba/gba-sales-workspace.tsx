import React from "react";
import Link from "next/link";
import type { GbaSalesRoutePermissions } from "@/app/glw/(protected)/sales-agent/access";
import { createPrismaSalesRepository } from "@/lib/gba/sales-repository";
import { createSalesRuntimeService } from "@/lib/gba/sales-runtime";

type SalesWorkspaceMode =
  | "dashboard"
  | "pipeline"
  | "forecasting"
  | "accounts"
  | "recommendations"
  | "timeline"
  | "health";

const LABEL: Record<SalesWorkspaceMode, string> = {
  dashboard: "Dashboard",
  pipeline: "Pipeline",
  forecasting: "Forecasting",
  accounts: "Account Intelligence",
  recommendations: "Recommendations",
  timeline: "Timeline",
  health: "Health",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaSalesWorkspace({ mode, permissions }: { mode: SalesWorkspaceMode; permissions: GbaSalesRoutePermissions }) {
  const repository = createPrismaSalesRepository();
  const runtime = createSalesRuntimeService(repository);

  const [dashboard, pipeline, forecasting, accounts, recommendations, timeline, health] = await Promise.all([
    runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listPipeline(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listForecasts(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listAccounts(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listRecommendations(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listTimeline(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listHealth(WORKSPACE_ID, ORGANIZATION_ID),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Sales Agent Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Revenue command surface for pipeline execution, forecasting, account intelligence, and cross-agent recommendation governance.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/sales-agent" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Dashboard</Link>
          <Link href="/glw/sales-agent/pipeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Pipeline</Link>
          <Link href="/glw/sales-agent/forecasting" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Forecasting</Link>
          <Link href="/glw/sales-agent/accounts" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Accounts</Link>
          <Link href="/glw/sales-agent/recommendations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href="/glw/sales-agent/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
          <Link href="/glw/sales-agent/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Pipeline</p><p className="mt-2 text-2xl text-white">${dashboard.totalPipelineValue.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Forecast</p><p className="mt-2 text-2xl text-white">${dashboard.weightedForecast.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Win Rate</p><p className="mt-2 text-2xl text-white">{dashboard.winRate.value.toFixed(0)}%</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Recommendations</p><p className="mt-2 text-2xl text-white">{recommendations.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? (
          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Cycle time: {dashboard.cycleTimeDays.value.toFixed(0)} days</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Account risk score: {dashboard.accountRiskScore.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Fulfillment readiness: {dashboard.fulfillmentReadiness.value.toFixed(0)}</p>
          </div>
        ) : null}

        {mode === "pipeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Pipeline mutation: {permissions.canManagePipeline ? "enabled" : "restricted"}</p>
            {pipeline.length === 0 ? <p className="text-zinc-400">No pipeline records available.</p> : pipeline.slice(0, 30).map((entry) => (
              <p key={entry.salesPipelineRecordId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.accountName} - {entry.opportunityReference} - {entry.stage} - ${(entry.amountCents / 100).toFixed(0)}</p>
            ))}
          </div>
        ) : null}

        {mode === "forecasting" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {forecasting.length === 0 ? <p className="text-zinc-400">No forecasts available.</p> : forecasting.slice(0, 20).map((entry) => (
              <p key={entry.salesForecastSnapshotId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.period} - weighted ${(entry.weightedAmountCents / 100).toFixed(0)} - confidence {entry.confidence}</p>
            ))}
          </div>
        ) : null}

        {mode === "accounts" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {accounts.length === 0 ? <p className="text-zinc-400">No account intelligence available.</p> : accounts.slice(0, 30).map((entry) => (
              <p key={entry.salesAccountIntelligenceId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.accountName} - health {entry.relationshipHealthScore} - expansion {entry.expansionPotentialScore} - churn risk {entry.churnRiskScore}</p>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>
            {recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => (
              <p key={entry.salesRecommendationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.priority} - {entry.confidence}</p>
            ))}
          </div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline events available.</p> : timeline.slice(0, 30).map((entry) => (
              <p key={entry.salesTimelineEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.salesHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - stalled {entry.stalledOpportunityCount} - account risk {entry.riskyAccountCount} - forecast gaps {entry.forecastGapCount}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
