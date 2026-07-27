import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  CapacityHistoryRecord,
  CapacityRecord,
  InventoryHistoryRecord,
  InventoryRecord,
  OperationsExecutiveSummary,
  OperationsHealthSnapshot,
  OperationsKpiDefinition,
  OperationsKpiHistoryRecord,
  OperationsRecommendation,
  OperationsRecommendationReview,
  OperationsTimelineEvent,
  ProductionScheduleRecord,
  PurchasingHistoryRecord,
  PurchasingRecord,
  ShippingHistoryRecord,
  ShippingRecord,
  VendorMetricHistoryRecord,
  VendorMetricRecord,
  WarehouseHistoryRecord,
  WarehouseOperationRecord,
  WorkOrder,
  WorkOrderHistoryRecord,
} from "./operations-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type OperationsRepository = {
  saveWorkOrder: (workOrder: WorkOrder) => Promise<WorkOrder>;
  listWorkOrders: (workspaceId: string) => Promise<WorkOrder[]>;
  saveWorkOrderHistory: (record: WorkOrderHistoryRecord) => Promise<WorkOrderHistoryRecord>;
  listWorkOrderHistory: (workspaceId: string, workOrderId?: string) => Promise<WorkOrderHistoryRecord[]>;

  saveProductionSchedule: (record: ProductionScheduleRecord) => Promise<ProductionScheduleRecord>;
  listProductionSchedules: (workspaceId: string) => Promise<ProductionScheduleRecord[]>;

  saveInventory: (record: InventoryRecord) => Promise<InventoryRecord>;
  listInventory: (workspaceId: string) => Promise<InventoryRecord[]>;
  saveInventoryHistory: (record: InventoryHistoryRecord) => Promise<InventoryHistoryRecord>;
  listInventoryHistory: (workspaceId: string, inventoryRecordId?: string) => Promise<InventoryHistoryRecord[]>;

  saveWarehouseOperation: (record: WarehouseOperationRecord) => Promise<WarehouseOperationRecord>;
  listWarehouseOperations: (workspaceId: string) => Promise<WarehouseOperationRecord[]>;
  saveWarehouseHistory: (record: WarehouseHistoryRecord) => Promise<WarehouseHistoryRecord>;
  listWarehouseHistory: (workspaceId: string, warehouseOperationId?: string) => Promise<WarehouseHistoryRecord[]>;

  savePurchasing: (record: PurchasingRecord) => Promise<PurchasingRecord>;
  listPurchasing: (workspaceId: string) => Promise<PurchasingRecord[]>;
  savePurchasingHistory: (record: PurchasingHistoryRecord) => Promise<PurchasingHistoryRecord>;
  listPurchasingHistory: (workspaceId: string, purchasingId?: string) => Promise<PurchasingHistoryRecord[]>;

  saveShipping: (record: ShippingRecord) => Promise<ShippingRecord>;
  listShipping: (workspaceId: string) => Promise<ShippingRecord[]>;
  saveShippingHistory: (record: ShippingHistoryRecord) => Promise<ShippingHistoryRecord>;
  listShippingHistory: (workspaceId: string, shippingId?: string) => Promise<ShippingHistoryRecord[]>;

  saveCapacity: (record: CapacityRecord) => Promise<CapacityRecord>;
  listCapacity: (workspaceId: string) => Promise<CapacityRecord[]>;
  saveCapacityHistory: (record: CapacityHistoryRecord) => Promise<CapacityHistoryRecord>;
  listCapacityHistory: (workspaceId: string, capacityId?: string) => Promise<CapacityHistoryRecord[]>;

  saveOperationsKpi: (record: OperationsKpiDefinition) => Promise<OperationsKpiDefinition>;
  listOperationsKpis: (workspaceId: string) => Promise<OperationsKpiDefinition[]>;
  saveOperationsKpiHistory: (record: OperationsKpiHistoryRecord) => Promise<OperationsKpiHistoryRecord>;
  listOperationsKpiHistory: (workspaceId: string, operationsKpiId?: string) => Promise<OperationsKpiHistoryRecord[]>;

  saveRecommendation: (record: OperationsRecommendation) => Promise<OperationsRecommendation>;
  listRecommendations: (workspaceId: string) => Promise<OperationsRecommendation[]>;
  saveRecommendationReview: (record: OperationsRecommendationReview) => Promise<OperationsRecommendationReview>;
  listRecommendationReviews: (workspaceId: string, operationsRecommendationId?: string) => Promise<OperationsRecommendationReview[]>;

  saveVendorMetric: (record: VendorMetricRecord) => Promise<VendorMetricRecord>;
  listVendorMetrics: (workspaceId: string) => Promise<VendorMetricRecord[]>;
  saveVendorMetricHistory: (record: VendorMetricHistoryRecord) => Promise<VendorMetricHistoryRecord>;
  listVendorMetricHistory: (workspaceId: string, vendorMetricId?: string) => Promise<VendorMetricHistoryRecord[]>;

  saveTimelineEvent: (record: OperationsTimelineEvent) => Promise<OperationsTimelineEvent>;
  listTimeline: (workspaceId: string) => Promise<OperationsTimelineEvent[]>;

  saveHealth: (record: OperationsHealthSnapshot) => Promise<OperationsHealthSnapshot>;
  listHealth: (workspaceId: string) => Promise<OperationsHealthSnapshot[]>;

  saveExecutiveSummary: (record: OperationsExecutiveSummary) => Promise<OperationsExecutiveSummary>;
  listExecutiveSummaries: (workspaceId: string) => Promise<OperationsExecutiveSummary[]>;
};

