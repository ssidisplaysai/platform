import { createDefaultToolExecutor, createInMemoryToolRegistry } from "@/lib/gea/tool-framework";
import { createInMemoryCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import { createInMemoryGeaRepository, createSeedAgent } from "@/lib/gea/agent-repository";
import { geaId } from "@/lib/gea/agent-models";
import { createPrismaMemoryRepository } from "@/lib/gea/memory-repository";
import { createMemoryCatalog, createMemoryRegistryService, createMemoryResolver } from "@/lib/gea/memory-registry";
import { createContextBuilderService } from "@/lib/gea/context-framework";
import { createPrismaOrchestrationRepository } from "@/lib/gea/orchestration-repository";
import { createOrchestrationRuntimeService } from "@/lib/gea/orchestration-runtime";
import {
  canonicalizeOperationsRecommendation,
  createOperationsIds,
  createOperationsImmutableLineage,
  gbaOpsChecksum,
  gbaOpsNowIso,
  type CapacityRecord,
  type InventoryRecord,
  type OperationsDashboard,
  type OperationsExecutiveSummary,
  type OperationsHealthSnapshot,
  type OperationsKpiDefinition,
  type OperationsKpiHistoryRecord,
  type OperationsRecommendation,
  type OperationsRecommendationReview,
  type OperationsScopeFilter,
  type ProductionScheduleRecord,
  type PurchasingRecord,
  type ShippingRecord,
  type VendorMetricRecord,
  type WarehouseOperationRecord,
  type WorkOrder,
} from "./operations-models";
import type { OperationsRepository } from "./operations-repository";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";

export type OperationsRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string, filters?: OperationsScopeFilter) => Promise<OperationsDashboard>;
  listWorkOrders: (workspaceId: string) => Promise<WorkOrder[]>;
  createWorkOrder: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    title: string;
    priority: WorkOrder["priority"];
    dueDate: string;
    dependencies?: string[];
    assignedResources?: string[];
    estimatedLaborHours?: number;
  }) => Promise<WorkOrder>;

  listProductionSchedules: (workspaceId: string) => Promise<ProductionScheduleRecord[]>;
  listInventory: (workspaceId: string) => Promise<InventoryRecord[]>;
  listPurchasing: (workspaceId: string) => Promise<PurchasingRecord[]>;
  listWarehouseOperations: (workspaceId: string) => Promise<WarehouseOperationRecord[]>;
  listShipping: (workspaceId: string) => Promise<ShippingRecord[]>;
  listCapacity: (workspaceId: string) => Promise<CapacityRecord[]>;
  listOperationsKpis: (workspaceId: string) => Promise<Array<OperationsKpiDefinition & { latest?: OperationsKpiHistoryRecord }>>;
  listRecommendations: (workspaceId: string) => Promise<OperationsRecommendation[]>;
  listVendorMetrics: (workspaceId: string) => Promise<VendorMetricRecord[]>;
  listTimeline: (workspaceId: string) => Promise<Awaited<ReturnType<OperationsRepository["listTimeline"]>>>;
  listHealth: (workspaceId: string) => Promise<OperationsHealthSnapshot[]>;
  listExecutiveSummaries: (workspaceId: string) => Promise<OperationsExecutiveSummary[]>;

  reviewRecommendation: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    operationsRecommendationId: string;
    decision: "APPROVED" | "REJECTED";
    notes?: string;
  }) => Promise<OperationsRecommendationReview>;
};

