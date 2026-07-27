-- AlterTable
ALTER TABLE "GeaAgent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaAgentAction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaAgentApproval" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaAgentExecution" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaAgentMemoryReference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaAgentResult" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaMemoryCollection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaMemoryReference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaMemorySource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaToolDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeaToolExecution" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GedEntityDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GedRelationshipDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GmpAnalyticsCollection" ALTER COLUMN "workspaceId" DROP DEFAULT,
ALTER COLUMN "requestedDimensions" DROP DEFAULT,
ALTER COLUMN "requestedMetrics" DROP DEFAULT,
ALTER COLUMN "collectionMode" DROP DEFAULT,
ALTER COLUMN "idempotencyKey" DROP DEFAULT,
ALTER COLUMN "inputFingerprint" DROP DEFAULT,
ALTER COLUMN "adapterKey" DROP DEFAULT,
ALTER COLUMN "adapterVersion" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GmpAnalyticsObservation" ALTER COLUMN "sourceRecordIdentity" DROP DEFAULT,
ALTER COLUMN "observationType" DROP DEFAULT,
ALTER COLUMN "sourceTimestamp" DROP DEFAULT,
ALTER COLUMN "dimensions" DROP DEFAULT,
ALTER COLUMN "metrics" DROP DEFAULT,
ALTER COLUMN "rawPayloadChecksum" DROP DEFAULT,
ALTER COLUMN "dataQualityStatus" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GbaSalesPipelineRecord" (
    "salesPipelineRecordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "opportunityReference" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amountCents" DOUBLE PRECISION NOT NULL,
    "weightedAmountCents" DOUBLE PRECISION NOT NULL,
    "probabilityPercent" DOUBLE PRECISION NOT NULL,
    "expectedCloseAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesPipelineRecord_pkey" PRIMARY KEY ("salesPipelineRecordId")
);

-- CreateTable
CREATE TABLE "GbaSalesForecastSnapshot" (
    "salesForecastSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "pipelineAmountCents" DOUBLE PRECISION NOT NULL,
    "weightedAmountCents" DOUBLE PRECISION NOT NULL,
    "committedAmountCents" DOUBLE PRECISION NOT NULL,
    "modeledWinRatePercent" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesForecastSnapshot_pkey" PRIMARY KEY ("salesForecastSnapshotId")
);

-- CreateTable
CREATE TABLE "GbaSalesAccountIntelligence" (
    "salesAccountIntelligenceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "relationshipHealthScore" DOUBLE PRECISION NOT NULL,
    "expansionPotentialScore" DOUBLE PRECISION NOT NULL,
    "churnRiskScore" DOUBLE PRECISION NOT NULL,
    "openOpportunities" INTEGER NOT NULL,
    "openRevenueCents" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesAccountIntelligence_pkey" PRIMARY KEY ("salesAccountIntelligenceId")
);