export function createInMemoryOperationsRepository(): OperationsRepository {
  const workOrders = new Map<string, WorkOrder>();
  const workOrderHistory = new Map<string, WorkOrderHistoryRecord>();
  const productionSchedules = new Map<string, ProductionScheduleRecord>();
  const inventory = new Map<string, InventoryRecord>();
  const inventoryHistory = new Map<string, InventoryHistoryRecord>();
  const warehouse = new Map<string, WarehouseOperationRecord>();
  const warehouseHistory = new Map<string, WarehouseHistoryRecord>();
  const purchasing = new Map<string, PurchasingRecord>();
  const purchasingHistory = new Map<string, PurchasingHistoryRecord>();
  const shipping = new Map<string, ShippingRecord>();
  const shippingHistory = new Map<string, ShippingHistoryRecord>();
  const capacity = new Map<string, CapacityRecord>();
  const capacityHistory = new Map<string, CapacityHistoryRecord>();
  const kpis = new Map<string, OperationsKpiDefinition>();
  const kpiHistory = new Map<string, OperationsKpiHistoryRecord>();
  const recommendations = new Map<string, OperationsRecommendation>();
  const recommendationReviews = new Map<string, OperationsRecommendationReview>();
  const vendorMetrics = new Map<string, VendorMetricRecord>();
  const vendorMetricHistory = new Map<string, VendorMetricHistoryRecord>();
  const timeline = new Map<string, OperationsTimelineEvent>();
  const health = new Map<string, OperationsHealthSnapshot>();
  const summaries = new Map<string, OperationsExecutiveSummary>();

  return {
    async saveWorkOrder(entry) { workOrders.set(entry.workOrderId, entry); return entry; },
    async listWorkOrders(workspaceId) { return [...workOrders.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveWorkOrderHistory(entry) { workOrderHistory.set(entry.workOrderHistoryId, entry); return entry; },
    async listWorkOrderHistory(workspaceId, workOrderId) {
      const rows = [...workOrderHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = workOrderId ? rows.filter((entry) => entry.workOrderId === workOrderId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveProductionSchedule(entry) { productionSchedules.set(entry.scheduleId, entry); return entry; },
    async listProductionSchedules(workspaceId) { return [...productionSchedules.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => a.sequence - b.sequence); },

    async saveInventory(entry) { inventory.set(entry.inventoryRecordId, entry); return entry; },
    async listInventory(workspaceId) { return [...inventory.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveInventoryHistory(entry) { inventoryHistory.set(entry.inventoryHistoryId, entry); return entry; },
    async listInventoryHistory(workspaceId, inventoryRecordId) {
      const rows = [...inventoryHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = inventoryRecordId ? rows.filter((entry) => entry.inventoryRecordId === inventoryRecordId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveWarehouseOperation(entry) { warehouse.set(entry.warehouseOperationId, entry); return entry; },
    async listWarehouseOperations(workspaceId) { return [...warehouse.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveWarehouseHistory(entry) { warehouseHistory.set(entry.warehouseHistoryId, entry); return entry; },
    async listWarehouseHistory(workspaceId, warehouseOperationId) {
      const rows = [...warehouseHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = warehouseOperationId ? rows.filter((entry) => entry.warehouseOperationId === warehouseOperationId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async savePurchasing(entry) { purchasing.set(entry.purchasingId, entry); return entry; },
    async listPurchasing(workspaceId) { return [...purchasing.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async savePurchasingHistory(entry) { purchasingHistory.set(entry.purchasingHistoryId, entry); return entry; },
    async listPurchasingHistory(workspaceId, purchasingId) {
      const rows = [...purchasingHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = purchasingId ? rows.filter((entry) => entry.purchasingId === purchasingId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveShipping(entry) { shipping.set(entry.shippingId, entry); return entry; },
    async listShipping(workspaceId) { return [...shipping.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveShippingHistory(entry) { shippingHistory.set(entry.shippingHistoryId, entry); return entry; },
    async listShippingHistory(workspaceId, shippingId) {
      const rows = [...shippingHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = shippingId ? rows.filter((entry) => entry.shippingId === shippingId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveCapacity(entry) { capacity.set(entry.capacityId, entry); return entry; },
    async listCapacity(workspaceId) { return [...capacity.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },
    async saveCapacityHistory(entry) { capacityHistory.set(entry.capacityHistoryId, entry); return entry; },
    async listCapacityHistory(workspaceId, capacityId) {
      const rows = [...capacityHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = capacityId ? rows.filter((entry) => entry.capacityId === capacityId) : rows;
      return scoped.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    },

    async saveOperationsKpi(entry) { kpis.set(entry.operationsKpiId, entry); return entry; },
    async listOperationsKpis(workspaceId) { return [...kpis.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveOperationsKpiHistory(entry) { kpiHistory.set(entry.operationsKpiHistoryId, entry); return entry; },
    async listOperationsKpiHistory(workspaceId, operationsKpiId) {
      const rows = [...kpiHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = operationsKpiId ? rows.filter((entry) => entry.operationsKpiId === operationsKpiId) : rows;
      return scoped.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    },

    async saveRecommendation(entry) { recommendations.set(entry.operationsRecommendationId, entry); return entry; },
    async listRecommendations(workspaceId) { return [...recommendations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async saveRecommendationReview(entry) { recommendationReviews.set(entry.operationsRecommendationReviewId, entry); return entry; },
    async listRecommendationReviews(workspaceId, operationsRecommendationId) {
      const rows = [...recommendationReviews.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = operationsRecommendationId ? rows.filter((entry) => entry.operationsRecommendationId === operationsRecommendationId) : rows;
      return scoped.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    },

    async saveVendorMetric(entry) { vendorMetrics.set(entry.vendorMetricId, entry); return entry; },
    async listVendorMetrics(workspaceId) { return [...vendorMetrics.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },
    async saveVendorMetricHistory(entry) { vendorMetricHistory.set(entry.vendorMetricHistoryId, entry); return entry; },
    async listVendorMetricHistory(workspaceId, vendorMetricId) {
      const rows = [...vendorMetricHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = vendorMetricId ? rows.filter((entry) => entry.vendorMetricId === vendorMetricId) : rows;
      return scoped.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    },

    async saveTimelineEvent(entry) { timeline.set(entry.operationsTimelineEventId, entry); return entry; },
    async listTimeline(workspaceId) { return [...timeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveHealth(entry) { health.set(entry.operationsHealthId, entry); return entry; },
    async listHealth(workspaceId) { return [...health.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)); },

    async saveExecutiveSummary(entry) { summaries.set(entry.summaryId, entry); return entry; },
    async listExecutiveSummaries(workspaceId) { return [...summaries.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  };
}

export function createPrismaOperationsRepository(prismaClient?: PrismaClient): OperationsRepository {
  const prisma = prismaClient ?? getPrismaClient();

  return {
    async saveWorkOrder(entry) {
      await prisma.gbaOperationsWorkOrder.upsert({
        where: { workOrderId: entry.workOrderId },
        create: {
          workOrderId: entry.workOrderId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          title: entry.title,
          status: entry.status,
          priority: entry.priority,
          dueDate: new Date(entry.dueDate),
          dependencies: toJson(entry.dependencies),
          assignedResources: toJson(entry.assignedResources),
          estimatedLaborHours: entry.estimatedLaborHours,
          actualLaborHours: entry.actualLaborHours,
          completionPercent: entry.completionPercent,
          createdBy: entry.createdBy,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          title: entry.title,
          status: entry.status,
          priority: entry.priority,
          dueDate: new Date(entry.dueDate),
          dependencies: toJson(entry.dependencies),
          assignedResources: toJson(entry.assignedResources),
          estimatedLaborHours: entry.estimatedLaborHours,
          actualLaborHours: entry.actualLaborHours,
          completionPercent: entry.completionPercent,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listWorkOrders(workspaceId) {
      const rows = await prisma.gbaOperationsWorkOrder.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        workOrderId: row.workOrderId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        title: row.title,
        status: row.status as WorkOrder["status"],
        priority: row.priority as WorkOrder["priority"],
        dueDate: row.dueDate.toISOString(),
        dependencies: row.dependencies as string[],
        assignedResources: row.assignedResources as string[],
        estimatedLaborHours: row.estimatedLaborHours,
        actualLaborHours: row.actualLaborHours,
        completionPercent: row.completionPercent,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveWorkOrderHistory(entry) {
      await prisma.gbaOperationsWorkOrderHistory.upsert({
        where: { workOrderHistoryId: entry.workOrderHistoryId },
        create: {
          workOrderHistoryId: entry.workOrderHistoryId,
          workOrderId: entry.workOrderId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listWorkOrderHistory(workspaceId, workOrderId) {
      const rows = await prisma.gbaOperationsWorkOrderHistory.findMany({
        where: { workspaceId, ...(workOrderId ? { workOrderId } : {}) },
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        workOrderHistoryId: row.workOrderHistoryId,
        workOrderId: row.workOrderId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        fromStatus: row.fromStatus as WorkOrderHistoryRecord["fromStatus"],
        toStatus: row.toStatus as WorkOrderHistoryRecord["toStatus"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveProductionSchedule(entry) {
      await prisma.gbaOperationsProductionSchedule.upsert({
        where: { scheduleId: entry.scheduleId },
        create: {
          scheduleId: entry.scheduleId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          queueName: entry.queueName,
          machineId: entry.machineId,
          shiftCode: entry.shiftCode,
          sequence: entry.sequence,
          plannedStartAt: new Date(entry.plannedStartAt),
          plannedEndAt: new Date(entry.plannedEndAt),
          plannedLaborHours: entry.plannedLaborHours,
          plannedUnits: entry.plannedUnits,
          bottleneckRisk: entry.bottleneckRisk,
          createdAt: new Date(entry.createdAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          sequence: entry.sequence,
          plannedStartAt: new Date(entry.plannedStartAt),
          plannedEndAt: new Date(entry.plannedEndAt),
          plannedLaborHours: entry.plannedLaborHours,
          plannedUnits: entry.plannedUnits,
          bottleneckRisk: entry.bottleneckRisk,
        },
      });
      return entry;
    },
    async listProductionSchedules(workspaceId) {
      const rows = await prisma.gbaOperationsProductionSchedule.findMany({ where: { workspaceId }, orderBy: { sequence: "asc" } });
      return rows.map((row) => ({
        scheduleId: row.scheduleId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        queueName: row.queueName,
        machineId: row.machineId,
        shiftCode: row.shiftCode,
        sequence: row.sequence,
        plannedStartAt: row.plannedStartAt.toISOString(),
        plannedEndAt: row.plannedEndAt.toISOString(),
        plannedLaborHours: row.plannedLaborHours,
        plannedUnits: row.plannedUnits,
        bottleneckRisk: row.bottleneckRisk as ProductionScheduleRecord["bottleneckRisk"],
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveInventory(entry) {
      await prisma.gbaOperationsInventoryRecord.upsert({
        where: { inventoryRecordId: entry.inventoryRecordId },
        create: {
          inventoryRecordId: entry.inventoryRecordId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          sku: entry.sku,
          itemType: entry.itemType,
          onHandQuantity: entry.onHandQuantity,
          allocatedQuantity: entry.allocatedQuantity,
          availableQuantity: entry.availableQuantity,
          safetyStock: entry.safetyStock,
          reorderPoint: entry.reorderPoint,
          lotTrackingEnabled: entry.lotTrackingEnabled,
          serialTrackingEnabled: entry.serialTrackingEnabled,
          valuationAmount: entry.valuationAmount,
          agingDays: entry.agingDays,
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          onHandQuantity: entry.onHandQuantity,
          allocatedQuantity: entry.allocatedQuantity,
          availableQuantity: entry.availableQuantity,
          safetyStock: entry.safetyStock,
          reorderPoint: entry.reorderPoint,
          lotTrackingEnabled: entry.lotTrackingEnabled,
          serialTrackingEnabled: entry.serialTrackingEnabled,
          valuationAmount: entry.valuationAmount,
          agingDays: entry.agingDays,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listInventory(workspaceId) {
      const rows = await prisma.gbaOperationsInventoryRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        inventoryRecordId: row.inventoryRecordId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        sku: row.sku,
        itemType: row.itemType as InventoryRecord["itemType"],
        onHandQuantity: row.onHandQuantity,
        allocatedQuantity: row.allocatedQuantity,
        availableQuantity: row.availableQuantity,
        safetyStock: row.safetyStock,
        reorderPoint: row.reorderPoint,
        lotTrackingEnabled: row.lotTrackingEnabled,
        serialTrackingEnabled: row.serialTrackingEnabled,
        valuationAmount: row.valuationAmount,
        agingDays: row.agingDays,
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveInventoryHistory(entry) {
      await prisma.gbaOperationsInventoryHistory.upsert({
        where: { inventoryHistoryId: entry.inventoryHistoryId },
        create: {
          inventoryHistoryId: entry.inventoryHistoryId,
          inventoryRecordId: entry.inventoryRecordId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          movementType: entry.movementType,
          quantityDelta: entry.quantityDelta,
          resultingOnHand: entry.resultingOnHand,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          movementType: entry.movementType,
          quantityDelta: entry.quantityDelta,
          resultingOnHand: entry.resultingOnHand,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listInventoryHistory(workspaceId, inventoryRecordId) {
      const rows = await prisma.gbaOperationsInventoryHistory.findMany({
        where: { workspaceId, ...(inventoryRecordId ? { inventoryRecordId } : {}) },
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        inventoryHistoryId: row.inventoryHistoryId,
        inventoryRecordId: row.inventoryRecordId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        movementType: row.movementType as InventoryHistoryRecord["movementType"],
        quantityDelta: row.quantityDelta,
        resultingOnHand: row.resultingOnHand,
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveWarehouseOperation(entry) {
      await prisma.gbaOperationsWarehouseOperation.upsert({
        where: { warehouseOperationId: entry.warehouseOperationId },
        create: {
          warehouseOperationId: entry.warehouseOperationId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          operationType: entry.operationType,
          status: entry.status,
          referenceId: entry.referenceId,
          zone: entry.zone,
          utilizationPercent: entry.utilizationPercent,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          referenceId: entry.referenceId,
          zone: entry.zone,
          utilizationPercent: entry.utilizationPercent,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listWarehouseOperations(workspaceId) {
      const rows = await prisma.gbaOperationsWarehouseOperation.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        warehouseOperationId: row.warehouseOperationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        operationType: row.operationType as WarehouseOperationRecord["operationType"],
        status: row.status as WarehouseOperationRecord["status"],
        referenceId: row.referenceId,
        zone: row.zone,
        utilizationPercent: row.utilizationPercent,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveWarehouseHistory(entry) {
      await prisma.gbaOperationsWarehouseHistory.upsert({
        where: { warehouseHistoryId: entry.warehouseHistoryId },
        create: {
          warehouseHistoryId: entry.warehouseHistoryId,
          warehouseOperationId: entry.warehouseOperationId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listWarehouseHistory(workspaceId, warehouseOperationId) {
      const rows = await prisma.gbaOperationsWarehouseHistory.findMany({
        where: { workspaceId, ...(warehouseOperationId ? { warehouseOperationId } : {}) },
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        warehouseHistoryId: row.warehouseHistoryId,
        warehouseOperationId: row.warehouseOperationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as WarehouseHistoryRecord["status"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async savePurchasing(entry) {
      await prisma.gbaOperationsPurchasingRecord.upsert({
        where: { purchasingId: entry.purchasingId },
        create: {
          purchasingId: entry.purchasingId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          purchaseRequestId: entry.purchaseRequestId,
          purchaseOrderNumber: entry.purchaseOrderNumber,
          vendorId: entry.vendorId,
          status: entry.status,
          leadTimeDays: entry.leadTimeDays,
          deliveryDueDate: new Date(entry.deliveryDueDate),
          totalCostAmount: entry.totalCostAmount,
          currency: entry.currency,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          leadTimeDays: entry.leadTimeDays,
          deliveryDueDate: new Date(entry.deliveryDueDate),
          totalCostAmount: entry.totalCostAmount,
          currency: entry.currency,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listPurchasing(workspaceId) {
      const rows = await prisma.gbaOperationsPurchasingRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        purchasingId: row.purchasingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        purchaseRequestId: row.purchaseRequestId,
        purchaseOrderNumber: row.purchaseOrderNumber,
        vendorId: row.vendorId,
        status: row.status as PurchasingRecord["status"],
        leadTimeDays: row.leadTimeDays,
        deliveryDueDate: row.deliveryDueDate.toISOString(),
        totalCostAmount: row.totalCostAmount,
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async savePurchasingHistory(entry) {
      await prisma.gbaOperationsPurchasingHistory.upsert({
        where: { purchasingHistoryId: entry.purchasingHistoryId },
        create: {
          purchasingHistoryId: entry.purchasingHistoryId,
          purchasingId: entry.purchasingId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listPurchasingHistory(workspaceId, purchasingId) {
      const rows = await prisma.gbaOperationsPurchasingHistory.findMany({
        where: { workspaceId, ...(purchasingId ? { purchasingId } : {}) },
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        purchasingHistoryId: row.purchasingHistoryId,
        purchasingId: row.purchasingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as PurchasingHistoryRecord["status"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveShipping(entry) {
      await prisma.gbaOperationsShippingRecord.upsert({
        where: { shippingId: entry.shippingId },
        create: {
          shippingId: entry.shippingId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          shipmentType: entry.shipmentType,
          carrier: entry.carrier,
          trackingNumber: entry.trackingNumber,
          status: entry.status,
          freightCostAmount: entry.freightCostAmount,
          damageClaimOpen: entry.damageClaimOpen,
          estimatedDeliveryAt: entry.estimatedDeliveryAt ? new Date(entry.estimatedDeliveryAt) : null,
          deliveredAt: entry.deliveredAt ? new Date(entry.deliveredAt) : null,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          freightCostAmount: entry.freightCostAmount,
          damageClaimOpen: entry.damageClaimOpen,
          estimatedDeliveryAt: entry.estimatedDeliveryAt ? new Date(entry.estimatedDeliveryAt) : null,
          deliveredAt: entry.deliveredAt ? new Date(entry.deliveredAt) : null,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listShipping(workspaceId) {
      const rows = await prisma.gbaOperationsShippingRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        shippingId: row.shippingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        shipmentType: row.shipmentType as ShippingRecord["shipmentType"],
        carrier: row.carrier,
        trackingNumber: row.trackingNumber,
        status: row.status as ShippingRecord["status"],
        freightCostAmount: row.freightCostAmount,
        damageClaimOpen: row.damageClaimOpen,
        estimatedDeliveryAt: row.estimatedDeliveryAt?.toISOString(),
        deliveredAt: row.deliveredAt?.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveShippingHistory(entry) {
      await prisma.gbaOperationsShippingHistory.upsert({
        where: { shippingHistoryId: entry.shippingHistoryId },
        create: {
          shippingHistoryId: entry.shippingHistoryId,
          shippingId: entry.shippingId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listShippingHistory(workspaceId, shippingId) {
      const rows = await prisma.gbaOperationsShippingHistory.findMany({
        where: { workspaceId, ...(shippingId ? { shippingId } : {}) },
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        shippingHistoryId: row.shippingHistoryId,
        shippingId: row.shippingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as ShippingHistoryRecord["status"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveCapacity(entry) {
      await prisma.gbaOperationsCapacityRecord.upsert({
        where: { capacityId: entry.capacityId },
        create: {
          capacityId: entry.capacityId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          machineUtilizationPercent: entry.machineUtilizationPercent,
          laborUtilizationPercent: entry.laborUtilizationPercent,
          productionCapacityUnits: entry.productionCapacityUnits,
          availableHours: entry.availableHours,
          constrainedHours: entry.constrainedHours,
          forecastDemandUnits: entry.forecastDemandUnits,
          bottleneckSummary: entry.bottleneckSummary,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          machineUtilizationPercent: entry.machineUtilizationPercent,
          laborUtilizationPercent: entry.laborUtilizationPercent,
          productionCapacityUnits: entry.productionCapacityUnits,
          availableHours: entry.availableHours,
          constrainedHours: entry.constrainedHours,
          forecastDemandUnits: entry.forecastDemandUnits,
          bottleneckSummary: entry.bottleneckSummary,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listCapacity(workspaceId) {
      const rows = await prisma.gbaOperationsCapacityRecord.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        capacityId: row.capacityId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        machineUtilizationPercent: row.machineUtilizationPercent,
        laborUtilizationPercent: row.laborUtilizationPercent,
        productionCapacityUnits: row.productionCapacityUnits,
        availableHours: row.availableHours,
        constrainedHours: row.constrainedHours,
        forecastDemandUnits: row.forecastDemandUnits,
        bottleneckSummary: row.bottleneckSummary,
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveCapacityHistory(entry) {
      await prisma.gbaOperationsCapacityHistory.upsert({
        where: { capacityHistoryId: entry.capacityHistoryId },
        create: {
          capacityHistoryId: entry.capacityHistoryId,
          capacityId: entry.capacityId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          machineUtilizationPercent: entry.machineUtilizationPercent,
          laborUtilizationPercent: entry.laborUtilizationPercent,
          productionCapacityUnits: entry.productionCapacityUnits,
          availableHours: entry.availableHours,
          constrainedHours: entry.constrainedHours,
          forecastDemandUnits: entry.forecastDemandUnits,
          bottleneckSummary: entry.bottleneckSummary,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          machineUtilizationPercent: entry.machineUtilizationPercent,
          laborUtilizationPercent: entry.laborUtilizationPercent,
          productionCapacityUnits: entry.productionCapacityUnits,
          availableHours: entry.availableHours,
          constrainedHours: entry.constrainedHours,
          forecastDemandUnits: entry.forecastDemandUnits,
          bottleneckSummary: entry.bottleneckSummary,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listCapacityHistory(workspaceId, capacityId) {
      const rows = await prisma.gbaOperationsCapacityHistory.findMany({ where: { workspaceId, ...(capacityId ? { capacityId } : {}) }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        capacityHistoryId: row.capacityHistoryId,
        capacityId: row.capacityId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        machineUtilizationPercent: row.machineUtilizationPercent,
        laborUtilizationPercent: row.laborUtilizationPercent,
        productionCapacityUnits: row.productionCapacityUnits,
        availableHours: row.availableHours,
        constrainedHours: row.constrainedHours,
        forecastDemandUnits: row.forecastDemandUnits,
        bottleneckSummary: row.bottleneckSummary,
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveOperationsKpi(entry) {
      await prisma.gbaOperationsKpi.upsert({
        where: { operationsKpiId: entry.operationsKpiId },
        create: {
          operationsKpiId: entry.operationsKpiId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          name: entry.name,
          target: entry.target,
          unit: entry.unit,
          versionTag: entry.versionTag,
          owner: entry.owner,
          evidenceReferences: toJson(entry.evidenceReferences),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        },
        update: {
          name: entry.name,
          target: entry.target,
          unit: entry.unit,
          versionTag: entry.versionTag,
          owner: entry.owner,
          evidenceReferences: toJson(entry.evidenceReferences),
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listOperationsKpis(workspaceId) {
      const rows = await prisma.gbaOperationsKpi.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        operationsKpiId: row.operationsKpiId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        name: row.name,
        target: row.target,
        unit: row.unit,
        versionTag: row.versionTag,
        owner: row.owner,
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async saveOperationsKpiHistory(entry) {
      await prisma.gbaOperationsKpiHistory.upsert({
        where: { operationsKpiHistoryId: entry.operationsKpiHistoryId },
        create: {
          operationsKpiHistoryId: entry.operationsKpiHistoryId,
          operationsKpiId: entry.operationsKpiId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          measuredValue: entry.measuredValue,
          trend: entry.trend,
          score: entry.score,
          status: entry.status,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          measuredValue: entry.measuredValue,
          trend: entry.trend,
          score: entry.score,
          status: entry.status,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listOperationsKpiHistory(workspaceId, operationsKpiId) {
      const rows = await prisma.gbaOperationsKpiHistory.findMany({ where: { workspaceId, ...(operationsKpiId ? { operationsKpiId } : {}) }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        operationsKpiHistoryId: row.operationsKpiHistoryId,
        operationsKpiId: row.operationsKpiId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        measuredValue: row.measuredValue,
        trend: row.trend,
        score: row.score,
        status: row.status as OperationsKpiHistoryRecord["status"],
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveRecommendation(entry) {
      await prisma.gbaOperationsRecommendation.upsert({
        where: { operationsRecommendationId: entry.operationsRecommendationId },
        create: {
          operationsRecommendationId: entry.operationsRecommendationId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          category: entry.category,
          title: entry.title,
          summary: entry.summary,
          evidenceReferences: toJson(entry.evidenceReferences),
          businessImpact: entry.businessImpact,
          priority: entry.priority,
          confidence: entry.confidence,
          suggestedOwner: entry.suggestedOwner,
          requiredApprovals: toJson(entry.requiredApprovals),
          deterministicChecksum: entry.deterministicChecksum,
          reviewed: entry.reviewed,
          createdAt: new Date(entry.createdAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          summary: entry.summary,
          evidenceReferences: toJson(entry.evidenceReferences),
          businessImpact: entry.businessImpact,
          priority: entry.priority,
          confidence: entry.confidence,
          suggestedOwner: entry.suggestedOwner,
          requiredApprovals: toJson(entry.requiredApprovals),
          deterministicChecksum: entry.deterministicChecksum,
          reviewed: entry.reviewed,
        },
      });
      return entry;
    },
    async listRecommendations(workspaceId) {
      const rows = await prisma.gbaOperationsRecommendation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        operationsRecommendationId: row.operationsRecommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        category: row.category as OperationsRecommendation["category"],
        title: row.title,
        summary: row.summary,
        evidenceReferences: row.evidenceReferences as string[],
        businessImpact: row.businessImpact,
        priority: row.priority as OperationsRecommendation["priority"],
        confidence: row.confidence as OperationsRecommendation["confidence"],
        suggestedOwner: row.suggestedOwner,
        requiredApprovals: row.requiredApprovals as string[],
        deterministicChecksum: row.deterministicChecksum,
        reviewed: row.reviewed,
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveRecommendationReview(entry) {
      await prisma.gbaOperationsRecommendationReview.upsert({
        where: { operationsRecommendationReviewId: entry.operationsRecommendationReviewId },
        create: {
          operationsRecommendationReviewId: entry.operationsRecommendationReviewId,
          operationsRecommendationId: entry.operationsRecommendationId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          decision: entry.decision,
          notes: entry.notes ?? null,
          reviewedBy: entry.reviewedBy,
          reviewedAt: new Date(entry.reviewedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          decision: entry.decision,
          notes: entry.notes ?? null,
          reviewedBy: entry.reviewedBy,
          reviewedAt: new Date(entry.reviewedAt),
        },
      });
      return entry;
    },
    async listRecommendationReviews(workspaceId, operationsRecommendationId) {
      const rows = await prisma.gbaOperationsRecommendationReview.findMany({ where: { workspaceId, ...(operationsRecommendationId ? { operationsRecommendationId } : {}) }, orderBy: { reviewedAt: "desc" } });
      return rows.map((row) => ({
        operationsRecommendationReviewId: row.operationsRecommendationReviewId,
        operationsRecommendationId: row.operationsRecommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        decision: row.decision as OperationsRecommendationReview["decision"],
        notes: row.notes ?? undefined,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveVendorMetric(entry) {
      await prisma.gbaOperationsVendorMetric.upsert({
        where: { vendorMetricId: entry.vendorMetricId },
        create: {
          vendorMetricId: entry.vendorMetricId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          vendorId: entry.vendorId,
          onTimeDeliveryRate: entry.onTimeDeliveryRate,
          qualityAcceptanceRate: entry.qualityAcceptanceRate,
          averageLeadTimeDays: entry.averageLeadTimeDays,
          costVariancePercent: entry.costVariancePercent,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          onTimeDeliveryRate: entry.onTimeDeliveryRate,
          qualityAcceptanceRate: entry.qualityAcceptanceRate,
          averageLeadTimeDays: entry.averageLeadTimeDays,
          costVariancePercent: entry.costVariancePercent,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listVendorMetrics(workspaceId) {
      const rows = await prisma.gbaOperationsVendorMetric.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        vendorMetricId: row.vendorMetricId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        vendorId: row.vendorId,
        onTimeDeliveryRate: row.onTimeDeliveryRate,
        qualityAcceptanceRate: row.qualityAcceptanceRate,
        averageLeadTimeDays: row.averageLeadTimeDays,
        costVariancePercent: row.costVariancePercent,
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveVendorMetricHistory(entry) {
      await prisma.gbaOperationsVendorMetricHistory.upsert({
        where: { vendorMetricHistoryId: entry.vendorMetricHistoryId },
        create: {
          vendorMetricHistoryId: entry.vendorMetricHistoryId,
          vendorMetricId: entry.vendorMetricId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          onTimeDeliveryRate: entry.onTimeDeliveryRate,
          qualityAcceptanceRate: entry.qualityAcceptanceRate,
          averageLeadTimeDays: entry.averageLeadTimeDays,
          costVariancePercent: entry.costVariancePercent,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          onTimeDeliveryRate: entry.onTimeDeliveryRate,
          qualityAcceptanceRate: entry.qualityAcceptanceRate,
          averageLeadTimeDays: entry.averageLeadTimeDays,
          costVariancePercent: entry.costVariancePercent,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listVendorMetricHistory(workspaceId, vendorMetricId) {
      const rows = await prisma.gbaOperationsVendorMetricHistory.findMany({ where: { workspaceId, ...(vendorMetricId ? { vendorMetricId } : {}) }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        vendorMetricHistoryId: row.vendorMetricHistoryId,
        vendorMetricId: row.vendorMetricId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        onTimeDeliveryRate: row.onTimeDeliveryRate,
        qualityAcceptanceRate: row.qualityAcceptanceRate,
        averageLeadTimeDays: row.averageLeadTimeDays,
        costVariancePercent: row.costVariancePercent,
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveTimelineEvent(entry) {
      await prisma.gbaOperationsTimelineEvent.upsert({
        where: { operationsTimelineEventId: entry.operationsTimelineEventId },
        create: {
          operationsTimelineEventId: entry.operationsTimelineEventId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          eventType: entry.eventType,
          subjectId: entry.subjectId,
          summary: entry.summary,
          actorId: entry.actorId,
          evidenceReferences: toJson(entry.evidenceReferences),
          createdAt: new Date(entry.createdAt),
        },
        update: {
          eventType: entry.eventType,
          subjectId: entry.subjectId,
          summary: entry.summary,
          actorId: entry.actorId,
          evidenceReferences: toJson(entry.evidenceReferences),
          createdAt: new Date(entry.createdAt),
        },
      });
      return entry;
    },
    async listTimeline(workspaceId) {
      const rows = await prisma.gbaOperationsTimelineEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        operationsTimelineEventId: row.operationsTimelineEventId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        eventType: row.eventType as OperationsTimelineEvent["eventType"],
        subjectId: row.subjectId,
        summary: row.summary,
        actorId: row.actorId,
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveHealth(entry) {
      await prisma.gbaOperationsHealth.upsert({
        where: { operationsHealthId: entry.operationsHealthId },
        create: {
          operationsHealthId: entry.operationsHealthId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          blockedWorkOrderCount: entry.blockedWorkOrderCount,
          lowStockSkuCount: entry.lowStockSkuCount,
          delayedShipmentCount: entry.delayedShipmentCount,
          overCapacitySignalCount: entry.overCapacitySignalCount,
          unreviewedRecommendationCount: entry.unreviewedRecommendationCount,
          generatedAt: new Date(entry.generatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          blockedWorkOrderCount: entry.blockedWorkOrderCount,
          lowStockSkuCount: entry.lowStockSkuCount,
          delayedShipmentCount: entry.delayedShipmentCount,
          overCapacitySignalCount: entry.overCapacitySignalCount,
          unreviewedRecommendationCount: entry.unreviewedRecommendationCount,
          generatedAt: new Date(entry.generatedAt),
        },
      });
      return entry;
    },
    async listHealth(workspaceId) {
      const rows = await prisma.gbaOperationsHealth.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({
        operationsHealthId: row.operationsHealthId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as OperationsHealthSnapshot["status"],
        blockedWorkOrderCount: row.blockedWorkOrderCount,
        lowStockSkuCount: row.lowStockSkuCount,
        delayedShipmentCount: row.delayedShipmentCount,
        overCapacitySignalCount: row.overCapacitySignalCount,
        unreviewedRecommendationCount: row.unreviewedRecommendationCount,
        generatedAt: row.generatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveExecutiveSummary(entry) {
      await prisma.gbaOperationsExecutiveSummary.upsert({
        where: { summaryId: entry.summaryId },
        create: {
          summaryId: entry.summaryId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          period: entry.period,
          kpiRollups: toJson(entry.kpiRollups),
          exceptions: toJson(entry.exceptions),
          risks: toJson(entry.risks),
          opportunities: toJson(entry.opportunities),
          createdAt: new Date(entry.createdAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          period: entry.period,
          kpiRollups: toJson(entry.kpiRollups),
          exceptions: toJson(entry.exceptions),
          risks: toJson(entry.risks),
          opportunities: toJson(entry.opportunities),
          createdAt: new Date(entry.createdAt),
        },
      });
      return entry;
    },
    async listExecutiveSummaries(workspaceId) {
      const rows = await prisma.gbaOperationsExecutiveSummary.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        summaryId: row.summaryId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        period: row.period as OperationsExecutiveSummary["period"],
        kpiRollups: row.kpiRollups as string[],
        exceptions: row.exceptions as string[],
        risks: row.risks as string[],
        opportunities: row.opportunities as string[],
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
  };
}
