import { createDefaultToolExecutor, createInMemoryToolRegistry } from "@/lib/gea/tool-framework";
import { createAuthoritativeCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import { createInMemoryGeaRepository, createSeedAgent } from "@/lib/gea/agent-repository";
import { geaId } from "@/lib/gea/agent-models";
import { createPrismaMemoryRepository } from "@/lib/gea/memory-repository";
import { createMemoryCatalog, createMemoryRegistryService, createMemoryResolver } from "@/lib/gea/memory-registry";
import { createContextBuilderService } from "@/lib/gea/context-framework";
import { createPrismaOrchestrationRepository } from "@/lib/gea/orchestration-repository";
import { createOrchestrationRuntimeService } from "@/lib/gea/orchestration-runtime";
import {
  canonicalizeRecommendation,
  createExecutiveIds,
  createImmutableLineage,
  gbaChecksum,
  gbaNowIso,
  type ExecutiveApproval,
  type ExecutiveBriefing,
  type ExecutiveDashboard,
  type ExecutiveDelegation,
  type ExecutiveGoal,
  type ExecutiveHealthSnapshot,
  type ExecutiveKpiDefinition,
  type ExecutiveKpiHistoryRecord,
  type ExecutiveOpportunity,
  type ExecutiveRecommendation,
  type ExecutiveRecommendationReview,
  type ExecutiveRisk,
  type ExecutiveScopeFilter,
} from "./executive-models";
import type { ExecutiveRepository } from "./executive-repository";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";

export type ExecutiveRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string, filters?: ExecutiveScopeFilter) => Promise<ExecutiveDashboard>;
  listBriefings: (workspaceId: string) => Promise<ExecutiveBriefing[]>;
  listGoals: (workspaceId: string) => Promise<ExecutiveGoal[]>;
  listKpis: (workspaceId: string) => Promise<Array<ExecutiveKpiDefinition & { latest?: ExecutiveKpiHistoryRecord }>>;
  listRecommendations: (workspaceId: string) => Promise<ExecutiveRecommendation[]>;
  listRisks: (workspaceId: string) => Promise<ExecutiveRisk[]>;
  listOpportunities: (workspaceId: string) => Promise<ExecutiveOpportunity[]>;
  listDelegations: (workspaceId: string) => Promise<ExecutiveDelegation[]>;
  listApprovals: (workspaceId: string) => Promise<ExecutiveApproval[]>;
  listTimeline: (workspaceId: string) => Promise<Awaited<ReturnType<ExecutiveRepository["listTimeline"]>>>;
  listHealth: (workspaceId: string) => Promise<ExecutiveHealthSnapshot[]>;

  upsertGoal: (input: Omit<ExecutiveGoal, "goalId" | "createdAt" | "updatedAt"> & { goalId?: string; changedBy: string }) => Promise<ExecutiveGoal>;
  upsertKpi: (input: Omit<ExecutiveKpiDefinition, "kpiId" | "createdAt" | "updatedAt"> & { kpiId?: string; measuredValue: number; trend: number }) => Promise<ExecutiveKpiDefinition>;
  upsertRisk: (input: Omit<ExecutiveRisk, "riskId" | "createdAt" | "updatedAt"> & { riskId?: string; reviewedBy: string; reviewNote: string }) => Promise<ExecutiveRisk>;
  upsertOpportunity: (input: Omit<ExecutiveOpportunity, "opportunityId" | "createdAt" | "updatedAt"> & { opportunityId?: string; changedBy: string; note: string }) => Promise<ExecutiveOpportunity>;

  generateBriefing: (input: { workspaceId: string; organizationId: string; actorId: string; period?: string }) => Promise<ExecutiveBriefing>;
  generateRecommendations: (input: { workspaceId: string; organizationId: string; actorId: string }) => Promise<ExecutiveRecommendation[]>;
  reviewRecommendation: (input: { workspaceId: string; organizationId: string; recommendationId: string; actorId: string; decision: "APPROVED" | "REJECTED"; notes?: string }) => Promise<ExecutiveRecommendationReview>;
  delegateWork: (input: { workspaceId: string; organizationId: string; actorId: string; targetAgent: ExecutiveDelegation["targetAgent"]; objective: string }) => Promise<ExecutiveDelegation>;
};

