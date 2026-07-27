import React from "react";
import Link from "next/link";
import type { GbaFinanceRoutePermissions } from "@/app/glw/(protected)/finance-agent/access";
import { createPrismaFinanceRepository } from "@/lib/gba/finance-repository";
import { createFinanceRuntimeService } from "@/lib/gba/finance-runtime";

type FinanceWorkspaceMode =
  | "dashboard"
  | "general-ledger"
  | "accounts-receivable"
  | "accounts-payable"
  | "budgets"
  | "forecasting"
  | "profitability"
  | "reports"
  | "kpis"
  | "recommendations"
  | "health"
  | "settings";

const LABEL: Record<FinanceWorkspaceMode, string> = {
  dashboard: "Dashboard",
  "general-ledger": "General Ledger",
  "accounts-receivable": "Accounts Receivable",
  "accounts-payable": "Accounts Payable",
  budgets: "Budgets",
  forecasting: "Forecasting",
  profitability: "Profitability",
  reports: "Executive Reports",
  kpis: "KPIs",
  recommendations: "Recommendations",
  health: "Health",
  settings: "Settings",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaFinanceWorkspace({ mode, permissions }: { mode: FinanceWorkspaceMode; permissions: GbaFinanceRoutePermissions }) {
  const repository = createPrismaFinanceRepository();
  const runtime = createFinanceRuntimeService(repository);

  const [dashboard, ledger, chartOfAccounts, receivables, payables, budgets, profitability, forecasts, kpis, recommendations, reports, health] = await Promise.all([
    runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listGeneralLedger(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listChartOfAccounts(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listAccountsReceivable(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listAccountsPayable(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listBudgets(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listProfitability(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listForecasts(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listKpis(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listRecommendations(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listExecutiveReports(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listHealth(WORKSPACE_ID, ORGANIZATION_ID),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Finance Agent Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Financial command surface for ledger visibility, treasury flow, budget control, profitability analytics, and recommendation governance.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/finance-agent" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Dashboard</Link>
          <Link href="/glw/finance-agent/general-ledger" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">General Ledger</Link>
          <Link href="/glw/finance-agent/accounts-receivable" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">AR</Link>
          <Link href="/glw/finance-agent/accounts-payable" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">AP</Link>
          <Link href="/glw/finance-agent/budgets" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Budgets</Link>
          <Link href="/glw/finance-agent/forecasting" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Forecasting</Link>
          <Link href="/glw/finance-agent/profitability" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Profitability</Link>
          <Link href="/glw/finance-agent/reports" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Reports</Link>
          <Link href="/glw/finance-agent/kpis" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">KPIs</Link>
          <Link href="/glw/finance-agent/recommendations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href="/glw/finance-agent/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/finance-agent/settings" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Settings</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Revenue</p><p className="mt-2 text-2xl text-white">${dashboard.revenueSummary.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Gross Profit</p><p className="mt-2 text-2xl text-white">${dashboard.grossProfit.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Net Profit</p><p className="mt-2 text-2xl text-white">${dashboard.netProfit.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Alerts</p><p className="mt-2 text-2xl text-white">{dashboard.executiveAlerts.value.toFixed(0)}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? (
          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Cash position: ${dashboard.cashPosition.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">AR aging count: {dashboard.arAging.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">AP aging count: {dashboard.apAging.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Outstanding invoices: ${dashboard.outstandingInvoices.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Budget performance: ${dashboard.budgetPerformance.value.toFixed(0)}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Cash flow trend: ${dashboard.cashFlowTrend.value.toFixed(0)}</p>
          </div>
        ) : null}

        {mode === "general-ledger" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>General ledger visibility: {permissions.canViewGeneralLedger ? "enabled" : "restricted"}</p>
            {ledger.length === 0 ? <p className="text-zinc-400">No ledger entries available.</p> : ledger.slice(0, 30).map((entry) => (
              <p key={entry.financeGeneralLedgerEntryId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.postedAt.slice(0, 10)} - {entry.accountCode} - DR {(entry.debitAmountCents / 100).toFixed(0)} / CR {(entry.creditAmountCents / 100).toFixed(0)} - {entry.journalReference}</p>
            ))}
            {chartOfAccounts.length > 0 ? <p className="text-zinc-500 text-xs">Chart of accounts loaded: {chartOfAccounts.length}</p> : null}
          </div>
        ) : null}

        {mode === "accounts-receivable" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {receivables.length === 0 ? <p className="text-zinc-400">No receivable records available.</p> : receivables.slice(0, 30).map((entry) => (
              <p key={entry.financeReceivableId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.customerName} - {entry.invoiceReference} - {(entry.outstandingAmountCents / 100).toFixed(0)} - {entry.agingBucket}</p>
            ))}
          </div>
        ) : null}

        {mode === "accounts-payable" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {payables.length === 0 ? <p className="text-zinc-400">No payable records available.</p> : payables.slice(0, 30).map((entry) => (
              <p key={entry.financePayableId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.vendorName} - {entry.billReference} - {(entry.outstandingAmountCents / 100).toFixed(0)} - {entry.paymentPriority}</p>
            ))}
          </div>
        ) : null}

        {mode === "budgets" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Budget mutation: {permissions.canManageBudgets ? "enabled" : "restricted"}</p>
            {budgets.length === 0 ? <p className="text-zinc-400">No budget records available.</p> : budgets.slice(0, 30).map((entry) => (
              <p key={entry.financeBudgetId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.period} - {entry.budgetScope} - variance {(entry.varianceCents / 100).toFixed(0)}</p>
            ))}
          </div>
        ) : null}

        {mode === "forecasting" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {forecasts.length === 0 ? <p className="text-zinc-400">No forecast records available.</p> : forecasts.slice(0, 20).map((entry) => (
              <p key={entry.financeForecastId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.period} - revenue {(entry.revenueForecastCents / 100).toFixed(0)} - profit {(entry.profitForecastCents / 100).toFixed(0)} - confidence {entry.confidenceScore}</p>
            ))}
          </div>
        ) : null}

        {mode === "profitability" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {profitability.length === 0 ? <p className="text-zinc-400">No profitability snapshots available.</p> : profitability.slice(0, 30).map((entry) => (
              <p key={entry.financeProfitabilitySnapshotId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.dimension} {entry.referenceId} - gross margin {entry.grossMarginPercent.toFixed(1)}% - net margin {entry.netMarginPercent.toFixed(1)}%</p>
            ))}
          </div>
        ) : null}

        {mode === "reports" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {reports.length === 0 ? <p className="text-zinc-400">No executive reports available.</p> : reports.slice(0, 20).map((entry) => (
              <p key={entry.financeExecutiveReportId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.period} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "kpis" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {kpis.length === 0 ? <p className="text-zinc-400">No KPI records available.</p> : kpis.slice(0, 30).map((entry) => (
              <p key={entry.financeKpiId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.name} - {entry.value.toFixed(2)} {entry.unit} - target {entry.target.toFixed(2)}</p>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>
            {recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => (
              <p key={entry.financeRecommendationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.priority} - {entry.confidence} - {entry.status}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.financeHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - overdue AR {entry.overdueReceivables} - overdue AP {entry.overduePayables} - budget overruns {entry.budgetOverruns} - cash risks {entry.cashFlowRiskFlags}</p>
            ))}
          </div>
        ) : null}

        {mode === "settings" ? (
          <div className="mt-4 text-sm text-zinc-300">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Settings is informational in v1.0. No mutable controls are exposed in this freeze scope.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
