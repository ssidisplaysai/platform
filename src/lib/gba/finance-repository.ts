import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  type FinanceBudget,
  type FinanceChartOfAccount,
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

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type FinanceRepository = {
  listLedger: (workspaceId: string) => Promise<FinanceGeneralLedgerEntry[]>;
  upsertLedger: (record: FinanceGeneralLedgerEntry) => Promise<FinanceGeneralLedgerEntry>;
  listChartOfAccounts: (workspaceId: string) => Promise<FinanceChartOfAccount[]>;
  upsertChartOfAccount: (record: FinanceChartOfAccount) => Promise<FinanceChartOfAccount>;
  listReceivables: (workspaceId: string) => Promise<FinanceReceivable[]>;
  upsertReceivable: (record: FinanceReceivable) => Promise<FinanceReceivable>;
  listPayables: (workspaceId: string) => Promise<FinancePayable[]>;
  upsertPayable: (record: FinancePayable) => Promise<FinancePayable>;
  listBudgets: (workspaceId: string) => Promise<FinanceBudget[]>;
  upsertBudget: (record: FinanceBudget) => Promise<FinanceBudget>;
  listProfitability: (workspaceId: string) => Promise<FinanceProfitabilitySnapshot[]>;
  upsertProfitability: (record: FinanceProfitabilitySnapshot) => Promise<FinanceProfitabilitySnapshot>;
  listForecasts: (workspaceId: string) => Promise<FinanceForecast[]>;
  upsertForecast: (record: FinanceForecast) => Promise<FinanceForecast>;
  listKpis: (workspaceId: string) => Promise<FinanceKpi[]>;
  upsertKpi: (record: FinanceKpi) => Promise<FinanceKpi>;
  listRecommendations: (workspaceId: string) => Promise<FinanceRecommendation[]>;
  upsertRecommendation: (record: FinanceRecommendation) => Promise<FinanceRecommendation>;
  appendRecommendationReview: (record: FinanceRecommendationReview) => Promise<FinanceRecommendationReview>;
  listExecutiveReports: (workspaceId: string) => Promise<FinanceExecutiveReport[]>;
  upsertExecutiveReport: (record: FinanceExecutiveReport) => Promise<FinanceExecutiveReport>;
  listHealth: (workspaceId: string) => Promise<FinanceHealthSnapshot[]>;
  upsertHealth: (record: FinanceHealthSnapshot) => Promise<FinanceHealthSnapshot>;
  listTimeline: (workspaceId: string) => Promise<FinanceTimelineEvent[]>;
  appendTimelineEvent: (record: FinanceTimelineEvent) => Promise<FinanceTimelineEvent>;
};

