CREATE TABLE "GbaMarketingCampaignPlan" (
    "marketingCampaignPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "campaignName" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channelFocus" JSONB NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "budgetCents" DOUBLE PRECISION NOT NULL,
    "expectedImpressions" INTEGER NOT NULL,
    "expectedConversions" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingCampaignPlan_pkey" PRIMARY KEY ("marketingCampaignPlanId")
);

CREATE TABLE "GbaMarketingCampaignPlanHistory" (
    "marketingCampaignPlanHistoryId" TEXT NOT NULL,
    "marketingCampaignPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingCampaignPlanHistory_pkey" PRIMARY KEY ("marketingCampaignPlanHistoryId")
);

CREATE TABLE "GbaMarketingContentStrategy" (
    "marketingContentStrategyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pillarTopics" JSONB NOT NULL,
    "brandVoice" TEXT NOT NULL,
    "seoTheme" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingContentStrategy_pkey" PRIMARY KEY ("marketingContentStrategyId")
);

CREATE TABLE "GbaMarketingSeoIntelligence" (
    "marketingSeoIntelligenceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "primaryKeyword" TEXT NOT NULL,
    "secondaryKeywords" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "opportunities" JSONB NOT NULL,
    "blockers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingSeoIntelligence_pkey" PRIMARY KEY ("marketingSeoIntelligenceId")
);

CREATE TABLE "GbaMarketingBrandGovernanceReview" (
    "marketingBrandGovernanceReviewId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "reviewState" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingBrandGovernanceReview_pkey" PRIMARY KEY ("marketingBrandGovernanceReviewId")
);

CREATE TABLE "GbaMarketingAnalyticsSnapshot" (
    "marketingAnalyticsSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "sourceRecommendations" INTEGER NOT NULL,
    "sourceCollections" INTEGER NOT NULL,
    "trafficScore" DOUBLE PRECISION NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "conversionScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingAnalyticsSnapshot_pkey" PRIMARY KEY ("marketingAnalyticsSnapshotId")
);

CREATE TABLE "GbaMarketingRecommendation" (
    "marketingRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingRecommendation_pkey" PRIMARY KEY ("marketingRecommendationId")
);

CREATE TABLE "GbaMarketingRecommendationReview" (
    "marketingRecommendationReviewId" TEXT NOT NULL,
    "marketingRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingRecommendationReview_pkey" PRIMARY KEY ("marketingRecommendationReviewId")
);

CREATE TABLE "GbaMarketingTimelineEvent" (
    "marketingTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingTimelineEvent_pkey" PRIMARY KEY ("marketingTimelineEventId")
);

CREATE TABLE "GbaMarketingExecutiveReport" (
    "marketingExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "campaignHighlights" JSONB NOT NULL,
    "contentHighlights" JSONB NOT NULL,
    "seoHighlights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingExecutiveReport_pkey" PRIMARY KEY ("marketingExecutiveReportId")
);

CREATE TABLE "GbaMarketingHealth" (
    "marketingHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" TEXT NOT NULL,
    "blockedCampaigns" INTEGER NOT NULL,
    "reviewBacklog" INTEGER NOT NULL,
    "seoRisks" INTEGER NOT NULL,
    "analyticsGaps" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingHealth_pkey" PRIMARY KEY ("marketingHealthId")
);

