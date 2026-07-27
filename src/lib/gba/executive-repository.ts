import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  ExecutiveApproval,
  ExecutiveBriefing,
  ExecutiveDelegation,
  ExecutiveGoal,
  ExecutiveGoalHistoryRecord,
  ExecutiveHealthSnapshot,
  ExecutiveKpiDefinition,
  ExecutiveKpiHistoryRecord,
  ExecutiveOpportunity,
  ExecutiveOpportunityHistoryRecord,
  ExecutiveRecommendation,
  ExecutiveRecommendationReview,
  ExecutiveRisk,
  ExecutiveRiskHistoryRecord,
  ExecutiveTimelineEvent,
} from "./executive-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type ExecutiveRepository = {
  saveBriefing: (briefing: ExecutiveBriefing) => Promise<ExecutiveBriefing>;
  listBriefings: (workspaceId: string) => Promise<ExecutiveBriefing[]>;

  saveGoal: (goal: ExecutiveGoal) => Promise<ExecutiveGoal>;
  listGoals: (workspaceId: string) => Promise<ExecutiveGoal[]>;
  saveGoalHistory: (record: ExecutiveGoalHistoryRecord) => Promise<ExecutiveGoalHistoryRecord>;
  listGoalHistory: (workspaceId: string, goalId?: string) => Promise<ExecutiveGoalHistoryRecord[]>;

  saveKpi: (kpi: ExecutiveKpiDefinition) => Promise<ExecutiveKpiDefinition>;
  listKpis: (workspaceId: string) => Promise<ExecutiveKpiDefinition[]>;
  saveKpiHistory: (record: ExecutiveKpiHistoryRecord) => Promise<ExecutiveKpiHistoryRecord>;
  listKpiHistory: (workspaceId: string, kpiId?: string) => Promise<ExecutiveKpiHistoryRecord[]>;

  saveRecommendation: (recommendation: ExecutiveRecommendation) => Promise<ExecutiveRecommendation>;
  listRecommendations: (workspaceId: string) => Promise<ExecutiveRecommendation[]>;
  saveRecommendationReview: (review: ExecutiveRecommendationReview) => Promise<ExecutiveRecommendationReview>;
  listRecommendationReviews: (workspaceId: string, recommendationId?: string) => Promise<ExecutiveRecommendationReview[]>;

  saveRisk: (risk: ExecutiveRisk) => Promise<ExecutiveRisk>;
  listRisks: (workspaceId: string) => Promise<ExecutiveRisk[]>;
  saveRiskHistory: (record: ExecutiveRiskHistoryRecord) => Promise<ExecutiveRiskHistoryRecord>;
  listRiskHistory: (workspaceId: string, riskId?: string) => Promise<ExecutiveRiskHistoryRecord[]>;

  saveOpportunity: (opportunity: ExecutiveOpportunity) => Promise<ExecutiveOpportunity>;
  listOpportunities: (workspaceId: string) => Promise<ExecutiveOpportunity[]>;
  saveOpportunityHistory: (record: ExecutiveOpportunityHistoryRecord) => Promise<ExecutiveOpportunityHistoryRecord>;
  listOpportunityHistory: (workspaceId: string, opportunityId?: string) => Promise<ExecutiveOpportunityHistoryRecord[]>;

  saveDelegation: (delegation: ExecutiveDelegation) => Promise<ExecutiveDelegation>;
  listDelegations: (workspaceId: string) => Promise<ExecutiveDelegation[]>;

  saveApproval: (approval: ExecutiveApproval) => Promise<ExecutiveApproval>;
  listApprovals: (workspaceId: string) => Promise<ExecutiveApproval[]>;

  saveTimelineEvent: (event: ExecutiveTimelineEvent) => Promise<ExecutiveTimelineEvent>;
  listTimeline: (workspaceId: string) => Promise<ExecutiveTimelineEvent[]>;

  saveHealth: (health: ExecutiveHealthSnapshot) => Promise<ExecutiveHealthSnapshot>;
  listHealth: (workspaceId: string) => Promise<ExecutiveHealthSnapshot[]>;
};

