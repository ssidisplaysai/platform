import { geaId, nowIso, stableChecksum, stableStringify } from "@/lib/gea/agent-models";

export type ManufacturingStatus = "PLANNED" | "IN_PROGRESS" | "AT_RISK" | "BLOCKED" | "COMPLETE" | "CANCELLED";
export type ManufacturingPriority = "P1" | "P2" | "P3" | "P4";
export type ManufacturingConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ManufacturingScopeFilter = {
  facility?: string;
  workCenter?: string;
  shift?: string;
  period?: string;
  productFamily?: string;
};

export type ManufacturingMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  asOf: string;
  evidenceReferences: string[];
};

export type ManufacturingDashboard = {
  workspaceId: string;
  organizationId: string;
  filters: ManufacturingScopeFilter;
  activeProduction: ManufacturingMetric;
  productionQueues: ManufacturingMetric;
  machineUtilization: ManufacturingMetric;
  laborUtilization: ManufacturingMetric;
  bottlenecks: ManufacturingMetric;
  productionEfficiency: ManufacturingMetric;
  qualityScore: ManufacturingMetric;
  scrapRate: ManufacturingMetric;
  reworkRate: ManufacturingMetric;
  downtimeMinutes: ManufacturingMetric;
  forecastOutput: ManufacturingMetric;
  generatedAt: string;
  immutableLineage: string;
};

