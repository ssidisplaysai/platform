-- GBA-0001: Genesis Executive Agent v1.0
-- Additive migration only.

CREATE TABLE "GbaExecutiveBriefing" (
  "briefingId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "executiveSummary" TEXT NOT NULL,
  "criticalAlerts" JSONB NOT NULL,
  "topOpportunities" JSONB NOT NULL,
  "topRisks" JSONB NOT NULL,
  "completedGoals" JSONB NOT NULL,
  "behindScheduleGoals" JSONB NOT NULL,
  "operationalHighlights" JSONB NOT NULL,
  "financialHighlights" JSONB NOT NULL,
  "marketingHighlights" JSONB NOT NULL,
  "manufacturingHighlights" JSONB NOT NULL,
  "salesHighlights" JSONB NOT NULL,
  "supportHighlights" JSONB NOT NULL,
  "recommendedExecutiveActions" JSONB NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "contextPackageId" TEXT,
  "replayChecksum" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveBriefing_workspaceId_createdAt_idx" ON "GbaExecutiveBriefing" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveBriefing_organizationId_createdAt_idx" ON "GbaExecutiveBriefing" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveBriefing_period_createdAt_idx" ON "GbaExecutiveBriefing" ("period", "createdAt" DESC);
CREATE INDEX "GbaExecutiveBriefing_replayChecksum_idx" ON "GbaExecutiveBriefing" ("replayChecksum");

CREATE TABLE "GbaExecutiveGoal" (
  "goalId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parentGoalId" TEXT,
  "level" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "keyResults" JSONB NOT NULL,
  "milestones" JSONB NOT NULL,
  "dependencies" JSONB NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "progressPercent" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaExecutiveGoal_workspaceId_updatedAt_idx" ON "GbaExecutiveGoal" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveGoal_organizationId_updatedAt_idx" ON "GbaExecutiveGoal" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveGoal_status_updatedAt_idx" ON "GbaExecutiveGoal" ("status", "updatedAt" DESC);

CREATE TABLE "GbaExecutiveGoalHistory" (
  "goalHistoryId" TEXT PRIMARY KEY,
  "goalId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveGoalHistory_workspaceId_changedAt_idx" ON "GbaExecutiveGoalHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaExecutiveGoalHistory_goalId_changedAt_idx" ON "GbaExecutiveGoalHistory" ("goalId", "changedAt" DESC);
CREATE INDEX "GbaExecutiveGoalHistory_immutableLineage_idx" ON "GbaExecutiveGoalHistory" ("immutableLineage");

CREATE TABLE "GbaExecutiveKpi" (
  "kpiId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "target" DOUBLE PRECISION NOT NULL,
  "thresholdGreen" DOUBLE PRECISION NOT NULL,
  "thresholdYellow" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "versionTag" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaExecutiveKpi_workspaceId_updatedAt_idx" ON "GbaExecutiveKpi" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveKpi_organizationId_updatedAt_idx" ON "GbaExecutiveKpi" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveKpi_name_updatedAt_idx" ON "GbaExecutiveKpi" ("name", "updatedAt" DESC);

CREATE TABLE "GbaExecutiveKpiHistory" (
  "kpiHistoryId" TEXT PRIMARY KEY,
  "kpiId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "measuredValue" DOUBLE PRECISION NOT NULL,
  "trend" DOUBLE PRECISION NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveKpiHistory_workspaceId_measuredAt_idx" ON "GbaExecutiveKpiHistory" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaExecutiveKpiHistory_kpiId_measuredAt_idx" ON "GbaExecutiveKpiHistory" ("kpiId", "measuredAt" DESC);
CREATE INDEX "GbaExecutiveKpiHistory_immutableLineage_idx" ON "GbaExecutiveKpiHistory" ("immutableLineage");

CREATE TABLE "GbaExecutiveRecommendation" (
  "recommendationId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "businessImpact" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "requiredApprovals" JSONB NOT NULL,
  "suggestedOwner" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "deterministicChecksum" TEXT NOT NULL,
  "reviewed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveRecommendation_workspaceId_createdAt_idx" ON "GbaExecutiveRecommendation" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveRecommendation_organizationId_createdAt_idx" ON "GbaExecutiveRecommendation" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveRecommendation_category_createdAt_idx" ON "GbaExecutiveRecommendation" ("category", "createdAt" DESC);
CREATE INDEX "GbaExecutiveRecommendation_reviewed_createdAt_idx" ON "GbaExecutiveRecommendation" ("reviewed", "createdAt" DESC);
CREATE INDEX "GbaExecutiveRecommendation_deterministicChecksum_idx" ON "GbaExecutiveRecommendation" ("deterministicChecksum");

CREATE TABLE "GbaExecutiveRecommendationReview" (
  "recommendationReviewId" TEXT PRIMARY KEY,
  "recommendationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "notes" TEXT,
  "reviewedBy" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaExecutiveRecommendationReview" ("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaExecutiveRecommendationReview_recommendationId_reviewedAt_idx" ON "GbaExecutiveRecommendationReview" ("recommendationId", "reviewedAt" DESC);
CREATE INDEX "GbaExecutiveRecommendationReview_immutableLineage_idx" ON "GbaExecutiveRecommendationReview" ("immutableLineage");

CREATE TABLE "GbaExecutiveRisk" (
  "riskId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "probability" INTEGER NOT NULL,
  "impact" INTEGER NOT NULL,
  "owner" TEXT NOT NULL,
  "mitigation" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaExecutiveRisk_workspaceId_updatedAt_idx" ON "GbaExecutiveRisk" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveRisk_organizationId_updatedAt_idx" ON "GbaExecutiveRisk" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveRisk_category_updatedAt_idx" ON "GbaExecutiveRisk" ("category", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveRisk_status_updatedAt_idx" ON "GbaExecutiveRisk" ("status", "updatedAt" DESC);

CREATE TABLE "GbaExecutiveRiskHistory" (
  "riskHistoryId" TEXT PRIMARY KEY,
  "riskId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reviewNote" TEXT NOT NULL,
  "reviewedBy" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveRiskHistory_workspaceId_reviewedAt_idx" ON "GbaExecutiveRiskHistory" ("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaExecutiveRiskHistory_riskId_reviewedAt_idx" ON "GbaExecutiveRiskHistory" ("riskId", "reviewedAt" DESC);
CREATE INDEX "GbaExecutiveRiskHistory_immutableLineage_idx" ON "GbaExecutiveRiskHistory" ("immutableLineage");

CREATE TABLE "GbaExecutiveOpportunity" (
  "opportunityId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "projectedImpact" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaExecutiveOpportunity_workspaceId_updatedAt_idx" ON "GbaExecutiveOpportunity" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveOpportunity_organizationId_updatedAt_idx" ON "GbaExecutiveOpportunity" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveOpportunity_category_updatedAt_idx" ON "GbaExecutiveOpportunity" ("category", "updatedAt" DESC);
CREATE INDEX "GbaExecutiveOpportunity_status_updatedAt_idx" ON "GbaExecutiveOpportunity" ("status", "updatedAt" DESC);

CREATE TABLE "GbaExecutiveOpportunityHistory" (
  "opportunityHistoryId" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveOpportunityHistory_workspaceId_changedAt_idx" ON "GbaExecutiveOpportunityHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaExecutiveOpportunityHistory_opportunityId_changedAt_idx" ON "GbaExecutiveOpportunityHistory" ("opportunityId", "changedAt" DESC);
CREATE INDEX "GbaExecutiveOpportunityHistory_immutableLineage_idx" ON "GbaExecutiveOpportunityHistory" ("immutableLineage");

CREATE TABLE "GbaExecutiveDelegation" (
  "delegationId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetAgent" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "orchestrationExecutionId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveDelegation_workspaceId_createdAt_idx" ON "GbaExecutiveDelegation" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveDelegation_organizationId_createdAt_idx" ON "GbaExecutiveDelegation" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveDelegation_targetAgent_createdAt_idx" ON "GbaExecutiveDelegation" ("targetAgent", "createdAt" DESC);
CREATE INDEX "GbaExecutiveDelegation_orchestrationExecutionId_idx" ON "GbaExecutiveDelegation" ("orchestrationExecutionId");

CREATE TABLE "GbaExecutiveApproval" (
  "approvalId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "requiredApprovers" JSONB NOT NULL,
  "approvedBy" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaExecutiveApproval_workspaceId_createdAt_idx" ON "GbaExecutiveApproval" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveApproval_organizationId_createdAt_idx" ON "GbaExecutiveApproval" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveApproval_state_createdAt_idx" ON "GbaExecutiveApproval" ("state", "createdAt" DESC);

CREATE TABLE "GbaExecutiveTimelineEvent" (
  "timelineEventId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaExecutiveTimelineEvent_workspaceId_createdAt_idx" ON "GbaExecutiveTimelineEvent" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveTimelineEvent_organizationId_createdAt_idx" ON "GbaExecutiveTimelineEvent" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaExecutiveTimelineEvent_eventType_createdAt_idx" ON "GbaExecutiveTimelineEvent" ("eventType", "createdAt" DESC);

CREATE TABLE "GbaExecutiveHealth" (
  "healthId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "criticalRiskCount" INTEGER NOT NULL,
  "behindGoalCount" INTEGER NOT NULL,
  "openRecommendationCount" INTEGER NOT NULL,
  "pendingApprovalCount" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaExecutiveHealth_workspaceId_generatedAt_idx" ON "GbaExecutiveHealth" ("workspaceId", "generatedAt" DESC);
CREATE INDEX "GbaExecutiveHealth_organizationId_generatedAt_idx" ON "GbaExecutiveHealth" ("organizationId", "generatedAt" DESC);
CREATE INDEX "GbaExecutiveHealth_status_generatedAt_idx" ON "GbaExecutiveHealth" ("status", "generatedAt" DESC);