export function createInMemoryExecutiveRepository(): ExecutiveRepository {
  const briefings = new Map<string, ExecutiveBriefing>();
  const goals = new Map<string, ExecutiveGoal>();
  const goalHistory = new Map<string, ExecutiveGoalHistoryRecord>();
  const kpis = new Map<string, ExecutiveKpiDefinition>();
  const kpiHistory = new Map<string, ExecutiveKpiHistoryRecord>();
  const recommendations = new Map<string, ExecutiveRecommendation>();
  const recommendationReviews = new Map<string, ExecutiveRecommendationReview>();
  const risks = new Map<string, ExecutiveRisk>();
  const riskHistory = new Map<string, ExecutiveRiskHistoryRecord>();
  const opportunities = new Map<string, ExecutiveOpportunity>();
  const opportunityHistory = new Map<string, ExecutiveOpportunityHistoryRecord>();
  const delegations = new Map<string, ExecutiveDelegation>();
  const approvals = new Map<string, ExecutiveApproval>();
  const timeline = new Map<string, ExecutiveTimelineEvent>();
  const health = new Map<string, ExecutiveHealthSnapshot>();

  return {
    async saveBriefing(briefing) { briefings.set(briefing.briefingId, briefing); return briefing; },
    async listBriefings(workspaceId) { return [...briefings.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveGoal(goal) { goals.set(goal.goalId, goal); return goal; },
    async listGoals(workspaceId) { return [...goals.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveGoalHistory(record) { goalHistory.set(record.goalHistoryId, record); return record; },
    async listGoalHistory(workspaceId, goalId) {
      const rows = [...goalHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = goalId ? rows.filter((entry) => entry.goalId === goalId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveKpi(kpi) { kpis.set(kpi.kpiId, kpi); return kpi; },
    async listKpis(workspaceId) { return [...kpis.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveKpiHistory(record) { kpiHistory.set(record.kpiHistoryId, record); return record; },
    async listKpiHistory(workspaceId, kpiId) {
      const rows = [...kpiHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = kpiId ? rows.filter((entry) => entry.kpiId === kpiId) : rows;
      return scoped.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    },

    async saveRecommendation(recommendation) { recommendations.set(recommendation.recommendationId, recommendation); return recommendation; },
    async listRecommendations(workspaceId) { return [...recommendations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async saveRecommendationReview(review) { recommendationReviews.set(review.recommendationReviewId, review); return review; },
    async listRecommendationReviews(workspaceId, recommendationId) {
      const rows = [...recommendationReviews.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = recommendationId ? rows.filter((entry) => entry.recommendationId === recommendationId) : rows;
      return scoped.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    },

    async saveRisk(risk) { risks.set(risk.riskId, risk); return risk; },
    async listRisks(workspaceId) { return [...risks.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveRiskHistory(record) { riskHistory.set(record.riskHistoryId, record); return record; },
    async listRiskHistory(workspaceId, riskId) {
      const rows = [...riskHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = riskId ? rows.filter((entry) => entry.riskId === riskId) : rows;
      return scoped.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    },

    async saveOpportunity(opportunity) { opportunities.set(opportunity.opportunityId, opportunity); return opportunity; },
    async listOpportunities(workspaceId) { return [...opportunities.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveOpportunityHistory(record) { opportunityHistory.set(record.opportunityHistoryId, record); return record; },
    async listOpportunityHistory(workspaceId, opportunityId) {
      const rows = [...opportunityHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = opportunityId ? rows.filter((entry) => entry.opportunityId === opportunityId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveDelegation(delegation) { delegations.set(delegation.delegationId, delegation); return delegation; },
    async listDelegations(workspaceId) { return [...delegations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveApproval(approval) { approvals.set(approval.approvalId, approval); return approval; },
    async listApprovals(workspaceId) { return [...approvals.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveTimelineEvent(event) { timeline.set(event.timelineEventId, event); return event; },
    async listTimeline(workspaceId) { return [...timeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveHealth(entry) { health.set(entry.healthId, entry); return entry; },
    async listHealth(workspaceId) { return [...health.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)); },
  };
}

export function createPrismaExecutiveRepository(prismaClient?: PrismaClient): ExecutiveRepository {
  const prisma = prismaClient ?? getPrismaClient();

  return {
    async saveBriefing(briefing) {
      await prisma.gbaExecutiveBriefing.upsert({
        where: { briefingId: briefing.briefingId },
        create: {
          briefingId: briefing.briefingId,
          workspaceId: briefing.workspaceId,
          organizationId: briefing.organizationId,
          period: briefing.period,
          executiveSummary: briefing.executiveSummary,
          criticalAlerts: toJson(briefing.criticalAlerts),
          topOpportunities: toJson(briefing.topOpportunities),
          topRisks: toJson(briefing.topRisks),
          completedGoals: toJson(briefing.completedGoals),
          behindScheduleGoals: toJson(briefing.behindScheduleGoals),
          operationalHighlights: toJson(briefing.operationalHighlights),
          financialHighlights: toJson(briefing.financialHighlights),
          marketingHighlights: toJson(briefing.marketingHighlights),
          manufacturingHighlights: toJson(briefing.manufacturingHighlights),
          salesHighlights: toJson(briefing.salesHighlights),
          supportHighlights: toJson(briefing.supportHighlights),
          recommendedExecutiveActions: toJson(briefing.recommendedExecutiveActions),
          evidenceReferences: toJson(briefing.evidenceReferences),
          contextPackageId: briefing.contextPackageId ?? null,
          replayChecksum: briefing.replayChecksum,
          createdBy: briefing.createdBy,
          createdAt: new Date(briefing.createdAt),
          immutableLineage: briefing.immutableLineage,
        },
        update: {
          executiveSummary: briefing.executiveSummary,
          criticalAlerts: toJson(briefing.criticalAlerts),
          topOpportunities: toJson(briefing.topOpportunities),
          topRisks: toJson(briefing.topRisks),
          completedGoals: toJson(briefing.completedGoals),
          behindScheduleGoals: toJson(briefing.behindScheduleGoals),
          operationalHighlights: toJson(briefing.operationalHighlights),
          financialHighlights: toJson(briefing.financialHighlights),
          marketingHighlights: toJson(briefing.marketingHighlights),
          manufacturingHighlights: toJson(briefing.manufacturingHighlights),
          salesHighlights: toJson(briefing.salesHighlights),
          supportHighlights: toJson(briefing.supportHighlights),
          recommendedExecutiveActions: toJson(briefing.recommendedExecutiveActions),
          evidenceReferences: toJson(briefing.evidenceReferences),
          contextPackageId: briefing.contextPackageId ?? null,
          replayChecksum: briefing.replayChecksum,
        },
      });
      return briefing;
    },
    async listBriefings(workspaceId) {
      const rows = await prisma.gbaExecutiveBriefing.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        briefingId: row.briefingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        period: row.period,
        executiveSummary: row.executiveSummary,
        criticalAlerts: row.criticalAlerts as string[],
        topOpportunities: row.topOpportunities as string[],
        topRisks: row.topRisks as string[],
        completedGoals: row.completedGoals as string[],
        behindScheduleGoals: row.behindScheduleGoals as string[],
        operationalHighlights: row.operationalHighlights as string[],
        financialHighlights: row.financialHighlights as string[],
        marketingHighlights: row.marketingHighlights as string[],
        manufacturingHighlights: row.manufacturingHighlights as string[],
        salesHighlights: row.salesHighlights as string[],
        supportHighlights: row.supportHighlights as string[],
        recommendedExecutiveActions: row.recommendedExecutiveActions as string[],
        evidenceReferences: row.evidenceReferences as string[],
        contextPackageId: row.contextPackageId ?? undefined,
        replayChecksum: row.replayChecksum,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveGoal(goal) {
      await prisma.gbaExecutiveGoal.upsert({
        where: { goalId: goal.goalId },
        create: {
          goalId: goal.goalId,
          workspaceId: goal.workspaceId,
          organizationId: goal.organizationId,
          parentGoalId: goal.parentGoalId ?? null,
          level: goal.level,
          title: goal.title,
          owner: goal.owner,
          objective: goal.objective,
          keyResults: toJson(goal.keyResults),
          milestones: toJson(goal.milestones),
          dependencies: toJson(goal.dependencies),
          deadline: new Date(goal.deadline),
          progressPercent: goal.progressPercent,
          status: goal.status,
          evidenceReferences: toJson(goal.evidenceReferences),
          createdAt: new Date(goal.createdAt),
          updatedAt: new Date(goal.updatedAt),
        },
        update: {
          parentGoalId: goal.parentGoalId ?? null,
          level: goal.level,
          title: goal.title,
          owner: goal.owner,
          objective: goal.objective,
          keyResults: toJson(goal.keyResults),
          milestones: toJson(goal.milestones),
          dependencies: toJson(goal.dependencies),
          deadline: new Date(goal.deadline),
          progressPercent: goal.progressPercent,
          status: goal.status,
          evidenceReferences: toJson(goal.evidenceReferences),
          updatedAt: new Date(goal.updatedAt),
        },
      });
      return goal;
    },
    async listGoals(workspaceId) {
      const rows = await prisma.gbaExecutiveGoal.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        goalId: row.goalId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        parentGoalId: row.parentGoalId ?? undefined,
        level: row.level as ExecutiveGoal["level"],
        title: row.title,
        owner: row.owner,
        objective: row.objective,
        keyResults: row.keyResults as string[],
        milestones: row.milestones as string[],
        dependencies: row.dependencies as string[],
        deadline: row.deadline.toISOString(),
        progressPercent: row.progressPercent,
        status: row.status as ExecutiveGoal["status"],
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async saveGoalHistory(record) {
      await prisma.gbaExecutiveGoalHistory.upsert({
        where: { goalHistoryId: record.goalHistoryId },
        create: {
          goalHistoryId: record.goalHistoryId,
          goalId: record.goalId,
          workspaceId: record.workspaceId,
          organizationId: record.organizationId,
          progressPercent: record.progressPercent,
          status: record.status,
          changedBy: record.changedBy,
          changedAt: new Date(record.changedAt),
          immutableLineage: record.immutableLineage,
        },
        update: {
          progressPercent: record.progressPercent,
          status: record.status,
          changedBy: record.changedBy,
          changedAt: new Date(record.changedAt),
        },
      });
      return record;
    },
    async listGoalHistory(workspaceId, goalId) {
      const rows = await prisma.gbaExecutiveGoalHistory.findMany({
        where: { workspaceId, ...(goalId ? { goalId } : {}) },
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        goalHistoryId: row.goalHistoryId,
        goalId: row.goalId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        progressPercent: row.progressPercent,
        status: row.status as ExecutiveGoalHistoryRecord["status"],
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveKpi(kpi) {
      await prisma.gbaExecutiveKpi.upsert({
        where: { kpiId: kpi.kpiId },
        create: {
          kpiId: kpi.kpiId,
          workspaceId: kpi.workspaceId,
          organizationId: kpi.organizationId,
          name: kpi.name,
          owner: kpi.owner,
          target: kpi.target,
          thresholdGreen: kpi.thresholdGreen,
          thresholdYellow: kpi.thresholdYellow,
          unit: kpi.unit,
          versionTag: kpi.versionTag,
          evidenceReferences: toJson(kpi.evidenceReferences),
          createdAt: new Date(kpi.createdAt),
          updatedAt: new Date(kpi.updatedAt),
        },
        update: {
          name: kpi.name,
          owner: kpi.owner,
          target: kpi.target,
          thresholdGreen: kpi.thresholdGreen,
          thresholdYellow: kpi.thresholdYellow,
          unit: kpi.unit,
          versionTag: kpi.versionTag,
          evidenceReferences: toJson(kpi.evidenceReferences),
          updatedAt: new Date(kpi.updatedAt),
        },
      });
      return kpi;
    },
    async listKpis(workspaceId) {
      const rows = await prisma.gbaExecutiveKpi.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        kpiId: row.kpiId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        name: row.name,
        owner: row.owner,
        target: row.target,
        thresholdGreen: row.thresholdGreen,
        thresholdYellow: row.thresholdYellow,
        unit: row.unit,
        versionTag: row.versionTag,
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async saveKpiHistory(record) {
      await prisma.gbaExecutiveKpiHistory.upsert({
        where: { kpiHistoryId: record.kpiHistoryId },
        create: {
          kpiHistoryId: record.kpiHistoryId,
          kpiId: record.kpiId,
          workspaceId: record.workspaceId,
          organizationId: record.organizationId,
          measuredValue: record.measuredValue,
          trend: record.trend,
          score: record.score,
          status: record.status,
          measuredAt: new Date(record.measuredAt),
          immutableLineage: record.immutableLineage,
        },
        update: {
          measuredValue: record.measuredValue,
          trend: record.trend,
          score: record.score,
          status: record.status,
          measuredAt: new Date(record.measuredAt),
        },
      });
      return record;
    },
    async listKpiHistory(workspaceId, kpiId) {
      const rows = await prisma.gbaExecutiveKpiHistory.findMany({
        where: { workspaceId, ...(kpiId ? { kpiId } : {}) },
        orderBy: { measuredAt: "desc" },
      });
      return rows.map((row) => ({
        kpiHistoryId: row.kpiHistoryId,
        kpiId: row.kpiId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        measuredValue: row.measuredValue,
        trend: row.trend,
        score: row.score,
        status: row.status as ExecutiveKpiHistoryRecord["status"],
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveRecommendation(recommendation) {
      await prisma.gbaExecutiveRecommendation.upsert({
        where: { recommendationId: recommendation.recommendationId },
        create: {
          recommendationId: recommendation.recommendationId,
          workspaceId: recommendation.workspaceId,
          organizationId: recommendation.organizationId,
          category: recommendation.category,
          title: recommendation.title,
          summary: recommendation.summary,
          evidenceReferences: toJson(recommendation.evidenceReferences),
          businessImpact: recommendation.businessImpact,
          confidence: recommendation.confidence,
          requiredApprovals: toJson(recommendation.requiredApprovals),
          suggestedOwner: recommendation.suggestedOwner,
          priority: recommendation.priority,
          deterministicChecksum: recommendation.deterministicChecksum,
          reviewed: recommendation.reviewed,
          createdAt: new Date(recommendation.createdAt),
          immutableLineage: recommendation.immutableLineage,
        },
        update: {
          summary: recommendation.summary,
          evidenceReferences: toJson(recommendation.evidenceReferences),
          businessImpact: recommendation.businessImpact,
          confidence: recommendation.confidence,
          requiredApprovals: toJson(recommendation.requiredApprovals),
          suggestedOwner: recommendation.suggestedOwner,
          priority: recommendation.priority,
          deterministicChecksum: recommendation.deterministicChecksum,
          reviewed: recommendation.reviewed,
        },
      });
      return recommendation;
    },
    async listRecommendations(workspaceId) {
      const rows = await prisma.gbaExecutiveRecommendation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        recommendationId: row.recommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        category: row.category as ExecutiveRecommendation["category"],
        title: row.title,
        summary: row.summary,
        evidenceReferences: row.evidenceReferences as string[],
        businessImpact: row.businessImpact,
        confidence: row.confidence as ExecutiveRecommendation["confidence"],
        requiredApprovals: row.requiredApprovals as string[],
        suggestedOwner: row.suggestedOwner,
        priority: row.priority as ExecutiveRecommendation["priority"],
        deterministicChecksum: row.deterministicChecksum,
        reviewed: row.reviewed,
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveRecommendationReview(review) {
      await prisma.gbaExecutiveRecommendationReview.upsert({
        where: { recommendationReviewId: review.recommendationReviewId },
        create: {
          recommendationReviewId: review.recommendationReviewId,
          recommendationId: review.recommendationId,
          workspaceId: review.workspaceId,
          organizationId: review.organizationId,
          decision: review.decision,
          notes: review.notes ?? null,
          reviewedBy: review.reviewedBy,
          reviewedAt: new Date(review.reviewedAt),
          immutableLineage: review.immutableLineage,
        },
        update: {
          decision: review.decision,
          notes: review.notes ?? null,
          reviewedBy: review.reviewedBy,
          reviewedAt: new Date(review.reviewedAt),
        },
      });
      return review;
    },
    async listRecommendationReviews(workspaceId, recommendationId) {
      const rows = await prisma.gbaExecutiveRecommendationReview.findMany({
        where: { workspaceId, ...(recommendationId ? { recommendationId } : {}) },
        orderBy: { reviewedAt: "desc" },
      });
      return rows.map((row) => ({
        recommendationReviewId: row.recommendationReviewId,
        recommendationId: row.recommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        decision: row.decision as ExecutiveRecommendationReview["decision"],
        notes: row.notes ?? undefined,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveRisk(risk) {
      await prisma.gbaExecutiveRisk.upsert({
        where: { riskId: risk.riskId },
        create: {
          riskId: risk.riskId,
          workspaceId: risk.workspaceId,
          organizationId: risk.organizationId,
          category: risk.category,
          title: risk.title,
          probability: risk.probability,
          impact: risk.impact,
          owner: risk.owner,
          mitigation: risk.mitigation,
          status: risk.status,
          evidenceReferences: toJson(risk.evidenceReferences),
          createdAt: new Date(risk.createdAt),
          updatedAt: new Date(risk.updatedAt),
        },
        update: {
          probability: risk.probability,
          impact: risk.impact,
          owner: risk.owner,
          mitigation: risk.mitigation,
          status: risk.status,
          evidenceReferences: toJson(risk.evidenceReferences),
          updatedAt: new Date(risk.updatedAt),
        },
      });
      return risk;
    },
    async listRisks(workspaceId) {
      const rows = await prisma.gbaExecutiveRisk.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        riskId: row.riskId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        category: row.category as ExecutiveRisk["category"],
        title: row.title,
        probability: row.probability,
        impact: row.impact,
        owner: row.owner,
        mitigation: row.mitigation,
        status: row.status as ExecutiveRisk["status"],
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async saveRiskHistory(record) {
      await prisma.gbaExecutiveRiskHistory.upsert({
        where: { riskHistoryId: record.riskHistoryId },
        create: {
          riskHistoryId: record.riskHistoryId,
          riskId: record.riskId,
          workspaceId: record.workspaceId,
          organizationId: record.organizationId,
          status: record.status,
          reviewNote: record.reviewNote,
          reviewedBy: record.reviewedBy,
          reviewedAt: new Date(record.reviewedAt),
          immutableLineage: record.immutableLineage,
        },
        update: {
          status: record.status,
          reviewNote: record.reviewNote,
          reviewedBy: record.reviewedBy,
          reviewedAt: new Date(record.reviewedAt),
        },
      });
      return record;
    },
    async listRiskHistory(workspaceId, riskId) {
      const rows = await prisma.gbaExecutiveRiskHistory.findMany({ where: { workspaceId, ...(riskId ? { riskId } : {}) }, orderBy: { reviewedAt: "desc" } });
      return rows.map((row) => ({
        riskHistoryId: row.riskHistoryId,
        riskId: row.riskId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as ExecutiveRiskHistoryRecord["status"],
        reviewNote: row.reviewNote,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveOpportunity(opportunity) {
      await prisma.gbaExecutiveOpportunity.upsert({
        where: { opportunityId: opportunity.opportunityId },
        create: {
          opportunityId: opportunity.opportunityId,
          workspaceId: opportunity.workspaceId,
          organizationId: opportunity.organizationId,
          category: opportunity.category,
          title: opportunity.title,
          projectedImpact: opportunity.projectedImpact,
          owner: opportunity.owner,
          status: opportunity.status,
          evidenceReferences: toJson(opportunity.evidenceReferences),
          createdAt: new Date(opportunity.createdAt),
          updatedAt: new Date(opportunity.updatedAt),
        },
        update: {
          projectedImpact: opportunity.projectedImpact,
          owner: opportunity.owner,
          status: opportunity.status,
          evidenceReferences: toJson(opportunity.evidenceReferences),
          updatedAt: new Date(opportunity.updatedAt),
        },
      });
      return opportunity;
    },
    async listOpportunities(workspaceId) {
      const rows = await prisma.gbaExecutiveOpportunity.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        opportunityId: row.opportunityId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        category: row.category as ExecutiveOpportunity["category"],
        title: row.title,
        projectedImpact: row.projectedImpact,
        owner: row.owner,
        status: row.status as ExecutiveOpportunity["status"],
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async saveOpportunityHistory(record) {
      await prisma.gbaExecutiveOpportunityHistory.upsert({
        where: { opportunityHistoryId: record.opportunityHistoryId },
        create: {
          opportunityHistoryId: record.opportunityHistoryId,
          opportunityId: record.opportunityId,
          workspaceId: record.workspaceId,
          organizationId: record.organizationId,
          status: record.status,
          note: record.note,
          changedBy: record.changedBy,
          changedAt: new Date(record.changedAt),
          immutableLineage: record.immutableLineage,
        },
        update: {
          status: record.status,
          note: record.note,
          changedBy: record.changedBy,
          changedAt: new Date(record.changedAt),
        },
      });
      return record;
    },
    async listOpportunityHistory(workspaceId, opportunityId) {
      const rows = await prisma.gbaExecutiveOpportunityHistory.findMany({ where: { workspaceId, ...(opportunityId ? { opportunityId } : {}) }, orderBy: { changedAt: "desc" } });
      return rows.map((row) => ({
        opportunityHistoryId: row.opportunityHistoryId,
        opportunityId: row.opportunityId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as ExecutiveOpportunityHistoryRecord["status"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveDelegation(delegation) {
      await prisma.gbaExecutiveDelegation.upsert({
        where: { delegationId: delegation.delegationId },
        create: {
          delegationId: delegation.delegationId,
          workspaceId: delegation.workspaceId,
          organizationId: delegation.organizationId,
          targetAgent: delegation.targetAgent,
          objective: delegation.objective,
          orchestrationExecutionId: delegation.orchestrationExecutionId,
          requestedBy: delegation.requestedBy,
          createdAt: new Date(delegation.createdAt),
          immutableLineage: delegation.immutableLineage,
        },
        update: {
          targetAgent: delegation.targetAgent,
          objective: delegation.objective,
          orchestrationExecutionId: delegation.orchestrationExecutionId,
          requestedBy: delegation.requestedBy,
        },
      });
      return delegation;
    },
    async listDelegations(workspaceId) {
      const rows = await prisma.gbaExecutiveDelegation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        delegationId: row.delegationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        targetAgent: row.targetAgent as ExecutiveDelegation["targetAgent"],
        objective: row.objective,
        orchestrationExecutionId: row.orchestrationExecutionId,
        requestedBy: row.requestedBy,
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveApproval(approval) {
      await prisma.gbaExecutiveApproval.upsert({
        where: { approvalId: approval.approvalId },
        create: {
          approvalId: approval.approvalId,
          workspaceId: approval.workspaceId,
          organizationId: approval.organizationId,
          subjectType: approval.subjectType,
          subjectId: approval.subjectId,
          state: approval.state,
          requiredApprovers: toJson(approval.requiredApprovers),
          approvedBy: toJson(approval.approvedBy),
          createdAt: new Date(approval.createdAt),
          updatedAt: new Date(approval.updatedAt),
        },
        update: {
          state: approval.state,
          requiredApprovers: toJson(approval.requiredApprovers),
          approvedBy: toJson(approval.approvedBy),
          updatedAt: new Date(approval.updatedAt),
        },
      });
      return approval;
    },
    async listApprovals(workspaceId) {
      const rows = await prisma.gbaExecutiveApproval.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        approvalId: row.approvalId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        subjectType: row.subjectType as ExecutiveApproval["subjectType"],
        subjectId: row.subjectId,
        state: row.state as ExecutiveApproval["state"],
        requiredApprovers: row.requiredApprovers as string[],
        approvedBy: row.approvedBy as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async saveTimelineEvent(event) {
      await prisma.gbaExecutiveTimelineEvent.upsert({
        where: { timelineEventId: event.timelineEventId },
        create: {
          timelineEventId: event.timelineEventId,
          workspaceId: event.workspaceId,
          organizationId: event.organizationId,
          eventType: event.eventType,
          subjectId: event.subjectId,
          summary: event.summary,
          actorId: event.actorId,
          evidenceReferences: toJson(event.evidenceReferences),
          createdAt: new Date(event.createdAt),
        },
        update: {
          eventType: event.eventType,
          subjectId: event.subjectId,
          summary: event.summary,
          actorId: event.actorId,
          evidenceReferences: toJson(event.evidenceReferences),
          createdAt: new Date(event.createdAt),
        },
      });
      return event;
    },
    async listTimeline(workspaceId) {
      const rows = await prisma.gbaExecutiveTimelineEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        timelineEventId: row.timelineEventId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        eventType: row.eventType as ExecutiveTimelineEvent["eventType"],
        subjectId: row.subjectId,
        summary: row.summary,
        actorId: row.actorId,
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveHealth(entry) {
      await prisma.gbaExecutiveHealth.upsert({
        where: { healthId: entry.healthId },
        create: {
          healthId: entry.healthId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          criticalRiskCount: entry.criticalRiskCount,
          behindGoalCount: entry.behindGoalCount,
          openRecommendationCount: entry.openRecommendationCount,
          pendingApprovalCount: entry.pendingApprovalCount,
          generatedAt: new Date(entry.generatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          criticalRiskCount: entry.criticalRiskCount,
          behindGoalCount: entry.behindGoalCount,
          openRecommendationCount: entry.openRecommendationCount,
          pendingApprovalCount: entry.pendingApprovalCount,
          generatedAt: new Date(entry.generatedAt),
        },
      });
      return entry;
    },
    async listHealth(workspaceId) {
      const rows = await prisma.gbaExecutiveHealth.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({
        healthId: row.healthId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as ExecutiveHealthSnapshot["status"],
        criticalRiskCount: row.criticalRiskCount,
        behindGoalCount: row.behindGoalCount,
        openRecommendationCount: row.openRecommendationCount,
        pendingApprovalCount: row.pendingApprovalCount,
        generatedAt: row.generatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
  };
}
