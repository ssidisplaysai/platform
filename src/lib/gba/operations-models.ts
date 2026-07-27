import { geaId, nowIso, stableChecksum, stableStringify } from "@/lib/gea/agent-models";

export type OperationsConfidence = "HIGH" | "MEDIUM" | "LOW";
export type OperationsPriority = "P1" | "P2" | "P3" | "P4";
export type OperationsStatus = "PLANNED" | "IN_PROGRESS" | "AT_RISK" | "BLOCKED" | "COMPLETE" | "CANCELLED";

export type OperationsScopeFilter = {
  facility?: string;
  region?: string;
  shift?: string;
  period?: string;
  projectId?: string;
};

export type OperationsMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  asOf: string;
  evidenceReferences: string[];
};

export type OperationsDashboard = {
  workspaceId: string;
  organizationId: string;
  filters: OperationsScopeFilter;
  manufacturing: OperationsMetric;
  warehouse: OperationsMetric;
  inventory: OperationsMetric;
  purchasing: OperationsMetric;
  logistics: OperationsMetric;
  shipping: OperationsMetric;
  receiving: OperationsMetric;
  production: OperationsMetric;
  vendorPerformance: OperationsMetric;
  capacity: OperationsMetric;
  fieldOperations: OperationsMetric;
  generatedAt: string;
  immutableLineage: string;
};

