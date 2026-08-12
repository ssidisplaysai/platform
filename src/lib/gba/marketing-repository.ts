import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  marketingId,
  type MarketingAnalyticsSnapshot,
  type MarketingBrandGovernanceReview,
  type MarketingCampaignPlan,
  type MarketingCampaignPlanHistory,
  type MarketingContentStrategy,
  type MarketingExecutiveReport,
  type MarketingHealthSnapshot,
  type MarketingRecommendation,
  type MarketingRecommendationReview,
  type MarketingSeoIntelligence,
  type MarketingTimelineEvent,
} from "./marketing-models";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapCampaignPlan(row: any): MarketingCampaignPlan {
  return {
    marketingCampaignPlanId: row.marketingCampaignPlanId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    campaignName: row.campaignName,
    objective: row.objective,
    channelFocus: row.channelFocus ?? [],
    targetAudience: row.targetAudience,
    status: row.status,
    startAt: iso(row.startAt) ?? undefined,
    endAt: iso(row.endAt) ?? undefined,
    budgetCents: row.budgetCents,
    expectedImpressions: row.expectedImpressions,
    expectedConversions: row.expectedConversions,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapContentStrategy(row: any): MarketingContentStrategy {
  return {
    marketingContentStrategyId: row.marketingContentStrategyId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    title: row.title,
    summary: row.summary,
    status: row.status,
    pillarTopics: row.pillarTopics ?? [],
    brandVoice: row.brandVoice,
    seoTheme: row.seoTheme,
    owner: row.owner,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapSeoIntelligence(row: any): MarketingSeoIntelligence {
  return {
    marketingSeoIntelligenceId: row.marketingSeoIntelligenceId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    primaryKeyword: row.primaryKeyword,
    secondaryKeywords: row.secondaryKeywords ?? [],
    score: row.score,
    opportunities: row.opportunities ?? [],
    blockers: row.blockers ?? [],
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapBrandGovernance(row: any): MarketingBrandGovernanceReview {
  return {
    marketingBrandGovernanceReviewId: row.marketingBrandGovernanceReviewId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    reviewState: row.reviewState,
    notes: row.notes,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapAnalyticsSnapshot(row: any): MarketingAnalyticsSnapshot {
  return {
    marketingAnalyticsSnapshotId: row.marketingAnalyticsSnapshotId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    sourceRecommendations: row.sourceRecommendations,
    sourceCollections: row.sourceCollections,
    trafficScore: row.trafficScore,
    engagementScore: row.engagementScore,
    conversionScore: row.conversionScore,
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapRecommendation(row: any): MarketingRecommendation {
  return {
    marketingRecommendationId: row.marketingRecommendationId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    category: row.category,
    title: row.title,
    summary: row.summary,
    recommendedAction: row.recommendedAction,
    priority: row.priority,
    confidence: row.confidence,
    status: row.status,
    sourceReference: row.sourceReference,
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapTimeline(row: any): MarketingTimelineEvent {
  return {
    marketingTimelineEventId: row.marketingTimelineEventId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    eventType: row.eventType,
    subjectId: row.subjectId,
    summary: row.summary,
    actorId: row.actorId,
    evidenceReferences: row.evidenceReferences ?? [],
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapExecutiveReport(row: any): MarketingExecutiveReport {
  return {
    marketingExecutiveReportId: row.marketingExecutiveReportId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    period: row.period,
    summary: row.summary,
    campaignHighlights: row.campaignHighlights as Record<string, unknown>,
    contentHighlights: row.contentHighlights as Record<string, unknown>,
    seoHighlights: row.seoHighlights as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

function mapHealth(row: any): MarketingHealthSnapshot {
  return {
    marketingHealthId: row.marketingHealthId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    status: row.status,
    blockedCampaigns: row.blockedCampaigns,
    reviewBacklog: row.reviewBacklog,
    seoRisks: row.seoRisks,
    analyticsGaps: row.analyticsGaps,
    generatedAt: row.generatedAt.toISOString(),
    immutableLineage: row.immutableLineage,
  };
}

export type MarketingRepository = {
  listCampaignPlans: (projectId: string) => Promise<MarketingCampaignPlan[]>;
  createCampaignPlan: (plan: MarketingCampaignPlan) => Promise<MarketingCampaignPlan>;
  appendCampaignPlanHistory: (history: MarketingCampaignPlanHistory) => Promise<MarketingCampaignPlanHistory>;
  listContentStrategies: (projectId: string) => Promise<MarketingContentStrategy[]>;
  upsertContentStrategy: (strategy: Omit<MarketingContentStrategy, "marketingContentStrategyId" | "createdAt" | "updatedAt"> & { marketingContentStrategyId?: string }) => Promise<MarketingContentStrategy>;
  listSeoIntelligence: (projectId: string) => Promise<MarketingSeoIntelligence[]>;
  upsertSeoIntelligence: (entry: Omit<MarketingSeoIntelligence, "marketingSeoIntelligenceId" | "createdAt"> & { marketingSeoIntelligenceId?: string }) => Promise<MarketingSeoIntelligence>;
  listBrandGovernanceReviews: (projectId: string) => Promise<MarketingBrandGovernanceReview[]>;
  upsertBrandGovernanceReview: (entry: Omit<MarketingBrandGovernanceReview, "marketingBrandGovernanceReviewId" | "reviewedAt"> & { marketingBrandGovernanceReviewId?: string }) => Promise<MarketingBrandGovernanceReview>;
  listAnalyticsSnapshots: (projectId: string) => Promise<MarketingAnalyticsSnapshot[]>;
  upsertAnalyticsSnapshot: (entry: Omit<MarketingAnalyticsSnapshot, "marketingAnalyticsSnapshotId" | "createdAt"> & { marketingAnalyticsSnapshotId?: string }) => Promise<MarketingAnalyticsSnapshot>;
  listRecommendations: (projectId: string) => Promise<MarketingRecommendation[]>;
  upsertRecommendation: (entry: Omit<MarketingRecommendation, "marketingRecommendationId" | "createdAt"> & { marketingRecommendationId?: string }) => Promise<MarketingRecommendation>;
  appendRecommendationReview: (entry: MarketingRecommendationReview) => Promise<MarketingRecommendationReview>;
  listTimeline: (projectId: string) => Promise<MarketingTimelineEvent[]>;
  appendTimelineEvent: (entry: Omit<MarketingTimelineEvent, "marketingTimelineEventId" | "createdAt"> & { marketingTimelineEventId?: string }) => Promise<MarketingTimelineEvent>;
  listExecutiveReports: (projectId: string) => Promise<MarketingExecutiveReport[]>;
  upsertExecutiveReport: (entry: Omit<MarketingExecutiveReport, "marketingExecutiveReportId" | "createdAt"> & { marketingExecutiveReportId?: string }) => Promise<MarketingExecutiveReport>;
  listHealthSnapshots: (projectId: string) => Promise<MarketingHealthSnapshot[]>;
  upsertHealthSnapshot: (entry: Omit<MarketingHealthSnapshot, "marketingHealthId" | "generatedAt"> & { marketingHealthId?: string }) => Promise<MarketingHealthSnapshot>;
};

export function createPrismaMarketingRepository(prisma: PrismaClient = getPrismaClient()): MarketingRepository {
  return {
    async listCampaignPlans(projectId) {
      return (await prisma.gbaMarketingCampaignPlan.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } })).map(mapCampaignPlan);
    },
    async createCampaignPlan(plan) {
      return mapCampaignPlan(await prisma.gbaMarketingCampaignPlan.create({
        data: {
          marketingCampaignPlanId: plan.marketingCampaignPlanId,
          workspaceId: plan.workspaceId,
          organizationId: plan.organizationId,
          projectId: plan.projectId,
          siteId: plan.siteId ?? null,
          campaignName: plan.campaignName,
          objective: plan.objective,
          channelFocus: toJsonValue(plan.channelFocus),
          targetAudience: plan.targetAudience,
          status: plan.status,
          startAt: plan.startAt ? new Date(plan.startAt) : null,
          endAt: plan.endAt ? new Date(plan.endAt) : null,
          budgetCents: plan.budgetCents,
          expectedImpressions: plan.expectedImpressions,
          expectedConversions: plan.expectedConversions,
          createdBy: plan.createdBy,
          createdAt: new Date(plan.createdAt),
          updatedAt: new Date(plan.updatedAt),
          immutableLineage: plan.immutableLineage,
        },
      }));
    },
    async appendCampaignPlanHistory(history) {
      const created = await prisma.gbaMarketingCampaignPlanHistory.create({
        data: {
          marketingCampaignPlanHistoryId: history.marketingCampaignPlanHistoryId,
          marketingCampaignPlanId: history.marketingCampaignPlanId,
          workspaceId: history.workspaceId,
          organizationId: history.organizationId,
          status: history.status,
          note: history.note,
          changedBy: history.changedBy,
          changedAt: new Date(history.changedAt),
          immutableLineage: history.immutableLineage,
        },
      });
      return { ...history, changedAt: created.changedAt.toISOString() };
    },
    async listContentStrategies(projectId) {
      return (await prisma.gbaMarketingContentStrategy.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } })).map(mapContentStrategy);
    },
    async upsertContentStrategy(strategy) {
      const id = strategy.marketingContentStrategyId ?? marketingId("gbamktstrat");
      return mapContentStrategy(await prisma.gbaMarketingContentStrategy.upsert({
        where: { marketingContentStrategyId: id },
        create: {
          marketingContentStrategyId: id,
          workspaceId: strategy.workspaceId,
          organizationId: strategy.organizationId,
          projectId: strategy.projectId,
          siteId: strategy.siteId ?? null,
          title: strategy.title,
          summary: strategy.summary,
          status: strategy.status,
          pillarTopics: toJsonValue(strategy.pillarTopics),
          brandVoice: strategy.brandVoice,
          seoTheme: strategy.seoTheme,
          owner: strategy.owner,
          createdAt: new Date(),
          updatedAt: new Date(),
          immutableLineage: strategy.immutableLineage,
        },
        update: {
          title: strategy.title,
          summary: strategy.summary,
          status: strategy.status,
          pillarTopics: toJsonValue(strategy.pillarTopics),
          brandVoice: strategy.brandVoice,
          seoTheme: strategy.seoTheme,
          owner: strategy.owner,
          updatedAt: new Date(),
          immutableLineage: strategy.immutableLineage,
        },
      }));
    },
    async listSeoIntelligence(projectId) {
      return (await prisma.gbaMarketingSeoIntelligence.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } })).map(mapSeoIntelligence);
    },
    async upsertSeoIntelligence(entry) {
      const id = entry.marketingSeoIntelligenceId ?? marketingId("gbamktseo");
      return mapSeoIntelligence(await prisma.gbaMarketingSeoIntelligence.upsert({
        where: { marketingSeoIntelligenceId: id },
        create: {
          marketingSeoIntelligenceId: id,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          primaryKeyword: entry.primaryKeyword,
          secondaryKeywords: toJsonValue(entry.secondaryKeywords),
          score: entry.score,
          opportunities: toJsonValue(entry.opportunities),
          blockers: toJsonValue(entry.blockers),
          createdAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          score: entry.score,
          opportunities: toJsonValue(entry.opportunities),
          blockers: toJsonValue(entry.blockers),
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
    async listBrandGovernanceReviews(projectId) {
      return (await prisma.gbaMarketingBrandGovernanceReview.findMany({ where: { projectId }, orderBy: { reviewedAt: "desc" } })).map(mapBrandGovernance);
    },
    async upsertBrandGovernanceReview(entry) {
      const id = entry.marketingBrandGovernanceReviewId ?? marketingId("gbamktbrand");
      return mapBrandGovernance(await prisma.gbaMarketingBrandGovernanceReview.upsert({
        where: { marketingBrandGovernanceReviewId: id },
        create: {
          marketingBrandGovernanceReviewId: id,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          reviewState: entry.reviewState,
          notes: entry.notes,
          reviewedBy: entry.reviewedBy,
          reviewedAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          reviewState: entry.reviewState,
          notes: entry.notes,
          reviewedBy: entry.reviewedBy,
          reviewedAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
    async listAnalyticsSnapshots(projectId) {
      return (await prisma.gbaMarketingAnalyticsSnapshot.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } })).map(mapAnalyticsSnapshot);
    },
    async upsertAnalyticsSnapshot(entry) {
      const id = entry.marketingAnalyticsSnapshotId ?? marketingId("gbamktan");
      return mapAnalyticsSnapshot(await prisma.gbaMarketingAnalyticsSnapshot.upsert({
        where: { marketingAnalyticsSnapshotId: id },
        create: {
          marketingAnalyticsSnapshotId: id,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          sourceRecommendations: entry.sourceRecommendations,
          sourceCollections: entry.sourceCollections,
          trafficScore: entry.trafficScore,
          engagementScore: entry.engagementScore,
          conversionScore: entry.conversionScore,
          createdAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          sourceRecommendations: entry.sourceRecommendations,
          sourceCollections: entry.sourceCollections,
          trafficScore: entry.trafficScore,
          engagementScore: entry.engagementScore,
          conversionScore: entry.conversionScore,
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
    async listRecommendations(projectId) {
      return (await prisma.gbaMarketingRecommendation.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } })).map(mapRecommendation);
    },
    async upsertRecommendation(entry) {
      const id = entry.marketingRecommendationId ?? marketingId("gbamktrec");
      return mapRecommendation(await prisma.gbaMarketingRecommendation.upsert({
        where: { marketingRecommendationId: id },
        create: {
          marketingRecommendationId: id,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          category: entry.category,
          title: entry.title,
          summary: entry.summary,
          recommendedAction: entry.recommendedAction,
          priority: entry.priority,
          confidence: entry.confidence,
          status: entry.status,
          sourceReference: entry.sourceReference,
          createdAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          summary: entry.summary,
          recommendedAction: entry.recommendedAction,
          priority: entry.priority,
          confidence: entry.confidence,
          status: entry.status,
          sourceReference: entry.sourceReference,
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
    async appendRecommendationReview(entry) {
      const created = await prisma.gbaMarketingRecommendationReview.create({
        data: {
          marketingRecommendationReviewId: entry.marketingRecommendationReviewId,
          marketingRecommendationId: entry.marketingRecommendationId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          decision: entry.decision,
          notes: entry.notes ?? null,
          reviewedBy: entry.reviewedBy,
          reviewedAt: new Date(entry.reviewedAt),
          immutableLineage: entry.immutableLineage,
        },
      });
      return { ...entry, reviewedAt: created.reviewedAt.toISOString() };
    },
    async listTimeline(projectId) {
      return (await prisma.gbaMarketingTimelineEvent.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } })).map(mapTimeline);
    },
    async appendTimelineEvent(entry) {
      return mapTimeline(await prisma.gbaMarketingTimelineEvent.create({
        data: {
          marketingTimelineEventId: entry.marketingTimelineEventId ?? marketingId("gbamkttime"),
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          eventType: entry.eventType,
          subjectId: entry.subjectId,
          summary: entry.summary,
          actorId: entry.actorId,
          evidenceReferences: toJsonValue(entry.evidenceReferences),
          createdAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
    async listExecutiveReports(projectId) {
      return (await prisma.gbaMarketingExecutiveReport.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } })).map(mapExecutiveReport);
    },
    async upsertExecutiveReport(entry) {
      const id = entry.marketingExecutiveReportId ?? marketingId("gbamktexec");
      return mapExecutiveReport(await prisma.gbaMarketingExecutiveReport.upsert({
        where: { marketingExecutiveReportId: id },
        create: {
          marketingExecutiveReportId: id,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          period: entry.period,
          summary: entry.summary,
          campaignHighlights: toJsonValue(entry.campaignHighlights),
          contentHighlights: toJsonValue(entry.contentHighlights),
          seoHighlights: toJsonValue(entry.seoHighlights),
          createdAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          summary: entry.summary,
          campaignHighlights: toJsonValue(entry.campaignHighlights),
          contentHighlights: toJsonValue(entry.contentHighlights),
          seoHighlights: toJsonValue(entry.seoHighlights),
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
    async listHealthSnapshots(projectId) {
      return (await prisma.gbaMarketingHealth.findMany({ where: { projectId }, orderBy: { generatedAt: "desc" } })).map(mapHealth);
    },
    async upsertHealthSnapshot(entry) {
      const id = entry.marketingHealthId ?? marketingId("gbamkth");
      return mapHealth(await prisma.gbaMarketingHealth.upsert({
        where: { marketingHealthId: id },
        create: {
          marketingHealthId: id,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          projectId: entry.projectId,
          siteId: entry.siteId ?? null,
          status: entry.status,
          blockedCampaigns: entry.blockedCampaigns,
          reviewBacklog: entry.reviewBacklog,
          seoRisks: entry.seoRisks,
          analyticsGaps: entry.analyticsGaps,
          generatedAt: new Date(),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          blockedCampaigns: entry.blockedCampaigns,
          reviewBacklog: entry.reviewBacklog,
          seoRisks: entry.seoRisks,
          analyticsGaps: entry.analyticsGaps,
          immutableLineage: entry.immutableLineage,
        },
      }));
    },
  };
}

export function createInMemoryMarketingRepository(): MarketingRepository {
  const campaignPlans = new Map<string, MarketingCampaignPlan>();
  const campaignHistory = new Map<string, MarketingCampaignPlanHistory>();
  const contentStrategies = new Map<string, MarketingContentStrategy>();
  const seoIntelligence = new Map<string, MarketingSeoIntelligence>();
  const brandGovernance = new Map<string, MarketingBrandGovernanceReview>();
  const analyticsSnapshots = new Map<string, MarketingAnalyticsSnapshot>();
  const recommendations = new Map<string, MarketingRecommendation>();
  const recommendationReviews = new Map<string, MarketingRecommendationReview>();
  const timelineEvents = new Map<string, MarketingTimelineEvent>();
  const executiveReports = new Map<string, MarketingExecutiveReport>();
  const healthSnapshots = new Map<string, MarketingHealthSnapshot>();

  const byProject = <T extends { projectId: string }>(entries: Iterable<T>, projectId: string) => [...entries].filter((entry) => entry.projectId === projectId);

  return {
    async listCampaignPlans(projectId) {
      return byProject(campaignPlans.values(), projectId);
    },
    async createCampaignPlan(plan) {
      campaignPlans.set(plan.marketingCampaignPlanId, plan);
      return plan;
    },
    async appendCampaignPlanHistory(history) {
      campaignHistory.set(history.marketingCampaignPlanHistoryId, history);
      return history;
    },
    async listContentStrategies(projectId) {
      return byProject(contentStrategies.values(), projectId);
    },
    async upsertContentStrategy(strategy) {
      const id = strategy.marketingContentStrategyId ?? marketingId("gbamktstrat");
      const next = {
        marketingContentStrategyId: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...strategy,
      } as MarketingContentStrategy;
      contentStrategies.set(id, next);
      return next;
    },
    async listSeoIntelligence(projectId) {
      return byProject(seoIntelligence.values(), projectId);
    },
    async upsertSeoIntelligence(entry) {
      const id = entry.marketingSeoIntelligenceId ?? marketingId("gbamktseo");
      const next = { marketingSeoIntelligenceId: id, ...entry } as MarketingSeoIntelligence;
      seoIntelligence.set(id, next);
      return next;
    },
    async listBrandGovernanceReviews(projectId) {
      return byProject(brandGovernance.values(), projectId);
    },
    async upsertBrandGovernanceReview(entry) {
      const id = entry.marketingBrandGovernanceReviewId ?? marketingId("gbamktbrand");
      const next = { marketingBrandGovernanceReviewId: id, ...entry } as MarketingBrandGovernanceReview;
      brandGovernance.set(id, next);
      return next;
    },
    async listAnalyticsSnapshots(projectId) {
      return byProject(analyticsSnapshots.values(), projectId);
    },
    async upsertAnalyticsSnapshot(entry) {
      const id = entry.marketingAnalyticsSnapshotId ?? marketingId("gbamktan");
      const next = { marketingAnalyticsSnapshotId: id, ...entry } as MarketingAnalyticsSnapshot;
      analyticsSnapshots.set(id, next);
      return next;
    },
    async listRecommendations(projectId) {
      return byProject(recommendations.values(), projectId);
    },
    async upsertRecommendation(entry) {
      const id = entry.marketingRecommendationId ?? marketingId("gbamktrec");
      const next = { marketingRecommendationId: id, ...entry } as MarketingRecommendation;
      recommendations.set(id, next);
      return next;
    },
    async appendRecommendationReview(entry) {
      recommendationReviews.set(entry.marketingRecommendationReviewId, entry);
      return entry;
    },
    async listTimeline(projectId) {
      return byProject(timelineEvents.values(), projectId);
    },
    async appendTimelineEvent(entry) {
      const id = entry.marketingTimelineEventId ?? marketingId("gbamkttime");
      const next = { marketingTimelineEventId: id, ...entry, createdAt: new Date().toISOString() } as MarketingTimelineEvent;
      timelineEvents.set(id, next);
      return next;
    },
    async listExecutiveReports(projectId) {
      return byProject(executiveReports.values(), projectId);
    },
    async upsertExecutiveReport(entry) {
      const id = entry.marketingExecutiveReportId ?? marketingId("gbamktexec");
      const next = { marketingExecutiveReportId: id, ...entry } as MarketingExecutiveReport;
      executiveReports.set(id, next);
      return next;
    },
    async listHealthSnapshots(projectId) {
      return byProject(healthSnapshots.values(), projectId);
    },
    async upsertHealthSnapshot(entry) {
      const id = entry.marketingHealthId ?? marketingId("gbamkth");
      const next = { marketingHealthId: id, ...entry } as MarketingHealthSnapshot;
      healthSnapshots.set(id, next);
      return next;
    },
  };
}
