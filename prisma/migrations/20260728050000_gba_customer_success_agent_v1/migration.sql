-- CreateTable
CREATE TABLE "GbaCustomerSuccessOnboarding" (
    "customerSuccessOnboardingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "implementationMilestones" JSONB NOT NULL,
    "trainingProgressPercent" DOUBLE PRECISION NOT NULL,
    "documentationCompletionPercent" DOUBLE PRECISION NOT NULL,
    "goLiveReadinessPercent" DOUBLE PRECISION NOT NULL,
    "adoptionCheckpointPercent" DOUBLE PRECISION NOT NULL,
    "ownerId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessOnboarding_pkey" PRIMARY KEY ("customerSuccessOnboardingId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessHealth" (
    "customerSuccessHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "overallHealthScore" DOUBLE PRECISION NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "productAdoptionScore" DOUBLE PRECISION NOT NULL,
    "renewalHistoryScore" DOUBLE PRECISION NOT NULL,
    "supportInteractionScore" DOUBLE PRECISION NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "satisfactionScore" DOUBLE PRECISION NOT NULL,
    "executiveEscalationScore" DOUBLE PRECISION NOT NULL,
    "financialStandingScore" DOUBLE PRECISION NOT NULL,
    "operationalDeliveryScore" DOUBLE PRECISION NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessHealth_pkey" PRIMARY KEY ("customerSuccessHealthId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessPlan" (
    "customerSuccessPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "strategicObjectives" JSONB NOT NULL,
    "customerGoals" JSONB NOT NULL,
    "milestones" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "reviewSchedule" TEXT NOT NULL,
    "successOutcomes" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessPlan_pkey" PRIMARY KEY ("customerSuccessPlanId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessRenewal" (
    "customerSuccessRenewalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contractReference" TEXT NOT NULL,
    "contractExpiresAt" TIMESTAMP(3) NOT NULL,
    "renewalProbabilityPercent" DOUBLE PRECISION NOT NULL,
    "renewalForecastCents" DOUBLE PRECISION NOT NULL,
    "churnRiskPercent" DOUBLE PRECISION NOT NULL,
    "escalationRequired" BOOLEAN NOT NULL,
    "recommendationSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessRenewal_pkey" PRIMARY KEY ("customerSuccessRenewalId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessSatisfaction" (
    "customerSuccessSatisfactionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "csatScore" DOUBLE PRECISION NOT NULL,
    "npsScore" DOUBLE PRECISION NOT NULL,
    "sentimentTrend" TEXT NOT NULL,
    "surveySummary" TEXT NOT NULL,
    "feedbackHighlights" JSONB NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessSatisfaction_pkey" PRIMARY KEY ("customerSuccessSatisfactionId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessSupportSignal" (
    "customerSuccessSupportSignalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "openIssues" INTEGER NOT NULL,
    "escalations" INTEGER NOT NULL,
    "resolutionProgressPercent" DOUBLE PRECISION NOT NULL,
    "slaPerformancePercent" DOUBLE PRECISION NOT NULL,
    "communicationSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessSupportSignal_pkey" PRIMARY KEY ("customerSuccessSupportSignalId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessExpansionOpportunity" (
    "customerSuccessExpansionOpportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "productAdoptionGap" TEXT NOT NULL,
    "growthIndicator" TEXT NOT NULL,
    "projectedRevenueCents" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "recommendationSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessExpansionOpportunity_pkey" PRIMARY KEY ("customerSuccessExpansionOpportunityId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessKpi" (
    "customerSuccessKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessKpi_pkey" PRIMARY KEY ("customerSuccessKpiId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessRecommendation" (
    "customerSuccessRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
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

    CONSTRAINT "GbaCustomerSuccessRecommendation_pkey" PRIMARY KEY ("customerSuccessRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessRecommendationReview" (
    "customerSuccessRecommendationReviewId" TEXT NOT NULL,
    "customerSuccessRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessRecommendationReview_pkey" PRIMARY KEY ("customerSuccessRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessExecutiveReport" (
    "customerSuccessExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "churnForecast" TEXT NOT NULL,
    "renewalForecast" TEXT NOT NULL,
    "strategicRisks" JSONB NOT NULL,
    "strategicOpportunities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessExecutiveReport_pkey" PRIMARY KEY ("customerSuccessExecutiveReportId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessTimelineEvent" (
    "customerSuccessTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessTimelineEvent_pkey" PRIMARY KEY ("customerSuccessTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessAgentHealth" (
    "customerSuccessAgentHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "atRiskCustomers" INTEGER NOT NULL,
    "renewalsAtRisk" INTEGER NOT NULL,
    "escalatedAccounts" INTEGER NOT NULL,
    "onboardingDelays" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessAgentHealth_pkey" PRIMARY KEY ("customerSuccessAgentHealthId")
);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessOnboarding_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessOnboarding"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessOnboarding_organizationId_updatedAt_idx" ON "GbaCustomerSuccessOnboarding"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessOnboarding_customerId_updatedAt_idx" ON "GbaCustomerSuccessOnboarding"("customerId", "updatedAt" DESC);

CREATE INDEX "GbaCustomerSuccessHealth_workspaceId_measuredAt_idx" ON "GbaCustomerSuccessHealth"("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaCustomerSuccessHealth_organizationId_measuredAt_idx" ON "GbaCustomerSuccessHealth"("organizationId", "measuredAt" DESC);
CREATE INDEX "GbaCustomerSuccessHealth_customerId_measuredAt_idx" ON "GbaCustomerSuccessHealth"("customerId", "measuredAt" DESC);

CREATE INDEX "GbaCustomerSuccessPlan_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessPlan"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessPlan_organizationId_updatedAt_idx" ON "GbaCustomerSuccessPlan"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessPlan_customerId_updatedAt_idx" ON "GbaCustomerSuccessPlan"("customerId", "updatedAt" DESC);

CREATE INDEX "GbaCustomerSuccessRenewal_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessRenewal"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessRenewal_organizationId_updatedAt_idx" ON "GbaCustomerSuccessRenewal"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessRenewal_contractExpiresAt_updatedAt_idx" ON "GbaCustomerSuccessRenewal"("contractExpiresAt", "updatedAt" DESC);

CREATE INDEX "GbaCustomerSuccessSatisfaction_workspaceId_measuredAt_idx" ON "GbaCustomerSuccessSatisfaction"("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaCustomerSuccessSatisfaction_organizationId_measuredAt_idx" ON "GbaCustomerSuccessSatisfaction"("organizationId", "measuredAt" DESC);
CREATE INDEX "GbaCustomerSuccessSatisfaction_customerId_measuredAt_idx" ON "GbaCustomerSuccessSatisfaction"("customerId", "measuredAt" DESC);

CREATE INDEX "GbaCustomerSuccessSupportSignal_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessSupportSignal"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessSupportSignal_organizationId_updatedAt_idx" ON "GbaCustomerSuccessSupportSignal"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessSupportSignal_customerId_updatedAt_idx" ON "GbaCustomerSuccessSupportSignal"("customerId", "updatedAt" DESC);

CREATE INDEX "GbaCustomerSuccessExpansionOpportunity_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessExpansionOpportunity"("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessExpansionOpportunity_organizationId_updatedAt_idx" ON "GbaCustomerSuccessExpansionOpportunity"("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessExpansionOpportunity_customerId_updatedAt_idx" ON "GbaCustomerSuccessExpansionOpportunity"("customerId", "updatedAt" DESC);

CREATE INDEX "GbaCustomerSuccessKpi_workspaceId_measuredAt_idx" ON "GbaCustomerSuccessKpi"("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaCustomerSuccessKpi_organizationId_measuredAt_idx" ON "GbaCustomerSuccessKpi"("organizationId", "measuredAt" DESC);
CREATE INDEX "GbaCustomerSuccessKpi_name_measuredAt_idx" ON "GbaCustomerSuccessKpi"("name", "measuredAt" DESC);

CREATE INDEX "GbaCustomerSuccessRecommendation_workspaceId_createdAt_idx" ON "GbaCustomerSuccessRecommendation"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaCustomerSuccessRecommendation_organizationId_createdAt_idx" ON "GbaCustomerSuccessRecommendation"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaCustomerSuccessRecommendation_status_createdAt_idx" ON "GbaCustomerSuccessRecommendation"("status", "createdAt" DESC);

CREATE INDEX "GbaCustomerSuccessRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaCustomerSuccessRecommendationReview"("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaCustomerSuccessRecommendationReview_recommendationId_reviewedAt_idx" ON "GbaCustomerSuccessRecommendationReview"("customerSuccessRecommendationId", "reviewedAt" DESC);

CREATE INDEX "GbaCustomerSuccessExecutiveReport_workspaceId_createdAt_idx" ON "GbaCustomerSuccessExecutiveReport"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaCustomerSuccessExecutiveReport_organizationId_createdAt_idx" ON "GbaCustomerSuccessExecutiveReport"("organizationId", "createdAt" DESC);
CREATE INDEX "GbaCustomerSuccessExecutiveReport_period_createdAt_idx" ON "GbaCustomerSuccessExecutiveReport"("period", "createdAt" DESC);

CREATE INDEX "GbaCustomerSuccessTimelineEvent_workspaceId_createdAt_idx" ON "GbaCustomerSuccessTimelineEvent"("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaCustomerSuccessTimelineEvent_organizationId_createdAt_idx" ON "GbaCustomerSuccessTimelineEvent"("organizationId", "createdAt" DESC);

CREATE INDEX "GbaCustomerSuccessAgentHealth_workspaceId_generatedAt_idx" ON "GbaCustomerSuccessAgentHealth"("workspaceId", "generatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessAgentHealth_organizationId_generatedAt_idx" ON "GbaCustomerSuccessAgentHealth"("organizationId", "generatedAt" DESC);
CREATE INDEX "GbaCustomerSuccessAgentHealth_status_generatedAt_idx" ON "GbaCustomerSuccessAgentHealth"("status", "generatedAt" DESC);