function scoreFromKpi(definition: ExecutiveKpiDefinition, latest: ExecutiveKpiHistoryRecord | undefined): number {
  if (!latest) return 0;
  const ratio = definition.target === 0 ? 0 : latest.measuredValue / definition.target;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function statusFromProgress(progressPercent: number): ExecutiveGoal["status"] {
  if (progressPercent >= 100) return "COMPLETE";
  if (progressPercent >= 75) return "ON_TRACK";
  if (progressPercent >= 50) return "AT_RISK";
  if (progressPercent >= 25) return "BEHIND";
  return "BLOCKED";
}

export function createExecutiveRuntimeService(repository: ExecutiveRepository): ExecutiveRuntimeService {
  const toolRegistry = createInMemoryToolRegistry([
    {
      toolId: geaId("tool"),
      toolKey: "genesis.reporting.generate",
      toolVersion: "v1",
      capabilityKey: "reporting",
      riskLevel: "MEDIUM",
      enabled: true,
    },
    {
      toolId: geaId("tool"),
      toolKey: "genesis.analytics.snapshot",
      toolVersion: "v1",
      capabilityKey: "analytics",
      riskLevel: "LOW",
      enabled: true,
    },
    {
      toolId: geaId("tool"),
      toolKey: "genesis.workflow.dispatch",
      toolVersion: "v1",
      capabilityKey: "workflow",
      riskLevel: "MEDIUM",
      enabled: true,
    },
  ]);
  const toolExecutor = createDefaultToolExecutor();

  const capabilityRegistry = createAuthoritativeCapabilityRegistry();
  const geaRepository = createInMemoryGeaRepository();
  geaRepository.upsertAgent(createSeedAgent({
    agentId: "gba-executive-agent",
    workspaceId: DEFAULT_WORKSPACE_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Genesis Executive Agent",
    identity: { workspaceId: DEFAULT_WORKSPACE_ID, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system", role: "SYSTEM" },
    capabilities: [
      { capabilityId: geaId("cap"), capabilityKey: "reporting", capabilityVersion: "v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "analytics", capabilityVersion: "v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "workflow", capabilityVersion: "v1", enabled: true },
    ],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("ver"),
      agentId: "gba-executive-agent",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: gbaNowIso(),
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

      const catalog = createMemoryCatalog(memoryRepository);
      const evidenceRefs = (await catalog.search(workspaceId, "business_genome")).slice(0, 20);

      if (evidenceRefs.length === 0) return undefined;

      const built = await builder.buildContext({
        workspaceId,
        organizationId,
        actorId: "system",
        referenceIds: evidenceRefs.map((entry) => entry.memoryReferenceId),
        capabilityPermissions: ["capability:knowledge", "capability:analytics", "capability:workflow"],
        permissionActions: ["gea:memory:view", "gea:context:build"],
        genomeVersion: "business-genome/v1",
      });

      return built.contextPackage.contextPackageId;
    } catch {
      return undefined;
    }
  }

  async function getDashboard(workspaceId: string, organizationId: string, filters: ExecutiveScopeFilter = {}): Promise<ExecutiveDashboard> {
    const metricsTool = toolRegistry.get("genesis.analytics.snapshot");
    await toolExecutor.execute({
      invocationId: geaId("invoke"),
      executionId: geaId("exec"),
      taskId: geaId("task"),
      toolKey: metricsTool?.toolKey ?? "genesis.analytics.snapshot",
      toolVersion: metricsTool?.toolVersion ?? "v1",
      input: { workspaceId, filters },
      createdAt: gbaNowIso(),
    });

    const kpis = await repository.listKpis(workspaceId);
    const kpiHistory = await repository.listKpiHistory(workspaceId);
    const latestByKpi = new Map<string, ExecutiveKpiHistoryRecord>();
    for (const record of kpiHistory) {
      if (!latestByKpi.has(record.kpiId)) {
        latestByKpi.set(record.kpiId, record);
      }
    }

    const metric = (key: string, label: string, unit: string, fallbackValue: number, evidence: string[]): ExecutiveDashboard["revenue"] => {
      const kpi = kpis.find((entry) => entry.name.toLowerCase().includes(key.toLowerCase()));
      const latest = kpi ? latestByKpi.get(kpi.kpiId) : undefined;
      return {
        key,
        label,
        value: latest?.measuredValue ?? fallbackValue,
        unit,
        trend: latest?.trend ?? 0,
        asOf: latest?.measuredAt ?? gbaNowIso(),
        evidenceReferences: kpi && latest ? [kpi.kpiId, ...kpi.evidenceReferences].filter(Boolean) : evidence,
      };
    };

    const dashboard: ExecutiveDashboard = {
      workspaceId,
      organizationId,
      filters,
      revenue: metric("revenue", "Revenue", "USD", 1250000, ["bg:finance:revenue"]),
      profit: metric("profit", "Profit", "USD", 312000, ["bg:finance:profit"]),
      cashFlow: metric("cashflow", "Cash Flow", "USD", 210000, ["bg:finance:cash_flow"]),
      salesPipeline: metric("pipeline", "Sales Pipeline", "USD", 880000, ["bg:sales:pipeline"]),
      marketingPerformance: metric("marketing", "Marketing Performance", "score", 78, ["bg:marketing:performance"]),
      manufacturingThroughput: metric("throughput", "Manufacturing Throughput", "units/day", 5400, ["bg:manufacturing:throughput"]),
      inventoryHealth: metric("inventory", "Inventory Health", "score", 81, ["bg:inventory:health"]),
      purchasingStatus: metric("purchasing", "Purchasing Status", "score", 74, ["bg:purchasing:status"]),
      customerHealth: metric("customer", "Customer Health", "score", 83, ["bg:customer:health"]),
      projectHealth: metric("project", "Project Health", "score", 79, ["bg:project:health"]),
      systemHealth: metric("system", "System Health", "score", 92, ["bg:system:health"]),
      generatedAt: gbaNowIso(),
      immutableLineage: createImmutableLineage({ workspaceId, organizationId, filters, snapshotAt: gbaNowIso() }),
    };

    return dashboard;
  }

  async function computeHealth(workspaceId: string, organizationId: string): Promise<ExecutiveHealthSnapshot> {
    const [goals, risks, recommendations, approvals] = await Promise.all([
      repository.listGoals(workspaceId),
      repository.listRisks(workspaceId),
      repository.listRecommendations(workspaceId),
      repository.listApprovals(workspaceId),
    ]);

    const criticalRiskCount = risks.filter((entry) => entry.impact >= 70 && entry.probability >= 50).length;
    const behindGoalCount = goals.filter((entry) => entry.status === "BEHIND" || entry.status === "BLOCKED").length;
    const openRecommendationCount = recommendations.filter((entry) => !entry.reviewed).length;
    const pendingApprovalCount = approvals.filter((entry) => entry.state === "PENDING").length;

    const status: ExecutiveHealthSnapshot["status"] =
      criticalRiskCount === 0 && behindGoalCount < 3
        ? "HEALTHY"
        : criticalRiskCount < 3 && behindGoalCount < 6
          ? "DEGRADED"
          : "UNHEALTHY";

    return {
      healthId: createExecutiveIds().healthId,
      workspaceId,
      organizationId,
      status,
      criticalRiskCount,
      behindGoalCount,
      openRecommendationCount,
      pendingApprovalCount,
      generatedAt: gbaNowIso(),
      immutableLineage: createImmutableLineage({ workspaceId, organizationId, criticalRiskCount, behindGoalCount, pendingApprovalCount, generatedAt: gbaNowIso() }),
    };
  }

  async function generateRecommendations(input: { workspaceId: string; organizationId: string; actorId: string }): Promise<ExecutiveRecommendation[]> {
    const dashboard = await getDashboard(input.workspaceId, input.organizationId);
    const goals = await repository.listGoals(input.workspaceId);
    const risks = await repository.listRisks(input.workspaceId);

    const candidates: Array<Omit<ExecutiveRecommendation, "recommendationId" | "createdAt" | "immutableLineage" | "deterministicChecksum">> = [
      {
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: "FINANCIAL",
        title: "Stabilize cash conversion cycle",
        summary: `Cash flow trend is ${dashboard.cashFlow.trend.toFixed(2)}. Prioritize receivable acceleration and payable sequencing.`,
        evidenceReferences: ["bg:finance:cash_flow", ...dashboard.cashFlow.evidenceReferences],
        businessImpact: "Improves near-term liquidity and board confidence.",
        confidence: "HIGH",
        requiredApprovals: ["CFO", "CEO"],
        suggestedOwner: "Finance Agent",
        priority: "P1",
        reviewed: false,
      },
      {
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: "OPERATIONS",
        title: "Recover behind-schedule strategic goals",
        summary: `Detected ${goals.filter((entry) => entry.status === "BEHIND" || entry.status === "BLOCKED").length} delayed goals requiring intervention.`,
        evidenceReferences: goals.flatMap((entry) => entry.evidenceReferences).slice(0, 10),
        businessImpact: "Improves delivery predictability and execution cadence.",
        confidence: "MEDIUM",
        requiredApprovals: ["COO"],
        suggestedOwner: "Operations Agent",
        priority: "P2",
        reviewed: false,
      },
      {
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: "COMPLIANCE",
        title: "Reduce concentration of unresolved high-impact risks",
        summary: `Found ${risks.filter((entry) => entry.impact >= 70).length} high-impact risks.`,
        evidenceReferences: risks.flatMap((entry) => entry.evidenceReferences).slice(0, 10),
        businessImpact: "Reduces exposure and potential downside from regulatory and operational failures.",
        confidence: "MEDIUM",
        requiredApprovals: ["CEO", "General Counsel"],
        suggestedOwner: "Engineering Agent",
        priority: "P1",
        reviewed: false,
      },
    ];

    const sorted = candidates
      .map((entry) => ({ ...entry, evidenceReferences: [...new Set(entry.evidenceReferences.filter(Boolean))].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const created: ExecutiveRecommendation[] = [];
    for (const candidate of sorted) {
      const recommendationId = createExecutiveIds().recommendationId;
      const createdAt = gbaNowIso();
      const deterministicChecksum = gbaChecksum(canonicalizeRecommendation(candidate));
      const recommendation: ExecutiveRecommendation = {
        recommendationId,
        ...candidate,
        deterministicChecksum,
        createdAt,
        immutableLineage: createImmutableLineage({ recommendationId, checksum: deterministicChecksum, createdAt }),
      };

      await repository.saveRecommendation(recommendation);
      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "RECOMMENDATION_CREATED",
        subjectId: recommendation.recommendationId,
        summary: recommendation.title,
        actorId: input.actorId,
        evidenceReferences: recommendation.evidenceReferences,
        createdAt,
      });

      created.push(recommendation);
    }

    return created;
  }

  return {
    getDashboard,

    async listBriefings(workspaceId) {
      return repository.listBriefings(workspaceId);
    },

    async listGoals(workspaceId) {
      return repository.listGoals(workspaceId);
    },

    async listKpis(workspaceId) {
      const [definitions, history] = await Promise.all([
        repository.listKpis(workspaceId),
        repository.listKpiHistory(workspaceId),
      ]);

      const latestByKpi = new Map<string, ExecutiveKpiHistoryRecord>();
      for (const entry of history) {
        if (!latestByKpi.has(entry.kpiId)) latestByKpi.set(entry.kpiId, entry);
      }

      return definitions.map((entry) => ({ ...entry, latest: latestByKpi.get(entry.kpiId) }));
    },

    async listRecommendations(workspaceId) {
      const rows = await repository.listRecommendations(workspaceId);
      if (rows.length > 0) return rows;
      return generateRecommendations({ workspaceId, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system" });
    },

    async listRisks(workspaceId) {
      return repository.listRisks(workspaceId);
    },

    async listOpportunities(workspaceId) {
      return repository.listOpportunities(workspaceId);
    },

    async listDelegations(workspaceId) {
      return repository.listDelegations(workspaceId);
    },

    async listApprovals(workspaceId) {
      return repository.listApprovals(workspaceId);
    },

    async listTimeline(workspaceId) {
      return repository.listTimeline(workspaceId);
    },

    async listHealth(workspaceId) {
      const health = await computeHealth(workspaceId, DEFAULT_ORGANIZATION_ID);
      await repository.saveHealth(health);
      return repository.listHealth(workspaceId);
    },

    async upsertGoal(input) {
      const now = gbaNowIso();
      const status = statusFromProgress(input.progressPercent);
      const goal: ExecutiveGoal = {
        goalId: input.goalId ?? createExecutiveIds().goalId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        parentGoalId: input.parentGoalId,
        level: input.level,
        title: input.title,
        owner: input.owner,
        objective: input.objective,
        keyResults: input.keyResults,
        milestones: input.milestones,
        dependencies: input.dependencies,
        deadline: input.deadline,
        progressPercent: input.progressPercent,
        status,
        evidenceReferences: [...new Set(input.evidenceReferences)],
        createdAt: now,
        updatedAt: now,
      };

      await repository.saveGoal(goal);
      await repository.saveGoalHistory({
        goalHistoryId: createExecutiveIds().goalHistoryId,
        goalId: goal.goalId,
        workspaceId: goal.workspaceId,
        organizationId: goal.organizationId,
        progressPercent: goal.progressPercent,
        status: goal.status,
        changedBy: input.changedBy,
        changedAt: now,
        immutableLineage: createImmutableLineage({ goalId: goal.goalId, progress: goal.progressPercent, status: goal.status, changedAt: now }),
      });

      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: goal.workspaceId,
        organizationId: goal.organizationId,
        eventType: "GOAL_UPDATED",
        subjectId: goal.goalId,
        summary: `${goal.title} moved to ${goal.status}`,
        actorId: input.changedBy,
        evidenceReferences: goal.evidenceReferences,
        createdAt: now,
      });

      return goal;
    },

    async upsertKpi(input) {
      const now = gbaNowIso();
      const kpi: ExecutiveKpiDefinition = {
        kpiId: input.kpiId ?? createExecutiveIds().kpiId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        name: input.name,
        owner: input.owner,
        target: input.target,
        thresholdGreen: input.thresholdGreen,
        thresholdYellow: input.thresholdYellow,
        unit: input.unit,
        versionTag: input.versionTag,
        evidenceReferences: [...new Set(input.evidenceReferences)],
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveKpi(kpi);

      const score = scoreFromKpi(kpi, {
        kpiHistoryId: "preview",
        kpiId: kpi.kpiId,
        workspaceId: kpi.workspaceId,
        organizationId: kpi.organizationId,
        measuredValue: input.measuredValue,
        trend: input.trend,
        score: 0,
        status: "ON_TRACK",
        measuredAt: now,
        immutableLineage: "preview",
      });

      const status: ExecutiveKpiHistoryRecord["status"] =
        input.measuredValue >= kpi.thresholdGreen
          ? "ON_TRACK"
          : input.measuredValue >= kpi.thresholdYellow
            ? "AT_RISK"
            : "BEHIND";

      await repository.saveKpiHistory({
        kpiHistoryId: createExecutiveIds().kpiHistoryId,
        kpiId: kpi.kpiId,
        workspaceId: kpi.workspaceId,
        organizationId: kpi.organizationId,
        measuredValue: input.measuredValue,
        trend: input.trend,
        score,
        status,
        measuredAt: now,
        immutableLineage: createImmutableLineage({ kpiId: kpi.kpiId, value: input.measuredValue, trend: input.trend, measuredAt: now }),
      });

      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: kpi.workspaceId,
        organizationId: kpi.organizationId,
        eventType: "KPI_RECORDED",
        subjectId: kpi.kpiId,
        summary: `${kpi.name} measured at ${input.measuredValue}${kpi.unit}`,
        actorId: input.owner,
        evidenceReferences: kpi.evidenceReferences,
        createdAt: now,
      });

      return kpi;
    },

    async upsertRisk(input) {
      const now = gbaNowIso();
      const risk: ExecutiveRisk = {
        riskId: input.riskId ?? createExecutiveIds().riskId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: input.category,
        title: input.title,
        probability: input.probability,
        impact: input.impact,
        owner: input.owner,
        mitigation: input.mitigation,
        status: input.status,
        evidenceReferences: [...new Set(input.evidenceReferences)],
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveRisk(risk);

      await repository.saveRiskHistory({
        riskHistoryId: createExecutiveIds().riskHistoryId,
        riskId: risk.riskId,
        workspaceId: risk.workspaceId,
        organizationId: risk.organizationId,
        status: risk.status,
        reviewNote: input.reviewNote,
        reviewedBy: input.reviewedBy,
        reviewedAt: now,
        immutableLineage: createImmutableLineage({ riskId: risk.riskId, status: risk.status, reviewedAt: now }),
      });

      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: risk.workspaceId,
        organizationId: risk.organizationId,
        eventType: "RISK_REVIEWED",
        subjectId: risk.riskId,
        summary: `${risk.title} reviewed as ${risk.status}`,
        actorId: input.reviewedBy,
        evidenceReferences: risk.evidenceReferences,
        createdAt: now,
      });

      return risk;
    },

    async upsertOpportunity(input) {
      const now = gbaNowIso();
      const opportunity: ExecutiveOpportunity = {
        opportunityId: input.opportunityId ?? createExecutiveIds().opportunityId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        category: input.category,
        title: input.title,
        projectedImpact: input.projectedImpact,
        owner: input.owner,
        status: input.status,
        evidenceReferences: [...new Set(input.evidenceReferences)],
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveOpportunity(opportunity);

      await repository.saveOpportunityHistory({
        opportunityHistoryId: createExecutiveIds().opportunityHistoryId,
        opportunityId: opportunity.opportunityId,
        workspaceId: opportunity.workspaceId,
        organizationId: opportunity.organizationId,
        status: opportunity.status,
        note: input.note,
        changedBy: input.changedBy,
        changedAt: now,
        immutableLineage: createImmutableLineage({ opportunityId: opportunity.opportunityId, status: opportunity.status, changedAt: now }),
      });

      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: opportunity.workspaceId,
        organizationId: opportunity.organizationId,
        eventType: "OPPORTUNITY_UPDATED",
        subjectId: opportunity.opportunityId,
        summary: `${opportunity.title} updated to ${opportunity.status}`,
        actorId: input.changedBy,
        evidenceReferences: opportunity.evidenceReferences,
        createdAt: now,
      });

      return opportunity;
    },

    async generateBriefing(input) {
      const [dashboard, goals, risks, opportunities, recommendations] = await Promise.all([
        getDashboard(input.workspaceId, input.organizationId, { period: input.period ?? "daily" }),
        repository.listGoals(input.workspaceId),
        repository.listRisks(input.workspaceId),
        repository.listOpportunities(input.workspaceId),
        generateRecommendations({ workspaceId: input.workspaceId, organizationId: input.organizationId, actorId: input.actorId }),
      ]);

      const reportingTool = toolRegistry.get("genesis.reporting.generate");
      await toolExecutor.execute({
        invocationId: geaId("invoke"),
        executionId: geaId("exec"),
        taskId: geaId("task"),
        toolKey: reportingTool?.toolKey ?? "genesis.reporting.generate",
        toolVersion: reportingTool?.toolVersion ?? "v1",
        input: { dashboard: { revenue: dashboard.revenue.value, profit: dashboard.profit.value }, goals: goals.length, risks: risks.length },
        createdAt: gbaNowIso(),
      });

      const contextPackageId = await ensureContext(input.workspaceId, input.organizationId);
      const now = gbaNowIso();
      const evidenceReferences = [
        ...dashboard.revenue.evidenceReferences,
        ...dashboard.profit.evidenceReferences,
        ...goals.flatMap((entry) => entry.evidenceReferences),
        ...risks.flatMap((entry) => entry.evidenceReferences),
        ...opportunities.flatMap((entry) => entry.evidenceReferences),
      ];

      const briefingPayload = {
        period: input.period ?? "daily",
        revenue: dashboard.revenue.value,
        profit: dashboard.profit.value,
        goalCount: goals.length,
        riskCount: risks.length,
        recommendationCount: recommendations.length,
      };

      const briefing: ExecutiveBriefing = {
        briefingId: createExecutiveIds().briefingId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        period: input.period ?? "daily",
        executiveSummary: `Revenue ${dashboard.revenue.value.toFixed(0)} ${dashboard.revenue.unit}, profit ${dashboard.profit.value.toFixed(0)} ${dashboard.profit.unit}, ${risks.length} tracked risks, ${recommendations.length} active recommendations.`,
        criticalAlerts: risks.filter((entry) => entry.impact >= 70 && entry.probability >= 50).map((entry) => entry.title).slice(0, 5),
        topOpportunities: opportunities.map((entry) => entry.title).slice(0, 5),
        topRisks: risks.map((entry) => entry.title).slice(0, 5),
        completedGoals: goals.filter((entry) => entry.status === "COMPLETE").map((entry) => entry.title),
        behindScheduleGoals: goals.filter((entry) => entry.status === "BEHIND" || entry.status === "BLOCKED").map((entry) => entry.title),
        operationalHighlights: [`System health score ${dashboard.systemHealth.value}`],
        financialHighlights: [`Cash flow ${dashboard.cashFlow.value.toFixed(0)} ${dashboard.cashFlow.unit}`],
        marketingHighlights: [`Marketing performance score ${dashboard.marketingPerformance.value}`],
        manufacturingHighlights: [`Manufacturing throughput ${dashboard.manufacturingThroughput.value} ${dashboard.manufacturingThroughput.unit}`],
        salesHighlights: [`Pipeline ${dashboard.salesPipeline.value.toFixed(0)} ${dashboard.salesPipeline.unit}`],
        supportHighlights: [`Customer health ${dashboard.customerHealth.value}`],
        recommendedExecutiveActions: recommendations.map((entry) => entry.title).slice(0, 5),
        evidenceReferences: [...new Set(evidenceReferences)].sort((a, b) => a.localeCompare(b)),
        contextPackageId,
        replayChecksum: gbaChecksum(briefingPayload),
        createdBy: input.actorId,
        createdAt: now,
        immutableLineage: createImmutableLineage({ briefingPayload, contextPackageId, createdAt: now }),
      };

      await repository.saveBriefing(briefing);
      await repository.saveApproval({
        approvalId: createExecutiveIds().approvalId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        subjectType: "BRIEFING",
        subjectId: briefing.briefingId,
        state: "PENDING",
        requiredApprovers: ["CEO"],
        approvedBy: [],
        createdAt: now,
        updatedAt: now,
      });
      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "BRIEFING_GENERATED",
        subjectId: briefing.briefingId,
        summary: `Daily briefing generated for ${briefing.period}`,
        actorId: input.actorId,
        evidenceReferences: briefing.evidenceReferences,
        createdAt: now,
      });
      return briefing;
    },

    async generateRecommendations(input) {
      return generateRecommendations(input);
    },

    async reviewRecommendation(input) {
      const recommendations = await repository.listRecommendations(input.workspaceId);
      const recommendation = recommendations.find((entry) => entry.recommendationId === input.recommendationId);
      if (!recommendation) {
        throw new Error("Recommendation not found.");
      }

      const now = gbaNowIso();
      const review: ExecutiveRecommendationReview = {
        recommendationReviewId: createExecutiveIds().recommendationReviewId,
        recommendationId: recommendation.recommendationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        decision: input.decision,
        notes: input.notes,
        reviewedBy: input.actorId,
        reviewedAt: now,
        immutableLineage: createImmutableLineage({ recommendationId: recommendation.recommendationId, decision: input.decision, reviewedBy: input.actorId, reviewedAt: now }),
      };

      await repository.saveRecommendation({ ...recommendation, reviewed: true });
      await repository.saveRecommendationReview(review);
      await repository.saveApproval({
        approvalId: createExecutiveIds().approvalId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        subjectType: "RECOMMENDATION",
        subjectId: recommendation.recommendationId,
        state: input.decision === "APPROVED" ? "APPROVED" : "REJECTED",
        requiredApprovers: recommendation.requiredApprovals,
        approvedBy: [input.actorId],
        createdAt: now,
        updatedAt: now,
      });

      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "RECOMMENDATION_REVIEWED",
        subjectId: recommendation.recommendationId,
        summary: `Recommendation ${input.decision.toLowerCase()}`,
        actorId: input.actorId,
        evidenceReferences: recommendation.evidenceReferences,
        createdAt: now,
      });

      return review;
    },

    async delegateWork(input) {
      const workflowTool = toolRegistry.get("genesis.workflow.dispatch");
      await toolExecutor.execute({
        invocationId: geaId("invoke"),
        executionId: geaId("exec"),
        taskId: geaId("task"),
        toolKey: workflowTool?.toolKey ?? "genesis.workflow.dispatch",
        toolVersion: workflowTool?.toolVersion ?? "v1",
        input: { targetAgent: input.targetAgent, objective: input.objective },
        createdAt: gbaNowIso(),
      });

      const orchestrationRepository = createPrismaOrchestrationRepository();
      const orchestrationRuntime = createOrchestrationRuntimeService({ repository: orchestrationRepository, agentRuntime });
      const compiled = await orchestrationRuntime.workflowCompiler.compile({
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        orchestrationName: `Executive delegation ${input.targetAgent}`,
        orchestrationDescription: "Executive coordination workflow",
        workflowKey: `gba.delegate.${input.targetAgent.toLowerCase()}`,
        workflowName: `Delegate ${input.targetAgent}`,
        workflowDescription: input.objective,
        actorId: input.actorId,
        steps: [
          {
            stepId: geaId("step"),
            stepKey: "delegate",
            title: "Delegate objective",
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
            input: { targetAgent: input.targetAgent, objective: input.objective },
          },
        ],
      });

      const execution = await orchestrationRuntime.executionManager.start({
        orchestrationId: compiled.orchestration.orchestrationId,
        workflowId: compiled.workflow.workflowId,
        actorId: input.actorId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
      });

      const now = gbaNowIso();
      const delegation: ExecutiveDelegation = {
        delegationId: createExecutiveIds().delegationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        targetAgent: input.targetAgent,
        objective: input.objective,
        orchestrationExecutionId: execution.executionId,
        requestedBy: input.actorId,
        createdAt: now,
        immutableLineage: createImmutableLineage({ targetAgent: input.targetAgent, objective: input.objective, executionId: execution.executionId, createdAt: now }),
      };

      await repository.saveDelegation(delegation);
      await repository.saveApproval({
        approvalId: createExecutiveIds().approvalId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        subjectType: "DELEGATION",
        subjectId: delegation.delegationId,
        state: "PENDING",
        requiredApprovers: ["CEO"],
        approvedBy: [],
        createdAt: now,
        updatedAt: now,
      });
      await repository.saveTimelineEvent({
        timelineEventId: createExecutiveIds().timelineEventId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "DELEGATION_REQUESTED",
        subjectId: delegation.delegationId,
        summary: `Delegated objective to ${input.targetAgent}`,
        actorId: input.actorId,
        evidenceReferences: ["bg:orchestration:delegation"],
        createdAt: now,
      });

      return delegation;
    },
  };
}
