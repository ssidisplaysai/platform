import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  ManufacturingBom,
  ManufacturingBomHistory,
  ManufacturingCostRecord,
  ManufacturingExecutiveReport,
  ManufacturingHealthSnapshot,
  ManufacturingKpiDefinition,
  ManufacturingKpiHistory,
  ManufacturingLabor,
  ManufacturingLaborHistory,
  ManufacturingMachine,
  ManufacturingMachineHistory,
  ManufacturingMaterialConsumption,
  ManufacturingOperationsSignal,
  ManufacturingProductionOrder,
  ManufacturingProductionOrderHistory,
  ManufacturingQualityEvent,
  ManufacturingRecommendation,
  ManufacturingRecommendationReview,
  ManufacturingRouting,
  ManufacturingRoutingHistory,
  ManufacturingTimelineEvent,
} from "./manufacturing-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type ManufacturingRepository = {
  saveBom: (entry: ManufacturingBom) => Promise<ManufacturingBom>;
  listBoms: (workspaceId: string) => Promise<ManufacturingBom[]>;
  saveBomHistory: (entry: ManufacturingBomHistory) => Promise<ManufacturingBomHistory>;
  listBomHistory: (workspaceId: string, bomId?: string) => Promise<ManufacturingBomHistory[]>;

  saveRouting: (entry: ManufacturingRouting) => Promise<ManufacturingRouting>;
  listRoutings: (workspaceId: string) => Promise<ManufacturingRouting[]>;
  saveRoutingHistory: (entry: ManufacturingRoutingHistory) => Promise<ManufacturingRoutingHistory>;
  listRoutingHistory: (workspaceId: string, routingId?: string) => Promise<ManufacturingRoutingHistory[]>;

  saveProductionOrder: (entry: ManufacturingProductionOrder) => Promise<ManufacturingProductionOrder>;
  listProductionOrders: (workspaceId: string) => Promise<ManufacturingProductionOrder[]>;
  saveProductionOrderHistory: (entry: ManufacturingProductionOrderHistory) => Promise<ManufacturingProductionOrderHistory>;
  listProductionOrderHistory: (workspaceId: string, productionOrderId?: string) => Promise<ManufacturingProductionOrderHistory[]>;

  saveMachine: (entry: ManufacturingMachine) => Promise<ManufacturingMachine>;
  listMachines: (workspaceId: string) => Promise<ManufacturingMachine[]>;
  saveMachineHistory: (entry: ManufacturingMachineHistory) => Promise<ManufacturingMachineHistory>;
  listMachineHistory: (workspaceId: string, machineId?: string) => Promise<ManufacturingMachineHistory[]>;

  saveLabor: (entry: ManufacturingLabor) => Promise<ManufacturingLabor>;
  listLabor: (workspaceId: string) => Promise<ManufacturingLabor[]>;
  saveLaborHistory: (entry: ManufacturingLaborHistory) => Promise<ManufacturingLaborHistory>;
  listLaborHistory: (workspaceId: string, laborRecordId?: string) => Promise<ManufacturingLaborHistory[]>;

  saveMaterialConsumption: (entry: ManufacturingMaterialConsumption) => Promise<ManufacturingMaterialConsumption>;
  listMaterialConsumption: (workspaceId: string) => Promise<ManufacturingMaterialConsumption[]>;

  saveQualityEvent: (entry: ManufacturingQualityEvent) => Promise<ManufacturingQualityEvent>;
  listQualityEvents: (workspaceId: string) => Promise<ManufacturingQualityEvent[]>;

  saveCostRecord: (entry: ManufacturingCostRecord) => Promise<ManufacturingCostRecord>;
  listCostRecords: (workspaceId: string) => Promise<ManufacturingCostRecord[]>;

  saveKpi: (entry: ManufacturingKpiDefinition) => Promise<ManufacturingKpiDefinition>;
  listKpis: (workspaceId: string) => Promise<ManufacturingKpiDefinition[]>;
  saveKpiHistory: (entry: ManufacturingKpiHistory) => Promise<ManufacturingKpiHistory>;
  listKpiHistory: (workspaceId: string, manufacturingKpiId?: string) => Promise<ManufacturingKpiHistory[]>;

  saveRecommendation: (entry: ManufacturingRecommendation) => Promise<ManufacturingRecommendation>;
  listRecommendations: (workspaceId: string) => Promise<ManufacturingRecommendation[]>;
  saveRecommendationReview: (entry: ManufacturingRecommendationReview) => Promise<ManufacturingRecommendationReview>;
  listRecommendationReviews: (workspaceId: string, manufacturingRecommendationId?: string) => Promise<ManufacturingRecommendationReview[]>;

  saveOperationsSignal: (entry: ManufacturingOperationsSignal) => Promise<ManufacturingOperationsSignal>;
  listOperationsSignals: (workspaceId: string) => Promise<ManufacturingOperationsSignal[]>;

  saveExecutiveReport: (entry: ManufacturingExecutiveReport) => Promise<ManufacturingExecutiveReport>;
  listExecutiveReports: (workspaceId: string) => Promise<ManufacturingExecutiveReport[]>;

  saveTimelineEvent: (entry: ManufacturingTimelineEvent) => Promise<ManufacturingTimelineEvent>;
  listTimeline: (workspaceId: string) => Promise<ManufacturingTimelineEvent[]>;

  saveHealth: (entry: ManufacturingHealthSnapshot) => Promise<ManufacturingHealthSnapshot>;
  listHealth: (workspaceId: string) => Promise<ManufacturingHealthSnapshot[]>;
};

