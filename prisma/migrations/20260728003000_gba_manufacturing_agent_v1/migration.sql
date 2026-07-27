-- GBA-0003: Genesis Manufacturing Agent v1.0
-- Additive migration only.

CREATE TABLE "GbaManufacturingBom" (
  "bomId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "components" JSONB NOT NULL,
  "approvedSubstitutions" JSONB NOT NULL,
  "costRollup" DOUBLE PRECISION NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingBom_workspaceId_updatedAt_idx" ON "GbaManufacturingBom" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingBom_organizationId_updatedAt_idx" ON "GbaManufacturingBom" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingBom_sku_updatedAt_idx" ON "GbaManufacturingBom" ("sku", "updatedAt" DESC);

CREATE TABLE "GbaManufacturingBomHistory" (
  "bomHistoryId" TEXT PRIMARY KEY,
  "bomId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingBomHistory_workspaceId_changedAt_idx" ON "GbaManufacturingBomHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingBomHistory_bomId_changedAt_idx" ON "GbaManufacturingBomHistory" ("bomId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingBomHistory_immutableLineage_idx" ON "GbaManufacturingBomHistory" ("immutableLineage");

CREATE TABLE "GbaManufacturingRouting" (
  "routingId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "workCenter" TEXT NOT NULL,
  "machineAssignments" JSONB NOT NULL,
  "processSteps" JSONB NOT NULL,
  "laborRequirements" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingRouting_workspaceId_updatedAt_idx" ON "GbaManufacturingRouting" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingRouting_organizationId_updatedAt_idx" ON "GbaManufacturingRouting" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingRouting_sku_updatedAt_idx" ON "GbaManufacturingRouting" ("sku", "updatedAt" DESC);

CREATE TABLE "GbaManufacturingRoutingHistory" (
  "routingHistoryId" TEXT PRIMARY KEY,
  "routingId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingRoutingHistory_workspaceId_changedAt_idx" ON "GbaManufacturingRoutingHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingRoutingHistory_routingId_changedAt_idx" ON "GbaManufacturingRoutingHistory" ("routingId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingRoutingHistory_immutableLineage_idx" ON "GbaManufacturingRoutingHistory" ("immutableLineage");

CREATE TABLE "GbaManufacturingProductionOrder" (
  "productionOrderId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "operationsWorkOrderId" TEXT,
  "title" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "bomRevision" TEXT NOT NULL,
  "routingRevision" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "quantityPlanned" INTEGER NOT NULL,
  "quantityCompleted" INTEGER NOT NULL,
  "scheduledStartAt" TIMESTAMP(3) NOT NULL,
  "scheduledEndAt" TIMESTAMP(3) NOT NULL,
  "materialAllocations" JSONB NOT NULL,
  "laborAssignments" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingProductionOrder_workspaceId_updatedAt_idx" ON "GbaManufacturingProductionOrder" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingProductionOrder_organizationId_updatedAt_idx" ON "GbaManufacturingProductionOrder" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingProductionOrder_status_updatedAt_idx" ON "GbaManufacturingProductionOrder" ("status", "updatedAt" DESC);

CREATE TABLE "GbaManufacturingProductionOrderHistory" (
  "productionOrderHistoryId" TEXT PRIMARY KEY,
  "productionOrderId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingProductionOrderHistory_workspaceId_changedAt_idx" ON "GbaManufacturingProductionOrderHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingProductionOrderHistory_productionOrderId_changedAt_idx" ON "GbaManufacturingProductionOrderHistory" ("productionOrderId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingProductionOrderHistory_immutableLineage_idx" ON "GbaManufacturingProductionOrderHistory" ("immutableLineage");

CREATE TABLE "GbaManufacturingMachine" (
  "machineId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "machineType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "runtimeMinutes" INTEGER NOT NULL,
  "downtimeMinutes" INTEGER NOT NULL,
  "plannedMaintenanceMinutes" INTEGER NOT NULL,
  "unplannedFailureCount" INTEGER NOT NULL,
  "availabilityPercent" DOUBLE PRECISION NOT NULL,
  "performancePercent" DOUBLE PRECISION NOT NULL,
  "qualityPercent" DOUBLE PRECISION NOT NULL,
  "utilizationPercent" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingMachine_workspaceId_updatedAt_idx" ON "GbaManufacturingMachine" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingMachine_organizationId_updatedAt_idx" ON "GbaManufacturingMachine" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingMachine_status_updatedAt_idx" ON "GbaManufacturingMachine" ("status", "updatedAt" DESC);

CREATE TABLE "GbaManufacturingMachineHistory" (
  "machineHistoryId" TEXT PRIMARY KEY,
  "machineId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingMachineHistory_workspaceId_changedAt_idx" ON "GbaManufacturingMachineHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingMachineHistory_machineId_changedAt_idx" ON "GbaManufacturingMachineHistory" ("machineId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingMachineHistory_immutableLineage_idx" ON "GbaManufacturingMachineHistory" ("immutableLineage");

CREATE TABLE "GbaManufacturingLabor" (
  "laborRecordId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "certifications" JSONB NOT NULL,
  "skills" JSONB NOT NULL,
  "shift" TEXT NOT NULL,
  "utilizationPercent" DOUBLE PRECISION NOT NULL,
  "overtimeHours" DOUBLE PRECISION NOT NULL,
  "laborEfficiencyPercent" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingLabor_workspaceId_updatedAt_idx" ON "GbaManufacturingLabor" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingLabor_organizationId_updatedAt_idx" ON "GbaManufacturingLabor" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingLabor_operatorId_updatedAt_idx" ON "GbaManufacturingLabor" ("operatorId", "updatedAt" DESC);

CREATE TABLE "GbaManufacturingLaborHistory" (
  "laborHistoryId" TEXT PRIMARY KEY,
  "laborRecordId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "shift" TEXT NOT NULL,
  "utilizationPercent" DOUBLE PRECISION NOT NULL,
  "overtimeHours" DOUBLE PRECISION NOT NULL,
  "laborEfficiencyPercent" DOUBLE PRECISION NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingLaborHistory_workspaceId_changedAt_idx" ON "GbaManufacturingLaborHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingLaborHistory_laborRecordId_changedAt_idx" ON "GbaManufacturingLaborHistory" ("laborRecordId", "changedAt" DESC);
CREATE INDEX "GbaManufacturingLaborHistory_immutableLineage_idx" ON "GbaManufacturingLaborHistory" ("immutableLineage");

CREATE TABLE "GbaManufacturingMaterialConsumption" (
  "materialConsumptionId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderId" TEXT NOT NULL,
  "rawMaterialUsed" DOUBLE PRECISION NOT NULL,
  "componentConsumed" DOUBLE PRECISION NOT NULL,
  "yieldPercent" DOUBLE PRECISION NOT NULL,
  "wasteQuantity" DOUBLE PRECISION NOT NULL,
  "scrapQuantity" DOUBLE PRECISION NOT NULL,
  "reworkMaterialQuantity" DOUBLE PRECISION NOT NULL,
  "variancePercent" DOUBLE PRECISION NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingMaterialConsumption_workspaceId_measuredAt_idx" ON "GbaManufacturingMaterialConsumption" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaManufacturingMaterialConsumption_organizationId_measuredAt_idx" ON "GbaManufacturingMaterialConsumption" ("organizationId", "measuredAt" DESC);
CREATE INDEX "GbaManufacturingMaterialConsumption_productionOrderId_measuredAt_idx" ON "GbaManufacturingMaterialConsumption" ("productionOrderId", "measuredAt" DESC);

CREATE TABLE "GbaManufacturingQualityEvent" (
  "qualityEventId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "defectCategory" TEXT NOT NULL,
  "rootCauseReference" TEXT,
  "firstPassYieldPercent" DOUBLE PRECISION NOT NULL,
  "note" TEXT NOT NULL,
  "recordedBy" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingQualityEvent_workspaceId_recordedAt_idx" ON "GbaManufacturingQualityEvent" ("workspaceId", "recordedAt" DESC);
CREATE INDEX "GbaManufacturingQualityEvent_organizationId_recordedAt_idx" ON "GbaManufacturingQualityEvent" ("organizationId", "recordedAt" DESC);
CREATE INDEX "GbaManufacturingQualityEvent_severity_recordedAt_idx" ON "GbaManufacturingQualityEvent" ("severity", "recordedAt" DESC);

CREATE TABLE "GbaManufacturingCostRecord" (
  "manufacturingCostId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderId" TEXT NOT NULL,
  "costingVersion" TEXT NOT NULL,
  "materialCost" DOUBLE PRECISION NOT NULL,
  "laborCost" DOUBLE PRECISION NOT NULL,
  "machineCost" DOUBLE PRECISION NOT NULL,
  "overheadCost" DOUBLE PRECISION NOT NULL,
  "burdenCost" DOUBLE PRECISION NOT NULL,
  "totalManufacturingCost" DOUBLE PRECISION NOT NULL,
  "costVariance" DOUBLE PRECISION NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingCostRecord_workspaceId_measuredAt_idx" ON "GbaManufacturingCostRecord" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaManufacturingCostRecord_organizationId_measuredAt_idx" ON "GbaManufacturingCostRecord" ("organizationId", "measuredAt" DESC);
CREATE INDEX "GbaManufacturingCostRecord_productionOrderId_measuredAt_idx" ON "GbaManufacturingCostRecord" ("productionOrderId", "measuredAt" DESC);

CREATE TABLE "GbaManufacturingKpi" (
  "manufacturingKpiId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "target" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "versionTag" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaManufacturingKpi_workspaceId_updatedAt_idx" ON "GbaManufacturingKpi" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingKpi_organizationId_updatedAt_idx" ON "GbaManufacturingKpi" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaManufacturingKpi_name_updatedAt_idx" ON "GbaManufacturingKpi" ("name", "updatedAt" DESC);

CREATE TABLE "GbaManufacturingKpiHistory" (
  "manufacturingKpiHistoryId" TEXT PRIMARY KEY,
  "manufacturingKpiId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "measuredValue" DOUBLE PRECISION NOT NULL,
  "trend" DOUBLE PRECISION NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingKpiHistory_workspaceId_measuredAt_idx" ON "GbaManufacturingKpiHistory" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaManufacturingKpiHistory_manufacturingKpiId_measuredAt_idx" ON "GbaManufacturingKpiHistory" ("manufacturingKpiId", "measuredAt" DESC);
CREATE INDEX "GbaManufacturingKpiHistory_immutableLineage_idx" ON "GbaManufacturingKpiHistory" ("immutableLineage");

CREATE TABLE "GbaManufacturingRecommendation" (
  "manufacturingRecommendationId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "confidence" TEXT NOT NULL,
  "businessImpact" TEXT NOT NULL,
  "estimatedSavings" DOUBLE PRECISION NOT NULL,
  "suggestedOwner" TEXT NOT NULL,
  "requiredApprovals" JSONB NOT NULL,
  "priority" TEXT NOT NULL,
  "deterministicChecksum" TEXT NOT NULL,
  "reviewed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingRecommendation_workspaceId_createdAt_idx" ON "GbaManufacturingRecommendation" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaManufacturingRecommendation_organizationId_createdAt_idx" ON "GbaManufacturingRecommendation" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaManufacturingRecommendation_category_createdAt_idx" ON "GbaManufacturingRecommendation" ("category", "createdAt" DESC);
CREATE INDEX "GbaManufacturingRecommendation_reviewed_createdAt_idx" ON "GbaManufacturingRecommendation" ("reviewed", "createdAt" DESC);
CREATE INDEX "GbaManufacturingRecommendation_deterministicChecksum_idx" ON "GbaManufacturingRecommendation" ("deterministicChecksum");

CREATE TABLE "GbaManufacturingRecommendationReview" (
  "manufacturingRecommendationReviewId" TEXT PRIMARY KEY,
  "manufacturingRecommendationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "notes" TEXT,
  "reviewedBy" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaManufacturingRecommendationReview" ("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaManufacturingRecommendationReview_manufacturingRecommendationId_reviewedAt_idx" ON "GbaManufacturingRecommendationReview" ("manufacturingRecommendationId", "reviewedAt" DESC);
CREATE INDEX "GbaManufacturingRecommendationReview_immutableLineage_idx" ON "GbaManufacturingRecommendationReview" ("immutableLineage");

CREATE TABLE "GbaManufacturingOperationsSignal" (
  "operationsSignalId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionCompletionPercent" INTEGER NOT NULL,
  "capacityUtilizationPercent" INTEGER NOT NULL,
  "materialShortageCount" INTEGER NOT NULL,
  "machineHealthStatus" TEXT NOT NULL,
  "laborAvailabilityPercent" INTEGER NOT NULL,
  "qualityAlertCount" INTEGER NOT NULL,
  "kpiSummary" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingOperationsSignal_workspaceId_publishedAt_idx" ON "GbaManufacturingOperationsSignal" ("workspaceId", "publishedAt" DESC);
CREATE INDEX "GbaManufacturingOperationsSignal_organizationId_publishedAt_idx" ON "GbaManufacturingOperationsSignal" ("organizationId", "publishedAt" DESC);
CREATE INDEX "GbaManufacturingOperationsSignal_machineHealthStatus_publishedAt_idx" ON "GbaManufacturingOperationsSignal" ("machineHealthStatus", "publishedAt" DESC);

CREATE TABLE "GbaManufacturingExecutiveReport" (
  "manufacturingExecutiveReportId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "productionSummary" JSONB NOT NULL,
  "capacityOutlook" JSONB NOT NULL,
  "qualitySummary" JSONB NOT NULL,
  "costSummary" JSONB NOT NULL,
  "risks" JSONB NOT NULL,
  "opportunities" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingExecutiveReport_workspaceId_createdAt_idx" ON "GbaManufacturingExecutiveReport" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaManufacturingExecutiveReport_organizationId_createdAt_idx" ON "GbaManufacturingExecutiveReport" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaManufacturingExecutiveReport_period_createdAt_idx" ON "GbaManufacturingExecutiveReport" ("period", "createdAt" DESC);

CREATE TABLE "GbaManufacturingTimelineEvent" (
  "manufacturingTimelineEventId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaManufacturingTimelineEvent_workspaceId_createdAt_idx" ON "GbaManufacturingTimelineEvent" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaManufacturingTimelineEvent_organizationId_createdAt_idx" ON "GbaManufacturingTimelineEvent" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaManufacturingTimelineEvent_eventType_createdAt_idx" ON "GbaManufacturingTimelineEvent" ("eventType", "createdAt" DESC);

CREATE TABLE "GbaManufacturingHealth" (
  "manufacturingHealthId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "blockedProductionOrders" INTEGER NOT NULL,
  "criticalQualityEvents" INTEGER NOT NULL,
  "machineDowntimeSignals" INTEGER NOT NULL,
  "materialVarianceSignals" INTEGER NOT NULL,
  "unreviewedRecommendations" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaManufacturingHealth_workspaceId_generatedAt_idx" ON "GbaManufacturingHealth" ("workspaceId", "generatedAt" DESC);
CREATE INDEX "GbaManufacturingHealth_organizationId_generatedAt_idx" ON "GbaManufacturingHealth" ("organizationId", "generatedAt" DESC);
CREATE INDEX "GbaManufacturingHealth_status_generatedAt_idx" ON "GbaManufacturingHealth" ("status", "generatedAt" DESC);
