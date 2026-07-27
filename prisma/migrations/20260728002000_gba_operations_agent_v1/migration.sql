-- GBA-0002: Genesis Operations Agent v1.0
-- Additive migration only.

CREATE TABLE "GbaOperationsWorkOrder" (
  "workOrderId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "dependencies" JSONB NOT NULL,
  "assignedResources" JSONB NOT NULL,
  "estimatedLaborHours" DOUBLE PRECISION NOT NULL,
  "actualLaborHours" DOUBLE PRECISION NOT NULL,
  "completionPercent" INTEGER NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsWorkOrder_workspaceId_updatedAt_idx" ON "GbaOperationsWorkOrder" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsWorkOrder_organizationId_updatedAt_idx" ON "GbaOperationsWorkOrder" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsWorkOrder_status_updatedAt_idx" ON "GbaOperationsWorkOrder" ("status", "updatedAt" DESC);

CREATE TABLE "GbaOperationsWorkOrderHistory" (
  "workOrderHistoryId" TEXT PRIMARY KEY,
  "workOrderId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsWorkOrderHistory_workspaceId_changedAt_idx" ON "GbaOperationsWorkOrderHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaOperationsWorkOrderHistory_workOrderId_changedAt_idx" ON "GbaOperationsWorkOrderHistory" ("workOrderId", "changedAt" DESC);
CREATE INDEX "GbaOperationsWorkOrderHistory_immutableLineage_idx" ON "GbaOperationsWorkOrderHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsProductionSchedule" (
  "scheduleId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "queueName" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "shiftCode" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "plannedStartAt" TIMESTAMP(3) NOT NULL,
  "plannedEndAt" TIMESTAMP(3) NOT NULL,
  "plannedLaborHours" DOUBLE PRECISION NOT NULL,
  "plannedUnits" INTEGER NOT NULL,
  "bottleneckRisk" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsProductionSchedule_workspaceId_sequence_idx" ON "GbaOperationsProductionSchedule" ("workspaceId", "sequence");
CREATE INDEX "GbaOperationsProductionSchedule_organizationId_createdAt_idx" ON "GbaOperationsProductionSchedule" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaOperationsProductionSchedule_bottleneckRisk_createdAt_idx" ON "GbaOperationsProductionSchedule" ("bottleneckRisk", "createdAt" DESC);

CREATE TABLE "GbaOperationsInventoryRecord" (
  "inventoryRecordId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "onHandQuantity" INTEGER NOT NULL,
  "allocatedQuantity" INTEGER NOT NULL,
  "availableQuantity" INTEGER NOT NULL,
  "safetyStock" INTEGER NOT NULL,
  "reorderPoint" INTEGER NOT NULL,
  "lotTrackingEnabled" BOOLEAN NOT NULL,
  "serialTrackingEnabled" BOOLEAN NOT NULL,
  "valuationAmount" DOUBLE PRECISION NOT NULL,
  "agingDays" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsInventoryRecord_workspaceId_updatedAt_idx" ON "GbaOperationsInventoryRecord" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsInventoryRecord_organizationId_updatedAt_idx" ON "GbaOperationsInventoryRecord" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsInventoryRecord_sku_updatedAt_idx" ON "GbaOperationsInventoryRecord" ("sku", "updatedAt" DESC);

CREATE TABLE "GbaOperationsInventoryHistory" (
  "inventoryHistoryId" TEXT PRIMARY KEY,
  "inventoryRecordId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "resultingOnHand" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsInventoryHistory_workspaceId_changedAt_idx" ON "GbaOperationsInventoryHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaOperationsInventoryHistory_inventoryRecordId_changedAt_idx" ON "GbaOperationsInventoryHistory" ("inventoryRecordId", "changedAt" DESC);
CREATE INDEX "GbaOperationsInventoryHistory_immutableLineage_idx" ON "GbaOperationsInventoryHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsWarehouseOperation" (
  "warehouseOperationId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "utilizationPercent" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsWarehouseOperation_workspaceId_updatedAt_idx" ON "GbaOperationsWarehouseOperation" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsWarehouseOperation_organizationId_updatedAt_idx" ON "GbaOperationsWarehouseOperation" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsWarehouseOperation_operationType_updatedAt_idx" ON "GbaOperationsWarehouseOperation" ("operationType", "updatedAt" DESC);

CREATE TABLE "GbaOperationsWarehouseHistory" (
  "warehouseHistoryId" TEXT PRIMARY KEY,
  "warehouseOperationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsWarehouseHistory_workspaceId_changedAt_idx" ON "GbaOperationsWarehouseHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaOperationsWarehouseHistory_warehouseOperationId_changedAt_idx" ON "GbaOperationsWarehouseHistory" ("warehouseOperationId", "changedAt" DESC);
CREATE INDEX "GbaOperationsWarehouseHistory_immutableLineage_idx" ON "GbaOperationsWarehouseHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsPurchasingRecord" (
  "purchasingId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "purchaseRequestId" TEXT NOT NULL,
  "purchaseOrderNumber" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "leadTimeDays" INTEGER NOT NULL,
  "deliveryDueDate" TIMESTAMP(3) NOT NULL,
  "totalCostAmount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsPurchasingRecord_workspaceId_updatedAt_idx" ON "GbaOperationsPurchasingRecord" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsPurchasingRecord_organizationId_updatedAt_idx" ON "GbaOperationsPurchasingRecord" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsPurchasingRecord_vendorId_updatedAt_idx" ON "GbaOperationsPurchasingRecord" ("vendorId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsPurchasingRecord_status_updatedAt_idx" ON "GbaOperationsPurchasingRecord" ("status", "updatedAt" DESC);

CREATE TABLE "GbaOperationsPurchasingHistory" (
  "purchasingHistoryId" TEXT PRIMARY KEY,
  "purchasingId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsPurchasingHistory_workspaceId_changedAt_idx" ON "GbaOperationsPurchasingHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaOperationsPurchasingHistory_purchasingId_changedAt_idx" ON "GbaOperationsPurchasingHistory" ("purchasingId", "changedAt" DESC);
CREATE INDEX "GbaOperationsPurchasingHistory_immutableLineage_idx" ON "GbaOperationsPurchasingHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsShippingRecord" (
  "shippingId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "shipmentType" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "freightCostAmount" DOUBLE PRECISION NOT NULL,
  "damageClaimOpen" BOOLEAN NOT NULL,
  "estimatedDeliveryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsShippingRecord_workspaceId_updatedAt_idx" ON "GbaOperationsShippingRecord" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsShippingRecord_organizationId_updatedAt_idx" ON "GbaOperationsShippingRecord" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsShippingRecord_shipmentType_updatedAt_idx" ON "GbaOperationsShippingRecord" ("shipmentType", "updatedAt" DESC);
CREATE INDEX "GbaOperationsShippingRecord_status_updatedAt_idx" ON "GbaOperationsShippingRecord" ("status", "updatedAt" DESC);

CREATE TABLE "GbaOperationsShippingHistory" (
  "shippingHistoryId" TEXT PRIMARY KEY,
  "shippingId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsShippingHistory_workspaceId_changedAt_idx" ON "GbaOperationsShippingHistory" ("workspaceId", "changedAt" DESC);
CREATE INDEX "GbaOperationsShippingHistory_shippingId_changedAt_idx" ON "GbaOperationsShippingHistory" ("shippingId", "changedAt" DESC);
CREATE INDEX "GbaOperationsShippingHistory_immutableLineage_idx" ON "GbaOperationsShippingHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsCapacityRecord" (
  "capacityId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "machineUtilizationPercent" DOUBLE PRECISION NOT NULL,
  "laborUtilizationPercent" DOUBLE PRECISION NOT NULL,
  "productionCapacityUnits" INTEGER NOT NULL,
  "availableHours" DOUBLE PRECISION NOT NULL,
  "constrainedHours" DOUBLE PRECISION NOT NULL,
  "forecastDemandUnits" INTEGER NOT NULL,
  "bottleneckSummary" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsCapacityRecord_workspaceId_measuredAt_idx" ON "GbaOperationsCapacityRecord" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsCapacityRecord_organizationId_measuredAt_idx" ON "GbaOperationsCapacityRecord" ("organizationId", "measuredAt" DESC);

CREATE TABLE "GbaOperationsCapacityHistory" (
  "capacityHistoryId" TEXT PRIMARY KEY,
  "capacityId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "machineUtilizationPercent" DOUBLE PRECISION NOT NULL,
  "laborUtilizationPercent" DOUBLE PRECISION NOT NULL,
  "productionCapacityUnits" INTEGER NOT NULL,
  "availableHours" DOUBLE PRECISION NOT NULL,
  "constrainedHours" DOUBLE PRECISION NOT NULL,
  "forecastDemandUnits" INTEGER NOT NULL,
  "bottleneckSummary" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsCapacityHistory_workspaceId_measuredAt_idx" ON "GbaOperationsCapacityHistory" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsCapacityHistory_capacityId_measuredAt_idx" ON "GbaOperationsCapacityHistory" ("capacityId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsCapacityHistory_immutableLineage_idx" ON "GbaOperationsCapacityHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsKpi" (
  "operationsKpiId" TEXT PRIMARY KEY,
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
CREATE INDEX "GbaOperationsKpi_workspaceId_updatedAt_idx" ON "GbaOperationsKpi" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsKpi_organizationId_updatedAt_idx" ON "GbaOperationsKpi" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GbaOperationsKpi_name_updatedAt_idx" ON "GbaOperationsKpi" ("name", "updatedAt" DESC);

CREATE TABLE "GbaOperationsKpiHistory" (
  "operationsKpiHistoryId" TEXT PRIMARY KEY,
  "operationsKpiId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "measuredValue" DOUBLE PRECISION NOT NULL,
  "trend" DOUBLE PRECISION NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsKpiHistory_workspaceId_measuredAt_idx" ON "GbaOperationsKpiHistory" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsKpiHistory_operationsKpiId_measuredAt_idx" ON "GbaOperationsKpiHistory" ("operationsKpiId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsKpiHistory_immutableLineage_idx" ON "GbaOperationsKpiHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsRecommendation" (
  "operationsRecommendationId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "businessImpact" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "suggestedOwner" TEXT NOT NULL,
  "requiredApprovals" JSONB NOT NULL,
  "deterministicChecksum" TEXT NOT NULL,
  "reviewed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsRecommendation_workspaceId_createdAt_idx" ON "GbaOperationsRecommendation" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaOperationsRecommendation_organizationId_createdAt_idx" ON "GbaOperationsRecommendation" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaOperationsRecommendation_category_createdAt_idx" ON "GbaOperationsRecommendation" ("category", "createdAt" DESC);
CREATE INDEX "GbaOperationsRecommendation_reviewed_createdAt_idx" ON "GbaOperationsRecommendation" ("reviewed", "createdAt" DESC);
CREATE INDEX "GbaOperationsRecommendation_deterministicChecksum_idx" ON "GbaOperationsRecommendation" ("deterministicChecksum");

CREATE TABLE "GbaOperationsRecommendationReview" (
  "operationsRecommendationReviewId" TEXT PRIMARY KEY,
  "operationsRecommendationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "notes" TEXT,
  "reviewedBy" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaOperationsRecommendationReview" ("workspaceId", "reviewedAt" DESC);
CREATE INDEX "GbaOperationsRecommendationReview_operationsRecommendationId_reviewedAt_idx" ON "GbaOperationsRecommendationReview" ("operationsRecommendationId", "reviewedAt" DESC);
CREATE INDEX "GbaOperationsRecommendationReview_immutableLineage_idx" ON "GbaOperationsRecommendationReview" ("immutableLineage");

CREATE TABLE "GbaOperationsVendorMetric" (
  "vendorMetricId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "onTimeDeliveryRate" DOUBLE PRECISION NOT NULL,
  "qualityAcceptanceRate" DOUBLE PRECISION NOT NULL,
  "averageLeadTimeDays" DOUBLE PRECISION NOT NULL,
  "costVariancePercent" DOUBLE PRECISION NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsVendorMetric_workspaceId_measuredAt_idx" ON "GbaOperationsVendorMetric" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsVendorMetric_organizationId_measuredAt_idx" ON "GbaOperationsVendorMetric" ("organizationId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsVendorMetric_vendorId_measuredAt_idx" ON "GbaOperationsVendorMetric" ("vendorId", "measuredAt" DESC);

CREATE TABLE "GbaOperationsVendorMetricHistory" (
  "vendorMetricHistoryId" TEXT PRIMARY KEY,
  "vendorMetricId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "onTimeDeliveryRate" DOUBLE PRECISION NOT NULL,
  "qualityAcceptanceRate" DOUBLE PRECISION NOT NULL,
  "averageLeadTimeDays" DOUBLE PRECISION NOT NULL,
  "costVariancePercent" DOUBLE PRECISION NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsVendorMetricHistory_workspaceId_measuredAt_idx" ON "GbaOperationsVendorMetricHistory" ("workspaceId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsVendorMetricHistory_vendorMetricId_measuredAt_idx" ON "GbaOperationsVendorMetricHistory" ("vendorMetricId", "measuredAt" DESC);
CREATE INDEX "GbaOperationsVendorMetricHistory_immutableLineage_idx" ON "GbaOperationsVendorMetricHistory" ("immutableLineage");

CREATE TABLE "GbaOperationsTimelineEvent" (
  "operationsTimelineEventId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GbaOperationsTimelineEvent_workspaceId_createdAt_idx" ON "GbaOperationsTimelineEvent" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaOperationsTimelineEvent_organizationId_createdAt_idx" ON "GbaOperationsTimelineEvent" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaOperationsTimelineEvent_eventType_createdAt_idx" ON "GbaOperationsTimelineEvent" ("eventType", "createdAt" DESC);

CREATE TABLE "GbaOperationsHealth" (
  "operationsHealthId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "blockedWorkOrderCount" INTEGER NOT NULL,
  "lowStockSkuCount" INTEGER NOT NULL,
  "delayedShipmentCount" INTEGER NOT NULL,
  "overCapacitySignalCount" INTEGER NOT NULL,
  "unreviewedRecommendationCount" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsHealth_workspaceId_generatedAt_idx" ON "GbaOperationsHealth" ("workspaceId", "generatedAt" DESC);
CREATE INDEX "GbaOperationsHealth_organizationId_generatedAt_idx" ON "GbaOperationsHealth" ("organizationId", "generatedAt" DESC);
CREATE INDEX "GbaOperationsHealth_status_generatedAt_idx" ON "GbaOperationsHealth" ("status", "generatedAt" DESC);

CREATE TABLE "GbaOperationsExecutiveSummary" (
  "summaryId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "kpiRollups" JSONB NOT NULL,
  "exceptions" JSONB NOT NULL,
  "risks" JSONB NOT NULL,
  "opportunities" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableLineage" TEXT NOT NULL
);
CREATE INDEX "GbaOperationsExecutiveSummary_workspaceId_createdAt_idx" ON "GbaOperationsExecutiveSummary" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GbaOperationsExecutiveSummary_organizationId_createdAt_idx" ON "GbaOperationsExecutiveSummary" ("organizationId", "createdAt" DESC);
CREATE INDEX "GbaOperationsExecutiveSummary_period_createdAt_idx" ON "GbaOperationsExecutiveSummary" ("period", "createdAt" DESC);