export function createInMemoryManufacturingRepository(): ManufacturingRepository {
  const boms = new Map<string, ManufacturingBom>();
  const bomHistory = new Map<string, ManufacturingBomHistory>();
  const routings = new Map<string, ManufacturingRouting>();
  const routingHistory = new Map<string, ManufacturingRoutingHistory>();
  const productionOrders = new Map<string, ManufacturingProductionOrder>();
  const productionOrderHistory = new Map<string, ManufacturingProductionOrderHistory>();
  const machines = new Map<string, ManufacturingMachine>();
  const machineHistory = new Map<string, ManufacturingMachineHistory>();
  const labor = new Map<string, ManufacturingLabor>();
  const laborHistory = new Map<string, ManufacturingLaborHistory>();
  const materials = new Map<string, ManufacturingMaterialConsumption>();
  const quality = new Map<string, ManufacturingQualityEvent>();
  const costing = new Map<string, ManufacturingCostRecord>();
  const kpis = new Map<string, ManufacturingKpiDefinition>();
  const kpiHistory = new Map<string, ManufacturingKpiHistory>();
  const recommendations = new Map<string, ManufacturingRecommendation>();
  const recommendationReviews = new Map<string, ManufacturingRecommendationReview>();
  const operationsSignals = new Map<string, ManufacturingOperationsSignal>();
  const executiveReports = new Map<string, ManufacturingExecutiveReport>();
  const timeline = new Map<string, ManufacturingTimelineEvent>();
  const health = new Map<string, ManufacturingHealthSnapshot>();

  return {
    async saveBom(entry) { boms.set(entry.bomId, entry); return entry; },
    async listBoms(workspaceId) { return [...boms.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveBomHistory(entry) { bomHistory.set(entry.bomHistoryId, entry); return entry; },
    async listBomHistory(workspaceId, bomId) {
      const rows = [...bomHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = bomId ? rows.filter((entry) => entry.bomId === bomId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveRouting(entry) { routings.set(entry.routingId, entry); return entry; },
    async listRoutings(workspaceId) { return [...routings.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveRoutingHistory(entry) { routingHistory.set(entry.routingHistoryId, entry); return entry; },
    async listRoutingHistory(workspaceId, routingId) {
      const rows = [...routingHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = routingId ? rows.filter((entry) => entry.routingId === routingId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveProductionOrder(entry) { productionOrders.set(entry.productionOrderId, entry); return entry; },
    async listProductionOrders(workspaceId) { return [...productionOrders.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveProductionOrderHistory(entry) { productionOrderHistory.set(entry.productionOrderHistoryId, entry); return entry; },
    async listProductionOrderHistory(workspaceId, productionOrderId) {
      const rows = [...productionOrderHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = productionOrderId ? rows.filter((entry) => entry.productionOrderId === productionOrderId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveMachine(entry) { machines.set(entry.machineId, entry); return entry; },
    async listMachines(workspaceId) { return [...machines.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveMachineHistory(entry) { machineHistory.set(entry.machineHistoryId, entry); return entry; },
    async listMachineHistory(workspaceId, machineId) {
      const rows = [...machineHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = machineId ? rows.filter((entry) => entry.machineId === machineId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveLabor(entry) { labor.set(entry.laborRecordId, entry); return entry; },
    async listLabor(workspaceId) { return [...labor.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveLaborHistory(entry) { laborHistory.set(entry.laborHistoryId, entry); return entry; },
    async listLaborHistory(workspaceId, laborRecordId) {
      const rows = [...laborHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = laborRecordId ? rows.filter((entry) => entry.laborRecordId === laborRecordId) : rows;
      return scoped.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    async saveMaterialConsumption(entry) { materials.set(entry.materialConsumptionId, entry); return entry; },
    async listMaterialConsumption(workspaceId) { return [...materials.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },

    async saveQualityEvent(entry) { quality.set(entry.qualityEventId, entry); return entry; },
    async listQualityEvents(workspaceId) { return [...quality.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)); },

    async saveCostRecord(entry) { costing.set(entry.manufacturingCostId, entry); return entry; },
    async listCostRecords(workspaceId) { return [...costing.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); },

    async saveKpi(entry) { kpis.set(entry.manufacturingKpiId, entry); return entry; },
    async listKpis(workspaceId) { return [...kpis.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveKpiHistory(entry) { kpiHistory.set(entry.manufacturingKpiHistoryId, entry); return entry; },
    async listKpiHistory(workspaceId, manufacturingKpiId) {
      const rows = [...kpiHistory.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = manufacturingKpiId ? rows.filter((entry) => entry.manufacturingKpiId === manufacturingKpiId) : rows;
      return scoped.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    },

    async saveRecommendation(entry) { recommendations.set(entry.manufacturingRecommendationId, entry); return entry; },
    async listRecommendations(workspaceId) { return [...recommendations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async saveRecommendationReview(entry) { recommendationReviews.set(entry.manufacturingRecommendationReviewId, entry); return entry; },
    async listRecommendationReviews(workspaceId, manufacturingRecommendationId) {
      const rows = [...recommendationReviews.values()].filter((entry) => entry.workspaceId === workspaceId);
      const scoped = manufacturingRecommendationId ? rows.filter((entry) => entry.manufacturingRecommendationId === manufacturingRecommendationId) : rows;
      return scoped.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    },

    async saveOperationsSignal(entry) { operationsSignals.set(entry.operationsSignalId, entry); return entry; },
    async listOperationsSignals(workspaceId) { return [...operationsSignals.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)); },

    async saveExecutiveReport(entry) { executiveReports.set(entry.manufacturingExecutiveReportId, entry); return entry; },
    async listExecutiveReports(workspaceId) { return [...executiveReports.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveTimelineEvent(entry) { timeline.set(entry.manufacturingTimelineEventId, entry); return entry; },
    async listTimeline(workspaceId) { return [...timeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async saveHealth(entry) { health.set(entry.manufacturingHealthId, entry); return entry; },
    async listHealth(workspaceId) { return [...health.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)); },
  };
}

export function createPrismaManufacturingRepository(prismaClient?: PrismaClient): ManufacturingRepository {
  const prisma = prismaClient ?? getPrismaClient();

  const saveTimeline = async (entry: ManufacturingTimelineEvent) => {
    await prisma.gbaManufacturingTimelineEvent.upsert({
      where: { manufacturingTimelineEventId: entry.manufacturingTimelineEventId },
      create: {
        manufacturingTimelineEventId: entry.manufacturingTimelineEventId,
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
        summary: entry.summary,
        evidenceReferences: toJson(entry.evidenceReferences),
      },
    });
    return entry;
  };

  return {
    async saveBom(entry) {
      await prisma.gbaManufacturingBom.upsert({
        where: { bomId: entry.bomId },
        create: {
          bomId: entry.bomId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          sku: entry.sku,
          revision: entry.revision,
          level: entry.level,
          effectiveFrom: new Date(entry.effectiveFrom),
          effectiveTo: entry.effectiveTo ? new Date(entry.effectiveTo) : null,
          components: toJson(entry.components),
          approvedSubstitutions: toJson(entry.approvedSubstitutions),
          costRollup: entry.costRollup,
          createdBy: entry.createdBy,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          revision: entry.revision,
          level: entry.level,
          effectiveFrom: new Date(entry.effectiveFrom),
          effectiveTo: entry.effectiveTo ? new Date(entry.effectiveTo) : null,
          components: toJson(entry.components),
          approvedSubstitutions: toJson(entry.approvedSubstitutions),
          costRollup: entry.costRollup,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listBoms(workspaceId) {
      const rows = await prisma.gbaManufacturingBom.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        bomId: row.bomId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        sku: row.sku,
        revision: row.revision,
        level: row.level,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo?.toISOString(),
        components: row.components as ManufacturingBom["components"],
        approvedSubstitutions: row.approvedSubstitutions as string[],
        costRollup: row.costRollup,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveBomHistory(entry) {
      await prisma.gbaManufacturingBomHistory.upsert({
        where: { bomHistoryId: entry.bomHistoryId },
        create: {
          bomHistoryId: entry.bomHistoryId,
          bomId: entry.bomId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          revision: entry.revision,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          revision: entry.revision,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listBomHistory(workspaceId, bomId) {
      const rows = await prisma.gbaManufacturingBomHistory.findMany({ where: { workspaceId, ...(bomId ? { bomId } : {}) }, orderBy: { changedAt: "desc" } });
      return rows.map((row) => ({
        bomHistoryId: row.bomHistoryId,
        bomId: row.bomId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        revision: row.revision,
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveRouting(entry) {
      await prisma.gbaManufacturingRouting.upsert({
        where: { routingId: entry.routingId },
        create: {
          routingId: entry.routingId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          sku: entry.sku,
          revision: entry.revision,
          workCenter: entry.workCenter,
          machineAssignments: toJson(entry.machineAssignments),
          processSteps: toJson(entry.processSteps),
          laborRequirements: toJson(entry.laborRequirements),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          revision: entry.revision,
          workCenter: entry.workCenter,
          machineAssignments: toJson(entry.machineAssignments),
          processSteps: toJson(entry.processSteps),
          laborRequirements: toJson(entry.laborRequirements),
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listRoutings(workspaceId) {
      const rows = await prisma.gbaManufacturingRouting.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        routingId: row.routingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        sku: row.sku,
        revision: row.revision,
        workCenter: row.workCenter,
        machineAssignments: row.machineAssignments as string[],
        processSteps: row.processSteps as ManufacturingRouting["processSteps"],
        laborRequirements: row.laborRequirements as ManufacturingRouting["laborRequirements"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveRoutingHistory(entry) {
      await prisma.gbaManufacturingRoutingHistory.upsert({
        where: { routingHistoryId: entry.routingHistoryId },
        create: {
          routingHistoryId: entry.routingHistoryId,
          routingId: entry.routingId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          revision: entry.revision,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          revision: entry.revision,
          note: entry.note,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listRoutingHistory(workspaceId, routingId) {
      const rows = await prisma.gbaManufacturingRoutingHistory.findMany({ where: { workspaceId, ...(routingId ? { routingId } : {}) }, orderBy: { changedAt: "desc" } });
      return rows.map((row) => ({
        routingHistoryId: row.routingHistoryId,
        routingId: row.routingId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        revision: row.revision,
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveProductionOrder(entry) {
      await prisma.gbaManufacturingProductionOrder.upsert({
        where: { productionOrderId: entry.productionOrderId },
        create: {
          productionOrderId: entry.productionOrderId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          operationsWorkOrderId: entry.operationsWorkOrderId ?? null,
          title: entry.title,
          sku: entry.sku,
          bomRevision: entry.bomRevision,
          routingRevision: entry.routingRevision,
          priority: entry.priority,
          status: entry.status,
          quantityPlanned: entry.quantityPlanned,
          quantityCompleted: entry.quantityCompleted,
          scheduledStartAt: new Date(entry.scheduledStartAt),
          scheduledEndAt: new Date(entry.scheduledEndAt),
          materialAllocations: toJson(entry.materialAllocations),
          laborAssignments: toJson(entry.laborAssignments),
          createdBy: entry.createdBy,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          priority: entry.priority,
          quantityCompleted: entry.quantityCompleted,
          scheduledStartAt: new Date(entry.scheduledStartAt),
          scheduledEndAt: new Date(entry.scheduledEndAt),
          materialAllocations: toJson(entry.materialAllocations),
          laborAssignments: toJson(entry.laborAssignments),
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listProductionOrders(workspaceId) {
      const rows = await prisma.gbaManufacturingProductionOrder.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        productionOrderId: row.productionOrderId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        operationsWorkOrderId: row.operationsWorkOrderId ?? undefined,
        title: row.title,
        sku: row.sku,
        bomRevision: row.bomRevision,
        routingRevision: row.routingRevision,
        priority: row.priority as ManufacturingProductionOrder["priority"],
        status: row.status as ManufacturingProductionOrder["status"],
        quantityPlanned: row.quantityPlanned,
        quantityCompleted: row.quantityCompleted,
        scheduledStartAt: row.scheduledStartAt.toISOString(),
        scheduledEndAt: row.scheduledEndAt.toISOString(),
        materialAllocations: row.materialAllocations as ManufacturingProductionOrder["materialAllocations"],
        laborAssignments: row.laborAssignments as string[],
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveProductionOrderHistory(entry) {
      await prisma.gbaManufacturingProductionOrderHistory.upsert({
        where: { productionOrderHistoryId: entry.productionOrderHistoryId },
        create: {
          productionOrderHistoryId: entry.productionOrderHistoryId,
          productionOrderId: entry.productionOrderId,
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
    async listProductionOrderHistory(workspaceId, productionOrderId) {
      const rows = await prisma.gbaManufacturingProductionOrderHistory.findMany({ where: { workspaceId, ...(productionOrderId ? { productionOrderId } : {}) }, orderBy: { changedAt: "desc" } });
      return rows.map((row) => ({
        productionOrderHistoryId: row.productionOrderHistoryId,
        productionOrderId: row.productionOrderId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        fromStatus: row.fromStatus as ManufacturingProductionOrderHistory["fromStatus"],
        toStatus: row.toStatus as ManufacturingProductionOrderHistory["toStatus"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveMachine(entry) {
      await prisma.gbaManufacturingMachine.upsert({
        where: { machineId: entry.machineId },
        create: {
          machineId: entry.machineId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          machineType: entry.machineType,
          status: entry.status,
          runtimeMinutes: entry.runtimeMinutes,
          downtimeMinutes: entry.downtimeMinutes,
          plannedMaintenanceMinutes: entry.plannedMaintenanceMinutes,
          unplannedFailureCount: entry.unplannedFailureCount,
          availabilityPercent: entry.availabilityPercent,
          performancePercent: entry.performancePercent,
          qualityPercent: entry.qualityPercent,
          utilizationPercent: entry.utilizationPercent,
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          runtimeMinutes: entry.runtimeMinutes,
          downtimeMinutes: entry.downtimeMinutes,
          plannedMaintenanceMinutes: entry.plannedMaintenanceMinutes,
          unplannedFailureCount: entry.unplannedFailureCount,
          availabilityPercent: entry.availabilityPercent,
          performancePercent: entry.performancePercent,
          qualityPercent: entry.qualityPercent,
          utilizationPercent: entry.utilizationPercent,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listMachines(workspaceId) {
      const rows = await prisma.gbaManufacturingMachine.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        machineId: row.machineId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        machineType: row.machineType as ManufacturingMachine["machineType"],
        status: row.status as ManufacturingMachine["status"],
        runtimeMinutes: row.runtimeMinutes,
        downtimeMinutes: row.downtimeMinutes,
        plannedMaintenanceMinutes: row.plannedMaintenanceMinutes,
        unplannedFailureCount: row.unplannedFailureCount,
        availabilityPercent: row.availabilityPercent,
        performancePercent: row.performancePercent,
        qualityPercent: row.qualityPercent,
        utilizationPercent: row.utilizationPercent,
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveMachineHistory(entry) {
      await prisma.gbaManufacturingMachineHistory.upsert({
        where: { machineHistoryId: entry.machineHistoryId },
        create: {
          machineHistoryId: entry.machineHistoryId,
          machineId: entry.machineId,
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
    async listMachineHistory(workspaceId, machineId) {
      const rows = await prisma.gbaManufacturingMachineHistory.findMany({ where: { workspaceId, ...(machineId ? { machineId } : {}) }, orderBy: { changedAt: "desc" } });
      return rows.map((row) => ({
        machineHistoryId: row.machineHistoryId,
        machineId: row.machineId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as ManufacturingMachineHistory["status"],
        note: row.note,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveLabor(entry) {
      await prisma.gbaManufacturingLabor.upsert({
        where: { laborRecordId: entry.laborRecordId },
        create: {
          laborRecordId: entry.laborRecordId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          operatorId: entry.operatorId,
          certifications: toJson(entry.certifications),
          skills: toJson(entry.skills),
          shift: entry.shift,
          utilizationPercent: entry.utilizationPercent,
          overtimeHours: entry.overtimeHours,
          laborEfficiencyPercent: entry.laborEfficiencyPercent,
          updatedAt: new Date(entry.updatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          certifications: toJson(entry.certifications),
          skills: toJson(entry.skills),
          shift: entry.shift,
          utilizationPercent: entry.utilizationPercent,
          overtimeHours: entry.overtimeHours,
          laborEfficiencyPercent: entry.laborEfficiencyPercent,
          updatedAt: new Date(entry.updatedAt),
        },
      });
      return entry;
    },
    async listLabor(workspaceId) {
      const rows = await prisma.gbaManufacturingLabor.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        laborRecordId: row.laborRecordId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        operatorId: row.operatorId,
        certifications: row.certifications as string[],
        skills: row.skills as string[],
        shift: row.shift,
        utilizationPercent: row.utilizationPercent,
        overtimeHours: row.overtimeHours,
        laborEfficiencyPercent: row.laborEfficiencyPercent,
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveLaborHistory(entry) {
      await prisma.gbaManufacturingLaborHistory.upsert({
        where: { laborHistoryId: entry.laborHistoryId },
        create: {
          laborHistoryId: entry.laborHistoryId,
          laborRecordId: entry.laborRecordId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          shift: entry.shift,
          utilizationPercent: entry.utilizationPercent,
          overtimeHours: entry.overtimeHours,
          laborEfficiencyPercent: entry.laborEfficiencyPercent,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          shift: entry.shift,
          utilizationPercent: entry.utilizationPercent,
          overtimeHours: entry.overtimeHours,
          laborEfficiencyPercent: entry.laborEfficiencyPercent,
          changedBy: entry.changedBy,
          changedAt: new Date(entry.changedAt),
        },
      });
      return entry;
    },
    async listLaborHistory(workspaceId, laborRecordId) {
      const rows = await prisma.gbaManufacturingLaborHistory.findMany({ where: { workspaceId, ...(laborRecordId ? { laborRecordId } : {}) }, orderBy: { changedAt: "desc" } });
      return rows.map((row) => ({
        laborHistoryId: row.laborHistoryId,
        laborRecordId: row.laborRecordId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        shift: row.shift,
        utilizationPercent: row.utilizationPercent,
        overtimeHours: row.overtimeHours,
        laborEfficiencyPercent: row.laborEfficiencyPercent,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveMaterialConsumption(entry) {
      await prisma.gbaManufacturingMaterialConsumption.upsert({
        where: { materialConsumptionId: entry.materialConsumptionId },
        create: {
          materialConsumptionId: entry.materialConsumptionId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          productionOrderId: entry.productionOrderId,
          rawMaterialUsed: entry.rawMaterialUsed,
          componentConsumed: entry.componentConsumed,
          yieldPercent: entry.yieldPercent,
          wasteQuantity: entry.wasteQuantity,
          scrapQuantity: entry.scrapQuantity,
          reworkMaterialQuantity: entry.reworkMaterialQuantity,
          variancePercent: entry.variancePercent,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          rawMaterialUsed: entry.rawMaterialUsed,
          componentConsumed: entry.componentConsumed,
          yieldPercent: entry.yieldPercent,
          wasteQuantity: entry.wasteQuantity,
          scrapQuantity: entry.scrapQuantity,
          reworkMaterialQuantity: entry.reworkMaterialQuantity,
          variancePercent: entry.variancePercent,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listMaterialConsumption(workspaceId) {
      const rows = await prisma.gbaManufacturingMaterialConsumption.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        materialConsumptionId: row.materialConsumptionId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        productionOrderId: row.productionOrderId,
        rawMaterialUsed: row.rawMaterialUsed,
        componentConsumed: row.componentConsumed,
        yieldPercent: row.yieldPercent,
        wasteQuantity: row.wasteQuantity,
        scrapQuantity: row.scrapQuantity,
        reworkMaterialQuantity: row.reworkMaterialQuantity,
        variancePercent: row.variancePercent,
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveQualityEvent(entry) {
      await prisma.gbaManufacturingQualityEvent.upsert({
        where: { qualityEventId: entry.qualityEventId },
        create: {
          qualityEventId: entry.qualityEventId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          productionOrderId: entry.productionOrderId,
          eventType: entry.eventType,
          severity: entry.severity,
          defectCategory: entry.defectCategory,
          rootCauseReference: entry.rootCauseReference ?? null,
          firstPassYieldPercent: entry.firstPassYieldPercent,
          note: entry.note,
          recordedBy: entry.recordedBy,
          recordedAt: new Date(entry.recordedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          severity: entry.severity,
          defectCategory: entry.defectCategory,
          rootCauseReference: entry.rootCauseReference ?? null,
          firstPassYieldPercent: entry.firstPassYieldPercent,
          note: entry.note,
          recordedBy: entry.recordedBy,
          recordedAt: new Date(entry.recordedAt),
        },
      });
      return entry;
    },
    async listQualityEvents(workspaceId) {
      const rows = await prisma.gbaManufacturingQualityEvent.findMany({ where: { workspaceId }, orderBy: { recordedAt: "desc" } });
      return rows.map((row) => ({
        qualityEventId: row.qualityEventId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        productionOrderId: row.productionOrderId,
        eventType: row.eventType as ManufacturingQualityEvent["eventType"],
        severity: row.severity as ManufacturingQualityEvent["severity"],
        defectCategory: row.defectCategory,
        rootCauseReference: row.rootCauseReference ?? undefined,
        firstPassYieldPercent: row.firstPassYieldPercent,
        note: row.note,
        recordedBy: row.recordedBy,
        recordedAt: row.recordedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveCostRecord(entry) {
      await prisma.gbaManufacturingCostRecord.upsert({
        where: { manufacturingCostId: entry.manufacturingCostId },
        create: {
          manufacturingCostId: entry.manufacturingCostId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          productionOrderId: entry.productionOrderId,
          costingVersion: entry.costingVersion,
          materialCost: entry.materialCost,
          laborCost: entry.laborCost,
          machineCost: entry.machineCost,
          overheadCost: entry.overheadCost,
          burdenCost: entry.burdenCost,
          totalManufacturingCost: entry.totalManufacturingCost,
          costVariance: entry.costVariance,
          measuredAt: new Date(entry.measuredAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          materialCost: entry.materialCost,
          laborCost: entry.laborCost,
          machineCost: entry.machineCost,
          overheadCost: entry.overheadCost,
          burdenCost: entry.burdenCost,
          totalManufacturingCost: entry.totalManufacturingCost,
          costVariance: entry.costVariance,
          measuredAt: new Date(entry.measuredAt),
        },
      });
      return entry;
    },
    async listCostRecords(workspaceId) {
      const rows = await prisma.gbaManufacturingCostRecord.findMany({ where: { workspaceId }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        manufacturingCostId: row.manufacturingCostId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        productionOrderId: row.productionOrderId,
        costingVersion: row.costingVersion,
        materialCost: row.materialCost,
        laborCost: row.laborCost,
        machineCost: row.machineCost,
        overheadCost: row.overheadCost,
        burdenCost: row.burdenCost,
        totalManufacturingCost: row.totalManufacturingCost,
        costVariance: row.costVariance,
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveKpi(entry) {
      await prisma.gbaManufacturingKpi.upsert({
        where: { manufacturingKpiId: entry.manufacturingKpiId },
        create: {
          manufacturingKpiId: entry.manufacturingKpiId,
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
    async listKpis(workspaceId) {
      const rows = await prisma.gbaManufacturingKpi.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        manufacturingKpiId: row.manufacturingKpiId,
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
    async saveKpiHistory(entry) {
      await prisma.gbaManufacturingKpiHistory.upsert({
        where: { manufacturingKpiHistoryId: entry.manufacturingKpiHistoryId },
        create: {
          manufacturingKpiHistoryId: entry.manufacturingKpiHistoryId,
          manufacturingKpiId: entry.manufacturingKpiId,
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
    async listKpiHistory(workspaceId, manufacturingKpiId) {
      const rows = await prisma.gbaManufacturingKpiHistory.findMany({ where: { workspaceId, ...(manufacturingKpiId ? { manufacturingKpiId } : {}) }, orderBy: { measuredAt: "desc" } });
      return rows.map((row) => ({
        manufacturingKpiHistoryId: row.manufacturingKpiHistoryId,
        manufacturingKpiId: row.manufacturingKpiId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        measuredValue: row.measuredValue,
        trend: row.trend,
        score: row.score,
        status: row.status as ManufacturingKpiHistory["status"],
        measuredAt: row.measuredAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveRecommendation(entry) {
      await prisma.gbaManufacturingRecommendation.upsert({
        where: { manufacturingRecommendationId: entry.manufacturingRecommendationId },
        create: {
          manufacturingRecommendationId: entry.manufacturingRecommendationId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          category: entry.category,
          title: entry.title,
          summary: entry.summary,
          evidenceReferences: toJson(entry.evidenceReferences),
          confidence: entry.confidence,
          businessImpact: entry.businessImpact,
          estimatedSavings: entry.estimatedSavings,
          suggestedOwner: entry.suggestedOwner,
          requiredApprovals: toJson(entry.requiredApprovals),
          priority: entry.priority,
          deterministicChecksum: entry.deterministicChecksum,
          reviewed: entry.reviewed,
          createdAt: new Date(entry.createdAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          summary: entry.summary,
          evidenceReferences: toJson(entry.evidenceReferences),
          confidence: entry.confidence,
          businessImpact: entry.businessImpact,
          estimatedSavings: entry.estimatedSavings,
          suggestedOwner: entry.suggestedOwner,
          requiredApprovals: toJson(entry.requiredApprovals),
          priority: entry.priority,
          deterministicChecksum: entry.deterministicChecksum,
          reviewed: entry.reviewed,
        },
      });
      return entry;
    },
    async listRecommendations(workspaceId) {
      const rows = await prisma.gbaManufacturingRecommendation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        manufacturingRecommendationId: row.manufacturingRecommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        category: row.category as ManufacturingRecommendation["category"],
        title: row.title,
        summary: row.summary,
        evidenceReferences: row.evidenceReferences as string[],
        confidence: row.confidence as ManufacturingRecommendation["confidence"],
        businessImpact: row.businessImpact,
        estimatedSavings: row.estimatedSavings,
        suggestedOwner: row.suggestedOwner,
        requiredApprovals: row.requiredApprovals as string[],
        priority: row.priority as ManufacturingRecommendation["priority"],
        deterministicChecksum: row.deterministicChecksum,
        reviewed: row.reviewed,
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async saveRecommendationReview(entry) {
      await prisma.gbaManufacturingRecommendationReview.upsert({
        where: { manufacturingRecommendationReviewId: entry.manufacturingRecommendationReviewId },
        create: {
          manufacturingRecommendationReviewId: entry.manufacturingRecommendationReviewId,
          manufacturingRecommendationId: entry.manufacturingRecommendationId,
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
    async listRecommendationReviews(workspaceId, manufacturingRecommendationId) {
      const rows = await prisma.gbaManufacturingRecommendationReview.findMany({ where: { workspaceId, ...(manufacturingRecommendationId ? { manufacturingRecommendationId } : {}) }, orderBy: { reviewedAt: "desc" } });
      return rows.map((row) => ({
        manufacturingRecommendationReviewId: row.manufacturingRecommendationReviewId,
        manufacturingRecommendationId: row.manufacturingRecommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        decision: row.decision as ManufacturingRecommendationReview["decision"],
        notes: row.notes ?? undefined,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveOperationsSignal(entry) {
      await prisma.gbaManufacturingOperationsSignal.upsert({
        where: { operationsSignalId: entry.operationsSignalId },
        create: {
          operationsSignalId: entry.operationsSignalId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          productionCompletionPercent: entry.productionCompletionPercent,
          capacityUtilizationPercent: entry.capacityUtilizationPercent,
          materialShortageCount: entry.materialShortageCount,
          machineHealthStatus: entry.machineHealthStatus,
          laborAvailabilityPercent: entry.laborAvailabilityPercent,
          qualityAlertCount: entry.qualityAlertCount,
          kpiSummary: toJson(entry.kpiSummary),
          publishedAt: new Date(entry.publishedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          productionCompletionPercent: entry.productionCompletionPercent,
          capacityUtilizationPercent: entry.capacityUtilizationPercent,
          materialShortageCount: entry.materialShortageCount,
          machineHealthStatus: entry.machineHealthStatus,
          laborAvailabilityPercent: entry.laborAvailabilityPercent,
          qualityAlertCount: entry.qualityAlertCount,
          kpiSummary: toJson(entry.kpiSummary),
          publishedAt: new Date(entry.publishedAt),
        },
      });
      return entry;
    },
    async listOperationsSignals(workspaceId) {
      const rows = await prisma.gbaManufacturingOperationsSignal.findMany({ where: { workspaceId }, orderBy: { publishedAt: "desc" } });
      return rows.map((row) => ({
        operationsSignalId: row.operationsSignalId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        productionCompletionPercent: row.productionCompletionPercent,
        capacityUtilizationPercent: row.capacityUtilizationPercent,
        materialShortageCount: row.materialShortageCount,
        machineHealthStatus: row.machineHealthStatus as ManufacturingOperationsSignal["machineHealthStatus"],
        laborAvailabilityPercent: row.laborAvailabilityPercent,
        qualityAlertCount: row.qualityAlertCount,
        kpiSummary: row.kpiSummary as string[],
        publishedAt: row.publishedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    async saveExecutiveReport(entry) {
      await prisma.gbaManufacturingExecutiveReport.upsert({
        where: { manufacturingExecutiveReportId: entry.manufacturingExecutiveReportId },
        create: {
          manufacturingExecutiveReportId: entry.manufacturingExecutiveReportId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          period: entry.period,
          productionSummary: toJson(entry.productionSummary),
          capacityOutlook: toJson(entry.capacityOutlook),
          qualitySummary: toJson(entry.qualitySummary),
          costSummary: toJson(entry.costSummary),
          risks: toJson(entry.risks),
          opportunities: toJson(entry.opportunities),
          createdAt: new Date(entry.createdAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          productionSummary: toJson(entry.productionSummary),
          capacityOutlook: toJson(entry.capacityOutlook),
          qualitySummary: toJson(entry.qualitySummary),
          costSummary: toJson(entry.costSummary),
          risks: toJson(entry.risks),
          opportunities: toJson(entry.opportunities),
          createdAt: new Date(entry.createdAt),
        },
      });
      return entry;
    },
    async listExecutiveReports(workspaceId) {
      const rows = await prisma.gbaManufacturingExecutiveReport.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        manufacturingExecutiveReportId: row.manufacturingExecutiveReportId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        period: row.period as ManufacturingExecutiveReport["period"],
        productionSummary: row.productionSummary as string[],
        capacityOutlook: row.capacityOutlook as string[],
        qualitySummary: row.qualitySummary as string[],
        costSummary: row.costSummary as string[],
        risks: row.risks as string[],
        opportunities: row.opportunities as string[],
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },

    saveTimelineEvent: saveTimeline,
    async listTimeline(workspaceId) {
      const rows = await prisma.gbaManufacturingTimelineEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        manufacturingTimelineEventId: row.manufacturingTimelineEventId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        eventType: row.eventType,
        subjectId: row.subjectId,
        summary: row.summary,
        actorId: row.actorId,
        evidenceReferences: row.evidenceReferences as string[],
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveHealth(entry) {
      await prisma.gbaManufacturingHealth.upsert({
        where: { manufacturingHealthId: entry.manufacturingHealthId },
        create: {
          manufacturingHealthId: entry.manufacturingHealthId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          blockedProductionOrders: entry.blockedProductionOrders,
          criticalQualityEvents: entry.criticalQualityEvents,
          machineDowntimeSignals: entry.machineDowntimeSignals,
          materialVarianceSignals: entry.materialVarianceSignals,
          unreviewedRecommendations: entry.unreviewedRecommendations,
          generatedAt: new Date(entry.generatedAt),
          immutableLineage: entry.immutableLineage,
        },
        update: {
          status: entry.status,
          blockedProductionOrders: entry.blockedProductionOrders,
          criticalQualityEvents: entry.criticalQualityEvents,
          machineDowntimeSignals: entry.machineDowntimeSignals,
          materialVarianceSignals: entry.materialVarianceSignals,
          unreviewedRecommendations: entry.unreviewedRecommendations,
          generatedAt: new Date(entry.generatedAt),
        },
      });
      return entry;
    },
    async listHealth(workspaceId) {
      const rows = await prisma.gbaManufacturingHealth.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({
        manufacturingHealthId: row.manufacturingHealthId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as ManufacturingHealthSnapshot["status"],
        blockedProductionOrders: row.blockedProductionOrders,
        criticalQualityEvents: row.criticalQualityEvents,
        machineDowntimeSignals: row.machineDowntimeSignals,
        materialVarianceSignals: row.materialVarianceSignals,
        unreviewedRecommendations: row.unreviewedRecommendations,
        generatedAt: row.generatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
  };
}