-- CreateTable
CREATE TABLE "GbaSalesRecommendation" (
    "salesRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
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

    CONSTRAINT "GbaSalesRecommendation_pkey" PRIMARY KEY ("salesRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaSalesRecommendationReview" (
    "salesRecommendationReviewId" TEXT NOT NULL,
    "salesRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesRecommendationReview_pkey" PRIMARY KEY ("salesRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaSalesTimelineEvent" (
    "salesTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesTimelineEvent_pkey" PRIMARY KEY ("salesTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaSalesHealth" (
    "salesHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stalledOpportunityCount" INTEGER NOT NULL,
    "riskyAccountCount" INTEGER NOT NULL,
    "forecastGapCount" INTEGER NOT NULL,
    "fulfillmentConstraintCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesHealth_pkey" PRIMARY KEY ("salesHealthId")
);

-- CreateIndex
CREATE INDEX "GbaSalesPipelineRecord_workspaceId_updatedAt_idx" ON "GbaSalesPipelineRecord"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesPipelineRecord_organizationId_updatedAt_idx" ON "GbaSalesPipelineRecord"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesPipelineRecord_accountId_updatedAt_idx" ON "GbaSalesPipelineRecord"("accountId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesForecastSnapshot_workspaceId_createdAt_idx" ON "GbaSalesForecastSnapshot"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesForecastSnapshot_organizationId_createdAt_idx" ON "GbaSalesForecastSnapshot"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesForecastSnapshot_period_createdAt_idx" ON "GbaSalesForecastSnapshot"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesAccountIntelligence_workspaceId_updatedAt_idx" ON "GbaSalesAccountIntelligence"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesAccountIntelligence_organizationId_updatedAt_idx" ON "GbaSalesAccountIntelligence"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesAccountIntelligence_accountId_updatedAt_idx" ON "GbaSalesAccountIntelligence"("accountId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendation_workspaceId_createdAt_idx" ON "GbaSalesRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendation_organizationId_createdAt_idx" ON "GbaSalesRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendation_status_createdAt_idx" ON "GbaSalesRecommendation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaSalesRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendationReview_salesRecommendationId_reviewed_idx" ON "GbaSalesRecommendationReview"("salesRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesTimelineEvent_workspaceId_createdAt_idx" ON "GbaSalesTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesTimelineEvent_organizationId_createdAt_idx" ON "GbaSalesTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesHealth_workspaceId_generatedAt_idx" ON "GbaSalesHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesHealth_organizationId_generatedAt_idx" ON "GbaSalesHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesHealth_status_generatedAt_idx" ON "GbaSalesHealth"("status", "generatedAt" DESC);

-- RenameIndex
ALTER INDEX "GbaExecutiveRecommendationReview_recommendationId_reviewedAt_id" RENAME TO "GbaExecutiveRecommendationReview_recommendationId_reviewedA_idx";

-- RenameIndex
ALTER INDEX "GbaManufacturingMaterialConsumption_organizationId_measuredAt_i" RENAME TO "GbaManufacturingMaterialConsumption_organizationId_measured_idx";

-- RenameIndex
ALTER INDEX "GbaManufacturingMaterialConsumption_productionOrderId_measuredA" RENAME TO "GbaManufacturingMaterialConsumption_productionOrderId_measu_idx";

-- RenameIndex
ALTER INDEX "GbaManufacturingOperationsSignal_machineHealthStatus_publishedA" RENAME TO "GbaManufacturingOperationsSignal_machineHealthStatus_publis_idx";

-- RenameIndex
ALTER INDEX "GbaManufacturingProductionOrderHistory_productionOrderId_change" RENAME TO "GbaManufacturingProductionOrderHistory_productionOrderId_ch_idx";

-- RenameIndex
ALTER INDEX "GbaManufacturingProductionOrderHistory_workspaceId_changedAt_id" RENAME TO "GbaManufacturingProductionOrderHistory_workspaceId_changedA_idx";

-- RenameIndex
ALTER INDEX "GbaManufacturingRecommendationReview_manufacturingRecommendatio" RENAME TO "GbaManufacturingRecommendationReview_manufacturingRecommend_idx";

-- RenameIndex
ALTER INDEX "GbaMarketingCampaignPlanHistory_marketingCampaignPlanId_changed" RENAME TO "GbaMarketingCampaignPlanHistory_marketingCampaignPlanId_cha_idx";

-- RenameIndex
ALTER INDEX "GbaMarketingRecommendationReview_marketingRecommendationId_revi" RENAME TO "GbaMarketingRecommendationReview_marketingRecommendationId__idx";

-- RenameIndex
ALTER INDEX "GbaOperationsRecommendationReview_operationsRecommendationId_re" RENAME TO "GbaOperationsRecommendationReview_operationsRecommendationI_idx";

-- RenameIndex
ALTER INDEX "GbaOperationsWarehouseHistory_warehouseOperationId_changedAt_id" RENAME TO "GbaOperationsWarehouseHistory_warehouseOperationId_changedA_idx";

-- RenameIndex
ALTER INDEX "GmpAnalyticsCollectionEvent_analyticsCollectionId_occurredAt_id" RENAME TO "GmpAnalyticsCollectionEvent_analyticsCollectionId_occurredA_idx";

-- RenameIndex
ALTER INDEX "GmpAnalyticsObservation_analyticsSourceId_sourceRecordIdentity_" RENAME TO "GmpAnalyticsObservation_analyticsSourceId_sourceRecordIdent_key";

-- RenameIndex
ALTER INDEX "GmpAnalyticsSourceCapability_analyticsSourceId_capabilityKey_ke" RENAME TO "GmpAnalyticsSourceCapability_analyticsSourceId_capabilityKe_key";

-- RenameIndex
ALTER INDEX "GmpAttributionResult_attributionAnalysisId_dimensionType_dimens" RENAME TO "GmpAttributionResult_attributionAnalysisId_dimensionType_di_idx";

-- RenameIndex
ALTER INDEX "GmpEvidenceCompiledMetric_evidenceSnapshotId_canonicalMetricKey" RENAME TO "GmpEvidenceCompiledMetric_evidenceSnapshotId_canonicalMetri_idx";

-- RenameIndex
ALTER INDEX "GmpEvidenceCompilerVersion_projectId_compilerName_compilerVersi" RENAME TO "GmpEvidenceCompilerVersion_projectId_compilerName_compilerV_key";

-- RenameIndex
ALTER INDEX "GmpEvidencePublicationReference_evidenceSnapshotId_createdAt_id" RENAME TO "GmpEvidencePublicationReference_evidenceSnapshotId_createdA_idx";

-- RenameIndex
ALTER INDEX "GmpRecommendationRuleCatalogEntry_projectId_ruleId_ruleVersion_" RENAME TO "GmpRecommendationRuleCatalogEntry_projectId_ruleId_ruleVers_key";

-- RenameIndex
ALTER INDEX "GmpRecommendationRuleExecution_recommendationRunId_createdAt_id" RENAME TO "GmpRecommendationRuleExecution_recommendationRunId_createdA_idx";