export type ManufacturingBom = {
  bomId: string;
  workspaceId: string;
  organizationId: string;
  sku: string;
  revision: string;
  level: number;
  effectiveFrom: string;
  effectiveTo?: string;
  components: Array<{ componentSku: string; quantity: number; unit: string; alternateSkus: string[] }>;
  approvedSubstitutions: string[];
  costRollup: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type ManufacturingBomHistory = {
  bomHistoryId: string;
  bomId: string;
  workspaceId: string;
  organizationId: string;
  revision: string;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ManufacturingRouting = {
  routingId: string;
  workspaceId: string;
  organizationId: string;
  sku: string;
  revision: string;
  workCenter: string;
  machineAssignments: string[];
  processSteps: Array<{ step: string; cycleMinutes: number; setupMinutes: number; laborSkill: string }>;
  laborRequirements: Array<{ skill: string; operators: number }>;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type ManufacturingRoutingHistory = {
  routingHistoryId: string;
  routingId: string;
  workspaceId: string;
  organizationId: string;
  revision: string;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ManufacturingProductionOrder = {
  productionOrderId: string;
  workspaceId: string;
  organizationId: string;
  operationsWorkOrderId?: string;
  title: string;
  sku: string;
  bomRevision: string;
  routingRevision: string;
  priority: ManufacturingPriority;
  status: ManufacturingStatus;
  quantityPlanned: number;
  quantityCompleted: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  materialAllocations: Array<{ sku: string; quantity: number }>;
  laborAssignments: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type ManufacturingProductionOrderHistory = {
  productionOrderHistoryId: string;
  productionOrderId: string;
  workspaceId: string;
  organizationId: string;
  fromStatus: ManufacturingStatus;
  toStatus: ManufacturingStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ManufacturingMachine = {
  machineId: string;
  workspaceId: string;
  organizationId: string;
  machineType: "LASER" | "PRESS_BRAKE" | "WELDING" | "ASSEMBLY" | "CNC" | "COATING" | "PACKAGING";
  status: ManufacturingStatus;
  runtimeMinutes: number;
  downtimeMinutes: number;
  plannedMaintenanceMinutes: number;
  unplannedFailureCount: number;
  availabilityPercent: number;
  performancePercent: number;
  qualityPercent: number;
  utilizationPercent: number;
  updatedAt: string;
  immutableLineage: string;
};

export type ManufacturingMachineHistory = {
  machineHistoryId: string;
  machineId: string;
  workspaceId: string;
  organizationId: string;
  status: ManufacturingStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ManufacturingLabor = {
  laborRecordId: string;
  workspaceId: string;
  organizationId: string;
  operatorId: string;
  certifications: string[];
  skills: string[];
  shift: string;
  utilizationPercent: number;
  overtimeHours: number;
  laborEfficiencyPercent: number;
  updatedAt: string;
  immutableLineage: string;
};

export type ManufacturingLaborHistory = {
  laborHistoryId: string;
  laborRecordId: string;
  workspaceId: string;
  organizationId: string;
  shift: string;
  utilizationPercent: number;
  overtimeHours: number;
  laborEfficiencyPercent: number;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ManufacturingMaterialConsumption = {
  materialConsumptionId: string;
  workspaceId: string;
  organizationId: string;
  productionOrderId: string;
  rawMaterialUsed: number;
  componentConsumed: number;
  yieldPercent: number;
  wasteQuantity: number;
  scrapQuantity: number;
  reworkMaterialQuantity: number;
  variancePercent: number;
  measuredAt: string;
  immutableLineage: string;
};

export type ManufacturingQualityEvent = {
  qualityEventId: string;
  workspaceId: string;
  organizationId: string;
  productionOrderId: string;
  eventType: "IN_PROCESS_INSPECTION" | "FINAL_INSPECTION" | "NCR" | "CORRECTIVE_ACTION";
  severity: "LOW" | "MEDIUM" | "HIGH";
  defectCategory: string;
  rootCauseReference?: string;
  firstPassYieldPercent: number;
  note: string;
  recordedBy: string;
  recordedAt: string;
  immutableLineage: string;
};

export type ManufacturingCostRecord = {
  manufacturingCostId: string;
  workspaceId: string;
  organizationId: string;
  productionOrderId: string;
  costingVersion: string;
  materialCost: number;
  laborCost: number;
  machineCost: number;
  overheadCost: number;
  burdenCost: number;
  totalManufacturingCost: number;
  costVariance: number;
  measuredAt: string;
  immutableLineage: string;
};

export type ManufacturingKpiDefinition = {
  manufacturingKpiId: string;
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

export type ManufacturingKpiHistory = {
  manufacturingKpiHistoryId: string;
  manufacturingKpiId: string;
  workspaceId: string;
  organizationId: string;
  measuredValue: number;
  trend: number;
  score: number;
  status: "ON_TRACK" | "AT_RISK" | "BEHIND";
  measuredAt: string;
  immutableLineage: string;
};

export type ManufacturingRecommendation = {
  manufacturingRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  category: "PROCESS" | "SCHEDULING" | "MACHINE" | "LABOR" | "COST" | "SCRAP" | "YIELD" | "CAPACITY" | "MAINTENANCE" | "SUPPLIER_QUALITY";
  title: string;
  summary: string;
  evidenceReferences: string[];
  confidence: ManufacturingConfidence;
  businessImpact: string;
  estimatedSavings: number;
  suggestedOwner: string;
  requiredApprovals: string[];
  priority: ManufacturingPriority;
  deterministicChecksum: string;
  reviewed: boolean;
  createdAt: string;
  immutableLineage: string;
};

export type ManufacturingRecommendationReview = {
  manufacturingRecommendationReviewId: string;
  manufacturingRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type ManufacturingOperationsSignal = {
  operationsSignalId: string;
  workspaceId: string;
  organizationId: string;
  productionCompletionPercent: number;
  capacityUtilizationPercent: number;
  materialShortageCount: number;
  machineHealthStatus: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  laborAvailabilityPercent: number;
  qualityAlertCount: number;
  kpiSummary: string[];
  publishedAt: string;
  immutableLineage: string;
};

export type ManufacturingExecutiveReport = {
  manufacturingExecutiveReportId: string;
  workspaceId: string;
  organizationId: string;
  period: "DAILY" | "WEEKLY";
  productionSummary: string[];
  capacityOutlook: string[];
  qualitySummary: string[];
  costSummary: string[];
  risks: string[];
  opportunities: string[];
  createdAt: string;
  immutableLineage: string;
};

export type ManufacturingTimelineEvent = {
  manufacturingTimelineEventId: string;
  workspaceId: string;
  organizationId: string;
  eventType: string;
  subjectId: string;
  summary: string;
  actorId: string;
  evidenceReferences: string[];
  createdAt: string;
};

export type ManufacturingHealthSnapshot = {
  manufacturingHealthId: string;
  workspaceId: string;
  organizationId: string;
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  blockedProductionOrders: number;
  criticalQualityEvents: number;
  machineDowntimeSignals: number;
  materialVarianceSignals: number;
  unreviewedRecommendations: number;
  generatedAt: string;
  immutableLineage: string;
};

export function createManufacturingIds() {
  return {
    bomId: geaId("gbamfgbom"),
    bomHistoryId: geaId("gbamfgbomh"),
    routingId: geaId("gbamfgrout"),
    routingHistoryId: geaId("gbamfgrouth"),
    productionOrderId: geaId("gbamfgpo"),
    productionOrderHistoryId: geaId("gbamfgpoh"),
    machineId: geaId("gbamfgmach"),
    machineHistoryId: geaId("gbamfgmachh"),
    laborRecordId: geaId("gbamfglabor"),
    laborHistoryId: geaId("gbamfglaborh"),
    materialConsumptionId: geaId("gbamfgmat"),
    qualityEventId: geaId("gbamfgqual"),
    manufacturingCostId: geaId("gbamfgcost"),
    manufacturingKpiId: geaId("gbamfgkpi"),
    manufacturingKpiHistoryId: geaId("gbamfgkpih"),
    manufacturingRecommendationId: geaId("gbamfgrec"),
    manufacturingRecommendationReviewId: geaId("gbamfgrecr"),
    operationsSignalId: geaId("gbamfgops"),
    manufacturingExecutiveReportId: geaId("gbamfgexec"),
    manufacturingTimelineEventId: geaId("gbamfgtime"),
    manufacturingHealthId: geaId("gbamfghealth"),
  };
}

export function gbaMfgNowIso(): string {
  return nowIso();
}

export function gbaMfgChecksum(value: unknown): string {
  return stableChecksum(value);
}

export function canonicalizeManufacturingRecommendation(
  input: Pick<ManufacturingRecommendation, "category" | "title" | "summary" | "evidenceReferences" | "confidence" | "businessImpact" | "estimatedSavings" | "suggestedOwner" | "requiredApprovals" | "priority">,
): string {
  return stableStringify({
    ...input,
    evidenceReferences: [...input.evidenceReferences].sort((a, b) => a.localeCompare(b)),
    requiredApprovals: [...input.requiredApprovals].sort((a, b) => a.localeCompare(b)),
  });
}

export function createManufacturingImmutableLineage(input: Record<string, unknown>): string {
  return stableChecksum(input);
}
