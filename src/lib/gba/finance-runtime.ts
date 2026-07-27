import { createEnterpriseDomainRuntimeService } from "@/lib/ged/enterprise-domain-runtime";
import { createPrismaEnterpriseDomainRepository } from "@/lib/ged/enterprise-domain-repository";
import { createSalesRuntimeService } from "./sales-runtime";
import { createPrismaSalesRepository } from "./sales-repository";
import { createOperationsRuntimeService } from "./operations-runtime";
import { createPrismaOperationsRepository } from "./operations-repository";
import { createManufacturingRuntimeService } from "./manufacturing-runtime";
import { createPrismaManufacturingRepository } from "./manufacturing-repository";
import { createMarketingRuntimeService } from "./marketing-runtime";
import { createPrismaMarketingRepository } from "./marketing-repository";
import { createExecutiveRuntimeService } from "./executive-runtime";
import { createPrismaExecutiveRepository } from "./executive-repository";
import {
  createFinanceImmutableLineage,
  financeId,
  financeNowIso,
  stableFinanceChecksum,
  type FinanceBudget,
  type FinanceChartOfAccount,
  type FinanceDashboard,
  type FinanceExecutiveReport,
  type FinanceForecast,
  type FinanceGeneralLedgerEntry,
  type FinanceHealthSnapshot,
  type FinanceKpi,
  type FinancePayable,
  type FinanceProfitabilitySnapshot,
  type FinanceReceivable,
  type FinanceRecommendation,
  type FinanceRecommendationReview,
  type FinanceTimelineEvent,
} from "./finance-models";
import type { FinanceRepository } from "./finance-repository";

export type FinanceRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string) => Promise<FinanceDashboard>;
  listGeneralLedger: (workspaceId: string, organizationId: string) => Promise<FinanceGeneralLedgerEntry[]>;
  listChartOfAccounts: (workspaceId: string, organizationId: string) => Promise<FinanceChartOfAccount[]>;
  listAccountsReceivable: (workspaceId: string, organizationId: string) => Promise<FinanceReceivable[]>;
  listAccountsPayable: (workspaceId: string, organizationId: string) => Promise<FinancePayable[]>;
  listBudgets: (workspaceId: string, organizationId: string) => Promise<FinanceBudget[]>;
  listProfitability: (workspaceId: string, organizationId: string) => Promise<FinanceProfitabilitySnapshot[]>;
  listForecasts: (workspaceId: string, organizationId: string) => Promise<FinanceForecast[]>;
  listKpis: (workspaceId: string, organizationId: string) => Promise<FinanceKpi[]>;
  listRecommendations: (workspaceId: string, organizationId: string) => Promise<FinanceRecommendation[]>;
  reviewRecommendation: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    financeRecommendationId: string;
    decision: FinanceRecommendationReview["decision"];
    notes?: string;
  }) => Promise<FinanceRecommendationReview>;
  listExecutiveReports: (workspaceId: string, organizationId: string) => Promise<FinanceExecutiveReport[]>;
  listTimeline: (workspaceId: string, organizationId: string) => Promise<FinanceTimelineEvent[]>;
  listHealth: (workspaceId: string, organizationId: string) => Promise<FinanceHealthSnapshot[]>;
};

function metric(key: string, label: string, unit: string, value: number, trend: number, evidenceReferences: string[]) {
  return { key, label, unit, value, trend, evidenceReferences, asOf: financeNowIso() };
}

