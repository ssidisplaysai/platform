-- GMP-0006D attribution, recommendations, and decision support v1 (additive)

CREATE TABLE "GmpAttributionAnalysis" (
  "attributionAnalysisId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteId" TEXT,
  "evidenceSnapshotId" TEXT NOT NULL,
  "attributionVersion" TEXT NOT NULL,
  "attributionWindowDays" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "inputFingerprint" TEXT NOT NULL,
  "outputChecksum" TEXT NOT NULL,
  "sourceMetricCount" INTEGER NOT NULL DEFAULT 0,
  "sourcePublicationCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpAttributionAnalysis_pkey" PRIMARY KEY ("attributionAnalysisId")
);

CREATE TABLE "GmpAttributionResult" (
  "attributionResultId" TEXT NOT NULL,
  "attributionAnalysisId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteId" TEXT,
  "evidenceSnapshotId" TEXT NOT NULL,
  "dimensionType" TEXT NOT NULL,
  "dimensionValue" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "attributedValue" DECIMAL(20,6) NOT NULL,
  "confidence" TEXT NOT NULL,
  "lineageFingerprint" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpAttributionResult_pkey" PRIMARY KEY ("attributionResultId")
);

CREATE TABLE "GmpRecommendationRuleCatalogEntry" (
  "recommendationRuleCatalogEntryId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "registryVersion" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "inputs" JSONB NOT NULL,
  "thresholds" JSONB NOT NULL,
  "outputSchema" JSONB NOT NULL,
  "severityMapping" JSONB NOT NULL,
  "priorityMapping" JSONB NOT NULL,
  "replayCompatible" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpRecommendationRuleCatalogEntry_pkey" PRIMARY KEY ("recommendationRuleCatalogEntryId")
);

CREATE TABLE "GmpRecommendationRun" (
  "recommendationRunId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteId" TEXT,
  "evidenceSnapshotId" TEXT NOT NULL,
  "attributionAnalysisId" TEXT NOT NULL,
  "replayOfRunId" TEXT,
  "triggerType" TEXT NOT NULL,
  "runStatus" TEXT NOT NULL,
  "recommendationEngineVersion" TEXT NOT NULL,
  "ruleCatalogVersion" TEXT NOT NULL,
  "attributionVersion" TEXT NOT NULL,
  "decisionSupportVersion" TEXT NOT NULL,
  "inputFingerprint" TEXT NOT NULL,
  "outputChecksum" TEXT,
  "recommendationCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmpRecommendationRun_pkey" PRIMARY KEY ("recommendationRunId")
);

CREATE TABLE "GmpRecommendationRuleExecution" (
  "recommendationRuleExecutionId" TEXT NOT NULL,
  "recommendationRunId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "evidenceSnapshotId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "matched" BOOLEAN NOT NULL,
  "producedCount" INTEGER NOT NULL DEFAULT 0,
  "executionChecksum" TEXT NOT NULL,
  "diagnostics" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpRecommendationRuleExecution_pkey" PRIMARY KEY ("recommendationRuleExecutionId")
);

CREATE TABLE "GmpRecommendationRecord" (
  "recommendationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteId" TEXT,
  "recommendationRunId" TEXT NOT NULL,
  "evidenceSnapshotId" TEXT NOT NULL,
  "attributionAnalysisId" TEXT NOT NULL,
  "recommendationVersion" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "evidenceCompilerVersion" TEXT NOT NULL,
  "snapshotVersion" TEXT NOT NULL,
  "attributionVersion" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "supportingEvidence" JSONB NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "lineageFingerprint" TEXT NOT NULL,
  "immutablePayloadChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpRecommendationRecord_pkey" PRIMARY KEY ("recommendationId")
);

CREATE TABLE "GmpRecommendationLifecycleEvent" (
  "recommendationLifecycleEventId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "lifecycleState" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpRecommendationLifecycleEvent_pkey" PRIMARY KEY ("recommendationLifecycleEventId")
);

CREATE TABLE "GmpRecommendationReplayRun" (
  "recommendationReplayRunId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteId" TEXT,
  "evidenceSnapshotId" TEXT NOT NULL,
  "recommendationRunId" TEXT NOT NULL,
  "ruleCatalogVersion" TEXT NOT NULL,
  "attributionVersion" TEXT NOT NULL,
  "replayChecksum" TEXT NOT NULL,
  "recommendationCount" INTEGER NOT NULL DEFAULT 0,
  "deterministicMatch" BOOLEAN,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpRecommendationReplayRun_pkey" PRIMARY KEY ("recommendationReplayRunId")
);

CREATE TABLE "GmpDecisionSupportSummary" (
  "decisionSupportSummaryId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteId" TEXT,
  "evidenceSnapshotId" TEXT NOT NULL,
  "recommendationRunId" TEXT,
  "summaryType" TEXT NOT NULL,
  "summaryKey" TEXT NOT NULL,
  "summaryValue" JSONB NOT NULL,
  "summaryChecksum" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmpDecisionSupportSummary_pkey" PRIMARY KEY ("decisionSupportSummaryId")
);

CREATE INDEX "GmpAttributionAnalysis_workspaceId_createdAt_idx"
ON "GmpAttributionAnalysis"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpAttributionAnalysis_projectId_createdAt_idx"
ON "GmpAttributionAnalysis"("projectId", "createdAt" DESC);