CREATE INDEX "GbaMarketingCampaignPlan_workspaceId_updatedAt_idx" ON "GbaMarketingCampaignPlan"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaMarketingCampaignPlan_organizationId_updatedAt_idx" ON "GbaMarketingCampaignPlan"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaMarketingCampaignPlan_projectId_updatedAt_idx" ON "GbaMarketingCampaignPlan"("projectId", "updatedAt" DESC);
CREATE INDEX "GbaMarketingCampaignPlanHistory_workspaceId_changedAt_idx" ON "GbaMarketingCampaignPlanHistory"("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaMarketingCampaignPlanHistory_marketingCampaignPlanId_changedAt_idx" ON "GbaMarketingCampaignPlanHistory"("marketingCampaignPlanId", "changedAt" DESC);
CREATE INDEX "GbaMarketingContentStrategy_workspaceId_updatedAt_idx" ON "GbaMarketingContentStrategy"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaMarketingContentStrategy_organizationId_updatedAt_idx" ON "GbaMarketingContentStrategy"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaMarketingContentStrategy_projectId_updatedAt_idx" ON "GbaMarketingContentStrategy"("projectId", "updatedAt" DESC);
CREATE INDEX "GbaMarketingSeoIntelligence_workspaceId_createdAt_idx" ON "GbaMarketingSeoIntelligence"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaMarketingSeoIntelligence_organizationId_createdAt_idx" ON "GbaMarketingSeoIntelligence"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaMarketingSeoIntelligence_projectId_createdAt_idx" ON "GbaMarketingSeoIntelligence"("projectId", "createdAt" DESC);
CREATE INDEX "GbaMarketingBrandGovernanceReview_workspaceId_reviewedAt_idx" ON "GbaMarketingBrandGovernanceReview"("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaMarketingBrandGovernanceReview_organizationId_reviewedAt_idx" ON "GbaMarketingBrandGovernanceReview"("organizationId", "reviewedAt" DESC);
CREATE INDEX "GbaMarketingBrandGovernanceReview_projectId_reviewedAt_idx" ON "GbaMarketingBrandGovernanceReview"("projectId", "reviewedAt" DESC);
CREATE INDEX "GbaMarketingAnalyticsSnapshot_workspaceId_createdAt_idx" ON "GbaMarketingAnalyticsSnapshot"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaMarketingAnalyticsSnapshot_organizationId_createdAt_idx" ON "GbaMarketingAnalyticsSnapshot"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaMarketingAnalyticsSnapshot_projectId_createdAt_idx" ON "GbaMarketingAnalyticsSnapshot"("projectId", "createdAt" DESC);
CREATE INDEX "GbaMarketingRecommendation_workspaceId_createdAt_idx" ON "GbaMarketingRecommendation"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaMarketingRecommendation_organizationId_createdAt_idx" ON "GbaMarketingRecommendation"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaMarketingRecommendation_projectId_createdAt_idx" ON "GbaMarketingRecommendation"("projectId", "createdAt" DESC);
CREATE INDEX "GbaMarketingRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaMarketingRecommendationReview"("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaMarketingRecommendationReview_marketingRecommendationId_reviewedAt_idx" ON "GbaMarketingRecommendationReview"("marketingRecommendationId", "reviewedAt" DESC);
CREATE INDEX "GbaMarketingTimelineEvent_workspaceId_createdAt_idx" ON "GbaMarketingTimelineEvent"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaMarketingTimelineEvent_organizationId_createdAt_idx" ON "GbaMarketingTimelineEvent"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaMarketingTimelineEvent_projectId_createdAt_idx" ON "GbaMarketingTimelineEvent"("projectId", "createdAt" DESC);
CREATE INDEX "GbaMarketingExecutiveReport_workspaceId_createdAt_idx" ON "GbaMarketingExecutiveReport"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaMarketingExecutiveReport_organizationId_createdAt_idx" ON "GbaMarketingExecutiveReport"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaMarketingExecutiveReport_projectId_createdAt_idx" ON "GbaMarketingExecutiveReport"("projectId", "createdAt" DESC);
CREATE INDEX "GbaMarketingHealth_workspaceId_generatedAt_idx" ON "GbaMarketingHealth"("workspaceId", "generatedAt" DESC);
CREATE INDEX "GbaMarketingHealth_organizationId_generatedAt_idx" ON "GbaMarketingHealth"("organizationId", "generatedAt" DESC);
CREATE INDEX "GbaMarketingHealth_projectId_generatedAt_idx" ON "GbaMarketingHealth"("projectId", "generatedAt" DESC);