export function createFinanceRuntimeService(repository: FinanceRepository): FinanceRuntimeService {
  const gedRuntime = createEnterpriseDomainRuntimeService(createPrismaEnterpriseDomainRepository());
  const salesRuntime = createSalesRuntimeService(createPrismaSalesRepository());
  const operationsRuntime = createOperationsRuntimeService(createPrismaOperationsRepository());
  const manufacturingRuntime = createManufacturingRuntimeService(createPrismaManufacturingRepository());
  const marketingRuntime = createMarketingRuntimeService(createPrismaMarketingRepository());
  const executiveRuntime = createExecutiveRuntimeService(createPrismaExecutiveRepository());

  async function ensureSeed(workspaceId: string, organizationId: string) {
    const existingLedger = await repository.listLedger(workspaceId);
    if (existingLedger.length > 0) return;

    const now = financeNowIso();
    const [salesPipeline, operationsInventory, manufacturingCosts, executiveDashboard] = await Promise.all([
      salesRuntime.listPipeline(workspaceId, organizationId).catch(() => []),
      operationsRuntime.listInventory(workspaceId).catch(() => []),
      manufacturingRuntime.listCosting(workspaceId).catch(() => []),
      executiveRuntime.getDashboard(workspaceId, organizationId).catch(() => null),
    ]);

    const pipelineValue = salesPipeline.reduce((sum, row) => sum + row.amountCents, 0);
    const inventoryValue = operationsInventory.reduce((sum, row) => sum + row.valuationAmount, 0) * 100;
    const manufacturingCost = manufacturingCosts.reduce((sum, row) => sum + row.totalCostAmount, 0) * 100;
    const recognizedRevenue = Math.round(pipelineValue * 0.32);

    const ledgerRows: FinanceGeneralLedgerEntry[] = [
      {
        financeGeneralLedgerEntryId: financeId("gbafinledger"),
        workspaceId,
        organizationId,
        fiscalPeriod: "2026-Q3",
        journalReference: "JRN-REV-001",
        accountCode: "4000",
        debitAmountCents: 0,
        creditAmountCents: recognizedRevenue,
        postedAt: now,
        auditReference: "audit:revenue:recognition",
        immutableLineage: createFinanceImmutableLineage({ recognizedRevenue, now }),
      },
      {
        financeGeneralLedgerEntryId: financeId("gbafinledger"),
        workspaceId,
        organizationId,
        fiscalPeriod: "2026-Q3",
        journalReference: "JRN-COGS-001",
        accountCode: "5000",
        debitAmountCents: Math.round(manufacturingCost * 0.44),
        creditAmountCents: 0,
        postedAt: now,
        auditReference: "audit:cogs:allocation",
        immutableLineage: createFinanceImmutableLineage({ manufacturingCost, now }),
      },
    ];

    const chartRows: FinanceChartOfAccount[] = [
      { financeChartOfAccountId: financeId("gbafincoa"), workspaceId, organizationId, accountCode: "1000", accountName: "Cash", accountType: "ASSET", balanceCents: 124500000, updatedAt: now, immutableLineage: createFinanceImmutableLineage({ code: "1000", now }) },
      { financeChartOfAccountId: financeId("gbafincoa"), workspaceId, organizationId, accountCode: "1200", accountName: "Accounts Receivable", accountType: "ASSET", balanceCents: 86000000, updatedAt: now, immutableLineage: createFinanceImmutableLineage({ code: "1200", now }) },
      { financeChartOfAccountId: financeId("gbafincoa"), workspaceId, organizationId, accountCode: "2000", accountName: "Accounts Payable", accountType: "LIABILITY", balanceCents: 52200000, updatedAt: now, immutableLineage: createFinanceImmutableLineage({ code: "2000", now }) },
      { financeChartOfAccountId: financeId("gbafincoa"), workspaceId, organizationId, accountCode: "4000", accountName: "Revenue", accountType: "REVENUE", balanceCents: recognizedRevenue, updatedAt: now, immutableLineage: createFinanceImmutableLineage({ code: "4000", now }) },
      { financeChartOfAccountId: financeId("gbafincoa"), workspaceId, organizationId, accountCode: "5000", accountName: "Cost of Goods Sold", accountType: "EXPENSE", balanceCents: Math.round(manufacturingCost * 0.44), updatedAt: now, immutableLineage: createFinanceImmutableLineage({ code: "5000", now }) },
    ];

    const receivableRows: FinanceReceivable[] = [
      {
        financeReceivableId: financeId("gbafinar"), workspaceId, organizationId, customerId: "CUS-ORION", customerName: "Orion Facilities Group", invoiceReference: "INV-2026-001", outstandingAmountCents: 26000000, agingBucket: "DUE_30", dueAt: new Date(Date.now() + 10 * 86400000).toISOString(), creditExposureCents: 40000000, updatedAt: now, immutableLineage: createFinanceImmutableLineage({ invoice: "INV-2026-001", now }),
      },
      {
        financeReceivableId: financeId("gbafinar"), workspaceId, organizationId, customerId: "CUS-NOVA", customerName: "Nova Industrial Systems", invoiceReference: "INV-2026-002", outstandingAmountCents: 18000000, agingBucket: "CURRENT", dueAt: new Date(Date.now() + 25 * 86400000).toISOString(), creditExposureCents: 35000000, updatedAt: now, immutableLineage: createFinanceImmutableLineage({ invoice: "INV-2026-002", now }),
      },
    ];

    const payableRows: FinancePayable[] = [
      {
        financePayableId: financeId("gbafinap"), workspaceId, organizationId, vendorId: "VEN-ALLOY", vendorName: "Alloy Materials Co", billReference: "BILL-2026-110", outstandingAmountCents: 12000000, dueAt: new Date(Date.now() + 7 * 86400000).toISOString(), paymentPriority: "HIGH", updatedAt: now, immutableLineage: createFinanceImmutableLineage({ bill: "BILL-2026-110", now }),
      },
      {
        financePayableId: financeId("gbafinap"), workspaceId, organizationId, vendorId: "VEN-FREIGHT", vendorName: "Global Freight Partners", billReference: "BILL-2026-111", outstandingAmountCents: 8600000, dueAt: new Date(Date.now() + 16 * 86400000).toISOString(), paymentPriority: "MEDIUM", updatedAt: now, immutableLineage: createFinanceImmutableLineage({ bill: "BILL-2026-111", now }),
      },
    ];

    const budgetRows: FinanceBudget[] = [
      {
        financeBudgetId: financeId("gbafinbud"), workspaceId, organizationId, budgetScope: "DEPARTMENT", scopeReference: "finance", capexBudgetCents: 18000000, opexBudgetCents: 54000000, spentCapexCents: 9200000, spentOpexCents: 31200000, varianceCents: 13400000, period: "2026-Q3", updatedAt: now, immutableLineage: createFinanceImmutableLineage({ budgetScope: "finance", now }),
      },
      {
        financeBudgetId: financeId("gbafinbud"), workspaceId, organizationId, budgetScope: "PROJECT", scopeReference: "project-ledwarehouse", capexBudgetCents: 26000000, opexBudgetCents: 43000000, spentCapexCents: 15200000, spentOpexCents: 29600000, varianceCents: 24200000, period: "2026-Q3", updatedAt: now, immutableLineage: createFinanceImmutableLineage({ budgetScope: "project", now }),
      },
    ];

    const profitabilityRows: FinanceProfitabilitySnapshot[] = [
      {
        financeProfitabilitySnapshotId: financeId("gbafinprof"), workspaceId, organizationId, dimension: "PRODUCT", referenceId: "PRD-DISPLAY-900", revenueCents: 42000000, costCents: 25000000, grossMarginPercent: 40.5, netMarginPercent: 21.2, capturedAt: now, immutableLineage: createFinanceImmutableLineage({ dimension: "PRODUCT", now }),
      },
      {
        financeProfitabilitySnapshotId: financeId("gbafinprof"), workspaceId, organizationId, dimension: "CUSTOMER", referenceId: "CUS-ORION", revenueCents: 31000000, costCents: 18400000, grossMarginPercent: 40.6, netMarginPercent: 22.0, capturedAt: now, immutableLineage: createFinanceImmutableLineage({ dimension: "CUSTOMER", now }),
      },
    ];

    const forecast: FinanceForecast = {
      financeForecastId: financeId("gbafinfcast"), workspaceId, organizationId, period: "2026-Q4", revenueForecastCents: Math.round(pipelineValue * 0.41), expenseForecastCents: Math.round((manufacturingCost + inventoryValue * 0.08) * 0.52), cashFlowForecastCents: 18200000, profitForecastCents: 11600000, confidenceScore: 74, varianceProjectionCents: 3800000, assumptions: ["Sales pipeline conversion from Sales Agent", "Operational and manufacturing cost trend continuation", "Marketing spend maintained within approved budget bands"], generatedAt: now, immutableLineage: stableFinanceChecksum({ pipelineValue, inventoryValue, manufacturingCost }),
    };

    const kpis: FinanceKpi[] = [
      { financeKpiId: financeId("gbafinkpi"), workspaceId, organizationId, name: "Revenue", value: recognizedRevenue / 100, unit: "USD", target: 1500000, trend: 0.08, measuredAt: now, immutableLineage: stableFinanceChecksum({ name: "Revenue", now }) },
      { financeKpiId: financeId("gbafinkpi"), workspaceId, organizationId, name: "Gross Margin", value: 40.5, unit: "%", target: 38, trend: 1.2, measuredAt: now, immutableLineage: stableFinanceChecksum({ name: "Gross Margin", now }) },
      { financeKpiId: financeId("gbafinkpi"), workspaceId, organizationId, name: "Net Margin", value: 21.2, unit: "%", target: 20, trend: 0.7, measuredAt: now, immutableLineage: stableFinanceChecksum({ name: "Net Margin", now }) },
      { financeKpiId: financeId("gbafinkpi"), workspaceId, organizationId, name: "Cash Flow", value: 182000, unit: "USD", target: 150000, trend: 0.4, measuredAt: now, immutableLineage: stableFinanceChecksum({ name: "Cash Flow", now }) },
      { financeKpiId: financeId("gbafinkpi"), workspaceId, organizationId, name: "Budget Variance", value: 8.9, unit: "%", target: 5, trend: -0.6, measuredAt: now, immutableLineage: stableFinanceChecksum({ name: "Budget Variance", now }) },
      { financeKpiId: financeId("gbafinkpi"), workspaceId, organizationId, name: "Forecast Accuracy", value: 92.4, unit: "%", target: 90, trend: 0.5, measuredAt: now, immutableLineage: stableFinanceChecksum({ name: "Forecast Accuracy", now }) },
    ];

    const executiveSummary = executiveDashboard?.profit.value ?? 0;
    const report: FinanceExecutiveReport = {
      financeExecutiveReportId: financeId("gbafinreport"),
      workspaceId,
      organizationId,
      period: "WEEKLY",
      summary: `Finance operating position is stable. Net profit trend is ${executiveSummary.toFixed(0)} with controllable cost variance and moderate liquidity risk exposure.`,
      strategicRisks: ["Potential AR aging drift in >30 day bucket", "Vendor concentration risk on high-priority payables"],
      growthOpportunities: ["Improve quote-to-cash conversion with Sales signal integration", "Optimize AP timing using operations and manufacturing demand windows"],
      createdAt: now,
      immutableLineage: createFinanceImmutableLineage({ reportPeriod: "WEEKLY", now }),
    };

    for (const row of ledgerRows) await repository.upsertLedger(row);
    for (const row of chartRows) await repository.upsertChartOfAccount(row);
    for (const row of receivableRows) await repository.upsertReceivable(row);
    for (const row of payableRows) await repository.upsertPayable(row);
    for (const row of budgetRows) await repository.upsertBudget(row);
    for (const row of profitabilityRows) await repository.upsertProfitability(row);
    await repository.upsertForecast(forecast);
    for (const row of kpis) await repository.upsertKpi(row);
    await repository.upsertExecutiveReport(report);

    await repository.appendTimelineEvent({
      financeTimelineEventId: financeId("gbafintime"),
      workspaceId,
      organizationId,
      eventType: "FINANCE_BASELINE_SEEDED",
      subjectId: "finance-baseline",
      summary: "Finance baseline state was seeded from cross-agent and canonical domain signals.",
      actorId: "system",
      evidenceReferences: ["ged:domain", "gba:sales", "gba:operations", "gba:manufacturing", "gba:marketing", "gba:executive"],
      createdAt: now,
      immutableLineage: createFinanceImmutableLineage({ eventType: "FINANCE_BASELINE_SEEDED", now }),
    });
  }

  async function ensureRecommendations(workspaceId: string, organizationId: string) {
    const existing = await repository.listRecommendations(workspaceId);
    if (existing.length > 0) return existing;

    const [receivables, payables, budgets, forecast] = await Promise.all([
      repository.listReceivables(workspaceId),
      repository.listPayables(workspaceId),
      repository.listBudgets(workspaceId),
      repository.listForecasts(workspaceId),
    ]);

    const overdueAr = receivables.filter((entry) => entry.agingBucket === "DUE_60" || entry.agingBucket === "DUE_90_PLUS").length;
    const highPriorityAp = payables.filter((entry) => entry.paymentPriority === "HIGH").length;
    const overruns = budgets.filter((entry) => entry.varianceCents < 0).length;
    const confidence = forecast[0]?.confidenceScore ?? 0;

    const generated: FinanceRecommendation[] = [
      {
        financeRecommendationId: financeId("gbafinrec"), workspaceId, organizationId, category: "AR", title: "Prioritize receivable collections for aging exposure", summary: `Detected ${overdueAr} receivable entries in late aging buckets.`, recommendedAction: "Escalate collection actions for DUE_60 and DUE_90_PLUS customer balances.", priority: overdueAr > 0 ? "P0" : "P2", confidence: "HIGH", status: "NEW", sourceReference: "finance:ar:aging", createdAt: financeNowIso(), immutableLineage: stableFinanceChecksum({ overdueAr }),
      },
      {
        financeRecommendationId: financeId("gbafinrec"), workspaceId, organizationId, category: "AP", title: "Sequence high-priority AP payments against cash planning", summary: `Detected ${highPriorityAp} high-priority payable obligations.`, recommendedAction: "Align payment schedule to weekly cash windows and vendor criticality.", priority: highPriorityAp > 0 ? "P1" : "P3", confidence: "MEDIUM", status: "NEW", sourceReference: "finance:ap:priority", createdAt: financeNowIso(), immutableLineage: stableFinanceChecksum({ highPriorityAp }),
      },
      {
        financeRecommendationId: financeId("gbafinrec"), workspaceId, organizationId, category: "BUDGET", title: "Contain budget variance in overrun scopes", summary: `Detected ${overruns} budget scopes with negative variance.`, recommendedAction: "Apply immediate spend controls and variance root-cause review with department owners.", priority: overruns > 0 ? "P1" : "P3", confidence: "MEDIUM", status: "NEW", sourceReference: "finance:budget:variance", createdAt: financeNowIso(), immutableLineage: stableFinanceChecksum({ overruns }),
      },
      {
        financeRecommendationId: financeId("gbafinrec"), workspaceId, organizationId, category: "ANOMALY", title: "Improve forecast confidence through tighter variance governance", summary: `Current confidence score is ${confidence}.`, recommendedAction: "Increase reconciliation cadence between sales conversion, cost realization, and cash movement.", priority: confidence < 70 ? "P1" : "P2", confidence: confidence < 70 ? "HIGH" : "MEDIUM", status: "NEW", sourceReference: "finance:forecast:confidence", createdAt: financeNowIso(), immutableLineage: stableFinanceChecksum({ confidence }),
      },
    ];

    for (const rec of generated) await repository.upsertRecommendation(rec);

    return repository.listRecommendations(workspaceId);
  }

  async function computeHealth(workspaceId: string, organizationId: string): Promise<FinanceHealthSnapshot> {
    const [receivables, payables, budgets, forecasts] = await Promise.all([
      repository.listReceivables(workspaceId),
      repository.listPayables(workspaceId),
      repository.listBudgets(workspaceId),
      repository.listForecasts(workspaceId),
    ]);

    const overdueReceivables = receivables.filter((entry) => entry.agingBucket === "DUE_60" || entry.agingBucket === "DUE_90_PLUS").length;
    const overduePayables = payables.filter((entry) => new Date(entry.dueAt).getTime() < Date.now()).length;
    const budgetOverruns = budgets.filter((entry) => entry.varianceCents < 0).length;
    const cashFlowRiskFlags = forecasts.filter((entry) => entry.cashFlowForecastCents < 0 || entry.confidenceScore < 60).length;

    const status: FinanceHealthSnapshot["status"] =
      overdueReceivables === 0 && overduePayables === 0 && budgetOverruns === 0 && cashFlowRiskFlags === 0
        ? "HEALTHY"
        : overdueReceivables <= 2 && overduePayables <= 2 && budgetOverruns <= 1 && cashFlowRiskFlags <= 1
          ? "DEGRADED"
          : "BLOCKED";

    return repository.upsertHealth({
      financeHealthId: financeId("gbafinhealth"),
      workspaceId,
      organizationId,
      status,
      overdueReceivables,
      overduePayables,
      budgetOverruns,
      cashFlowRiskFlags,
      generatedAt: financeNowIso(),
      immutableLineage: stableFinanceChecksum({ overdueReceivables, overduePayables, budgetOverruns, cashFlowRiskFlags }),
    });
  }

  return {
    async getDashboard(workspaceId, organizationId) {
      await ensureSeed(workspaceId, organizationId);
      const [ledger, receivables, payables, budgets, profitability, forecasts, recommendations, health] = await Promise.all([
        repository.listLedger(workspaceId),
        repository.listReceivables(workspaceId),
        repository.listPayables(workspaceId),
        repository.listBudgets(workspaceId),
        repository.listProfitability(workspaceId),
        repository.listForecasts(workspaceId),
        ensureRecommendations(workspaceId, organizationId),
        computeHealth(workspaceId, organizationId),
      ]);

      const revenue = ledger.filter((entry) => entry.accountCode === "4000").reduce((sum, entry) => sum + entry.creditAmountCents, 0);
      const cogs = ledger.filter((entry) => entry.accountCode === "5000").reduce((sum, entry) => sum + entry.debitAmountCents, 0);
      const grossProfit = revenue - cogs;
      const netProfit = Math.round(grossProfit * 0.52);
      const cashPosition = 124500000;
      const arOutstanding = receivables.reduce((sum, entry) => sum + entry.outstandingAmountCents, 0);
      const apOutstanding = payables.reduce((sum, entry) => sum + entry.outstandingAmountCents, 0);
      const budgetVariance = budgets.reduce((sum, entry) => sum + entry.varianceCents, 0);
      const opEx = budgets.reduce((sum, entry) => sum + entry.spentOpexCents, 0);
      const mfgCost = profitability.reduce((sum, entry) => sum + entry.costCents, 0);

      return {
        workspaceId,
        organizationId,
        revenueSummary: metric("revenue", "Revenue Summary", "USD", revenue / 100, 0.08, ["finance:ledger:revenue"]),
        grossProfit: metric("gross_profit", "Gross Profit", "USD", grossProfit / 100, 0.06, ["finance:ledger:gross-profit"]),
        netProfit: metric("net_profit", "Net Profit", "USD", netProfit / 100, 0.04, ["finance:ledger:net-profit"]),
        cashPosition: metric("cash_position", "Cash Position", "USD", cashPosition / 100, 0.02, ["finance:coa:cash"]),
        arAging: metric("ar_aging", "AR Aging", "count", receivables.filter((entry) => entry.agingBucket !== "CURRENT").length, -0.2, ["finance:ar"]),
        apAging: metric("ap_aging", "AP Aging", "count", payables.filter((entry) => new Date(entry.dueAt).getTime() < Date.now()).length, -0.1, ["finance:ap"]),
        outstandingInvoices: metric("outstanding_invoices", "Outstanding Invoices", "USD", arOutstanding / 100, 0.03, ["finance:ar:outstanding"]),
        budgetPerformance: metric("budget_performance", "Budget Performance", "USD", budgetVariance / 100, -0.5, ["finance:budget:variance"]),
        cashFlowTrend: metric("cash_flow_trend", "Cash Flow Trend", "USD", (forecasts[0]?.cashFlowForecastCents ?? 0) / 100, 0.01, ["finance:forecast:cash-flow"]),
        operatingExpenses: metric("operating_expenses", "Operating Expenses", "USD", opEx / 100, 0.04, ["finance:budget:opex"]),
        manufacturingCosts: metric("manufacturing_costs", "Manufacturing Costs", "USD", mfgCost / 100, 0.03, ["gba:manufacturing:costing"]),
        executiveAlerts: metric("executive_alerts", "Executive Financial Alerts", "count", health.cashFlowRiskFlags + health.budgetOverruns, 0.2, ["finance:health", "gba:executive"]),
        generatedAt: financeNowIso(),
        immutableLineage: createFinanceImmutableLineage({ revenue, grossProfit, netProfit, arOutstanding, apOutstanding, budgetVariance }),
      };
    },
    async listGeneralLedger(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listLedger(workspaceId); },
    async listChartOfAccounts(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listChartOfAccounts(workspaceId); },
    async listAccountsReceivable(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listReceivables(workspaceId); },
    async listAccountsPayable(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listPayables(workspaceId); },
    async listBudgets(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listBudgets(workspaceId); },
    async listProfitability(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listProfitability(workspaceId); },
    async listForecasts(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listForecasts(workspaceId); },
    async listKpis(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listKpis(workspaceId); },
    async listRecommendations(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return ensureRecommendations(workspaceId, organizationId); },
    async reviewRecommendation(input) {
      await ensureSeed(input.workspaceId, input.organizationId);
      const review: FinanceRecommendationReview = {
        financeRecommendationReviewId: financeId("gbafinrev"),
        financeRecommendationId: input.financeRecommendationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        decision: input.decision,
        notes: input.notes,
        reviewedBy: input.actorId,
        reviewedAt: financeNowIso(),
        immutableLineage: stableFinanceChecksum({ recommendationId: input.financeRecommendationId, decision: input.decision }),
      };

      await repository.appendRecommendationReview(review);
      await repository.appendTimelineEvent({
        financeTimelineEventId: financeId("gbafintime"),
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "RECOMMENDATION_REVIEWED",
        subjectId: input.financeRecommendationId,
        summary: `Finance recommendation ${input.decision.toLowerCase()} by ${input.actorId}`,
        actorId: input.actorId,
        evidenceReferences: [review.financeRecommendationReviewId],
        createdAt: financeNowIso(),
        immutableLineage: stableFinanceChecksum({ reviewId: review.financeRecommendationReviewId }),
      });

      return review;
    },
    async listExecutiveReports(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listExecutiveReports(workspaceId); },
    async listTimeline(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listTimeline(workspaceId); },
    async listHealth(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); await computeHealth(workspaceId, organizationId); return repository.listHealth(workspaceId); },
  };
}