CREATE INDEX "GmpAttributionAnalysis_siteId_createdAt_idx"
ON "GmpAttributionAnalysis"("siteId", "createdAt" DESC);

CREATE INDEX "GmpAttributionAnalysis_evidenceSnapshotId_createdAt_idx"
ON "GmpAttributionAnalysis"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpAttributionAnalysis_inputFingerprint_idx"
ON "GmpAttributionAnalysis"("inputFingerprint");

CREATE INDEX "GmpAttributionResult_attributionAnalysisId_dimensionType_dimensionValue_idx"
ON "GmpAttributionResult"("attributionAnalysisId", "dimensionType", "dimensionValue");

CREATE INDEX "GmpAttributionResult_workspaceId_createdAt_idx"
ON "GmpAttributionResult"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpAttributionResult_projectId_createdAt_idx"
ON "GmpAttributionResult"("projectId", "createdAt" DESC);

CREATE INDEX "GmpAttributionResult_evidenceSnapshotId_createdAt_idx"
ON "GmpAttributionResult"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpAttributionResult_lineageFingerprint_idx"
ON "GmpAttributionResult"("lineageFingerprint");

CREATE UNIQUE INDEX "GmpRecommendationRuleCatalogEntry_projectId_ruleId_ruleVersion_key"
ON "GmpRecommendationRuleCatalogEntry"("projectId", "ruleId", "ruleVersion");

CREATE INDEX "GmpRecommendationRuleCatalogEntry_projectId_createdAt_idx"
ON "GmpRecommendationRuleCatalogEntry"("projectId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRuleCatalogEntry_registryVersion_idx"
ON "GmpRecommendationRuleCatalogEntry"("registryVersion");

CREATE INDEX "GmpRecommendationRun_workspaceId_createdAt_idx"
ON "GmpRecommendationRun"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRun_projectId_createdAt_idx"
ON "GmpRecommendationRun"("projectId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRun_siteId_createdAt_idx"
ON "GmpRecommendationRun"("siteId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRun_evidenceSnapshotId_createdAt_idx"
ON "GmpRecommendationRun"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRun_replayOfRunId_createdAt_idx"
ON "GmpRecommendationRun"("replayOfRunId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRun_inputFingerprint_idx"
ON "GmpRecommendationRun"("inputFingerprint");

CREATE INDEX "GmpRecommendationRuleExecution_recommendationRunId_createdAt_idx"
ON "GmpRecommendationRuleExecution"("recommendationRunId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRuleExecution_projectId_createdAt_idx"
ON "GmpRecommendationRuleExecution"("projectId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRuleExecution_evidenceSnapshotId_createdAt_idx"
ON "GmpRecommendationRuleExecution"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRuleExecution_ruleId_ruleVersion_idx"
ON "GmpRecommendationRuleExecution"("ruleId", "ruleVersion");

CREATE INDEX "GmpRecommendationRecord_workspaceId_createdAt_idx"
ON "GmpRecommendationRecord"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRecord_projectId_createdAt_idx"
ON "GmpRecommendationRecord"("projectId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRecord_siteId_createdAt_idx"
ON "GmpRecommendationRecord"("siteId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRecord_recommendationRunId_createdAt_idx"
ON "GmpRecommendationRecord"("recommendationRunId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRecord_evidenceSnapshotId_createdAt_idx"
ON "GmpRecommendationRecord"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationRecord_ruleId_ruleVersion_idx"
ON "GmpRecommendationRecord"("ruleId", "ruleVersion");

CREATE INDEX "GmpRecommendationRecord_lineageFingerprint_idx"
ON "GmpRecommendationRecord"("lineageFingerprint");

CREATE INDEX "GmpRecommendationLifecycleEvent_recommendationId_createdAt_idx"
ON "GmpRecommendationLifecycleEvent"("recommendationId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationLifecycleEvent_workspaceId_createdAt_idx"
ON "GmpRecommendationLifecycleEvent"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationLifecycleEvent_projectId_createdAt_idx"
ON "GmpRecommendationLifecycleEvent"("projectId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationLifecycleEvent_lifecycleState_createdAt_idx"
ON "GmpRecommendationLifecycleEvent"("lifecycleState", "createdAt" DESC);

CREATE INDEX "GmpRecommendationReplayRun_workspaceId_createdAt_idx"
ON "GmpRecommendationReplayRun"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationReplayRun_projectId_createdAt_idx"
ON "GmpRecommendationReplayRun"("projectId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationReplayRun_evidenceSnapshotId_createdAt_idx"
ON "GmpRecommendationReplayRun"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpRecommendationReplayRun_recommendationRunId_createdAt_idx"
ON "GmpRecommendationReplayRun"("recommendationRunId", "createdAt" DESC);

CREATE INDEX "GmpDecisionSupportSummary_workspaceId_createdAt_idx"
ON "GmpDecisionSupportSummary"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpDecisionSupportSummary_projectId_createdAt_idx"
ON "GmpDecisionSupportSummary"("projectId", "createdAt" DESC);

CREATE INDEX "GmpDecisionSupportSummary_evidenceSnapshotId_createdAt_idx"
ON "GmpDecisionSupportSummary"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpDecisionSupportSummary_summaryType_createdAt_idx"
ON "GmpDecisionSupportSummary"("summaryType", "createdAt" DESC);

CREATE INDEX "GmpDecisionSupportSummary_summaryChecksum_idx"
ON "GmpDecisionSupportSummary"("summaryChecksum");
