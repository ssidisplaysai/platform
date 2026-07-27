import { createPrismaGmpRepository } from "@/lib/gmp/repository";
import { createGmpAnalyticsServices } from "@/lib/gmp/analytics-services";
import { createGmpRecommendationServices } from "@/lib/gmp/recommendation-services";
import { createPrismaMarketingRepository, type MarketingRepository } from "./marketing-repository";
import {
  createMarketingCampaignPlan,
  createMarketingDashboardLineage,
  marketingId,
  stableMarketingChecksum,
  type MarketingAnalyticsSnapshot,
  type MarketingBrandGovernanceReview,
  type MarketingCampaignPlan,
  type MarketingContentStrategy,
  type MarketingDashboard,
  type MarketingExecutiveReport,
  type MarketingHealthSnapshot,
  type MarketingRecommendation,
  type MarketingRecommendationReview,
  type MarketingSeoIntelligence,
  type MarketingTimelineEvent,
} from "./marketing-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";

export type MarketingRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string, projectId?: string, siteId?: string) => Promise<MarketingDashboard>;
  listCampaignPlans: (projectId: string) => Promise<MarketingCampaignPlan[]>;
  createCampaignPlan: (input: {
    workspaceId: string;
    organizationId: string;
    projectId: string;
    siteId?: string;
    actorId: string;
    campaignName: string;
    objective: string;
    channelFocus: string[];
    targetAudience: string;
    budgetCents: number;
    expectedImpressions: number;
    expectedConversions: number;
  }) => Promise<MarketingCampaignPlan>;
  listContentStrategies: (projectId: string) => Promise<MarketingContentStrategy[]>;
  listSeoIntelligence: (projectId: string) => Promise<MarketingSeoIntelligence[]>;
  listBrandGovernanceReviews: (projectId: string) => Promise<MarketingBrandGovernanceReview[]>;
  listAnalyticsSnapshots: (projectId: string) => Promise<MarketingAnalyticsSnapshot[]>;
  listRecommendations: (projectId: string) => Promise<MarketingRecommendation[]>;
  reviewRecommendation: (input: { workspaceId: string; organizationId: string; projectId: string; recommendationId: string; actorId: string; decision: MarketingRecommendationReview["decision"]; notes?: string }) => Promise<MarketingRecommendationReview>;
  listTimeline: (projectId: string) => Promise<MarketingTimelineEvent[]>;
  listExecutiveReports: (projectId: string) => Promise<MarketingExecutiveReport[]>;
  listHealth: (projectId: string) => Promise<MarketingHealthSnapshot[]>;
};