export type WorkOrder = {
  workOrderId: string;
  workspaceId: string;
  organizationId: string;
  title: string;
  status: OperationsStatus;
  priority: OperationsPriority;
  dueDate: string;
  dependencies: string[];
  assignedResources: string[];
  estimatedLaborHours: number;
  actualLaborHours: number;
  completionPercent: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type WorkOrderHistoryRecord = {
  workOrderHistoryId: string;
  workOrderId: string;
  workspaceId: string;
  organizationId: string;
  fromStatus: OperationsStatus;
  toStatus: OperationsStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ProductionScheduleRecord = {
  scheduleId: string;
  workspaceId: string;
  organizationId: string;
  queueName: string;
  machineId: string;
  shiftCode: string;
  sequence: number;
  plannedStartAt: string;
  plannedEndAt: string;
  plannedLaborHours: number;
  plannedUnits: number;
  bottleneckRisk: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
  immutableLineage: string;
};

export type InventoryRecord = {
  inventoryRecordId: string;
  workspaceId: string;
  organizationId: string;
  sku: string;
  itemType: "RAW_MATERIAL" | "COMPONENT" | "FINISHED_GOOD";
  onHandQuantity: number;
  allocatedQuantity: number;
  availableQuantity: number;
  safetyStock: number;
  reorderPoint: number;
  lotTrackingEnabled: boolean;
  serialTrackingEnabled: boolean;
  valuationAmount: number;
  agingDays: number;
  updatedAt: string;
  immutableLineage: string;
};

export type InventoryHistoryRecord = {
  inventoryHistoryId: string;
  inventoryRecordId: string;
  workspaceId: string;
  organizationId: string;
  movementType: "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT" | "COUNT";
  quantityDelta: number;
  resultingOnHand: number;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type WarehouseOperationRecord = {
  warehouseOperationId: string;
  workspaceId: string;
  organizationId: string;
  operationType: "RECEIVING" | "PUT_AWAY" | "PICKING" | "PACKING" | "SHIPPING" | "TRANSFER" | "CYCLE_COUNT";
  status: OperationsStatus;
  referenceId: string;
  zone: string;
  utilizationPercent: number;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type WarehouseHistoryRecord = {
  warehouseHistoryId: string;
  warehouseOperationId: string;
  workspaceId: string;
  organizationId: string;
  status: OperationsStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type PurchasingRecord = {
  purchasingId: string;
  workspaceId: string;
  organizationId: string;
  purchaseRequestId: string;
  purchaseOrderNumber: string;
  vendorId: string;
  status: OperationsStatus;
  leadTimeDays: number;
  deliveryDueDate: string;
  totalCostAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type PurchasingHistoryRecord = {
  purchasingHistoryId: string;
  purchasingId: string;
  workspaceId: string;
  organizationId: string;
  status: OperationsStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ShippingRecord = {
  shippingId: string;
  workspaceId: string;
  organizationId: string;
  shipmentType: "OUTBOUND" | "INBOUND" | "RETURN";
  carrier: string;
  trackingNumber: string;
  status: OperationsStatus;
  freightCostAmount: number;
  damageClaimOpen: boolean;
  estimatedDeliveryAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type ShippingHistoryRecord = {
  shippingHistoryId: string;
  shippingId: string;
  workspaceId: string;
  organizationId: string;
  status: OperationsStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type CapacityRecord = {
  capacityId: string;
  workspaceId: string;
  organizationId: string;
  machineUtilizationPercent: number;
  laborUtilizationPercent: number;
  productionCapacityUnits: number;
  availableHours: number;
  constrainedHours: number;
  forecastDemandUnits: number;
  bottleneckSummary: string;
  measuredAt: string;
  immutableLineage: string;
};

export type CapacityHistoryRecord = {
  capacityHistoryId: string;
  capacityId: string;
  workspaceId: string;
  organizationId: string;
  machineUtilizationPercent: number;
  laborUtilizationPercent: number;
  productionCapacityUnits: number;
  availableHours: number;
  constrainedHours: number;
  forecastDemandUnits: number;
  bottleneckSummary: string;
  measuredAt: string;
  immutableLineage: string;
};

export type OperationsKpiDefinition = {
  operationsKpiId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  target: number;
  unit: string;
  versionTag: string;
  owner: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
};

export type OperationsKpiHistoryRecord = {
  operationsKpiHistoryId: string;
  operationsKpiId: string;
  workspaceId: string;
  organizationId: string;
  measuredValue: number;
  trend: number;
  score: number;
  status: "ON_TRACK" | "AT_RISK" | "BEHIND";
  measuredAt: string;
  immutableLineage: string;
};

export type OperationsRecommendation = {
  operationsRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  category: "INVENTORY" | "PURCHASING" | "PRODUCTION" | "WAREHOUSE" | "LOGISTICS" | "LABOR" | "CAPACITY" | "VENDOR";
  title: string;
  summary: string;
  evidenceReferences: string[];
  businessImpact: string;
  priority: OperationsPriority;
  confidence: OperationsConfidence;
  suggestedOwner: string;
  requiredApprovals: string[];
  deterministicChecksum: string;
  reviewed: boolean;
  createdAt: string;
  immutableLineage: string;
};

export type OperationsRecommendationReview = {
  operationsRecommendationReviewId: string;
  operationsRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type VendorMetricRecord = {
  vendorMetricId: string;
  workspaceId: string;
  organizationId: string;
  vendorId: string;
  onTimeDeliveryRate: number;
  qualityAcceptanceRate: number;
  averageLeadTimeDays: number;
  costVariancePercent: number;
  measuredAt: string;
  immutableLineage: string;
};

export type VendorMetricHistoryRecord = {
  vendorMetricHistoryId: string;
  vendorMetricId: string;
  workspaceId: string;
  organizationId: string;
  onTimeDeliveryRate: number;
  qualityAcceptanceRate: number;
  averageLeadTimeDays: number;
  costVariancePercent: number;
  measuredAt: string;
  immutableLineage: string;
};

export type OperationsTimelineEvent = {
  operationsTimelineEventId: string;
  workspaceId: string;
  organizationId: string;
  eventType:
    | "WORK_ORDER_CREATED"
    | "WORK_ORDER_UPDATED"
    | "SCHEDULE_RECORDED"
    | "INVENTORY_UPDATED"
    | "WAREHOUSE_UPDATED"
    | "PURCHASING_UPDATED"
    | "SHIPPING_UPDATED"
    | "CAPACITY_RECORDED"
    | "KPI_RECORDED"
    | "RECOMMENDATION_CREATED"
    | "RECOMMENDATION_REVIEWED"
    | "EXECUTIVE_REPORT_PUBLISHED";
  subjectId: string;
  summary: string;
  actorId: string;
  evidenceReferences: string[];
  createdAt: string;
};

export type OperationsHealthSnapshot = {
  operationsHealthId: string;
  workspaceId: string;
  organizationId: string;
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  blockedWorkOrderCount: number;
  lowStockSkuCount: number;
  delayedShipmentCount: number;
  overCapacitySignalCount: number;
  unreviewedRecommendationCount: number;
  generatedAt: string;
  immutableLineage: string;
};

export type OperationsExecutiveSummary = {
  summaryId: string;
  workspaceId: string;
  organizationId: string;
  period: "DAILY" | "WEEKLY";
  kpiRollups: string[];
  exceptions: string[];
  risks: string[];
  opportunities: string[];
  createdAt: string;
  immutableLineage: string;
};

export function createOperationsIds() {
  return {
    workOrderId: geaId("gbaopswo"),
    workOrderHistoryId: geaId("gbaopswoh"),
    scheduleId: geaId("gbaopssched"),
    inventoryRecordId: geaId("gbaopsinv"),
    inventoryHistoryId: geaId("gbaopsinvh"),
    warehouseOperationId: geaId("gbaopswh"),
    warehouseHistoryId: geaId("gbaopswhh"),
    purchasingId: geaId("gbaopspo"),
    purchasingHistoryId: geaId("gbaopspoh"),
    shippingId: geaId("gbaopsship"),
    shippingHistoryId: geaId("gbaopsshiph"),
    capacityId: geaId("gbaopscap"),
    capacityHistoryId: geaId("gbaopscaph"),
    operationsKpiId: geaId("gbaopskpi"),
    operationsKpiHistoryId: geaId("gbaopskpih"),
    operationsRecommendationId: geaId("gbaopsrec"),
    operationsRecommendationReviewId: geaId("gbaopsrecr"),
    vendorMetricId: geaId("gbaopsvend"),
    vendorMetricHistoryId: geaId("gbaopsvendh"),
    operationsTimelineEventId: geaId("gbaopstime"),
    operationsHealthId: geaId("gbaopshealth"),
    summaryId: geaId("gbaopssum"),
  };
}

export function gbaOpsNowIso(): string {
  return nowIso();
}

export function gbaOpsChecksum(value: unknown): string {
  return stableChecksum(value);
}

export function canonicalizeOperationsRecommendation(
  input: Pick<OperationsRecommendation, "category" | "title" | "summary" | "evidenceReferences" | "businessImpact" | "priority" | "confidence" | "suggestedOwner" | "requiredApprovals">,
): string {
  return stableStringify({
    ...input,
    evidenceReferences: [...input.evidenceReferences].sort((a, b) => a.localeCompare(b)),
    requiredApprovals: [...input.requiredApprovals].sort((a, b) => a.localeCompare(b)),
  });
}

export function createOperationsImmutableLineage(input: Record<string, unknown>): string {
  return stableChecksum(input);
}
