import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  type CustomerSuccessExecutiveReport,
  type CustomerSuccessExpansionOpportunity,
  type CustomerSuccessHealthRecord,
  type CustomerSuccessHealthSnapshot,
  type CustomerSuccessKpi,
  type CustomerSuccessOnboardingRecord,
  type CustomerSuccessPlan,
  type CustomerSuccessRecommendation,
  type CustomerSuccessRecommendationReview,
  type CustomerSuccessRenewal,
  type CustomerSuccessSatisfaction,
  type CustomerSuccessSupportSignal,
  type CustomerSuccessTimelineEvent,
} from "./customer-success-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const customerSuccessOnboardingStatuses = ["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "READY_FOR_GO_LIVE", "COMPLETE"] as const;

function toCustomerSuccessOnboardingStatus(value: string): CustomerSuccessOnboardingRecord["status"] {
  if ((customerSuccessOnboardingStatuses as readonly string[]).includes(value)) {
    return value as CustomerSuccessOnboardingRecord["status"];
  }

  throw new Error(`Invalid customer success onboarding status: ${value}`);
}

export type CustomerSuccessRepository = {
  listOnboarding: (workspaceId: string) => Promise<CustomerSuccessOnboardingRecord[]>;
  upsertOnboarding: (record: CustomerSuccessOnboardingRecord) => Promise<CustomerSuccessOnboardingRecord>;
  listCustomerHealth: (workspaceId: string) => Promise<CustomerSuccessHealthRecord[]>;
  upsertCustomerHealth: (record: CustomerSuccessHealthRecord) => Promise<CustomerSuccessHealthRecord>;
  listSuccessPlans: (workspaceId: string) => Promise<CustomerSuccessPlan[]>;
  upsertSuccessPlan: (record: CustomerSuccessPlan) => Promise<CustomerSuccessPlan>;
  listRenewals: (workspaceId: string) => Promise<CustomerSuccessRenewal[]>;
  upsertRenewal: (record: CustomerSuccessRenewal) => Promise<CustomerSuccessRenewal>;
  listSatisfaction: (workspaceId: string) => Promise<CustomerSuccessSatisfaction[]>;
  upsertSatisfaction: (record: CustomerSuccessSatisfaction) => Promise<CustomerSuccessSatisfaction>;
  listSupportSignals: (workspaceId: string) => Promise<CustomerSuccessSupportSignal[]>;
  upsertSupportSignal: (record: CustomerSuccessSupportSignal) => Promise<CustomerSuccessSupportSignal>;
  listExpansionOpportunities: (workspaceId: string) => Promise<CustomerSuccessExpansionOpportunity[]>;
  upsertExpansionOpportunity: (record: CustomerSuccessExpansionOpportunity) => Promise<CustomerSuccessExpansionOpportunity>;
  listKpis: (workspaceId: string) => Promise<CustomerSuccessKpi[]>;
  upsertKpi: (record: CustomerSuccessKpi) => Promise<CustomerSuccessKpi>;
  listRecommendations: (workspaceId: string) => Promise<CustomerSuccessRecommendation[]>;
  upsertRecommendation: (record: CustomerSuccessRecommendation) => Promise<CustomerSuccessRecommendation>;
  appendRecommendationReview: (record: CustomerSuccessRecommendationReview) => Promise<CustomerSuccessRecommendationReview>;
  listExecutiveReports: (workspaceId: string) => Promise<CustomerSuccessExecutiveReport[]>;
  upsertExecutiveReport: (record: CustomerSuccessExecutiveReport) => Promise<CustomerSuccessExecutiveReport>;
  listTimeline: (workspaceId: string) => Promise<CustomerSuccessTimelineEvent[]>;
  appendTimelineEvent: (record: CustomerSuccessTimelineEvent) => Promise<CustomerSuccessTimelineEvent>;
  listAgentHealth: (workspaceId: string) => Promise<CustomerSuccessHealthSnapshot[]>;
  upsertAgentHealth: (record: CustomerSuccessHealthSnapshot) => Promise<CustomerSuccessHealthSnapshot>;
};

