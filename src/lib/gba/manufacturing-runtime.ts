import { geaId } from "@/lib/gea/agent-models";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import { createInMemoryCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createContextBuilderService } from "@/lib/gea/context-framework";
import { createPrismaMemoryRepository } from "@/lib/gea/memory-repository";
import { createMemoryCatalog, createMemoryRegistryService, createMemoryResolver } from "@/lib/gea/memory-registry";
import { createSeedAgent, createInMemoryGeaRepository } from "@/lib/gea/agent-repository";
import { createInMemoryToolRegistry, createDefaultToolExecutor } from "@/lib/gea/tool-framework";
import {
  canonicalizeManufacturingRecommendation,
  createManufacturingIds,
  createManufacturingImmutableLineage,
  gbaMfgChecksum,
  gbaMfgNowIso,
  type ManufacturingBom,
  type ManufacturingCostRecord,
  type ManufacturingDashboard,
  type ManufacturingExecutiveReport,
  type ManufacturingHealthSnapshot,
  type ManufacturingKpiDefinition,
  type ManufacturingKpiHistory,
  type ManufacturingLabor,
  type ManufacturingMachine,
  type ManufacturingMaterialConsumption,
  type ManufacturingProductionOrder,
  type ManufacturingQualityEvent,
  type ManufacturingRecommendation,
  type ManufacturingRecommendationReview,
  type ManufacturingRouting,
  type ManufacturingScopeFilter,
} from "./manufacturing-models";
import type { ManufacturingRepository } from "./manufacturing-repository";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";

export type ManufacturingRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string, filters?: ManufacturingScopeFilter) => Promise<ManufacturingDashboard>;
  listBoms: (workspaceId: string) => Promise<ManufacturingBom[]>;
  listRoutings: (workspaceId: string) => Promise<ManufacturingRouting[]>;
  listProductionOrders: (workspaceId: string) => Promise<ManufacturingProductionOrder[]>;
  listMachines: (workspaceId: string) => Promise<ManufacturingMachine[]>;
  listLabor: (workspaceId: string) => Promise<ManufacturingLabor[]>;
  listMaterials: (workspaceId: string) => Promise<ManufacturingMaterialConsumption[]>;
  listQuality: (workspaceId: string) => Promise<ManufacturingQualityEvent[]>;
  listCosting: (workspaceId: string) => Promise<ManufacturingCostRecord[]>;
  listKpis: (workspaceId: string) => Promise<Array<ManufacturingKpiDefinition & { latest?: ManufacturingKpiHistory }>>;
  listRecommendations: (workspaceId: string) => Promise<ManufacturingRecommendation[]>;
  listTimeline: (workspaceId: string) => Promise<Awaited<ReturnType<ManufacturingRepository["listTimeline"]>>>;
  listHealth: (workspaceId: string) => Promise<ManufacturingHealthSnapshot[]>;
  listExecutiveReports: (workspaceId: string) => Promise<ManufacturingExecutiveReport[]>;

  createProductionOrder: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    title: string;
    sku: string;
    priority: ManufacturingProductionOrder["priority"];
    quantityPlanned: number;
    scheduledStartAt: string;
    scheduledEndAt: string;
    operationsWorkOrderId?: string;
  }) => Promise<ManufacturingProductionOrder>;

  recordQualityEvent: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    productionOrderId: string;
    eventType: ManufacturingQualityEvent["eventType"];
    severity: ManufacturingQualityEvent["severity"];
    defectCategory: string;
    note: string;
    firstPassYieldPercent: number;
    rootCauseReference?: string;
  }) => Promise<ManufacturingQualityEvent>;

  updateMachineStatus: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    machineId: string;
    status: ManufacturingMachine["status"];
    note: string;
  }) => Promise<ManufacturingMachine>;

  reviewRecommendation: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    manufacturingRecommendationId: string;
    decision: "APPROVED" | "REJECTED";
    notes?: string;
  }) => Promise<ManufacturingRecommendationReview>;
};

function scoreKpi(kpi: ManufacturingKpiDefinition, latest: ManufacturingKpiHistory | undefined): number {
  if (!latest || kpi.target === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((latest.measuredValue / kpi.target) * 100)));
}

