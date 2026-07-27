import React from "react";
import Link from "next/link";
import type { GbaMarketingRoutePermissions } from "@/app/glw/(protected)/marketing-agent/access";
import { createPrismaMarketingRepository } from "@/lib/gba/marketing-repository";
import { createMarketingRuntimeService } from "@/lib/gba/marketing-runtime";

type MarketingWorkspaceMode =
  | "dashboard"
  | "campaigns"
  | "strategy"
  | "seo"
  | "brand-governance"
  | "analytics"
  | "recommendations"
  | "timeline"
  | "health"
  | "executive-reports";

const LABEL: Record<MarketingWorkspaceMode, string> = {
  dashboard: "Dashboard",
  campaigns: "Campaign Planning",
  strategy: "Content Strategy",
  seo: "SEO Intelligence",
  "brand-governance": "Brand Governance",
  analytics: "Analytics",
  recommendations: "Recommendations",
  timeline: "Timeline",
  health: "Health",
  "executive-reports": "Executive Reports",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaMarketingWorkspace({ mode, permissions }: { mode: MarketingWorkspaceMode; permissions: GbaMarketingRoutePermissions }) {
  const repository = createPrismaMarketingRepository();
  const runtime = createMarketingRuntimeService(repository);
  const dashboard = await runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID);
  const projectId = dashboard.projectId;

  const [campaigns, strategy, seo, brandGovernance, analytics, recommendations, timeline, health, executiveReports] = await Promise.all([
    runtime.listCampaignPlans(projectId),
    runtime.listContentStrategies(projectId),
    runtime.listSeoIntelligence(projectId),
    runtime.listBrandGovernanceReviews(projectId),
    runtime.listAnalyticsSnapshots(projectId),
    runtime.listRecommendations(projectId),
    runtime.listTimeline(projectId),
    runtime.listHealth(projectId),
    runtime.listExecutiveReports(projectId),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-amber-800/60 bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.18),_transparent_40%),linear-gradient(180deg,_rgba(24,18,11,0.96),_rgba(9,7,5,0.98))] p-5 shadow-[0_0_60px_rgba(217,119,6,0.08)] sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-amber-200/60">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Marketing Agent Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm text-amber-50/70">Marketing intelligence surface for campaign planning, content strategy, SEO insight, brand governance, analytics synthesis, and recommendation review. The agent consumes the certified GMP kernel; it does not replace it.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/marketing-agent" className="rounded-lg border border-amber-700/80 bg-amber-950/50 px-3 py-2 text-xs text-amber-50">Dashboard</Link>
          <Link href="/glw/marketing-agent/campaigns" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Campaigns</Link>
          <Link href="/glw/marketing-agent/strategy" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Strategy</Link>
          <Link href="/glw/marketing-agent/seo" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">SEO</Link>
          <Link href="/glw/marketing-agent/brand-governance" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Brand Governance</Link>
          <Link href="/glw/marketing-agent/analytics" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Analytics</Link>
          <Link href="/glw/marketing-agent/recommendations" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Recommendations</Link>
          <Link href="/glw/marketing-agent/timeline" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Timeline</Link>
          <Link href="/glw/marketing-agent/health" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Health</Link>
          <Link href="/glw/marketing-agent/executive-reports" className="rounded-lg border border-amber-700/80 px-3 py-2 text-xs text-amber-50">Executive Reports</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">Campaigns</p><p className="mt-2 text-2xl text-white">{campaigns.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">Strategy</p><p className="mt-2 text-2xl text-white">{strategy[0]?.status ?? "DRAFT"}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">SEO Score</p><p className="mt-2 text-2xl text-white">{seo[0]?.score ?? 0}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">Recommendations</p><p className="mt-2 text-2xl text-white">{recommendations.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">Health</p><p className="mt-2 text-2xl text-white">{health[0]?.status ?? "HEALTHY"}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3"><p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">Project: {dashboard.projectName}</p><p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">Active campaigns: {dashboard.activeCampaigns}</p><p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">Health score: {dashboard.healthScore}</p></div> : null}

        {mode === "campaigns" ? <div className="mt-4 space-y-2 text-sm text-zinc-300"><p>Campaign planning: {permissions.canManageCampaigns ? "enabled" : "restricted"}</p>{campaigns.length === 0 ? <p className="text-zinc-400">No campaign plans available.</p> : campaigns.slice(0, 30).map((entry) => <p key={entry.marketingCampaignPlanId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.campaignName} - {entry.status} - budget ${(entry.budgetCents / 100).toFixed(0)}</p>)}</div> : null}

        {mode === "strategy" ? <div className="mt-4 space-y-2 text-sm text-zinc-300"><p>Strategy management: {permissions.canManageStrategy ? "enabled" : "restricted"}</p>{strategy.length === 0 ? <p className="text-zinc-400">No strategy records available.</p> : strategy.slice(0, 30).map((entry) => <p key={entry.marketingContentStrategyId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.title} - {entry.status} - pillars {entry.pillarTopics.length}</p>)}</div> : null}

        {mode === "seo" ? <div className="mt-4 space-y-2 text-sm text-zinc-300">{seo.length === 0 ? <p className="text-zinc-400">No SEO intelligence available.</p> : seo.slice(0, 30).map((entry) => <p key={entry.marketingSeoIntelligenceId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.primaryKeyword} - score {entry.score} - blockers {entry.blockers.length}</p>)}</div> : null}

        {mode === "brand-governance" ? <div className="mt-4 space-y-2 text-sm text-zinc-300"><p>Governance management: {permissions.canManageBrandGovernance ? "enabled" : "restricted"}</p>{brandGovernance.length === 0 ? <p className="text-zinc-400">No brand reviews available.</p> : brandGovernance.slice(0, 30).map((entry) => <p key={entry.marketingBrandGovernanceReviewId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.reviewState} - {entry.notes}</p>)}</div> : null}

        {mode === "analytics" ? <div className="mt-4 space-y-2 text-sm text-zinc-300">{analytics.length === 0 ? <p className="text-zinc-400">No analytics snapshots available.</p> : analytics.slice(0, 30).map((entry) => <p key={entry.marketingAnalyticsSnapshotId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">Traffic {entry.trafficScore} - engagement {entry.engagementScore} - conversions {entry.conversionScore}</p>)}</div> : null}

        {mode === "recommendations" ? <div className="mt-4 space-y-2 text-sm text-zinc-300"><p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>{recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => <p key={entry.marketingRecommendationId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.priority} - {entry.confidence}</p>)}</div> : null}

        {mode === "timeline" ? <div className="mt-4 space-y-2 text-sm text-zinc-300">{timeline.length === 0 ? <p className="text-zinc-400">No timeline events available.</p> : timeline.slice(0, 30).map((entry) => <p key={entry.marketingTimelineEventId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.eventType} - {entry.summary}</p>)}</div> : null}

        {mode === "health" ? <div className="mt-4 space-y-2 text-sm text-zinc-300"><p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>{health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.slice(0, 20).map((entry) => <p key={entry.marketingHealthId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.status} - backlog {entry.reviewBacklog} - SEO risks {entry.seoRisks}</p>)}</div> : null}

        {mode === "executive-reports" ? <div className="mt-4 space-y-2 text-sm text-zinc-300">{executiveReports.length === 0 ? <p className="text-zinc-400">No executive reports available.</p> : executiveReports.slice(0, 20).map((entry) => <p key={entry.marketingExecutiveReportId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">{entry.period} - {entry.summary}</p>)}</div> : null}
      </section>
    </div>
  );
}
