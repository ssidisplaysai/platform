import React from "react";
import Link from "next/link";
import type { GbaExecutiveRoutePermissions } from "@/app/glw/(protected)/executive/access";
import { createPrismaExecutiveRepository } from "@/lib/gba/executive-repository";
import { createExecutiveRuntimeService } from "@/lib/gba/executive-runtime";

type ExecutiveWorkspaceMode =
  | "dashboard"
  | "briefings"
  | "goals"
  | "kpis"
  | "recommendations"
  | "risks"
  | "opportunities"
  | "delegations"
  | "health"
  | "timeline"
  | "approvals";

const LABEL: Record<ExecutiveWorkspaceMode, string> = {
  dashboard: "Dashboard",
  briefings: "Executive Briefings",
  goals: "Goals",
  kpis: "KPIs",
  recommendations: "Recommendations",
  risks: "Risks",
  opportunities: "Opportunities",
  delegations: "Delegations",
  health: "Enterprise Health",
  timeline: "Activity Timeline",
  approvals: "Approvals",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaExecutiveWorkspace({ mode, permissions }: { mode: ExecutiveWorkspaceMode; permissions: GbaExecutiveRoutePermissions }) {
  const repository = createPrismaExecutiveRepository();
  const runtime = createExecutiveRuntimeService(repository);

  const [dashboard, briefings, goals, kpis, recommendations, risks, opportunities, delegations, health, timeline, approvals] = await Promise.all([
    runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listBriefings(WORKSPACE_ID),
    runtime.listGoals(WORKSPACE_ID),
    runtime.listKpis(WORKSPACE_ID),
    runtime.listRecommendations(WORKSPACE_ID),
    runtime.listRisks(WORKSPACE_ID),
    runtime.listOpportunities(WORKSPACE_ID),
    runtime.listDelegations(WORKSPACE_ID),
    runtime.listHealth(WORKSPACE_ID),
    runtime.listTimeline(WORKSPACE_ID),
    runtime.listApprovals(WORKSPACE_ID),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Executive Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Enterprise executive operating surface for health visibility, strategic recommendations, goals, KPIs, and cross-agent delegation.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/executive" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Dashboard</Link>
          <Link href="/glw/executive/briefings" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Briefings</Link>
          <Link href="/glw/executive/goals" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Goals</Link>
          <Link href="/glw/executive/kpis" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">KPIs</Link>
          <Link href="/glw/executive/recommendations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href="/glw/executive/risks" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Risks</Link>
          <Link href="/glw/executive/opportunities" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Opportunities</Link>
          <Link href="/glw/executive/delegations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Delegations</Link>
          <Link href="/glw/executive/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/executive/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
          <Link href="/glw/executive/approvals" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Approvals</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Revenue</p><p className="mt-2 text-2xl text-white">{dashboard.revenue.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Profit</p><p className="mt-2 text-2xl text-white">{dashboard.profit.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Goals</p><p className="mt-2 text-2xl text-white">{goals.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Risks</p><p className="mt-2 text-2xl text-white">{risks.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Recommendations</p><p className="mt-2 text-2xl text-white">{recommendations.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? (
          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Cash flow: {dashboard.cashFlow.value.toFixed(0)} ({dashboard.cashFlow.trend.toFixed(1)} trend)</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Sales pipeline: {dashboard.salesPipeline.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">System health: {dashboard.systemHealth.value}</p>
          </div>
        ) : null}

        {mode === "briefings" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Briefing generation: {permissions.canGenerateBriefings ? "enabled" : "restricted"}</p>
            {briefings.length === 0 ? <p className="text-zinc-400">No briefings generated yet.</p> : briefings.slice(0, 20).map((entry) => (
              <p key={entry.briefingId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.period} - {entry.executiveSummary}</p>
            ))}
          </div>
        ) : null}

        {mode === "goals" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Goal management: {permissions.canManageGoals ? "enabled" : "restricted"}</p>
            {goals.length === 0 ? <p className="text-zinc-400">No goals defined.</p> : goals.slice(0, 30).map((entry) => (
              <p key={entry.goalId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.title} - {entry.progressPercent}% - {entry.status}</p>
            ))}
          </div>
        ) : null}

        {mode === "kpis" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>KPI management: {permissions.canManageKpis ? "enabled" : "restricted"}</p>
            {kpis.length === 0 ? <p className="text-zinc-400">No KPIs configured.</p> : kpis.slice(0, 30).map((entry) => (
              <p key={entry.kpiId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.name} - target {entry.target}{entry.unit} - latest {entry.latest?.measuredValue ?? "n/a"}</p>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>
            {recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => (
              <p key={entry.recommendationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.priority} - {entry.confidence}</p>
            ))}
          </div>
        ) : null}

        {mode === "risks" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Risk management: {permissions.canManageRisks ? "enabled" : "restricted"}</p>
            {risks.length === 0 ? <p className="text-zinc-400">No risks tracked.</p> : risks.slice(0, 30).map((entry) => (
              <p key={entry.riskId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - P{entry.probability}/I{entry.impact}</p>
            ))}
          </div>
        ) : null}

        {mode === "opportunities" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {opportunities.length === 0 ? <p className="text-zinc-400">No opportunities tracked.</p> : opportunities.slice(0, 30).map((entry) => (
              <p key={entry.opportunityId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.projectedImpact}</p>
            ))}
          </div>
        ) : null}

        {mode === "delegations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Delegation rights: {permissions.canDelegateWork ? "enabled" : "restricted"}</p>
            {delegations.length === 0 ? <p className="text-zinc-400">No delegation records.</p> : delegations.slice(0, 30).map((entry) => (
              <p key={entry.delegationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.targetAgent} - execution {entry.orchestrationExecutionId}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.healthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - critical risks {entry.criticalRiskCount} - behind goals {entry.behindGoalCount}</p>
            ))}
          </div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline events.</p> : timeline.slice(0, 30).map((entry) => (
              <p key={entry.timelineEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "approvals" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {approvals.length === 0 ? <p className="text-zinc-400">No approvals queued.</p> : approvals.slice(0, 30).map((entry) => (
              <p key={entry.approvalId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.subjectType} - {entry.state}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
