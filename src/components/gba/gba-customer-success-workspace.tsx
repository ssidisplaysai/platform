import React from "react";
import Link from "next/link";
import type { GbaCustomerSuccessRoutePermissions } from "@/app/glw/(protected)/customer-success-agent/access";
import { createPrismaCustomerSuccessRepository } from "@/lib/gba/customer-success-repository";
import { createCustomerSuccessRuntimeService } from "@/lib/gba/customer-success-runtime";

type CustomerSuccessWorkspaceMode =
  | "dashboard"
  | "customer-health"
  | "onboarding"
  | "success-plans"
  | "renewals"
  | "satisfaction"
  | "reports"
  | "kpis"
  | "recommendations"
  | "timeline"
  | "health"
  | "settings";

const LABEL: Record<CustomerSuccessWorkspaceMode, string> = {
  dashboard: "Dashboard",
  "customer-health": "Customer Health",
  onboarding: "Onboarding",
  "success-plans": "Success Plans",
  renewals: "Renewals",
  satisfaction: "Customer Satisfaction",
  reports: "Executive Reports",
  kpis: "KPIs",
  recommendations: "Recommendations",
  timeline: "Timeline",
  health: "Health",
  settings: "Settings",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaCustomerSuccessWorkspace({ mode, permissions }: { mode: CustomerSuccessWorkspaceMode; permissions: GbaCustomerSuccessRoutePermissions }) {
  const repository = createPrismaCustomerSuccessRepository();
  const runtime = createCustomerSuccessRuntimeService(repository);

  const [dashboard, customerHealth, onboarding, successPlans, renewals, satisfaction, reports, kpis, recommendations, timeline, health] = await Promise.all([
    runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listCustomerHealth(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listOnboarding(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listSuccessPlans(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listRenewals(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listSatisfaction(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listExecutiveReports(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listKpis(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listRecommendations(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listTimeline(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listHealth(WORKSPACE_ID, ORGANIZATION_ID),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Customer Success Agent Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Post-sale lifecycle intelligence for onboarding, adoption, renewals, retention, and strategic customer outcomes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/customer-success-agent" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Dashboard</Link>
          <Link href="/glw/customer-success-agent/customer-health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Customer Health</Link>
          <Link href="/glw/customer-success-agent/onboarding" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Onboarding</Link>
          <Link href="/glw/customer-success-agent/success-plans" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Success Plans</Link>
          <Link href="/glw/customer-success-agent/renewals" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Renewals</Link>
          <Link href="/glw/customer-success-agent/satisfaction" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Satisfaction</Link>
          <Link href="/glw/customer-success-agent/reports" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Reports</Link>
          <Link href="/glw/customer-success-agent/kpis" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">KPIs</Link>
          <Link href="/glw/customer-success-agent/recommendations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href="/glw/customer-success-agent/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
          <Link href="/glw/customer-success-agent/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/customer-success-agent/settings" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Settings</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Active Customers</p><p className="mt-2 text-2xl text-white">{dashboard.activeCustomers.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Health Summary</p><p className="mt-2 text-2xl text-white">{dashboard.customerHealthSummary.value.toFixed(1)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Renewals Due</p><p className="mt-2 text-2xl text-white">{dashboard.renewalsDue.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Executive Alerts</p><p className="mt-2 text-2xl text-white">{dashboard.executiveCustomerAlerts.value.toFixed(0)}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? (
          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Onboarding progress: {dashboard.onboardingProgress.value.toFixed(1)}%</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Renewal pipeline: ${dashboard.renewalPipeline.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Churn risk: {dashboard.churnRiskSummary.value.toFixed(1)}%</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Expansion opportunities: {dashboard.expansionOpportunities.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Satisfaction trend: {dashboard.customerSatisfactionTrends.value.toFixed(1)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Support activity: {dashboard.supportActivitySummary.value.toFixed(0)}</p>
          </div>
        ) : null}

        {mode === "customer-health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {customerHealth.length === 0 ? <p className="text-zinc-400">No customer health records available.</p> : customerHealth.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - score {entry.overallHealthScore} - risk {entry.riskLevel} - trend {entry.trendDirection}</p>
            ))}
          </div>
        ) : null}

        {mode === "onboarding" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {onboarding.length === 0 ? <p className="text-zinc-400">No onboarding records available.</p> : onboarding.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessOnboardingId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - {entry.status} - go-live {entry.goLiveReadinessPercent}% - adoption {entry.adoptionCheckpointPercent}%</p>
            ))}
          </div>
        ) : null}

        {mode === "success-plans" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {successPlans.length === 0 ? <p className="text-zinc-400">No success plans available.</p> : successPlans.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessPlanId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - review {entry.reviewSchedule} - objectives {entry.strategicObjectives.length}</p>
            ))}
          </div>
        ) : null}

        {mode === "renewals" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {renewals.length === 0 ? <p className="text-zinc-400">No renewal records available.</p> : renewals.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessRenewalId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - probability {entry.renewalProbabilityPercent}% - churn {entry.churnRiskPercent}% - expires {entry.contractExpiresAt.slice(0, 10)}</p>
            ))}
          </div>
        ) : null}

        {mode === "satisfaction" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {satisfaction.length === 0 ? <p className="text-zinc-400">No satisfaction records available.</p> : satisfaction.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessSatisfactionId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - CSAT {entry.csatScore.toFixed(1)} - NPS {entry.npsScore} - trend {entry.sentimentTrend}</p>
            ))}
          </div>
        ) : null}

        {mode === "reports" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {reports.length === 0 ? <p className="text-zinc-400">No executive reports available.</p> : reports.slice(0, 20).map((entry) => (
              <p key={entry.customerSuccessExecutiveReportId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.period} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "kpis" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {kpis.length === 0 ? <p className="text-zinc-400">No KPI records available.</p> : kpis.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessKpiId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.name} - {entry.value.toFixed(2)} {entry.unit} - target {entry.target.toFixed(2)}</p>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>
            {recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessRecommendationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - {entry.category} - {entry.priority} - {entry.status}</p>
            ))}
          </div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline events available.</p> : timeline.slice(0, 30).map((entry) => (
              <p key={entry.customerSuccessTimelineEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No agent health snapshots available.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.customerSuccessAgentHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - at risk {entry.atRiskCustomers} - renewals at risk {entry.renewalsAtRisk} - escalated {entry.escalatedAccounts}</p>
            ))}
          </div>
        ) : null}

        {mode === "settings" ? (
          <div className="mt-4 text-sm text-zinc-300">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Settings is informational in v1.0. No mutable controls are exposed in this scope.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