export function createManufacturingRuntimeService(repository: ManufacturingRepository): ManufacturingRuntimeService {
  const toolRegistry = createInMemoryToolRegistry([
    { toolId: geaId("tool"), toolKey: "genesis.manufacturing.plan", toolVersion: "v1", capabilityKey: "workflow", riskLevel: "MEDIUM", enabled: true },
    { toolId: geaId("tool"), toolKey: "genesis.manufacturing.schedule", toolVersion: "v1", capabilityKey: "workflow", riskLevel: "MEDIUM", enabled: true },
    { toolId: geaId("tool"), toolKey: "genesis.manufacturing.quality", toolVersion: "v1", capabilityKey: "quality", riskLevel: "LOW", enabled: true },
  ]);
  createDefaultToolExecutor();

  const capabilityRegistry = createInMemoryCapabilityRegistry();
  const geaRepository = createInMemoryGeaRepository();
  geaRepository.upsertAgent(createSeedAgent({
    agentId: "gba-manufacturing-agent",
    workspaceId: DEFAULT_WORKSPACE_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Genesis Manufacturing Agent",
    identity: { workspaceId: DEFAULT_WORKSPACE_ID, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system", role: "SYSTEM" },
    capabilities: [
      { capabilityId: geaId("cap"), capabilityKey: "workflow", capabilityVersion: "v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "quality", capabilityVersion: "v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "optimization", capabilityVersion: "v1", enabled: true },
    ],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("ver"),
      agentId: "gba-manufacturing-agent",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: gbaMfgNowIso(),
    },
  })).catch(() => undefined);

  createAgentRuntimeService({ repository: geaRepository, capabilityRegistry, toolRegistry });

  async function ensureContext(workspaceId: string, organizationId: string) {
    try {
      const memoryRepository = createPrismaMemoryRepository();
      const registry = createMemoryRegistryService(memoryRepository);
      const resolver = createMemoryResolver();
      const builder = createContextBuilderService({ repository: memoryRepository, registry, resolver });
      const references = await registry.listReferences(workspaceId);
      if (references.length === 0) return undefined;
      const catalog = createMemoryCatalog();
      const picks = catalog.query(references, "business_genome").slice(0, 20);
      if (picks.length === 0) return undefined;
      const result = await builder.buildContext({
        workspaceId,
        organizationId,
        actorId: "system",
        referenceIds: picks.map((entry) => entry.memoryReferenceId),
        capabilityPermissions: ["capability:knowledge", "capability:workflow", "capability:quality"],
        permissionActions: ["gea:memory:view", "gea:context:build"],
        genomeVersion: "business-genome/v1",
      });
      return result.contextPackage.contextPackageId;
    } catch {
      return undefined;
    }
  }

  async function seedBomsIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listBoms(workspaceId);
    if (existing.length > 0) return existing;
    const now = gbaMfgNowIso();
    const bom: ManufacturingBom = {
      bomId: createManufacturingIds().bomId,
      workspaceId,
      organizationId,
      sku: "FG-DISPLAY-900",
      revision: "A",
      level: 0,
      effectiveFrom: now,
      components: [
        { componentSku: "RAW-ALU-001", quantity: 6, unit: "kg", alternateSkus: ["RAW-ALU-002"] },
        { componentSku: "COMP-LED-ARRAY", quantity: 1, unit: "ea", alternateSkus: [] },
      ],
      approvedSubstitutions: ["RAW-ALU-002"],
      costRollup: 420,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ sku: "FG-DISPLAY-900", revision: "A", updatedAt: now }),
    };
    await repository.saveBom(bom);
    await repository.saveBomHistory({
      bomHistoryId: createManufacturingIds().bomHistoryId,
      bomId: bom.bomId,
      workspaceId,
      organizationId,
      revision: bom.revision,
      note: "Seed baseline BOM",
      changedBy: "system",
      changedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ bomId: bom.bomId, revision: bom.revision, changedAt: now }),
    });
    return repository.listBoms(workspaceId);
  }

  async function seedRoutingsIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listRoutings(workspaceId);
    if (existing.length > 0) return existing;
    const now = gbaMfgNowIso();
    const routing: ManufacturingRouting = {
      routingId: createManufacturingIds().routingId,
      workspaceId,
      organizationId,
      sku: "FG-DISPLAY-900",
      revision: "A",
      workCenter: "CELL-ALPHA",
      machineAssignments: ["LASER-01", "CNC-04", "WELD-02", "ASSEMBLY-01"],
      processSteps: [
        { step: "Cut material", cycleMinutes: 18, setupMinutes: 10, laborSkill: "laser_operator" },
        { step: "CNC finish", cycleMinutes: 24, setupMinutes: 8, laborSkill: "cnc_operator" },
        { step: "Weld frame", cycleMinutes: 35, setupMinutes: 12, laborSkill: "welder" },
        { step: "Final assembly", cycleMinutes: 26, setupMinutes: 6, laborSkill: "assembler" },
      ],
      laborRequirements: [
        { skill: "laser_operator", operators: 1 },
        { skill: "cnc_operator", operators: 1 },
        { skill: "welder", operators: 2 },
        { skill: "assembler", operators: 2 },
      ],
      createdAt: now,
      updatedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ sku: "FG-DISPLAY-900", revision: "A", updatedAt: now }),
    };
    await repository.saveRouting(routing);
    await repository.saveRoutingHistory({
      routingHistoryId: createManufacturingIds().routingHistoryId,
      routingId: routing.routingId,
      workspaceId,
      organizationId,
      revision: routing.revision,
      note: "Seed baseline routing",
      changedBy: "system",
      changedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ routingId: routing.routingId, revision: routing.revision, changedAt: now }),
    });
    return repository.listRoutings(workspaceId);
  }

  async function seedMachinesIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listMachines(workspaceId);
    if (existing.length > 0) return existing;
    const now = gbaMfgNowIso();
    const rows: ManufacturingMachine[] = [
      {
        machineId: createManufacturingIds().machineId,
        workspaceId,
        organizationId,
        machineType: "LASER",
        status: "IN_PROGRESS",
        runtimeMinutes: 460,
        downtimeMinutes: 34,
        plannedMaintenanceMinutes: 22,
        unplannedFailureCount: 1,
        availabilityPercent: 93,
        performancePercent: 87,
        qualityPercent: 98,
        utilizationPercent: 84,
        updatedAt: now,
        immutableLineage: createManufacturingImmutableLineage({ machineType: "LASER", updatedAt: now }),
      },
      {
        machineId: createManufacturingIds().machineId,
        workspaceId,
        organizationId,
        machineType: "PRESS_BRAKE",
        status: "IN_PROGRESS",
        runtimeMinutes: 390,
        downtimeMinutes: 29,
        plannedMaintenanceMinutes: 18,
        unplannedFailureCount: 0,
        availabilityPercent: 95,
        performancePercent: 86,
        qualityPercent: 97,
        utilizationPercent: 81,
        updatedAt: now,
        immutableLineage: createManufacturingImmutableLineage({ machineType: "PRESS_BRAKE", updatedAt: now }),
      },
    ];
    for (const row of rows) {
      await repository.saveMachine(row);
      await repository.saveMachineHistory({
        machineHistoryId: createManufacturingIds().machineHistoryId,
        machineId: row.machineId,
        workspaceId,
        organizationId,
        status: row.status,
        note: "Seed baseline machine status",
        changedBy: "system",
        changedAt: now,
        immutableLineage: createManufacturingImmutableLineage({ machineId: row.machineId, status: row.status, changedAt: now }),
      });
    }
    return repository.listMachines(workspaceId);
  }

  async function seedLaborIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listLabor(workspaceId);
    if (existing.length > 0) return existing;
    const now = gbaMfgNowIso();
    const row: ManufacturingLabor = {
      laborRecordId: createManufacturingIds().laborRecordId,
      workspaceId,
      organizationId,
      operatorId: "OP-100",
      certifications: ["WELD-AWS-D1.1", "FORKLIFT-2026"],
      skills: ["welder", "assembler"],
      shift: "SHIFT-A",
      utilizationPercent: 82,
      overtimeHours: 1.4,
      laborEfficiencyPercent: 89,
      updatedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ operatorId: "OP-100", updatedAt: now }),
    };
    await repository.saveLabor(row);
    await repository.saveLaborHistory({
      laborHistoryId: createManufacturingIds().laborHistoryId,
      laborRecordId: row.laborRecordId,
      workspaceId,
      organizationId,
      shift: row.shift,
      utilizationPercent: row.utilizationPercent,
      overtimeHours: row.overtimeHours,
      laborEfficiencyPercent: row.laborEfficiencyPercent,
      changedBy: "system",
      changedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ laborRecordId: row.laborRecordId, changedAt: now }),
    });
    return repository.listLabor(workspaceId);
  }

  async function seedProductionIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listProductionOrders(workspaceId);
    if (existing.length > 0) return existing;
    const now = gbaMfgNowIso();
    const row: ManufacturingProductionOrder = {
      productionOrderId: createManufacturingIds().productionOrderId,
      workspaceId,
      organizationId,
      operationsWorkOrderId: "ops-seed-1",
      title: "LED Display Batch A",
      sku: "FG-DISPLAY-900",
      bomRevision: "A",
      routingRevision: "A",
      priority: "P2",
      status: "IN_PROGRESS",
      quantityPlanned: 240,
      quantityCompleted: 140,
      scheduledStartAt: now,
      scheduledEndAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      materialAllocations: [
        { sku: "RAW-ALU-001", quantity: 1200 },
        { sku: "COMP-LED-ARRAY", quantity: 240 },
      ],
      laborAssignments: ["OP-100", "OP-101"],
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ sku: "FG-DISPLAY-900", quantityPlanned: 240, createdAt: now }),
    };
    await repository.saveProductionOrder(row);
    await repository.saveProductionOrderHistory({
      productionOrderHistoryId: createManufacturingIds().productionOrderHistoryId,
      productionOrderId: row.productionOrderId,
      workspaceId,
      organizationId,
      fromStatus: row.status,
      toStatus: row.status,
      note: "Seed baseline production order",
      changedBy: "system",
      changedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ productionOrderId: row.productionOrderId, changedAt: now }),
    });
    return repository.listProductionOrders(workspaceId);
  }

  async function seedMaterialsIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listMaterialConsumption(workspaceId);
    if (existing.length > 0) return existing;
    const orders = await seedProductionIfEmpty(workspaceId, organizationId);
    const now = gbaMfgNowIso();
    const row: ManufacturingMaterialConsumption = {
      materialConsumptionId: createManufacturingIds().materialConsumptionId,
      workspaceId,
      organizationId,
      productionOrderId: orders[0].productionOrderId,
      rawMaterialUsed: 890,
      componentConsumed: 140,
      yieldPercent: 93,
      wasteQuantity: 18,
      scrapQuantity: 10,
      reworkMaterialQuantity: 6,
      variancePercent: 2.4,
      measuredAt: now,
      immutableLineage: createManufacturingImmutableLineage({ productionOrderId: orders[0].productionOrderId, measuredAt: now }),
    };
    await repository.saveMaterialConsumption(row);
    return repository.listMaterialConsumption(workspaceId);
  }

  async function seedQualityIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listQualityEvents(workspaceId);
    if (existing.length > 0) return existing;
    const orders = await seedProductionIfEmpty(workspaceId, organizationId);
    const now = gbaMfgNowIso();
    const row: ManufacturingQualityEvent = {
      qualityEventId: createManufacturingIds().qualityEventId,
      workspaceId,
      organizationId,
      productionOrderId: orders[0].productionOrderId,
      eventType: "IN_PROCESS_INSPECTION",
      severity: "MEDIUM",
      defectCategory: "weld_spatter",
      rootCauseReference: "RCA-WELD-17",
      firstPassYieldPercent: 94,
      note: "Weld cleanup required for 3 units",
      recordedBy: "system",
      recordedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ productionOrderId: orders[0].productionOrderId, recordedAt: now }),
    };
    await repository.saveQualityEvent(row);
    return repository.listQualityEvents(workspaceId);
  }

  async function seedCostingIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listCostRecords(workspaceId);
    if (existing.length > 0) return existing;
    const orders = await seedProductionIfEmpty(workspaceId, organizationId);
    const now = gbaMfgNowIso();
    const materialCost = 61200;
    const laborCost = 22100;
    const machineCost = 18800;
    const overheadCost = 9100;
    const burdenCost = 4800;
    const totalManufacturingCost = materialCost + laborCost + machineCost + overheadCost + burdenCost;
    const costVariance = -2.3;
    const row: ManufacturingCostRecord = {
      manufacturingCostId: createManufacturingIds().manufacturingCostId,
      workspaceId,
      organizationId,
      productionOrderId: orders[0].productionOrderId,
      costingVersion: "v1",
      materialCost,
      laborCost,
      machineCost,
      overheadCost,
      burdenCost,
      totalManufacturingCost,
      costVariance,
      measuredAt: now,
      immutableLineage: createManufacturingImmutableLineage({ productionOrderId: orders[0].productionOrderId, totalManufacturingCost, measuredAt: now }),
    };
    await repository.saveCostRecord(row);
    return repository.listCostRecords(workspaceId);
  }

  async function seedKpisIfEmpty(workspaceId: string, organizationId: string) {
    const existing = await repository.listKpis(workspaceId);
    if (existing.length > 0) return existing;
    const now = gbaMfgNowIso();
    const defs: ManufacturingKpiDefinition[] = [
      { manufacturingKpiId: createManufacturingIds().manufacturingKpiId, workspaceId, organizationId, name: "OEE", target: 85, unit: "%", versionTag: "v1", owner: "Manufacturing Agent", evidenceReferences: ["bg:mfg:oee"], createdAt: now, updatedAt: now },
      { manufacturingKpiId: createManufacturingIds().manufacturingKpiId, workspaceId, organizationId, name: "Scrap rate", target: 2, unit: "%", versionTag: "v1", owner: "Quality Agent", evidenceReferences: ["bg:mfg:scrap"], createdAt: now, updatedAt: now },
      { manufacturingKpiId: createManufacturingIds().manufacturingKpiId, workspaceId, organizationId, name: "First-pass yield", target: 96, unit: "%", versionTag: "v1", owner: "Quality Agent", evidenceReferences: ["bg:mfg:fpy"], createdAt: now, updatedAt: now },
    ];
    for (const def of defs) {
      await repository.saveKpi(def);
      const measured = def.name === "OEE" ? 81 : def.name === "Scrap rate" ? 2.8 : 94;
      await repository.saveKpiHistory({
        manufacturingKpiHistoryId: createManufacturingIds().manufacturingKpiHistoryId,
        manufacturingKpiId: def.manufacturingKpiId,
        workspaceId,
        organizationId,
        measuredValue: measured,
        trend: def.name === "Scrap rate" ? -0.3 : 0.5,
        score: 0,
        status: def.name === "OEE" ? "AT_RISK" : "ON_TRACK",
        measuredAt: now,
        immutableLineage: createManufacturingImmutableLineage({ manufacturingKpiId: def.manufacturingKpiId, measuredAt: now }),
      });
    }
    return repository.listKpis(workspaceId);
  }

  async function publishOperationsSignal(workspaceId: string, organizationId: string) {
    const [orders, machines, labor, quality, kpis] = await Promise.all([
      repository.listProductionOrders(workspaceId),
      repository.listMachines(workspaceId),
      repository.listLabor(workspaceId),
      repository.listQualityEvents(workspaceId),
      listKpis(workspaceId),
    ]);
    const completion = orders.length === 0 ? 0 : Math.round((orders.reduce((acc, row) => acc + row.quantityCompleted, 0) / Math.max(1, orders.reduce((acc, row) => acc + row.quantityPlanned, 0))) * 100);
    const capacity = machines.length === 0 ? 0 : Math.round(machines.reduce((acc, row) => acc + row.utilizationPercent, 0) / machines.length);
    const machineHealthStatus = machines.some((entry) => entry.status === "BLOCKED") ? "UNHEALTHY" : machines.some((entry) => entry.status === "AT_RISK") ? "DEGRADED" : "HEALTHY";
    const laborAvailability = labor.length === 0 ? 0 : Math.round(labor.reduce((acc, row) => acc + row.utilizationPercent, 0) / labor.length);
    const qualityAlerts = quality.filter((entry) => entry.severity === "HIGH").length;
    const signal = {
      operationsSignalId: createManufacturingIds().operationsSignalId,
      workspaceId,
      organizationId,
      productionCompletionPercent: completion,
      capacityUtilizationPercent: capacity,
      materialShortageCount: 1,
      machineHealthStatus,
      laborAvailabilityPercent: laborAvailability,
      qualityAlertCount: qualityAlerts,
      kpiSummary: kpis.slice(0, 5).map((kpi) => `${kpi.name}:${kpi.latest?.measuredValue ?? "n/a"}`),
      publishedAt: gbaMfgNowIso(),
      immutableLineage: createManufacturingImmutableLineage({ workspaceId, completion, capacity, qualityAlerts, at: gbaMfgNowIso() }),
    } as const;
    await repository.saveOperationsSignal(signal);
    return signal;
  }

  async function listRecommendations(workspaceId: string) {
    const existing = await repository.listRecommendations(workspaceId);
    if (existing.length > 0) return existing;
    const [machines, quality, materials] = await Promise.all([
      seedMachinesIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID),
      seedQualityIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID),
      seedMaterialsIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID),
    ]);

    const machineAtRisk = machines.filter((entry) => entry.utilizationPercent > 85).length;
    const highQuality = quality.filter((entry) => entry.severity === "HIGH").length;
    const materialVariance = materials.filter((entry) => Math.abs(entry.variancePercent) >= 2).length;

    const candidates: Array<Omit<ManufacturingRecommendation, "manufacturingRecommendationId" | "deterministicChecksum" | "createdAt" | "immutableLineage">> = [
      {
        workspaceId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        category: "SCHEDULING",
        title: "Reduce peak station contention",
        summary: `Detected ${machineAtRisk} stations above 85% utilization. Rebalance sequence windows across work centers.`,
        evidenceReferences: ["bg:mfg:scheduling", ...machines.map((entry) => entry.machineType)],
        confidence: "MEDIUM",
        businessImpact: "Improves throughput consistency and on-time completion.",
        estimatedSavings: 18000,
        suggestedOwner: "Manufacturing Agent",
        requiredApprovals: ["COO"],
        priority: "P2",
        reviewed: false,
      },
      {
        workspaceId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        category: "SCRAP",
        title: "Drive scrap and rework reduction",
        summary: `Material variance signals: ${materialVariance}; high-severity quality alerts: ${highQuality}. Launch focused defect containment plan.`,
        evidenceReferences: ["bg:mfg:scrap", ...quality.map((entry) => entry.defectCategory)],
        confidence: "HIGH",
        businessImpact: "Reduces material waste and protects margin.",
        estimatedSavings: 24500,
        suggestedOwner: "Quality Agent",
        requiredApprovals: ["COO", "CFO"],
        priority: "P1",
        reviewed: false,
      },
    ];

    const built: ManufacturingRecommendation[] = [];
    for (const candidate of candidates.sort((a, b) => a.title.localeCompare(b.title))) {
      const id = createManufacturingIds().manufacturingRecommendationId;
      const createdAt = gbaMfgNowIso();
      const deterministicChecksum = gbaMfgChecksum(canonicalizeManufacturingRecommendation(candidate));
      const rec: ManufacturingRecommendation = {
        manufacturingRecommendationId: id,
        ...candidate,
        deterministicChecksum,
        createdAt,
        immutableLineage: createManufacturingImmutableLineage({ id, deterministicChecksum, createdAt }),
      };
      await repository.saveRecommendation(rec);
      await repository.saveTimelineEvent({
        manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
        workspaceId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        eventType: "RECOMMENDATION_CREATED",
        subjectId: rec.manufacturingRecommendationId,
        summary: rec.title,
        actorId: "system",
        evidenceReferences: rec.evidenceReferences,
        createdAt,
      });
      built.push(rec);
    }

    return built;
  }

  async function computeHealth(workspaceId: string, organizationId: string): Promise<ManufacturingHealthSnapshot> {
    const [orders, quality, machines, materials, recommendations] = await Promise.all([
      repository.listProductionOrders(workspaceId),
      repository.listQualityEvents(workspaceId),
      repository.listMachines(workspaceId),
      repository.listMaterialConsumption(workspaceId),
      repository.listRecommendations(workspaceId),
    ]);

    const blockedProductionOrders = orders.filter((entry) => entry.status === "BLOCKED").length;
    const criticalQualityEvents = quality.filter((entry) => entry.severity === "HIGH").length;
    const machineDowntimeSignals = machines.filter((entry) => entry.downtimeMinutes > 45).length;
    const materialVarianceSignals = materials.filter((entry) => Math.abs(entry.variancePercent) > 2).length;
    const unreviewedRecommendations = recommendations.filter((entry) => !entry.reviewed).length;

    const score = blockedProductionOrders + criticalQualityEvents + machineDowntimeSignals + materialVarianceSignals;
    const status: ManufacturingHealthSnapshot["status"] = score <= 1 ? "HEALTHY" : score <= 4 ? "DEGRADED" : "UNHEALTHY";

    return {
      manufacturingHealthId: createManufacturingIds().manufacturingHealthId,
      workspaceId,
      organizationId,
      status,
      blockedProductionOrders,
      criticalQualityEvents,
      machineDowntimeSignals,
      materialVarianceSignals,
      unreviewedRecommendations,
      generatedAt: gbaMfgNowIso(),
      immutableLineage: createManufacturingImmutableLineage({ workspaceId, blockedProductionOrders, criticalQualityEvents, machineDowntimeSignals, materialVarianceSignals, unreviewedRecommendations }),
    };
  }

  async function listExecutiveReports(workspaceId: string) {
    const existing = await repository.listExecutiveReports(workspaceId);
    if (existing.length > 0) return existing;

    const [dashboard, healthRows, costingRows, recommendations] = await Promise.all([
      getDashboard(workspaceId, DEFAULT_ORGANIZATION_ID),
      repository.listHealth(workspaceId),
      listCosting(workspaceId),
      listRecommendations(workspaceId),
    ]);
    const now = gbaMfgNowIso();

    const report: ManufacturingExecutiveReport = {
      manufacturingExecutiveReportId: createManufacturingIds().manufacturingExecutiveReportId,
      workspaceId,
      organizationId: DEFAULT_ORGANIZATION_ID,
      period: "DAILY",
      productionSummary: [
        `Active production score ${dashboard.activeProduction.value}`,
        `Forecast output ${dashboard.forecastOutput.value} ${dashboard.forecastOutput.unit}`,
      ],
      capacityOutlook: [`Machine utilization ${dashboard.machineUtilization.value}%`, `Labor utilization ${dashboard.laborUtilization.value}%`],
      qualitySummary: [`Quality score ${dashboard.qualityScore.value}`, `Scrap rate ${dashboard.scrapRate.value}%`],
      costSummary: [`Latest total manufacturing cost ${costingRows[0]?.totalManufacturingCost ?? 0}`],
      risks: healthRows.length > 0 ? [`Health status ${healthRows[0].status}`] : ["Health pending"],
      opportunities: recommendations.slice(0, 3).map((entry) => entry.title),
      createdAt: now,
      immutableLineage: createManufacturingImmutableLineage({ workspaceId, period: "DAILY", createdAt: now }),
    };
    await repository.saveExecutiveReport(report);
    await repository.saveTimelineEvent({
      manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
      workspaceId,
      organizationId: DEFAULT_ORGANIZATION_ID,
      eventType: "EXECUTIVE_REPORT_PUBLISHED",
      subjectId: report.manufacturingExecutiveReportId,
      summary: "Manufacturing daily executive report published",
      actorId: "system",
      evidenceReferences: ["bg:mfg:executive_report"],
      createdAt: now,
    });

    return repository.listExecutiveReports(workspaceId);
  }

  async function getDashboard(workspaceId: string, organizationId: string, filters: ManufacturingScopeFilter = {}): Promise<ManufacturingDashboard> {
    await Promise.all([
      seedBomsIfEmpty(workspaceId, organizationId),
      seedRoutingsIfEmpty(workspaceId, organizationId),
      seedProductionIfEmpty(workspaceId, organizationId),
      seedMachinesIfEmpty(workspaceId, organizationId),
      seedLaborIfEmpty(workspaceId, organizationId),
      seedMaterialsIfEmpty(workspaceId, organizationId),
      seedQualityIfEmpty(workspaceId, organizationId),
      seedCostingIfEmpty(workspaceId, organizationId),
      seedKpisIfEmpty(workspaceId, organizationId),
    ]);

    const [orders, machines, labor, quality, materials] = await Promise.all([
      repository.listProductionOrders(workspaceId),
      repository.listMachines(workspaceId),
      repository.listLabor(workspaceId),
      repository.listQualityEvents(workspaceId),
      repository.listMaterialConsumption(workspaceId),
    ]);

    const activeProductionCount = orders.filter((entry) => entry.status === "IN_PROGRESS").length;
    const queueCount = orders.filter((entry) => entry.status === "PLANNED").length;
    const machineUtilization = machines.length > 0 ? Math.round(machines.reduce((acc, row) => acc + row.utilizationPercent, 0) / machines.length) : 0;
    const laborUtilization = labor.length > 0 ? Math.round(labor.reduce((acc, row) => acc + row.utilizationPercent, 0) / labor.length) : 0;
    const bottleneckCount = machines.filter((entry) => entry.utilizationPercent > 85).length;
    const efficiency = orders.length > 0 ? Math.round((orders.reduce((acc, row) => acc + row.quantityCompleted, 0) / Math.max(1, orders.reduce((acc, row) => acc + row.quantityPlanned, 0))) * 100) : 0;
    const avgFpy = quality.length > 0 ? Math.round(quality.reduce((acc, row) => acc + row.firstPassYieldPercent, 0) / quality.length) : 95;
    const scrapRate = materials.length > 0 ? Number((materials.reduce((acc, row) => acc + row.scrapQuantity, 0) / Math.max(1, materials.reduce((acc, row) => acc + row.rawMaterialUsed, 0)) * 100).toFixed(2)) : 0;
    const reworkRate = materials.length > 0 ? Number((materials.reduce((acc, row) => acc + row.reworkMaterialQuantity, 0) / Math.max(1, materials.reduce((acc, row) => acc + row.rawMaterialUsed, 0)) * 100).toFixed(2)) : 0;
    const downtimeMinutes = machines.reduce((acc, row) => acc + row.downtimeMinutes, 0);
    const forecastOutput = orders.reduce((acc, row) => acc + row.quantityPlanned, 0);

    return {
      workspaceId,
      organizationId,
      filters,
      activeProduction: { key: "active_production", label: "Active Production", value: activeProductionCount, unit: "orders", trend: 0.4, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:orders"] },
      productionQueues: { key: "production_queues", label: "Production Queues", value: queueCount, unit: "orders", trend: -0.2, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:queues"] },
      machineUtilization: { key: "machine_utilization", label: "Machine Utilization", value: machineUtilization, unit: "%", trend: 0.6, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:machines"] },
      laborUtilization: { key: "labor_utilization", label: "Labor Utilization", value: laborUtilization, unit: "%", trend: 0.3, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:labor"] },
      bottlenecks: { key: "bottlenecks", label: "Bottlenecks", value: bottleneckCount, unit: "count", trend: -0.1, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:bottlenecks"] },
      productionEfficiency: { key: "production_efficiency", label: "Production Efficiency", value: efficiency, unit: "%", trend: 0.5, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:efficiency"] },
      qualityScore: { key: "quality_score", label: "Quality Score", value: avgFpy, unit: "%", trend: 0.2, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:quality"] },
      scrapRate: { key: "scrap_rate", label: "Scrap Rate", value: scrapRate, unit: "%", trend: -0.4, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:scrap"] },
      reworkRate: { key: "rework_rate", label: "Rework Rate", value: reworkRate, unit: "%", trend: -0.2, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:rework"] },
      downtimeMinutes: { key: "downtime_minutes", label: "Downtime", value: downtimeMinutes, unit: "minutes", trend: -0.3, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:downtime"] },
      forecastOutput: { key: "forecast_output", label: "Forecast Output", value: forecastOutput, unit: "units", trend: 1.1, asOf: gbaMfgNowIso(), evidenceReferences: ["bg:mfg:forecast"] },
      generatedAt: gbaMfgNowIso(),
      immutableLineage: createManufacturingImmutableLineage({ workspaceId, organizationId, filters, generatedAt: gbaMfgNowIso() }),
    };
  }

  async function listKpis(workspaceId: string) {
    const [defs, history] = await Promise.all([seedKpisIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID), repository.listKpiHistory(workspaceId)]);
    const latestById = new Map<string, ManufacturingKpiHistory>();
    for (const row of history) {
      if (!latestById.has(row.manufacturingKpiId)) {
        latestById.set(row.manufacturingKpiId, row);
      }
    }
    return defs.map((entry) => {
      const latest = latestById.get(entry.manufacturingKpiId);
      if (!latest) return { ...entry };
      return { ...entry, latest: { ...latest, score: scoreKpi(entry, latest) } };
    });
  }

  async function listHealth(workspaceId: string) {
    const health = await computeHealth(workspaceId, DEFAULT_ORGANIZATION_ID);
    await repository.saveHealth(health);
    return repository.listHealth(workspaceId);
  }

  async function createProductionOrder(input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    title: string;
    sku: string;
    priority: ManufacturingProductionOrder["priority"];
    quantityPlanned: number;
    scheduledStartAt: string;
    scheduledEndAt: string;
    operationsWorkOrderId?: string;
  }) {
    const now = gbaMfgNowIso();
    const order: ManufacturingProductionOrder = {
      productionOrderId: createManufacturingIds().productionOrderId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      operationsWorkOrderId: input.operationsWorkOrderId,
      title: input.title,
      sku: input.sku,
      bomRevision: "A",
      routingRevision: "A",
      priority: input.priority,
      status: "PLANNED",
      quantityPlanned: input.quantityPlanned,
      quantityCompleted: 0,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      materialAllocations: [{ sku: "RAW-ALU-001", quantity: Math.max(1, Math.round(input.quantityPlanned * 5)) }],
      laborAssignments: [],
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ title: input.title, sku: input.sku, quantityPlanned: input.quantityPlanned, createdAt: now }),
    };
    await repository.saveProductionOrder(order);
    await repository.saveProductionOrderHistory({
      productionOrderHistoryId: createManufacturingIds().productionOrderHistoryId,
      productionOrderId: order.productionOrderId,
      workspaceId: order.workspaceId,
      organizationId: order.organizationId,
      fromStatus: "PLANNED",
      toStatus: "PLANNED",
      note: "Production order created",
      changedBy: input.actorId,
      changedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ productionOrderId: order.productionOrderId, changedAt: now }),
    });
    await repository.saveTimelineEvent({
      manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
      workspaceId: order.workspaceId,
      organizationId: order.organizationId,
      eventType: "PRODUCTION_ORDER_CREATED",
      subjectId: order.productionOrderId,
      summary: `Production order created: ${order.title}`,
      actorId: input.actorId,
      evidenceReferences: ["bg:mfg:production_orders"],
      createdAt: now,
    });
    await publishOperationsSignal(order.workspaceId, order.organizationId);
    return order;
  }

  async function recordQualityEvent(input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    productionOrderId: string;
    eventType: ManufacturingQualityEvent["eventType"];
    severity: ManufacturingQualityEvent["severity"];
    defectCategory: string;
    note: string;
    firstPassYieldPercent: number;
    rootCauseReference?: string;
  }) {
    const now = gbaMfgNowIso();
    const event: ManufacturingQualityEvent = {
      qualityEventId: createManufacturingIds().qualityEventId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      productionOrderId: input.productionOrderId,
      eventType: input.eventType,
      severity: input.severity,
      defectCategory: input.defectCategory,
      rootCauseReference: input.rootCauseReference,
      firstPassYieldPercent: input.firstPassYieldPercent,
      note: input.note,
      recordedBy: input.actorId,
      recordedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ productionOrderId: input.productionOrderId, eventType: input.eventType, recordedAt: now }),
    };
    await repository.saveQualityEvent(event);
    await repository.saveTimelineEvent({
      manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      eventType: "QUALITY_EVENT_RECORDED",
      subjectId: event.qualityEventId,
      summary: `${event.eventType} (${event.severity})`,
      actorId: input.actorId,
      evidenceReferences: [event.defectCategory],
      createdAt: now,
    });
    await publishOperationsSignal(input.workspaceId, input.organizationId);
    return event;
  }

  async function updateMachineStatus(input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    machineId: string;
    status: ManufacturingMachine["status"];
    note: string;
  }) {
    const machines = await seedMachinesIfEmpty(input.workspaceId, input.organizationId);
    const target = machines.find((entry) => entry.machineId === input.machineId);
    if (!target) throw new Error("Machine not found.");
    const now = gbaMfgNowIso();
    const next: ManufacturingMachine = {
      ...target,
      status: input.status,
      updatedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ machineId: target.machineId, status: input.status, updatedAt: now }),
    };
    await repository.saveMachine(next);
    await repository.saveMachineHistory({
      machineHistoryId: createManufacturingIds().machineHistoryId,
      machineId: next.machineId,
      workspaceId: next.workspaceId,
      organizationId: next.organizationId,
      status: next.status,
      note: input.note,
      changedBy: input.actorId,
      changedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ machineId: next.machineId, status: next.status, changedAt: now }),
    });
    await repository.saveTimelineEvent({
      manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
      workspaceId: next.workspaceId,
      organizationId: next.organizationId,
      eventType: "MACHINE_STATUS_UPDATED",
      subjectId: next.machineId,
      summary: `${next.machineType} status -> ${next.status}`,
      actorId: input.actorId,
      evidenceReferences: [next.machineType],
      createdAt: now,
    });
    await publishOperationsSignal(input.workspaceId, input.organizationId);
    return next;
  }

  async function reviewRecommendation(input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    manufacturingRecommendationId: string;
    decision: "APPROVED" | "REJECTED";
    notes?: string;
  }) {
    const recommendations = await listRecommendations(input.workspaceId);
    const recommendation = recommendations.find((entry) => entry.manufacturingRecommendationId === input.manufacturingRecommendationId);
    if (!recommendation) {
      throw new Error("Recommendation not found.");
    }
    const now = gbaMfgNowIso();
    const review: ManufacturingRecommendationReview = {
      manufacturingRecommendationReviewId: createManufacturingIds().manufacturingRecommendationReviewId,
      manufacturingRecommendationId: recommendation.manufacturingRecommendationId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      decision: input.decision,
      notes: input.notes,
      reviewedBy: input.actorId,
      reviewedAt: now,
      immutableLineage: createManufacturingImmutableLineage({ recommendationId: recommendation.manufacturingRecommendationId, decision: input.decision, reviewedAt: now }),
    };
    await repository.saveRecommendation({ ...recommendation, reviewed: true });
    await repository.saveRecommendationReview(review);
    await repository.saveTimelineEvent({
      manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      eventType: "RECOMMENDATION_REVIEWED",
      subjectId: recommendation.manufacturingRecommendationId,
      summary: `Manufacturing recommendation ${input.decision.toLowerCase()}`,
      actorId: input.actorId,
      evidenceReferences: recommendation.evidenceReferences,
      createdAt: now,
    });
    return review;
  }

  return {
    getDashboard,
    async listBoms(workspaceId) {
      await seedBomsIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listBoms(workspaceId);
    },
    async listRoutings(workspaceId) {
      await seedRoutingsIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listRoutings(workspaceId);
    },
    async listProductionOrders(workspaceId) {
      await seedProductionIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listProductionOrders(workspaceId);
    },
    async listMachines(workspaceId) {
      await seedMachinesIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listMachines(workspaceId);
    },
    async listLabor(workspaceId) {
      await seedLaborIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listLabor(workspaceId);
    },
    async listMaterials(workspaceId) {
      await seedMaterialsIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listMaterialConsumption(workspaceId);
    },
    async listQuality(workspaceId) {
      await seedQualityIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listQualityEvents(workspaceId);
    },
    async listCosting(workspaceId) {
      await seedCostingIfEmpty(workspaceId, DEFAULT_ORGANIZATION_ID);
      return repository.listCostRecords(workspaceId);
    },
    async listKpis(workspaceId) {
      return listKpis(workspaceId);
    },
    async listRecommendations(workspaceId) {
      return listRecommendations(workspaceId);
    },
    async listTimeline(workspaceId) {
      return repository.listTimeline(workspaceId);
    },
    async listHealth(workspaceId) {
      return listHealth(workspaceId);
    },
    async listExecutiveReports(workspaceId) {
      const contextPackageId = await ensureContext(workspaceId, DEFAULT_ORGANIZATION_ID);
      const reports = await listExecutiveReports(workspaceId);
      if (contextPackageId) {
        await repository.saveTimelineEvent({
          manufacturingTimelineEventId: createManufacturingIds().manufacturingTimelineEventId,
          workspaceId,
          organizationId: DEFAULT_ORGANIZATION_ID,
          eventType: "CONTEXT_LINKED",
          subjectId: contextPackageId,
          summary: "Manufacturing context package linked",
          actorId: "system",
          evidenceReferences: [contextPackageId],
          createdAt: gbaMfgNowIso(),
        });
      }
      return reports;
    },
    createProductionOrder,
    recordQualityEvent,
    updateMachineStatus,
    reviewRecommendation,
  };
}