export function createInMemoryCustomerSuccessRepository(): CustomerSuccessRepository {
  const onboarding = new Map<string, CustomerSuccessOnboardingRecord>();
  const customerHealth = new Map<string, CustomerSuccessHealthRecord>();
  const plans = new Map<string, CustomerSuccessPlan>();
  const renewals = new Map<string, CustomerSuccessRenewal>();
  const satisfaction = new Map<string, CustomerSuccessSatisfaction>();
  const supportSignals = new Map<string, CustomerSuccessSupportSignal>();
  const expansions = new Map<string, CustomerSuccessExpansionOpportunity>();
  const kpis = new Map<string, CustomerSuccessKpi>();
  const recommendations = new Map<string, CustomerSuccessRecommendation>();
  const reviews = new Map<string, CustomerSuccessRecommendationReview>();
  const reports = new Map<string, CustomerSuccessExecutiveReport>();
  const timeline = new Map<string, CustomerSuccessTimelineEvent>();
  const agentHealth = new Map<string, CustomerSuccessHealthSnapshot>();

  return {
    async listOnboarding(workspaceId) { return [...onboarding.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertOnboarding(record) { onboarding.set(record.customerSuccessOnboardingId, record); return record; },
    async listCustomerHealth(workspaceId) { return [...customerHealth.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },
    async upsertCustomerHealth(record) { customerHealth.set(record.customerSuccessHealthId, record); return record; },
    async listSuccessPlans(workspaceId) { return [...plans.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertSuccessPlan(record) { plans.set(record.customerSuccessPlanId, record); return record; },
    async listRenewals(workspaceId) { return [...renewals.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertRenewal(record) { renewals.set(record.customerSuccessRenewalId, record); return record; },
    async listSatisfaction(workspaceId) { return [...satisfaction.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },
    async upsertSatisfaction(record) { satisfaction.set(record.customerSuccessSatisfactionId, record); return record; },
    async listSupportSignals(workspaceId) { return [...supportSignals.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertSupportSignal(record) { supportSignals.set(record.customerSuccessSupportSignalId, record); return record; },
    async listExpansionOpportunities(workspaceId) { return [...expansions.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async upsertExpansionOpportunity(record) { expansions.set(record.customerSuccessExpansionOpportunityId, record); return record; },
    async listKpis(workspaceId) { return [...kpis.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },
    async upsertKpi(record) { kpis.set(record.customerSuccessKpiId, record); return record; },
    async listRecommendations(workspaceId) { return [...recommendations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async upsertRecommendation(record) { recommendations.set(record.customerSuccessRecommendationId, record); return record; },
    async appendRecommendationReview(record) {
      reviews.set(record.customerSuccessRecommendationReviewId, record);
      const rec = recommendations.get(record.customerSuccessRecommendationId);
      if (rec) recommendations.set(rec.customerSuccessRecommendationId, { ...rec, status: record.decision });
      return record;
    },
    async listExecutiveReports(workspaceId) { return [...reports.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async upsertExecutiveReport(record) { reports.set(record.customerSuccessExecutiveReportId, record); return record; },
    async listTimeline(workspaceId) { return [...timeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async appendTimelineEvent(record) { timeline.set(record.customerSuccessTimelineEventId, record); return record; },
    async listAgentHealth(workspaceId) { return [...agentHealth.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)); },
    async upsertAgentHealth(record) { agentHealth.set(record.customerSuccessAgentHealthId, record); return record; },
  };
}

export function createPrismaCustomerSuccessRepository(prisma: PrismaClient = getPrismaClient()): CustomerSuccessRepository {
  return {
    async listOnboarding(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessOnboarding.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, status: toCustomerSuccessOnboardingStatus(row.status), updatedAt: row.updatedAt.toISOString(), implementationMilestones: (row.implementationMilestones as string[]) ?? [] }));
    },
    async upsertOnboarding(record) {
      await prisma.gbaCustomerSuccessOnboarding.upsert({ where: { customerSuccessOnboardingId: record.customerSuccessOnboardingId }, create: { ...record, implementationMilestones: toJson(record.implementationMilestones), updatedAt: new Date(record.updatedAt) }, update: { customerId: record.customerId, customerName: record.customerName, status: record.status, implementationMilestones: toJson(record.implementationMilestones), trainingProgressPercent: record.trainingProgressPercent, documentationCompletionPercent: record.documentationCompletionPercent, goLiveReadinessPercent: record.goLiveReadinessPercent, adoptionCheckpointPercent: record.adoptionCheckpointPercent, ownerId: record.ownerId, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listCustomerHealth(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessHealth.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({ ...row, measuredAt: row.measuredAt.toISOString(), trendDirection: row.trendDirection as CustomerSuccessHealthRecord["trendDirection"], riskLevel: row.riskLevel as CustomerSuccessHealthRecord["riskLevel"], recommendedActions: (row.recommendedActions as string[]) ?? [] }));
    },
    async upsertCustomerHealth(record) {
      await prisma.gbaCustomerSuccessHealth.upsert({ where: { customerSuccessHealthId: record.customerSuccessHealthId }, create: { ...record, recommendedActions: toJson(record.recommendedActions), measuredAt: new Date(record.measuredAt) }, update: { customerId: record.customerId, customerName: record.customerName, overallHealthScore: record.overallHealthScore, trendDirection: record.trendDirection, riskLevel: record.riskLevel, productAdoptionScore: record.productAdoptionScore, renewalHistoryScore: record.renewalHistoryScore, supportInteractionScore: record.supportInteractionScore, engagementScore: record.engagementScore, satisfactionScore: record.satisfactionScore, executiveEscalationScore: record.executiveEscalationScore, financialStandingScore: record.financialStandingScore, operationalDeliveryScore: record.operationalDeliveryScore, recommendedActions: toJson(record.recommendedActions), measuredAt: new Date(record.measuredAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listSuccessPlans(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessPlan.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, strategicObjectives: (row.strategicObjectives as string[]) ?? [], customerGoals: (row.customerGoals as string[]) ?? [], milestones: (row.milestones as string[]) ?? [], actionItems: (row.actionItems as string[]) ?? [], successOutcomes: (row.successOutcomes as string[]) ?? [], updatedAt: row.updatedAt.toISOString() }));
    },
    async upsertSuccessPlan(record) {
      await prisma.gbaCustomerSuccessPlan.upsert({ where: { customerSuccessPlanId: record.customerSuccessPlanId }, create: { ...record, strategicObjectives: toJson(record.strategicObjectives), customerGoals: toJson(record.customerGoals), milestones: toJson(record.milestones), actionItems: toJson(record.actionItems), successOutcomes: toJson(record.successOutcomes), updatedAt: new Date(record.updatedAt) }, update: { customerId: record.customerId, customerName: record.customerName, strategicObjectives: toJson(record.strategicObjectives), customerGoals: toJson(record.customerGoals), milestones: toJson(record.milestones), actionItems: toJson(record.actionItems), reviewSchedule: record.reviewSchedule, successOutcomes: toJson(record.successOutcomes), updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listRenewals(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessRenewal.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, contractExpiresAt: row.contractExpiresAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
    },
    async upsertRenewal(record) {
      await prisma.gbaCustomerSuccessRenewal.upsert({ where: { customerSuccessRenewalId: record.customerSuccessRenewalId }, create: { ...record, contractExpiresAt: new Date(record.contractExpiresAt), updatedAt: new Date(record.updatedAt) }, update: { customerId: record.customerId, customerName: record.customerName, contractReference: record.contractReference, contractExpiresAt: new Date(record.contractExpiresAt), renewalProbabilityPercent: record.renewalProbabilityPercent, renewalForecastCents: record.renewalForecastCents, churnRiskPercent: record.churnRiskPercent, escalationRequired: record.escalationRequired, recommendationSummary: record.recommendationSummary, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listSatisfaction(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessSatisfaction.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({ ...row, measuredAt: row.measuredAt.toISOString(), sentimentTrend: row.sentimentTrend as CustomerSuccessSatisfaction["sentimentTrend"], feedbackHighlights: (row.feedbackHighlights as string[]) ?? [] }));
    },
    async upsertSatisfaction(record) {
      await prisma.gbaCustomerSuccessSatisfaction.upsert({ where: { customerSuccessSatisfactionId: record.customerSuccessSatisfactionId }, create: { ...record, feedbackHighlights: toJson(record.feedbackHighlights), measuredAt: new Date(record.measuredAt) }, update: { customerId: record.customerId, customerName: record.customerName, csatScore: record.csatScore, npsScore: record.npsScore, sentimentTrend: record.sentimentTrend, surveySummary: record.surveySummary, feedbackHighlights: toJson(record.feedbackHighlights), measuredAt: new Date(record.measuredAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listSupportSignals(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessSupportSignal.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
    },
    async upsertSupportSignal(record) {
      await prisma.gbaCustomerSuccessSupportSignal.upsert({ where: { customerSuccessSupportSignalId: record.customerSuccessSupportSignalId }, create: { ...record, updatedAt: new Date(record.updatedAt) }, update: { customerId: record.customerId, customerName: record.customerName, openIssues: record.openIssues, escalations: record.escalations, resolutionProgressPercent: record.resolutionProgressPercent, slaPerformancePercent: record.slaPerformancePercent, communicationSummary: record.communicationSummary, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listExpansionOpportunities(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessExpansionOpportunity.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString(), opportunityType: row.opportunityType as CustomerSuccessExpansionOpportunity["opportunityType"] }));
    },
    async upsertExpansionOpportunity(record) {
      await prisma.gbaCustomerSuccessExpansionOpportunity.upsert({ where: { customerSuccessExpansionOpportunityId: record.customerSuccessExpansionOpportunityId }, create: { ...record, updatedAt: new Date(record.updatedAt) }, update: { customerId: record.customerId, customerName: record.customerName, opportunityType: record.opportunityType, productAdoptionGap: record.productAdoptionGap, growthIndicator: record.growthIndicator, projectedRevenueCents: record.projectedRevenueCents, confidenceScore: record.confidenceScore, recommendationSummary: record.recommendationSummary, updatedAt: new Date(record.updatedAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listKpis(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessKpi.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({ ...row, measuredAt: row.measuredAt.toISOString() }));
    },
    async upsertKpi(record) {
      await prisma.gbaCustomerSuccessKpi.upsert({ where: { customerSuccessKpiId: record.customerSuccessKpiId }, create: { ...record, measuredAt: new Date(record.measuredAt) }, update: { name: record.name, value: record.value, unit: record.unit, target: record.target, trend: record.trend, measuredAt: new Date(record.measuredAt), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listRecommendations(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessRecommendation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), category: row.category as CustomerSuccessRecommendation["category"], priority: row.priority as CustomerSuccessRecommendation["priority"], confidence: row.confidence as CustomerSuccessRecommendation["confidence"], status: row.status as CustomerSuccessRecommendation["status"] }));
    },
    async upsertRecommendation(record) {
      await prisma.gbaCustomerSuccessRecommendation.upsert({ where: { customerSuccessRecommendationId: record.customerSuccessRecommendationId }, create: { ...record, createdAt: new Date(record.createdAt) }, update: { customerId: record.customerId, customerName: record.customerName, category: record.category, title: record.title, summary: record.summary, recommendedAction: record.recommendedAction, priority: record.priority, confidence: record.confidence, status: record.status, sourceReference: record.sourceReference, immutableLineage: record.immutableLineage } });
      return record;
    },
    async appendRecommendationReview(record) {
      await prisma.gbaCustomerSuccessRecommendationReview.create({ data: { ...record, reviewedAt: new Date(record.reviewedAt) } });
      await prisma.gbaCustomerSuccessRecommendation.updateMany({ where: { customerSuccessRecommendationId: record.customerSuccessRecommendationId }, data: { status: record.decision } });
      return record;
    },
    async listExecutiveReports(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessExecutiveReport.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({ ...row, period: row.period as CustomerSuccessExecutiveReport["period"], strategicRisks: (row.strategicRisks as string[]) ?? [], strategicOpportunities: (row.strategicOpportunities as string[]) ?? [], createdAt: row.createdAt.toISOString() }));
    },
    async upsertExecutiveReport(record) {
      await prisma.gbaCustomerSuccessExecutiveReport.upsert({ where: { customerSuccessExecutiveReportId: record.customerSuccessExecutiveReportId }, create: { ...record, strategicRisks: toJson(record.strategicRisks), strategicOpportunities: toJson(record.strategicOpportunities), createdAt: new Date(record.createdAt) }, update: { period: record.period, summary: record.summary, churnForecast: record.churnForecast, renewalForecast: record.renewalForecast, strategicRisks: toJson(record.strategicRisks), strategicOpportunities: toJson(record.strategicOpportunities), immutableLineage: record.immutableLineage } });
      return record;
    },
    async listTimeline(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessTimelineEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({ ...row, evidenceReferences: (row.evidenceReferences as string[]) ?? [], createdAt: row.createdAt.toISOString() }));
    },
    async appendTimelineEvent(record) {
      await prisma.gbaCustomerSuccessTimelineEvent.create({ data: { ...record, evidenceReferences: toJson(record.evidenceReferences), createdAt: new Date(record.createdAt) } });
      return record;
    },
    async listAgentHealth(workspaceId) {
      const rows = await prisma.gbaCustomerSuccessAgentHealth.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({ ...row, generatedAt: row.generatedAt.toISOString(), status: row.status as CustomerSuccessHealthSnapshot["status"] }));
    },
    async upsertAgentHealth(record) {
      await prisma.gbaCustomerSuccessAgentHealth.upsert({ where: { customerSuccessAgentHealthId: record.customerSuccessAgentHealthId }, create: { ...record, generatedAt: new Date(record.generatedAt) }, update: { status: record.status, atRiskCustomers: record.atRiskCustomers, renewalsAtRisk: record.renewalsAtRisk, escalatedAccounts: record.escalatedAccounts, onboardingDelays: record.onboardingDelays, immutableLineage: record.immutableLineage } });
      return record;
    },
  };
}