function scoreKpi(kpi: OperationsKpiDefinition, latest: OperationsKpiHistoryRecord | undefined): number {
  if (!latest || kpi.target === 0) return 0;
  const ratio = latest.measuredValue / kpi.target;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function createOperationsRuntimeService(repository: OperationsRepository): OperationsRuntimeService {
  const toolRegistry = createInMemoryToolRegistry([
    {
      toolId: geaId("tool"),
      toolKey: "genesis.operations.schedule",
      toolVersion: "v1",
      capabilityKey: "workflow",
      riskLevel: "MEDIUM",
      enabled: true,
    },
    {
      toolId: geaId("tool"),
      toolKey: "genesis.inventory.optimize",
      toolVersion: "v1",
      capabilityKey: "inventory",
      riskLevel: "MEDIUM",
      enabled: true,
    },
    {
      toolId: geaId("tool"),
      toolKey: "genesis.reporting.generate",
      toolVersion: "v1",
      capabilityKey: "reporting",
      riskLevel: "LOW",
      enabled: true,
    },
  ]);
  createDefaultToolExecutor();

  const capabilityRegistry = createInMemoryCapabilityRegistry();
  const geaRepository = createInMemoryGeaRepository();
  geaRepository.upsertAgent(createSeedAgent({
    agentId: "gba-operations-agent",
    workspaceId: DEFAULT_WORKSPACE_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Genesis Operations Agent",
    identity: { workspaceId: DEFAULT_WORKSPACE_ID, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system", role: "SYSTEM" },
    capabilities: [
      { capabilityId: geaId("cap"), capabilityKey: "workflow", capabilityVersion: "v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "inventory", capabilityVersion: "v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "reporting", capabilityVersion: "v1", enabled: true },
    ],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("ver"),
      agentId: "gba-operations-agent",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: gbaOpsNowIso(),
    },
  })).catch(() => undefined);

  const agentRuntime = createAgentRuntimeService({ repository: geaRepository, capabilityRegistry, toolRegistry });

  async function ensureContext(workspaceId: string, organizationId: string) {
    try {
      const memoryRepository = createPrismaMemoryRepository();
      const registry = createMemoryRegistryService(memoryRepository);
      const resolver = createMemoryResolver();
      const builder = createContextBuilderService({ repository: memoryRepository, registry, resolver });

      const references = await registry.listReferences(workspaceId);
      if (references.length === 0) return undefined;

      const catalog = createMemoryCatalog();
      const evidenceRefs = catalog.query(references, "business_genome").slice(0, 20);
      if (evidenceRefs.length === 0) return undefined;

      const built = await builder.buildContext({
        workspaceId,
        organizationId,
        actorId: "system",
        referenceIds: evidenceRefs.map((entry) => entry.memoryReferenceId),
        capabilityPermissions: ["capability:knowledge", "capability:workflow", "capability:inventory"],
        permissionActions: ["gea:memory:view", "gea:context:build"],
        genomeVersion: "business-genome/v1",
      });

      return built.contextPackage.contextPackageId;
    } catch {
      return undefined;
    }
  }

  function defaultMetric(key: string, label: string, unit: string, value: number, trend: number, evidence: string[]) {
    return {
      key,
      label,
      value,
      unit,
      trend,
      asOf: gbaOpsNowIso(),
      evidenceReferences: evidence,
    };
  }

  async function seedProductionIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listProductionSchedules(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const rows: ProductionScheduleRecord[] = [
      {
        scheduleId: createOperationsIds().scheduleId,
        workspaceId,
        organizationId,
        queueName: "Primary Assembly",
        machineId: "M-100",
        shiftCode: "SHIFT-A",
        sequence: 1,
        plannedStartAt: now,
        plannedEndAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        plannedLaborHours: 24,
        plannedUnits: 450,
        bottleneckRisk: "MEDIUM",
        createdAt: now,
        immutableLineage: createOperationsImmutableLineage({ queueName: "Primary Assembly", sequence: 1 }),
      },
      {
        scheduleId: createOperationsIds().scheduleId,
        workspaceId,
        organizationId,
        queueName: "Finishing",
        machineId: "M-220",
        shiftCode: "SHIFT-B",
        sequence: 2,
        plannedStartAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        plannedEndAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
        plannedLaborHours: 18,
        plannedUnits: 380,
        bottleneckRisk: "HIGH",
        createdAt: now,
        immutableLineage: createOperationsImmutableLineage({ queueName: "Finishing", sequence: 2 }),
      },
    ];

    for (const row of rows) {
      await repository.saveProductionSchedule(row);
      await repository.saveTimelineEvent({
        operationsTimelineEventId: createOperationsIds().operationsTimelineEventId,
        workspaceId,
        organizationId,
        eventType: "SCHEDULE_RECORDED",
        subjectId: row.scheduleId,
        summary: `Scheduled ${row.queueName} on ${row.machineId}`,
        actorId: "system",
        evidenceReferences: ["bg:operations:scheduling"],
        createdAt: now,
      });
    }

    return repository.listProductionSchedules(workspaceId);
  }

  async function seedInventoryIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listInventory(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const rows: InventoryRecord[] = [
      {
        inventoryRecordId: createOperationsIds().inventoryRecordId,
        workspaceId,
        organizationId,
        sku: "RAW-ALU-001",
        itemType: "RAW_MATERIAL",
        onHandQuantity: 1600,
        allocatedQuantity: 1100,
        availableQuantity: 500,
        safetyStock: 650,
        reorderPoint: 700,
        lotTrackingEnabled: true,
        serialTrackingEnabled: false,
        valuationAmount: 48600,
        agingDays: 14,
        updatedAt: now,
        immutableLineage: createOperationsImmutableLineage({ sku: "RAW-ALU-001", onHandQuantity: 1600, updatedAt: now }),
      },
      {
        inventoryRecordId: createOperationsIds().inventoryRecordId,
        workspaceId,
        organizationId,
        sku: "FG-DISPLAY-900",
        itemType: "FINISHED_GOOD",
        onHandQuantity: 240,
        allocatedQuantity: 170,
        availableQuantity: 70,
        safetyStock: 60,
        reorderPoint: 80,
        lotTrackingEnabled: true,
        serialTrackingEnabled: true,
        valuationAmount: 125000,
        agingDays: 9,
        updatedAt: now,
        immutableLineage: createOperationsImmutableLineage({ sku: "FG-DISPLAY-900", onHandQuantity: 240, updatedAt: now }),
      },
    ];

    for (const row of rows) {
      await repository.saveInventory(row);
      await repository.saveInventoryHistory({
        inventoryHistoryId: createOperationsIds().inventoryHistoryId,
        inventoryRecordId: row.inventoryRecordId,
        workspaceId,
        organizationId,
        movementType: "ADJUSTMENT",
        quantityDelta: 0,
        resultingOnHand: row.onHandQuantity,
        note: "Seed baseline",
        changedBy: "system",
        changedAt: now,
        immutableLineage: createOperationsImmutableLineage({ sku: row.sku, resultingOnHand: row.onHandQuantity, changedAt: now }),
      });
    }

    return repository.listInventory(workspaceId);
  }

  async function seedWarehouseIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listWarehouseOperations(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const row: WarehouseOperationRecord = {
      warehouseOperationId: createOperationsIds().warehouseOperationId,
      workspaceId,
      organizationId,
      operationType: "RECEIVING",
      status: "IN_PROGRESS",
      referenceId: "RCV-1001",
      zone: "DOCK-A",
      utilizationPercent: 72,
      createdAt: now,
      updatedAt: now,
      immutableLineage: createOperationsImmutableLineage({ referenceId: "RCV-1001", operationType: "RECEIVING", createdAt: now }),
    };
    await repository.saveWarehouseOperation(row);
    await repository.saveWarehouseHistory({
      warehouseHistoryId: createOperationsIds().warehouseHistoryId,
      warehouseOperationId: row.warehouseOperationId,
      workspaceId,
      organizationId,
      status: row.status,
      note: "Baseline operation seeded",
      changedBy: "system",
      changedAt: now,
      immutableLineage: createOperationsImmutableLineage({ warehouseOperationId: row.warehouseOperationId, status: row.status, changedAt: now }),
    });
    return repository.listWarehouseOperations(workspaceId);
  }

  async function seedPurchasingIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listPurchasing(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const row: PurchasingRecord = {
      purchasingId: createOperationsIds().purchasingId,
      workspaceId,
      organizationId,
      purchaseRequestId: "PR-4401",
      purchaseOrderNumber: "PO-8801",
      vendorId: "VENDOR-ALPHA",
      status: "IN_PROGRESS",
      leadTimeDays: 12,
      deliveryDueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      totalCostAmount: 28650,
      currency: "USD",
      createdAt: now,
      updatedAt: now,
      immutableLineage: createOperationsImmutableLineage({ purchaseOrderNumber: "PO-8801", status: "IN_PROGRESS", createdAt: now }),
    };
    await repository.savePurchasing(row);
    await repository.savePurchasingHistory({
      purchasingHistoryId: createOperationsIds().purchasingHistoryId,
      purchasingId: row.purchasingId,
      workspaceId,
      organizationId,
      status: row.status,
      note: "Baseline purchasing order seeded",
      changedBy: "system",
      changedAt: now,
      immutableLineage: createOperationsImmutableLineage({ purchasingId: row.purchasingId, status: row.status, changedAt: now }),
    });
    return repository.listPurchasing(workspaceId);
  }

  async function seedShippingIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listShipping(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const row: ShippingRecord = {
      shippingId: createOperationsIds().shippingId,
      workspaceId,
      organizationId,
      shipmentType: "OUTBOUND",
      carrier: "CarrierX",
      trackingNumber: "TRK-55110",
      status: "IN_PROGRESS",
      freightCostAmount: 1420,
      damageClaimOpen: false,
      estimatedDeliveryAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      createdAt: now,
      updatedAt: now,
      immutableLineage: createOperationsImmutableLineage({ trackingNumber: "TRK-55110", status: "IN_PROGRESS", createdAt: now }),
    };
    await repository.saveShipping(row);
    await repository.saveShippingHistory({
      shippingHistoryId: createOperationsIds().shippingHistoryId,
      shippingId: row.shippingId,
      workspaceId,
      organizationId,
      status: row.status,
      note: "Baseline shipment seeded",
      changedBy: "system",
      changedAt: now,
      immutableLineage: createOperationsImmutableLineage({ shippingId: row.shippingId, status: row.status, changedAt: now }),
    });
    return repository.listShipping(workspaceId);
  }

  async function seedCapacityIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listCapacity(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const row: CapacityRecord = {
      capacityId: createOperationsIds().capacityId,
      workspaceId,
      organizationId,
      machineUtilizationPercent: 82,
      laborUtilizationPercent: 76,
      productionCapacityUnits: 1200,
      availableHours: 640,
      constrainedHours: 86,
      forecastDemandUnits: 1320,
      bottleneckSummary: "Finishing line shift overlap",
      measuredAt: now,
      immutableLineage: createOperationsImmutableLineage({ machineUtilizationPercent: 82, laborUtilizationPercent: 76, measuredAt: now }),
    };
    await repository.saveCapacity(row);
    await repository.saveCapacityHistory({
      capacityHistoryId: createOperationsIds().capacityHistoryId,
      capacityId: row.capacityId,
      workspaceId,
      organizationId,
      machineUtilizationPercent: row.machineUtilizationPercent,
      laborUtilizationPercent: row.laborUtilizationPercent,
      productionCapacityUnits: row.productionCapacityUnits,
      availableHours: row.availableHours,
      constrainedHours: row.constrainedHours,
      forecastDemandUnits: row.forecastDemandUnits,
      bottleneckSummary: row.bottleneckSummary,
      measuredAt: now,
      immutableLineage: createOperationsImmutableLineage({ capacityId: row.capacityId, measuredAt: now }),
    });
    return repository.listCapacity(workspaceId);
  }

  async function seedKpisIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listOperationsKpis(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const rows: OperationsKpiDefinition[] = [
      {
        operationsKpiId: createOperationsIds().operationsKpiId,
        workspaceId,
        organizationId,
        name: "On-time delivery",
        target: 98,
        unit: "%",
        versionTag: "v1",
        owner: "Logistics Agent",
        evidenceReferences: ["bg:ops:delivery"],
        createdAt: now,
        updatedAt: now,
      },
      {
        operationsKpiId: createOperationsIds().operationsKpiId,
        workspaceId,
        organizationId,
        name: "Inventory accuracy",
        target: 99,
        unit: "%",
        versionTag: "v1",
        owner: "Inventory Agent",
        evidenceReferences: ["bg:ops:inventory_accuracy"],
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const row of rows) {
      await repository.saveOperationsKpi(row);
      await repository.saveOperationsKpiHistory({
        operationsKpiHistoryId: createOperationsIds().operationsKpiHistoryId,
        operationsKpiId: row.operationsKpiId,
        workspaceId,
        organizationId,
        measuredValue: row.name.includes("delivery") ? 94 : 97,
        trend: row.name.includes("delivery") ? -1.5 : 0.8,
        score: 0,
        status: row.name.includes("delivery") ? "AT_RISK" : "ON_TRACK",
        measuredAt: now,
        immutableLineage: createOperationsImmutableLineage({ operationsKpiId: row.operationsKpiId, measuredAt: now }),
      });
    }

    return repository.listOperationsKpis(workspaceId);
  }

  async function seedVendorMetricsIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listVendorMetrics(workspaceId);
    if (existing.length > 0) return existing;

    const now = gbaOpsNowIso();
    const row: VendorMetricRecord = {
      vendorMetricId: createOperationsIds().vendorMetricId,
      workspaceId,
      organizationId,
      vendorId: "VENDOR-ALPHA",
      onTimeDeliveryRate: 91,
      qualityAcceptanceRate: 96,
      averageLeadTimeDays: 14,
      costVariancePercent: 3.2,
      measuredAt: now,
      immutableLineage: createOperationsImmutableLineage({ vendorId: "VENDOR-ALPHA", measuredAt: now }),
    };

    await repository.saveVendorMetric(row);
    await repository.saveVendorMetricHistory({
      vendorMetricHistoryId: createOperationsIds().vendorMetricHistoryId,
      vendorMetricId: row.vendorMetricId,
      workspaceId,
      organizationId,
      onTimeDeliveryRate: row.onTimeDeliveryRate,
      qualityAcceptanceRate: row.qualityAcceptanceRate,
      averageLeadTimeDays: row.averageLeadTimeDays,
      costVariancePercent: row.costVariancePercent,
      measuredAt: now,
      immutableLineage: createOperationsImmutableLineage({ vendorMetricId: row.vendorMetricId, measuredAt: now }),
    });

    return repository.listVendorMetrics(workspaceId);
  }

  async function generateRecommendations(input: { workspaceId: string; organizationId: string; actorId: string }) {
    const [inventoryRows, capacityRows, vendorRows, workOrders] = await Promise.all([
      seedInventoryIfEmpty(input.workspaceId, input.organizationId),
      seedCapacityIfEmpty(input.workspaceId, input.organizationId),
      seedVendorMetricsIfEmpty(input.workspaceId, input.organizationId),
      repository.listWorkOrders(input.workspaceId),
    ]);

    const lowStockCount = inventoryRows.filter((entry) => entry.availableQuantity < entry.reorderPoint).length;
    const constrained = capacityRows[0];
    const vendor = vendorRows[0];
    const blockedWorkOrders = workOrders.filter((entry) => entry.status === "BLOCKED").length;

    const candidates: Array<Omit<OperationsRecommendation, "operationsRecommendationId" | "deterministicChecksum" | "createdAt" | "immutableLineage">> = [
      {
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: "INVENTORY",
        title: "Protect near-term stockout risk",
        summary: `Detected ${lowStockCount} SKUs below reorder thresholds. Prioritize replenishment and transfer balancing.`,
        evidenceReferences: inventoryRows.map((entry) => entry.sku).slice(0, 8),
        businessImpact: "Reduces production interruptions and missed commitments.",
        priority: "P1",
        confidence: "HIGH",
        suggestedOwner: "Inventory Agent",
        requiredApprovals: ["COO"],
        reviewed: false,
      },
      {
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: "CAPACITY",
        title: "Mitigate finishing-line bottleneck",
        summary: `Constrained hours at ${constrained.constrainedHours} with forecast demand ${constrained.forecastDemandUnits} units.`,
        evidenceReferences: ["bg:ops:capacity", constrained.bottleneckSummary],
        businessImpact: "Improves throughput and schedule reliability.",
        priority: "P1",
        confidence: "MEDIUM",
        suggestedOwner: "Production Agent",
        requiredApprovals: ["COO", "CFO"],
        reviewed: false,
      },
      {
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: "VENDOR",
        title: "Raise vendor on-time delivery reliability",
        summary: `Vendor on-time rate is ${vendor.onTimeDeliveryRate}%. Establish corrective action plan and alternate sourcing guardrail.`,
        evidenceReferences: [vendor.vendorId, "bg:ops:vendor_performance"],
        businessImpact: "Stabilizes procurement and inbound material flow.",
        priority: blockedWorkOrders > 0 ? "P1" : "P2",
        confidence: "MEDIUM",
        suggestedOwner: "Purchasing Agent",
        requiredApprovals: ["COO"],
        reviewed: false,
      },
    ];

    const created: OperationsRecommendation[] = [];
    for (const candidate of candidates.sort((a, b) => a.title.localeCompare(b.title))) {
      const id = createOperationsIds().operationsRecommendationId;
      const createdAt = gbaOpsNowIso();
      const deterministicChecksum = gbaOpsChecksum(canonicalizeOperationsRecommendation(candidate));
      const recommendation: OperationsRecommendation = {
        operationsRecommendationId: id,
        ...candidate,
        deterministicChecksum,
        createdAt,
        immutableLineage: createOperationsImmutableLineage({ id, deterministicChecksum, createdAt }),
      };

      await repository.saveRecommendation(recommendation);
      await repository.saveTimelineEvent({
        operationsTimelineEventId: createOperationsIds().operationsTimelineEventId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "RECOMMENDATION_CREATED",
        subjectId: recommendation.operationsRecommendationId,
        summary: recommendation.title,
        actorId: input.actorId,
        evidenceReferences: recommendation.evidenceReferences,
        createdAt,
      });

      created.push(recommendation);
    }

    return created;
  }

  async function computeHealth(workspaceId: string, organizationId: string): Promise<OperationsHealthSnapshot> {
    const [workOrders, inventoryRows, shippingRows, capacityRows, recommendations] = await Promise.all([
      repository.listWorkOrders(workspaceId),
      repository.listInventory(workspaceId),
      repository.listShipping(workspaceId),
      repository.listCapacity(workspaceId),
      repository.listRecommendations(workspaceId),
    ]);

    const blockedWorkOrderCount = workOrders.filter((entry) => entry.status === "BLOCKED").length;
    const lowStockSkuCount = inventoryRows.filter((entry) => entry.availableQuantity < entry.reorderPoint).length;
    const delayedShipmentCount = shippingRows.filter((entry) => entry.status === "AT_RISK" || entry.status === "BLOCKED").length;
    const overCapacitySignalCount = capacityRows.filter((entry) => entry.forecastDemandUnits > entry.productionCapacityUnits).length;
    const unreviewedRecommendationCount = recommendations.filter((entry) => !entry.reviewed).length;

    const severity = blockedWorkOrderCount + lowStockSkuCount + delayedShipmentCount + overCapacitySignalCount;
    const status: OperationsHealthSnapshot["status"] = severity <= 1 ? "HEALTHY" : severity <= 4 ? "DEGRADED" : "UNHEALTHY";

    return {
      operationsHealthId: createOperationsIds().operationsHealthId,
      workspaceId,
      organizationId,
      status,
      blockedWorkOrderCount,
      lowStockSkuCount,
      delayedShipmentCount,
      overCapacitySignalCount,
      unreviewedRecommendationCount,
      generatedAt: gbaOpsNowIso(),
      immutableLineage: createOperationsImmutableLineage({ workspaceId, blockedWorkOrderCount, lowStockSkuCount, delayedShipmentCount, overCapacitySignalCount, unreviewedRecommendationCount }),
    };
  }

  async function getDashboard(workspaceId: string, organizationId: string, filters: OperationsScopeFilter = {}): Promise<OperationsDashboard> {
    await Promise.all([
      seedProductionIfEmpty(workspaceId, organizationId),
      seedInventoryIfEmpty(workspaceId, organizationId),
      seedWarehouseIfEmpty(workspaceId, organizationId),
      seedPurchasingIfEmpty(workspaceId, organizationId),
      seedShippingIfEmpty(workspaceId, organizationId),
      seedCapacityIfEmpty(workspaceId, organizationId),
      seedKpisIfEmpty(workspaceId, organizationId),
      seedVendorMetricsIfEmpty(workspaceId, organizationId),
    ]);

    const [inventoryRows, warehouseRows, purchasingRows, shippingRows, capacityRows, vendorRows, schedules] = await Promise.all([
      repository.listInventory(workspaceId),
      repository.listWarehouseOperations(workspaceId),
      repository.listPurchasing(workspaceId),
      repository.listShipping(workspaceId),
      repository.listCapacity(workspaceId),
      repository.listVendorMetrics(workspaceId),
      repository.listProductionSchedules(workspaceId),
    ]);

    const metric = (key: string, label: string, unit: string, value: number, trend: number, evidence: string[]) => defaultMetric(key, label, unit, value, trend, evidence);

    const dashboard: OperationsDashboard = {
      workspaceId,
      organizationId,
      filters,
      manufacturing: metric("manufacturing", "Manufacturing", "score", 84, 1.1, ["bg:ops:manufacturing", ...schedules.map((s) => s.machineId)]),
      warehouse: metric("warehouse", "Warehouse", "score", warehouseRows[0]?.utilizationPercent ?? 70, -0.4, ["bg:ops:warehouse"]),
      inventory: metric("inventory", "Inventory", "score", inventoryRows.length > 0 ? Math.round((inventoryRows.reduce((acc, row) => acc + row.availableQuantity, 0) / Math.max(1, inventoryRows.reduce((acc, row) => acc + row.onHandQuantity, 0))) * 100) : 73, -1.2, ["bg:ops:inventory"]),
      purchasing: metric("purchasing", "Purchasing", "score", purchasingRows[0] ? 100 - purchasingRows[0].leadTimeDays : 79, 0.2, ["bg:ops:purchasing"]),
      logistics: metric("logistics", "Logistics", "score", shippingRows[0]?.damageClaimOpen ? 68 : 88, -0.1, ["bg:ops:logistics"]),
      shipping: metric("shipping", "Shipping", "score", shippingRows.filter((entry) => entry.status === "COMPLETE").length > 0 ? 92 : 82, 0.5, ["bg:ops:shipping"]),
      receiving: metric("receiving", "Receiving", "score", warehouseRows.filter((entry) => entry.operationType === "RECEIVING").length > 0 ? 86 : 75, 0.4, ["bg:ops:receiving"]),
      production: metric("production", "Production", "units/day", schedules.reduce((acc, row) => acc + row.plannedUnits, 0), 1.9, ["bg:ops:production"]),
      vendorPerformance: metric("vendor", "Vendor Performance", "score", vendorRows[0]?.onTimeDeliveryRate ?? 90, -0.3, ["bg:ops:vendor_performance"]),
      capacity: metric("capacity", "Capacity", "%", capacityRows[0]?.machineUtilizationPercent ?? 80, 0.7, ["bg:ops:capacity"]),
      fieldOperations: metric("field", "Field Operations", "score", 83, 0.1, ["bg:ops:field"]),
      generatedAt: gbaOpsNowIso(),
      immutableLineage: createOperationsImmutableLineage({ workspaceId, organizationId, filters, generatedAt: gbaOpsNowIso() }),
    };

    return dashboard;
  }

  async function listRecommendations(workspaceId: string) {
    const rows = await repository.listRecommendations(workspaceId);
    if (rows.length > 0) return rows;
    return generateRecommendations({ workspaceId, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system" });
  }

  async function listExecutiveSummaries(workspaceId: string) {
    const existing = await repository.listExecutiveSummaries(workspaceId);
    if (existing.length > 0) return existing;

    const dashboard = await getDashboard(workspaceId, DEFAULT_ORGANIZATION_ID);
    const recommendations = await listRecommendations(workspaceId);
    const healthRows = await repository.listHealth(workspaceId);
    const now = gbaOpsNowIso();

    const daily: OperationsExecutiveSummary = {
      summaryId: createOperationsIds().summaryId,
      workspaceId,
      organizationId: DEFAULT_ORGANIZATION_ID,
      period: "DAILY",
      kpiRollups: [
        `Throughput ${dashboard.production.value.toFixed(0)} ${dashboard.production.unit}`,
        `Inventory score ${dashboard.inventory.value}`,
        `On-time vendor rate ${dashboard.vendorPerformance.value}`,
      ],
      exceptions: [`Open operational recommendations ${recommendations.filter((entry) => !entry.reviewed).length}`],
      risks: healthRows.length > 0 ? [`Operational status ${healthRows[0].status}`] : ["Operational status not yet computed"],
      opportunities: recommendations.slice(0, 3).map((entry) => entry.title),
      createdAt: now,
      immutableLineage: createOperationsImmutableLineage({ workspaceId, period: "DAILY", createdAt: now }),
    };

    const weekly: OperationsExecutiveSummary = {
      summaryId: createOperationsIds().summaryId,
      workspaceId,
      organizationId: DEFAULT_ORGANIZATION_ID,
      period: "WEEKLY",
      kpiRollups: [
        `Capacity utilization ${dashboard.capacity.value}%`,
        `Warehouse utilization ${dashboard.warehouse.value}%`,
        `Shipping score ${dashboard.shipping.value}`,
      ],
      exceptions: ["Weekly bottleneck analysis required for finishing line"],
      risks: ["Supplier lead-time variability remains elevated"],
      opportunities: ["Shift rebalancing can increase on-time completion"],
      createdAt: now,
      immutableLineage: createOperationsImmutableLineage({ workspaceId, period: "WEEKLY", createdAt: now }),
    };

    await repository.saveExecutiveSummary(daily);
    await repository.saveExecutiveSummary(weekly);
    await repository.saveTimelineEvent({
      operationsTimelineEventId: createOperationsIds().operationsTimelineEventId,
      workspaceId,
      organizationId: DEFAULT_ORGANIZATION_ID,
      eventType: "EXECUTIVE_REPORT_PUBLISHED",
      subjectId: daily.summaryId,
      summary: "Operations executive summaries published",
      actorId: "system",
      evidenceReferences: ["bg:ops:executive_reporting"],
      createdAt: now,
    });

    return repository.listExecutiveSummaries(workspaceId);
  }

  return {
    getDashboard,

    async listWorkOrders(workspaceId) {
      return repository.listWorkOrders(workspaceId);
    },

    async createWorkOrder(input) {
      const now = gbaOpsNowIso();
      const workOrder: WorkOrder = {
        workOrderId: createOperationsIds().workOrderId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        title: input.title,
        status: "PLANNED",
        priority: input.priority,
        dueDate: input.dueDate,
        dependencies: [...new Set(input.dependencies ?? [])],
        assignedResources: [...new Set(input.assignedResources ?? [])],
        estimatedLaborHours: input.estimatedLaborHours ?? 8,
        actualLaborHours: 0,
        completionPercent: 0,
        createdBy: input.actorId,
        createdAt: now,
        updatedAt: now,
        immutableLineage: createOperationsImmutableLineage({ title: input.title, dueDate: input.dueDate, createdAt: now }),
      };

      await repository.saveWorkOrder(workOrder);
      await repository.saveWorkOrderHistory({
        workOrderHistoryId: createOperationsIds().workOrderHistoryId,
        workOrderId: workOrder.workOrderId,
        workspaceId: workOrder.workspaceId,
        organizationId: workOrder.organizationId,
        fromStatus: "PLANNED",
        toStatus: "PLANNED",
        note: "Work order created",
        changedBy: input.actorId,
        changedAt: now,
        immutableLineage: createOperationsImmutableLineage({ workOrderId: workOrder.workOrderId, changedAt: now }),
      });

      await repository.saveTimelineEvent({
        operationsTimelineEventId: createOperationsIds().operationsTimelineEventId,
        workspaceId: workOrder.workspaceId,
        organizationId: workOrder.organizationId,
        eventType: "WORK_ORDER_CREATED",
        subjectId: workOrder.workOrderId,
        summary: `Work order created: ${workOrder.title}`,
        actorId: input.actorId,
        evidenceReferences: ["bg:ops:work_orders"],
        createdAt: now,
      });

      const orchestrationRepository = createPrismaOrchestrationRepository();
      const orchestrationRuntime = createOrchestrationRuntimeService({ repository: orchestrationRepository, agentRuntime });
      const compiled = await orchestrationRuntime.workflowCompiler.compile({
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        orchestrationName: `Ops work order ${workOrder.workOrderId}`,
        orchestrationDescription: "Operations work order coordination",
        workflowKey: `gba.ops.workorder.${workOrder.workOrderId}`,
        workflowName: "Work Order Coordination",
        workflowDescription: workOrder.title,
        actorId: input.actorId,
        steps: [
          {
            stepId: geaId("step"),
            stepKey: "work-order-plan",
            title: "Plan execution",
            stepType: "SEQUENTIAL",
            order: 1,
            requiresApproval: false,
            highRisk: false,
            assignment: {
              assignmentId: geaId("assign"),
              stepId: geaId("stepref"),
              agentId: "gea-orchestrator-agent",
              agentVersion: "v1",
              requiredCapabilities: ["workflow"],
            },
            retryPolicy: { maxRetries: 1, backoffMs: 1000, strategy: "FIXED", retryOnStates: ["FAILED"] },
            compensation: { reversible: false, actionType: "NONE" },
            input: { workOrderId: workOrder.workOrderId, title: workOrder.title },
          },
        ],
      });

      await orchestrationRuntime.executionManager.start({
        orchestrationId: compiled.orchestration.orchestrationId,
        workflowId: compiled.workflow.workflowId,
        actorId: input.actorId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
      });

      return workOrder;
    },

    async listProductionSchedules(workspaceId) {
      await seedProductionIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listProductionSchedules(workspaceId);
    },

    async listInventory(workspaceId) {
      await seedInventoryIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listInventory(workspaceId);
    },

    async listPurchasing(workspaceId) {
      await seedPurchasingIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listPurchasing(workspaceId);
    },

    async listWarehouseOperations(workspaceId) {
      await seedWarehouseIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listWarehouseOperations(workspaceId);
    },

    async listShipping(workspaceId) {
      await seedShippingIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listShipping(workspaceId);
    },

    async listCapacity(workspaceId) {
      await seedCapacityIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listCapacity(workspaceId);
    },

    async listOperationsKpis(workspaceId) {
      const [defs, history] = await Promise.all([
        seedKpisIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID),
        repository.listOperationsKpiHistory(workspaceId),
      ]);
      const latestById = new Map<string, OperationsKpiHistoryRecord>();
      for (const row of history) {
        if (!latestById.has(row.operationsKpiId)) {
          latestById.set(row.operationsKpiId, row);
        }
      }

      return defs.map((entry) => {
        const latest = latestById.get(entry.operationsKpiId);
        if (!latest) return { ...entry };
        const score = scoreKpi(entry, latest);
        return { ...entry, latest: { ...latest, score } };
      });
    },

    async listRecommendations(workspaceId) {
      return listRecommendations(workspaceId);
    },

    async listVendorMetrics(workspaceId) {
      await seedVendorMetricsIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listVendorMetrics(workspaceId);
    },

    async listTimeline(workspaceId) {
      return repository.listTimeline(workspaceId);
    },

    async listHealth(workspaceId) {
      const health = await computeHealth(workspaceId, DEFAULT_ORGANIZATION_ID);
      await repository.saveHealth(health);
      return repository.listHealth(workspaceId);
    },

    async listExecutiveSummaries(workspaceId) {
      const contextPackageId = await ensureContext(workspaceId, DEFAULT_ORGANIZATION_ID);
      const summaries = await listExecutiveSummaries(workspaceId);

      if (contextPackageId) {
        await repository.saveTimelineEvent({
          operationsTimelineEventId: createOperationsIds().operationsTimelineEventId,
          workspaceId,
          organizationId: DEFAULT_ORGANIZATION_ID,
          eventType: "EXECUTIVE_REPORT_PUBLISHED",
          subjectId: contextPackageId,
          summary: "Context package linked to operations reporting",
          actorId: "system",
          evidenceReferences: [contextPackageId],
          createdAt: gbaOpsNowIso(),
        });
      }

      return summaries;
    },

    async reviewRecommendation(input) {
      const recommendations = await repository.listRecommendations(input.workspaceId);
      const recommendation = recommendations.find((entry) => entry.operationsRecommendationId === input.operationsRecommendationId);
      if (!recommendation) {
        throw new Error("Recommendation not found.");
      }

      const now = gbaOpsNowIso();
      const review: OperationsRecommendationReview = {
        operationsRecommendationReviewId: createOperationsIds().operationsRecommendationReviewId,
        operationsRecommendationId: recommendation.operationsRecommendationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        decision: input.decision,
        notes: input.notes,
        reviewedBy: input.actorId,
        reviewedAt: now,
        immutableLineage: createOperationsImmutableLineage({ recommendationId: recommendation.operationsRecommendationId, decision: input.decision, reviewedAt: now }),
      };

      await repository.saveRecommendation({ ...recommendation, reviewed: true });
      await repository.saveRecommendationReview(review);
      await repository.saveTimelineEvent({
        operationsTimelineEventId: createOperationsIds().operationsTimelineEventId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "RECOMMENDATION_REVIEWED",
        subjectId: recommendation.operationsRecommendationId,
        summary: `Operations recommendation ${input.decision.toLowerCase()}`,
        actorId: input.actorId,
        evidenceReferences: recommendation.evidenceReferences,
        createdAt: now,
      });

      return review;
    },
  };
}
