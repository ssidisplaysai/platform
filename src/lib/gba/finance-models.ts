import { createHash, randomUUID } from "node:crypto";

export const financeRecommendationStatuses = ["NEW", "REVIEWED", "APPROVED", "REJECTED", "DISMISSED"] as const;

export type FinanceRecommendationStatus = (typeof financeRecommendationStatuses)[number];

export type FinanceMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  asOf: string;
  evidenceReferences: string[];
};

export type FinanceDashboard = {
  workspaceId: string;
  organizationId: string;
  revenueSummary: FinanceMetric;
  grossProfit: FinanceMetric;
  netProfit: FinanceMetric;
  cashPosition: FinanceMetric;
  arAging: FinanceMetric;
  apAging: FinanceMetric;
  outstandingInvoices: FinanceMetric;
  budgetPerformance: FinanceMetric;
  cashFlowTrend: FinanceMetric;
  operatingExpenses: FinanceMetric;
  manufacturingCosts: FinanceMetric;
  executiveAlerts: FinanceMetric;
  generatedAt: string;
  immutableLineage: string;
};

export type FinanceGeneralLedgerEntry = {
  financeGeneralLedgerEntryId: string;
  workspaceId: string;
  organizationId: string;
  fiscalPeriod: string;
  journalReference: string;
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  postedAt: string;
  auditReference: string;
  immutableLineage: string;
};

export type FinanceChartOfAccount = {
  financeChartOfAccountId: string;
  workspaceId: string;
  organizationId: string;
  accountCode: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  balanceCents: number;
  updatedAt: string;
  immutableLineage: string;
};

export type FinanceReceivable = {
  financeReceivableId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  invoiceReference: string;
  outstandingAmountCents: number;
  agingBucket: "CURRENT" | "DUE_30" | "DUE_60" | "DUE_90_PLUS";
  dueAt: string;
  creditExposureCents: number;
  updatedAt: string;
  immutableLineage: string;
};

export type FinancePayable = {
  financePayableId: string;
  workspaceId: string;
  organizationId: string;
  vendorId: string;
  vendorName: string;
  billReference: string;
  outstandingAmountCents: number;
  dueAt: string;
  paymentPriority: "LOW" | "MEDIUM" | "HIGH";
  updatedAt: string;
  immutableLineage: string;
};

export type FinanceBudget = {
  financeBudgetId: string;
  workspaceId: string;
  organizationId: string;
  budgetScope: "DEPARTMENT" | "BUSINESS_UNIT" | "PROJECT";
  scopeReference: string;
  capexBudgetCents: number;
  opexBudgetCents: number;
  spentCapexCents: number;
  spentOpexCents: number;
  varianceCents: number;
  period: string;
  updatedAt: string;
  immutableLineage: string;
};

export type FinanceProfitabilitySnapshot = {
  financeProfitabilitySnapshotId: string;
  workspaceId: string;
  organizationId: string;
  dimension: "PRODUCT" | "CUSTOMER" | "PROJECT" | "DEPARTMENT" | "BUSINESS_UNIT";
  referenceId: string;
  revenueCents: number;
  costCents: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  capturedAt: string;
  immutableLineage: string;
};

export type FinanceForecast = {
  financeForecastId: string;
  workspaceId: string;
  organizationId: string;
  period: string;
  revenueForecastCents: number;
  expenseForecastCents: number;
  cashFlowForecastCents: number;
  profitForecastCents: number;
  confidenceScore: number;
  varianceProjectionCents: number;
  assumptions: string[];
  generatedAt: string;
  immutableLineage: string;
};

export type FinanceKpi = {
  financeKpiId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  value: number;
  unit: string;
  target: number;
  trend: number;
  measuredAt: string;
  immutableLineage: string;
};

export type FinanceExecutiveReport = {
  financeExecutiveReportId: string;
  workspaceId: string;
  organizationId: string;
  period: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  summary: string;
  strategicRisks: string[];
  growthOpportunities: string[];
  createdAt: string;
  immutableLineage: string;
};

export type FinanceRecommendation = {
  financeRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  category: "CASH_FLOW" | "BUDGET" | "COST" | "PROFIT" | "AR" | "AP" | "ANOMALY";
  title: string;
  summary: string;
  recommendedAction: string;
  priority: "P0" | "P1" | "P2" | "P3";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  status: FinanceRecommendationStatus;
  sourceReference: string;
  createdAt: string;
  immutableLineage: string;
};

export type FinanceRecommendationReview = {
  financeRecommendationReviewId: string;
  financeRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: Extract<FinanceRecommendationStatus, "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED">;
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type FinanceHealthSnapshot = {
  financeHealthId: string;
  workspaceId: string;
  organizationId: string;
  status: "HEALTHY" | "DEGRADED" | "BLOCKED";
  overdueReceivables: number;
  overduePayables: number;
  budgetOverruns: number;
  cashFlowRiskFlags: number;
  generatedAt: string;
  immutableLineage: string;
};

export type FinanceTimelineEvent = {
  financeTimelineEventId: string;
  workspaceId: string;
  organizationId: string;
  eventType: string;
  subjectId: string;
  summary: string;
  actorId: string;
  evidenceReferences: string[];
  createdAt: string;
  immutableLineage: string;
};

export function financeId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function stableFinanceChecksum(value: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(value));
  return hash.digest("hex");
}

export function createFinanceImmutableLineage(value: unknown): string {
  return stableFinanceChecksum(value);
}

export function financeNowIso(): string {
  return new Date().toISOString();
}