export function createInMemoryFinanceRepository(): FinanceRepository {
  const ledger = new Map<string, FinanceGeneralLedgerEntry>();
  const coa = new Map<string, FinanceChartOfAccount>();
  const ar = new Map<string, FinanceReceivable>();
  const ap = new Map<string, FinancePayable>();
  const budgets = new Map<string, FinanceBudget>();
  const profitability = new Map<string, FinanceProfitabilitySnapshot>();
  const forecasts = new Map<string, FinanceForecast>();
  const kpis = new Map<string, FinanceKpi>();
  const recommendations = new Map<string, FinanceRecommendation>();
  const reviews = new Map<string, FinanceRecommendationReview>();
  const reports = new Map<string, FinanceExecutiveReport>();
  const health = new Map<string, FinanceHealthSnapshot>();
  const timeline = new Map<string, FinanceTimelineEvent>();

  return {
    async listLedger(workspaceId) { return [...ledger.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.postedAt.localeCompare(a.postedAt)); },
    async upsertLedger(record) { ledger.set(record.financeGeneralLedgerEntryId, record); return record; },
    async listChartOfAccounts(workspaceId) { return [...coa.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => a.accountCode.localeCompare(b.accountCode)); },
    async upsertChartOfAccount(record) { coa.set(record.financeChartOfAccountId, record); return record; },
    async listReceivables(workspaceId) { return [...ar.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertReceivable(record) { ar.set(record.financeReceivableId, record); return record; },
    async listPayables(workspaceId) { return [...ap.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertPayable(record) { ap.set(record.financePayableId, record); return record; },
    async listBudgets(workspaceId) { return [...budgets.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertBudget(record) { budgets.set(record.financeBudgetId, record); return record; },
    async listProfitability(workspaceId) { return [...profitability.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)); },
    async upsertProfitability(record) { profitability.set(record.financeProfitabilitySnapshotId, record); return record; },
    async listForecasts(workspaceId) { return [...forecasts.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)); },
    async upsertForecast(record) { forecasts.set(record.financeForecastId, record); return record; },
    async listKpis(workspaceId) { return [...kpis.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },
    async upsertKpi(record) { kpis.set(record.financeKpiId, record); return record; },
    async listRecommendations(workspaceId) { return [...recommendations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async upsertRecommendation(record) { recommendations.set(record.financeRecommendationId, record); return record; },
    async appendRecommendationReview(record) {
      reviews.set(record.financeRecommendationReviewId, record);
      const rec = recommendations.get(record.financeRecommendationId);
      if (rec) recommendations.set(rec.financeRecommendationId, { ...rec, status: record.decision });
      return record;
    },
    async listExecutiveReports(workspaceId) { return [...reports.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async upsertExecutiveReport(record) { reports.set(record.financeExecutiveReportId, record); return record; },
    async listHealth(workspaceId) { return [...health.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)); },
    async upsertHealth(record) { health.set(record.financeHealthId, record); return record; },
    async listTimeline(workspaceId) { return [...timeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async appendTimelineEvent(record) { timeline.set(record.financeTimelineEventId, record); return record; },
  };
}

export function createPrismaFinanceRepository(prisma: PrismaClient = getPrismaClient()): FinanceRepository {
  return {
    async listLedger(workspaceId) {
      const rows = await prisma.gbaFinanceGeneralLedgerEntry.findMany({ where: { workspaceId }, orderBy: { postedAt: "desc" } });
      return rows.map((row) => ({ ...row, postedAt: row.postedAt.toISOString() }));
    },
    async upsertLedger(record) {
      await prisma.gbaFinanceGeneralLedgerEntry.upsert({ where: { financeGeneralLedgerEntryId: record.financeGeneralLedgerEntryId }, create: { ...record, postedAt: new Date(record.postedAt) }, update: { fiscalPeriod: record.fiscalPeriod, journalReference: record.journalReference, accountCode: record.accountCode, debitAmountCents: record.debitAmountCents, creditAmountCents: record.creditAmountCents, postedAt: new Date(record.postedAt), auditReference: record.auditReference, immutableLineage: record.immutableLineage } });
      return record;
    },
    async listChartOfAccounts(workspaceId) {
      const rows = await prisma.gbaFinanceChartOfAccount.findMany({ where: { workspaceId }, orderBy: { accountCode: "asc" } });
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString(), accountType: row.accountType as FinanceChartOfAccount["accountType"] }));
    },
    async upsertChartOfAccount(record) {
      await prisma.gbaFinanceChartOfAccount.upsert({ where: { financeChartOfAccountId: record.financeChartOfAccountId }, create: { ...record, updatedAt: new Date(record.updatedAt) }, update: { accountCode: record.accountCode, accountName: record.accountName, accountType: record.accountType, balanceCents: record.balanceCents, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listReceivables(workspaceId) {
      const rows = await prisma.gbaFinanceReceivable.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, dueAt: row.dueAt.toISOString(), updatedAt: row.updatedAt.toISOString(), agingBucket: row.agingBucket as FinanceReceivable["agingBucket"] }));
    },
    async upsertReceivable(record) {
      await prisma.gbaFinanceReceivable.upsert({ where: { financeReceivableId: record.financeReceivableId }, create: { ...record, dueAt: new Date(record.dueAt), updatedAt: new Date(record.updatedAt) }, update: { customerId: record.customerId, customerName: record.customerName, invoiceReference: record.invoiceReference, outstandingAmountCents: record.outstandingAmountCents, agingBucket: record.agingBucket, dueAt: new Date(record.dueAt), creditExposureCents: record.creditExposureCents, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listPayables(workspaceId) {
      const rows = await prisma.gbaFinancePayable.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, dueAt: row.dueAt.toISOString(), updatedAt: row.updatedAt.toISOString(), paymentPriority: row.paymentPriority as FinancePayable["paymentPriority"] }));
    },
    async upsertPayable(record) {
      await prisma.gbaFinancePayable.upsert({ where: { financePayableId: record.financePayableId }, create: { ...record, dueAt: new Date(record.dueAt), updatedAt: new Date(record.updatedAt) }, update: { vendorId: record.vendorId, vendorName: record.vendorName, billReference: record.billReference, outstandingAmountCents: record.outstandingAmountCents, dueAt: new Date(record.dueAt), paymentPriority: record.paymentPriority, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listBudgets(workspaceId) {
      const rows = await prisma.gbaFinanceBudget.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString(), budgetScope: row.budgetScope as FinanceBudget["budgetScope"] }));
    },
    async upsertBudget(record) {
      await prisma.gbaFinanceBudget.upsert({ where: { financeBudgetId: record.financeBudgetId }, create: { ...record, updatedAt: new Date(record.updatedAt) }, update: { budgetScope: record.budgetScope, scopeReference: record.scopeReference, capexBudgetCents: record.capexBudgetCents, opexBudgetCents: record.opexBudgetCents, spentCapexCents: record.spentCapexCents, spentOpexCents: record.spentOpexCents, varianceCents: record.varianceCents, period: record.period, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listProfitability(workspaceId) {
      const rows = await prisma.gbaFinanceProfitabilitySnapshot.findMany({ where: { workspaceId }, orderBy: { capturedAt: "desc" } });
      return rows.map((row) => ({ ...row, capturedAt: row.capturedAt.toISOString(), dimension: row.dimension as FinanceProfitabilitySnapshot["dimension"] }));
    },
    async upsertProfitability(record) {
      await prisma.gbaFinanceProfitabilitySnapshot.upsert({ where: { financeProfitabilitySnapshotId: record.financeProfitabilitySnapshotId }, create: { ...record, capturedAt: new Date(record.capturedAt) }, update: { dimension: record.dimension, referenceId: record.referenceId, revenueCents: record.revenueCents, costCents: record.costCents, grossMarginPercent: record.grossMarginPercent, netMarginPercent: record.netMarginPercent, capturedAt: new Date(record.capturedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listForecasts(workspaceId) {
      const rows = await prisma.gbaFinanceForecast.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({ ...row, generatedAt: row.generatedAt.toISOString(), assumptions: (row.assumptions as string[]) ?? [] }));
    },
    async upsertForecast(record) {
      await prisma.gbaFinanceForecast.upsert({ where: { financeForecastId: record.financeForecastId }, create: { ...record, assumptions: toJson(record.assumptions), generatedAt: new Date(record.generatedAt) }, update: { period: record.period, revenueForecastCents: record.revenueForecastCents, expenseForecastCents: record.expenseForecastCents, cashFlowForecastCents: record.cashFlowForecastCents, profitForecastCents: record.profitForecastCents, confidenceScore: record.confidenceScore, varianceProjectionCents: record.varianceProjectionCents, assumptions: toJson(record.assumptions), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listKpis(workspaceId) {
      const rows = await prisma.gbaFinanceKpi.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({ ...row, measuredAt: row.measuredAt.toISOString() }));
    },
    async upsertKpi(record) {
      await prisma.gbaFinanceKpi.upsert({ where: { financeKpiId: record.financeKpiId }, create: { ...record, measuredAt: new Date(record.measuredAt) }, update: { name: record.name, value: record.value, unit: record.unit, target: record.target, trend: record.trend, measuredAt: new Date(record.measuredAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listRecommendations(workspaceId) {
      const rows = await prisma.gbaFinanceRecommendation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), category: row.category as FinanceRecommendation["category"], priority: row.priority as FinanceRecommendation["priority"], confidence: row.confidence as FinanceRecommendation["confidence"], status: row.status as FinanceRecommendation["status"] }));
    },
    async upsertRecommendation(record) {
      await prisma.gbaFinanceRecommendation.upsert({ where: { financeRecommendationId: record.financeRecommendationId }, create: { ...record, createdAt: new Date(record.createdAt) }, update: { category: record.category, title: record.title, summary: record.summary, recommendedAction: record.recommendedAction, priority: record.priority, confidence: record.confidence, status: record.status, sourceReference: record.sourceReference, immutableLineage: record.immutableLineage } });
      return record;
    },
    async appendRecommendationReview(record) {
      await prisma.gbaFinanceRecommendationReview.create({ data: { ...record, reviewedAt: new Date(record.reviewedAt) } });
      await prisma.gbaFinanceRecommendation.updateMany({ where: { financeRecommendationId: record.financeRecommendationId }, data: { status: record.decision } });
      return record;
    },
    async listExecutiveReports(workspaceId) {
      const rows = await prisma.gbaFinanceExecutiveReport.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({ ...row, period: row.period as FinanceExecutiveReport["period"], strategicRisks: (row.strategicRisks as string[]) ?? [], growthOpportunities: (row.growthOpportunities as string[]) ?? [], createdAt: row.createdAt.toISOString() }));
    },
    async upsertExecutiveReport(record) {
      await prisma.gbaFinanceExecutiveReport.upsert({ where: { financeExecutiveReportId: record.financeExecutiveReportId }, create: { ...record, strategicRisks: toJson(record.strategicRisks), growthOpportunities: toJson(record.growthOpportunities), createdAt: new Date(record.createdAt) }, update: { period: record.period, summary: record.summary, strategicRisks: toJson(record.strategicRisks), growthOpportunities: toJson(record.growthOpportunities), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listHealth(workspaceId) {
      const rows = await prisma.gbaFinanceHealth.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({ ...row, generatedAt: row.generatedAt.toISOString(), status: row.status as FinanceHealthSnapshot["status"] }));
    },
    async upsertHealth(record) {
      await prisma.gbaFinanceHealth.upsert({ where: { financeHealthId: record.financeHealthId }, create: { ...record, generatedAt: new Date(record.generatedAt) }, update: { status: record.status, overdueReceivables: record.overdueReceivables, overduePayables: record.overduePayables, budgetOverruns: record.budgetOverruns, cashFlowRiskFlags: record.cashFlowRiskFlags, immutableLineage: record.immutableLineage } });
      return record;
    },
    async listTimeline(workspaceId) {
      const rows = await prisma.gbaFinanceTimelineEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({ ...row, evidenceReferences: (row.evidenceReferences as string[]) ?? [], createdAt: row.createdAt.toISOString() }));
    },
    async appendTimelineEvent(record) {
      await prisma.gbaFinanceTimelineEvent.create({ data: { ...record, evidenceReferences: toJson(record.evidenceReferences), createdAt: new Date(record.createdAt) } });
      return record;
    },
  };
}