export function createMarketingRuntimeService(repository: MarketingRepository): MarketingRuntimeService {
  const gmpRepository = createPrismaGmpRepository();
  const gmpAnalytics = createGmpAnalyticsServices({ projectRepository: gmpRepository });
  const gmpRecommendations = createGmpRecommendationServices({ projectRepository: gmpRepository });

  async function ensureSeedArtifacts(projectId: string, workspaceId: string, organizationId: string, siteId?: string) {
    const existingPlans = await repository.listCampaignPlans(projectId);
    if (existingPlans.length > 0) {
      return;
    }

    const plan = createMarketingCampaignPlan({
      workspaceId,
      organizationId,
      projectId,
      siteId,
      campaignName: "Core Demand Capture",
      objective: "Convert high-intent marketing traffic into qualified pipeline.",
      channelFocus: ["organic_search", "email", "retargeting"],
      targetAudience: "Decision makers evaluating the Genesis platform",
      budgetCents: 250000,
      expectedImpressions: 120000,
      expectedConversions: 1800,
      createdBy: "system",
    });
    await repository.createCampaignPlan(plan);
    await repository.appendCampaignPlanHistory({
      marketingCampaignPlanHistoryId: marketingId("gbamkthist"),
      marketingCampaignPlanId: plan.marketingCampaignPlanId,
      workspaceId,
      organizationId,
      status: plan.status,
      note: "Seeded baseline campaign plan.",
      changedBy: "system",
      changedAt: new Date().toISOString(),
      immutableLineage: stableMarketingChecksum({ plan: plan.marketingCampaignPlanId, event: "seed" }),
    });

    await repository.upsertContentStrategy({
      marketingContentStrategyId: marketingId("gbamktstrat"),
      workspaceId,
      organizationId,
      projectId,
      siteId,
      title: "Authority-first content strategy",
      summary: "Structure editorial planning around approved brand voice, canonical knowledge, and search intent.",
      status: "APPROVED",
      pillarTopics: ["product narrative", "proof content", "category education"],
      brandVoice: "Authoritative, precise, and enterprise-focused.",
      seoTheme: "qualified demand and search capture",
      owner: "system",
      immutableLineage: stableMarketingChecksum({ projectId, siteId, type: "strategy" }),
    });

    await repository.upsertSeoIntelligence({
      marketingSeoIntelligenceId: marketingId("gbamktseo"),
      workspaceId,
      organizationId,
      projectId,
      siteId,
      primaryKeyword: "Genesis marketing agent",
      secondaryKeywords: ["campaign planning", "content strategy", "seo intelligence"],
      score: 82,
      opportunities: ["Improve search snippets for campaign pages", "Expand strategic pillar content"],
      blockers: ["No canonical campaign taxonomy yet"],
      createdAt: new Date().toISOString(),
      immutableLineage: stableMarketingChecksum({ projectId, siteId, type: "seo" }),
    });

    try {
      const recommendations = await gmpRecommendations.listRecommendations({ projectId });
      for (const recommendation of recommendations.slice(0, 8)) {
        await repository.upsertRecommendation({
          marketingRecommendationId: marketingId("gbamktrec"),
          workspaceId,
          organizationId,
          projectId,
          siteId,
          category: recommendation.category,
          title: recommendation.title,
          summary: recommendation.explanation,
          recommendedAction: recommendation.recommendedAction,
          priority: recommendation.priority,
          confidence: recommendation.confidence,
          status: "NEW",
          sourceReference: recommendation.recommendationId,
          createdAt: recommendation.createdAt,
          immutableLineage: stableMarketingChecksum({ recommendationId: recommendation.recommendationId }),
        });
      }
    } catch {
      // Missing GMP project data is acceptable in empty workspaces and test fixtures.
    }

    await repository.upsertBrandGovernanceReview({
      marketingBrandGovernanceReviewId: marketingId("gbamktbrand"),
      workspaceId,
      organizationId,
      projectId,
      siteId,
      reviewState: "PASS",
      notes: "Brand voice and governance are aligned to the certified GMP kernel inputs.",
      reviewedBy: "system",
      reviewedAt: new Date().toISOString(),
      immutableLineage: stableMarketingChecksum({ projectId, siteId, type: "brand_governance" }),
    });
  }

  async function projectContext(projectId: string) {
    const project = await gmpRepository.getProjectById(projectId);
    if (!project) {
      return null;
    }

    const [brandProfile, snapshots, recommendations, healthSnapshots] = await Promise.all([
      gmpRepository.getBrandProfileByProjectId(projectId),
      repository.listAnalyticsSnapshots(projectId),
      repository.listRecommendations(projectId),
      repository.listHealthSnapshots(projectId),
    ]);

    return { project, brandProfile, snapshots, recommendations, healthSnapshots };
  }

  function deriveAnalyticsSnapshot(snapshot: Awaited<ReturnType<typeof gmpAnalytics.listSnapshots>>[number], workspaceId: string, organizationId: string, projectId: string): MarketingAnalyticsSnapshot {
    const trafficScore = Math.min(100, Math.max(0, Math.round((snapshot.baselineScore ?? snapshot.totalMetrics) || 0)));
    const engagementScore = Math.min(100, Math.max(0, Math.round(((snapshot.trendDelta ?? 0) + 50))));
    const conversionScore = Math.min(100, Math.max(0, Math.round((snapshot.totalMetrics / 10))));

    return {
      marketingAnalyticsSnapshotId: marketingId("gbamktan"),
      workspaceId,
      organizationId,
      projectId,
      siteId: snapshot.siteId ?? undefined,
      sourceRecommendations: 0,
      sourceCollections: snapshot.totalMetrics,
      trafficScore,
      engagementScore,
      conversionScore,
      createdAt: snapshot.createdAt,
      immutableLineage: stableMarketingChecksum({ snapshot: snapshot.performanceSnapshotId, trafficScore, engagementScore, conversionScore }),
    };
  }

  return {
    async getDashboard(workspaceId, organizationId, projectId, siteId) {
      const resolvedProjectId = projectId ?? (await gmpRepository.listProjects(workspaceId))[0]?.projectId;
      if (!resolvedProjectId) {
        return {
          workspaceId,
          organizationId,
          projectId: "unassigned",
          projectName: "No project",
          activeCampaigns: 0,
          contentStrategyStatus: "DRAFT",
          seoCoverageScore: 0,
          analyticsSignalScore: 0,
          recommendationCount: 0,
          healthScore: 0,
          generatedAt: new Date().toISOString(),
          immutableLineage: createMarketingDashboardLineage({ workspaceId, organizationId, projectId: "unassigned" }),
        };
      }

      await ensureSeedArtifacts(resolvedProjectId, workspaceId, organizationId, siteId);
      const context = await projectContext(resolvedProjectId);
      if (!context) {
        return {
          workspaceId,
          organizationId,
          projectId: resolvedProjectId,
          projectName: "Unknown project",
          activeCampaigns: 0,
          contentStrategyStatus: "DRAFT",
          seoCoverageScore: 0,
          analyticsSignalScore: 0,
          recommendationCount: 0,
          healthScore: 0,
          generatedAt: new Date().toISOString(),
          immutableLineage: createMarketingDashboardLineage({ workspaceId, organizationId, projectId: resolvedProjectId }),
        };
      }

      const activeCampaigns = (await repository.listCampaignPlans(resolvedProjectId)).filter((entry) => entry.status === "ACTIVE").length;
      const strategy = (await repository.listContentStrategies(resolvedProjectId))[0];
      const analyticsSnapshot = context.snapshots[0];
      const latestHealth = context.healthSnapshots[0];

      return {
        workspaceId,
        organizationId,
        projectId: resolvedProjectId,
        siteId,
        projectName: context.project.name,
        brandName: context.brandProfile?.companyName,
        activeCampaigns,
        contentStrategyStatus: strategy?.status ?? "DRAFT",
        seoCoverageScore: analyticsSnapshot?.trafficScore ?? 0,
        analyticsSignalScore: analyticsSnapshot?.engagementScore ?? 0,
        recommendationCount: context.recommendations.length,
        healthScore: latestHealth ? Math.max(0, 100 - (latestHealth.blockedCampaigns * 20 + latestHealth.reviewBacklog * 10 + latestHealth.seoRisks * 5)) : 0,
        generatedAt: new Date().toISOString(),
        immutableLineage: createMarketingDashboardLineage({ workspaceId, organizationId, projectId: resolvedProjectId, activeCampaigns, strategy: strategy?.status }),
      };
    },

    listCampaignPlans(projectId) {
      return repository.listCampaignPlans(projectId);
    },

    async createCampaignPlan(input) {
      const plan = createMarketingCampaignPlan(input);
      await repository.createCampaignPlan(plan);
      await repository.appendCampaignPlanHistory({
        marketingCampaignPlanHistoryId: marketingId("gbamkthist"),
        marketingCampaignPlanId: plan.marketingCampaignPlanId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        status: plan.status,
        note: `Created campaign plan ${plan.campaignName}.`,
        changedBy: input.actorId,
        changedAt: new Date().toISOString(),
        immutableLineage: stableMarketingChecksum({ plan: plan.marketingCampaignPlanId, action: "created" }),
      });
      await repository.appendTimelineEvent({
        marketingTimelineEventId: marketingId("gbamkttime"),
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        siteId: input.siteId,
        eventType: "CAMPAIGN_CREATED",
        subjectId: plan.marketingCampaignPlanId,
        summary: `Created campaign plan ${plan.campaignName}`,
        actorId: input.actorId,
        evidenceReferences: [plan.immutableLineage],
        immutableLineage: stableMarketingChecksum({ plan: plan.marketingCampaignPlanId, event: "CAMPAIGN_CREATED" }),
      });
      return plan;
    },

    listContentStrategies(projectId) {
      return repository.listContentStrategies(projectId);
    },

    async listSeoIntelligence(projectId) {
      const existing = await repository.listSeoIntelligence(projectId);
      if (existing.length > 0) return existing;
      try {
        const snapshots = await gmpAnalytics.listSnapshots(projectId);
        const seeded = snapshots.slice(0, 2).map((snapshot) => deriveAnalyticsSnapshot(snapshot, DEFAULT_WORKSPACE_ID, DEFAULT_ORGANIZATION_ID, projectId));
        for (const entry of seeded) {
          await repository.upsertAnalyticsSnapshot(entry);
        }
      } catch {
        // Leave the SEO intelligence surface empty when GMP analytics data is unavailable.
      }
      return repository.listSeoIntelligence(projectId);
    },

    listBrandGovernanceReviews(projectId) {
      return repository.listBrandGovernanceReviews(projectId);
    },

    async listAnalyticsSnapshots(projectId) {
      const existing = await repository.listAnalyticsSnapshots(projectId);
      if (existing.length > 0) return existing;
      try {
        const snapshots = await gmpAnalytics.listSnapshots(projectId);
        const seeded = snapshots.slice(0, 3).map((snapshot) => deriveAnalyticsSnapshot(snapshot, DEFAULT_WORKSPACE_ID, DEFAULT_ORGANIZATION_ID, projectId));
        for (const entry of seeded) {
          await repository.upsertAnalyticsSnapshot(entry);
        }
      } catch {
        // Leave analytics empty when the GMP project is not available.
      }
      return repository.listAnalyticsSnapshots(projectId);
    },

    async listRecommendations(projectId) {
      const existing = await repository.listRecommendations(projectId);
      if (existing.length > 0) return existing;
      try {
        const gmp = await gmpRecommendations.listRecommendations({ projectId });
        for (const recommendation of gmp.slice(0, 12)) {
          await repository.upsertRecommendation({
            marketingRecommendationId: marketingId("gbamktrec"),
            workspaceId: recommendation.workspaceId,
            organizationId: DEFAULT_ORGANIZATION_ID,
            projectId,
            siteId: recommendation.siteId,
            category: recommendation.category,
            title: recommendation.title,
            summary: recommendation.explanation,
            recommendedAction: recommendation.recommendedAction,
            priority: recommendation.priority,
            confidence: recommendation.confidence,
            status: "NEW",
            sourceReference: recommendation.recommendationId,
            createdAt: recommendation.createdAt,
            immutableLineage: stableMarketingChecksum({ recommendationId: recommendation.recommendationId }),
          });
        }
      } catch {
        // Missing GMP recommendations is acceptable; the agent can still surface local planning state.
      }
      return repository.listRecommendations(projectId);
    },

    async reviewRecommendation(input) {
      const review = await repository.appendRecommendationReview({
        marketingRecommendationReviewId: marketingId("gbamktrev"),
        marketingRecommendationId: input.recommendationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        decision: input.decision,
        notes: input.notes,
        reviewedBy: input.actorId,
        reviewedAt: new Date().toISOString(),
        immutableLineage: stableMarketingChecksum({ recommendationId: input.recommendationId, decision: input.decision }),
      });
      await repository.appendTimelineEvent({
        marketingTimelineEventId: marketingId("gbamkttime"),
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        eventType: "RECOMMENDATION_REVIEWED",
        subjectId: input.recommendationId,
        summary: `Recommendation ${input.decision.toLowerCase()}`,
        actorId: input.actorId,
        evidenceReferences: [review.marketingRecommendationReviewId],
        immutableLineage: stableMarketingChecksum({ recommendationId: input.recommendationId, event: "REVIEWED" }),
      });
      return review;
    },

    listTimeline(projectId) {
      return repository.listTimeline(projectId);
    },

    async listExecutiveReports(projectId) {
      const existing = await repository.listExecutiveReports(projectId);
      if (existing.length > 0) return existing;
      const strategy = (await repository.listContentStrategies(projectId))[0];
      const seo = (await repository.listSeoIntelligence(projectId))[0];
      if (!strategy && !seo) return existing;
      const report = await repository.upsertExecutiveReport({
        marketingExecutiveReportId: marketingId("gbamktexec"),
        workspaceId: DEFAULT_WORKSPACE_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        projectId,
        period: "current",
        summary: "Marketing operating summary synthesized from GMP kernel and agent intelligence.",
        campaignHighlights: { activeCampaigns: (await repository.listCampaignPlans(projectId)).length },
        contentHighlights: { strategyStatus: strategy?.status ?? "DRAFT", pillars: strategy?.pillarTopics ?? [] },
        seoHighlights: { score: seo?.score ?? 0, opportunities: seo?.opportunities ?? [] },
        createdAt: new Date().toISOString(),
        immutableLineage: stableMarketingChecksum({ projectId, type: "executive_report" }),
      });
      return [report];
    },

    async listHealth(projectId) {
      const existing = await repository.listHealthSnapshots(projectId);
      if (existing.length > 0) return existing;
      const recommendations = await repository.listRecommendations(projectId);
      const seo = await repository.listSeoIntelligence(projectId);
      const health = await repository.upsertHealthSnapshot({
        marketingHealthId: marketingId("gbamkth"),
        workspaceId: DEFAULT_WORKSPACE_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        projectId,
        status: recommendations.length > 0 ? "DEGRADED" : "HEALTHY",
        blockedCampaigns: 0,
        reviewBacklog: recommendations.filter((entry) => entry.status === "NEW").length,
        seoRisks: seo.flatMap((entry) => entry.blockers).length,
        analyticsGaps: 0,
        generatedAt: new Date().toISOString(),
        immutableLineage: stableMarketingChecksum({ projectId, type: "health" }),
      });
      return [health];
    },
  };
}
