/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpAttributionAnalysis,
  GmpAttributionResult,
  GmpDecisionSupportSummary,
  GmpRecommendationLifecycleEvent,
  GmpRecommendationRecord,
  GmpRecommendationReplayRun,
  GmpRecommendationRuleCatalogEntry,
  GmpRecommendationRuleExecution,
  GmpRecommendationRun,
} from "./recommendation-models";

function asJson(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapAttributionAnalysis(row: any): GmpAttributionAnalysis {
  return {
    attributionAnalysisId: row.attributionAnalysisId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    evidenceSnapshotId: row.evidenceSnapshotId,
    attributionVersion: row.attributionVersion,
    attributionWindowDays: row.attributionWindowDays,
    windowStart: row.windowStart.toISOString(),
    windowEnd: row.windowEnd.toISOString(),
    inputFingerprint: row.inputFingerprint,
    outputChecksum: row.outputChecksum,
    sourceMetricCount: row.sourceMetricCount,
    sourcePublicationCount: row.sourcePublicationCount,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapAttributionResult(row: any): GmpAttributionResult {
  return {
    attributionResultId: row.attributionResultId,
    attributionAnalysisId: row.attributionAnalysisId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    evidenceSnapshotId: row.evidenceSnapshotId,
    dimensionType: row.dimensionType,
    dimensionValue: row.dimensionValue,
    metricKey: row.metricKey,
    attributedValue: Number(row.attributedValue),
    confidence: row.confidence,
    lineageFingerprint: row.lineageFingerprint,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRuleCatalogEntry(row: any): GmpRecommendationRuleCatalogEntry {
  return {
    recommendationRuleCatalogEntryId: row.recommendationRuleCatalogEntryId,
    projectId: row.projectId,
    ruleId: row.ruleId,
    ruleVersion: row.ruleVersion,
    registryVersion: row.registryVersion,
    description: row.description,
    inputs: asStringArray(row.inputs),
    thresholds: asRecord(row.thresholds),
    outputSchema: asRecord(row.outputSchema),
    severityMapping: asRecord(row.severityMapping) as Record<string, any>,
    priorityMapping: asRecord(row.priorityMapping) as Record<string, any>,
    replayCompatible: Boolean(row.replayCompatible),
    active: Boolean(row.active),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRecommendationRun(row: any): GmpRecommendationRun {
  return {
    recommendationRunId: row.recommendationRunId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    evidenceSnapshotId: row.evidenceSnapshotId,
    attributionAnalysisId: row.attributionAnalysisId,
    replayOfRunId: row.replayOfRunId ?? undefined,
    triggerType: row.triggerType,
    runStatus: row.runStatus,
    recommendationEngineVersion: row.recommendationEngineVersion,
    ruleCatalogVersion: row.ruleCatalogVersion,
    attributionVersion: row.attributionVersion,
    decisionSupportVersion: row.decisionSupportVersion,
    inputFingerprint: row.inputFingerprint,
    outputChecksum: row.outputChecksum ?? undefined,
    recommendationCount: row.recommendationCount,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRuleExecution(row: any): GmpRecommendationRuleExecution {
  return {
    recommendationRuleExecutionId: row.recommendationRuleExecutionId,
    recommendationRunId: row.recommendationRunId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    evidenceSnapshotId: row.evidenceSnapshotId,
    ruleId: row.ruleId,
    ruleVersion: row.ruleVersion,
    matched: Boolean(row.matched),
    producedCount: row.producedCount,
    executionChecksum: row.executionChecksum,
    diagnostics: asJson(row.diagnostics),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRecommendationRecord(row: any): GmpRecommendationRecord {
  return {
    recommendationId: row.recommendationId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    recommendationRunId: row.recommendationRunId,
    evidenceSnapshotId: row.evidenceSnapshotId,
    attributionAnalysisId: row.attributionAnalysisId,
    recommendationVersion: row.recommendationVersion,
    ruleId: row.ruleId,
    ruleVersion: row.ruleVersion,
    evidenceCompilerVersion: row.evidenceCompilerVersion,
    snapshotVersion: row.snapshotVersion,
    attributionVersion: row.attributionVersion,
    confidence: row.confidence,
    severity: row.severity,
    priority: row.priority,
    category: row.category,
    explanation: row.explanation,
    supportingEvidence: asRecord(row.supportingEvidence),
    recommendedAction: row.recommendedAction,
    lineageFingerprint: row.lineageFingerprint,
    immutablePayloadChecksum: row.immutablePayloadChecksum,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapLifecycleEvent(row: any): GmpRecommendationLifecycleEvent {
  return {
    recommendationLifecycleEventId: row.recommendationLifecycleEventId,
    recommendationId: row.recommendationId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    lifecycleState: row.lifecycleState,
    actorId: row.actorId,
    reason: row.reason ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapReplayRun(row: any): GmpRecommendationReplayRun {
  return {
    recommendationReplayRunId: row.recommendationReplayRunId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    evidenceSnapshotId: row.evidenceSnapshotId,
    recommendationRunId: row.recommendationRunId,
    ruleCatalogVersion: row.ruleCatalogVersion,
    attributionVersion: row.attributionVersion,
    replayChecksum: row.replayChecksum,
    recommendationCount: row.recommendationCount,
    deterministicMatch: row.deterministicMatch ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapDecisionSummary(row: any): GmpDecisionSupportSummary {
  return {
    decisionSupportSummaryId: row.decisionSupportSummaryId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    evidenceSnapshotId: row.evidenceSnapshotId,
    recommendationRunId: row.recommendationRunId ?? undefined,
    summaryType: row.summaryType,
    summaryKey: row.summaryKey,
    summaryValue: asRecord(row.summaryValue),
    summaryChecksum: row.summaryChecksum,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export type GmpRecommendationRepository = {
  createAttributionAnalysis: (input: Omit<GmpAttributionAnalysis, "attributionAnalysisId" | "createdAt">) => Promise<GmpAttributionAnalysis>;
  listAttributionAnalyses: (input: { projectId: string; evidenceSnapshotId?: string; limit?: number }) => Promise<GmpAttributionAnalysis[]>;
  getAttributionAnalysisById: (attributionAnalysisId: string) => Promise<GmpAttributionAnalysis | null>;

  createAttributionResult: (input: Omit<GmpAttributionResult, "attributionResultId" | "createdAt">) => Promise<GmpAttributionResult>;
  listAttributionResults: (attributionAnalysisId: string) => Promise<GmpAttributionResult[]>;

  upsertRuleCatalogEntry: (input: Omit<GmpRecommendationRuleCatalogEntry, "recommendationRuleCatalogEntryId" | "createdAt">) => Promise<GmpRecommendationRuleCatalogEntry>;
  listRuleCatalogEntries: (projectId: string) => Promise<GmpRecommendationRuleCatalogEntry[]>;

  createRecommendationRun: (input: Omit<GmpRecommendationRun, "recommendationRunId" | "createdAt" | "updatedAt">) => Promise<GmpRecommendationRun>;
  updateRecommendationRun: (recommendationRunId: string, changes: Partial<GmpRecommendationRun>) => Promise<GmpRecommendationRun | null>;
  getRecommendationRunById: (recommendationRunId: string) => Promise<GmpRecommendationRun | null>;
  listRecommendationRuns: (projectId: string, limit?: number) => Promise<GmpRecommendationRun[]>;

  createRuleExecution: (input: Omit<GmpRecommendationRuleExecution, "recommendationRuleExecutionId" | "createdAt">) => Promise<GmpRecommendationRuleExecution>;
  listRuleExecutions: (recommendationRunId: string) => Promise<GmpRecommendationRuleExecution[]>;

  createRecommendationRecord: (input: Omit<GmpRecommendationRecord, "recommendationId" | "createdAt"> & { recommendationId?: string }) => Promise<GmpRecommendationRecord>;
  getRecommendationById: (recommendationId: string) => Promise<GmpRecommendationRecord | null>;
  listRecommendations: (input: { projectId: string; evidenceSnapshotId?: string; limit?: number }) => Promise<GmpRecommendationRecord[]>;

  appendLifecycleEvent: (input: Omit<GmpRecommendationLifecycleEvent, "recommendationLifecycleEventId" | "createdAt">) => Promise<GmpRecommendationLifecycleEvent>;
  listLifecycleEvents: (recommendationId: string) => Promise<GmpRecommendationLifecycleEvent[]>;

  createReplayRun: (input: Omit<GmpRecommendationReplayRun, "recommendationReplayRunId" | "createdAt">) => Promise<GmpRecommendationReplayRun>;
  listReplayRuns: (projectId: string, limit?: number) => Promise<GmpRecommendationReplayRun[]>;

  createDecisionSummary: (input: Omit<GmpDecisionSupportSummary, "decisionSupportSummaryId" | "createdAt">) => Promise<GmpDecisionSupportSummary>;
  listDecisionSummaries: (input: { projectId: string; evidenceSnapshotId?: string; summaryType?: GmpDecisionSupportSummary["summaryType"]; limit?: number }) => Promise<GmpDecisionSupportSummary[]>;
};

export function createPrismaGmpRecommendationRepository(prisma: PrismaClient = getPrismaClient()): GmpRecommendationRepository {
  const db = prisma as unknown as Record<string, any>;

  return {
    async createAttributionAnalysis(input) {
      const row = await db.gmpAttributionAnalysis.create({
        data: {
          attributionAnalysisId: `gmpattr_${randomUUID()}`,
          ...input,
          windowStart: new Date(input.windowStart),
          windowEnd: new Date(input.windowEnd),
        },
      });
      return mapAttributionAnalysis(row);
    },
    async listAttributionAnalyses(input) {
      const rows = await db.gmpAttributionAnalysis.findMany({
        where: {
          projectId: input.projectId,
          evidenceSnapshotId: input.evidenceSnapshotId,
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.max(1, Math.min(500, input.limit ?? 100)),
      });
      return rows.map(mapAttributionAnalysis);
    },
    async getAttributionAnalysisById(attributionAnalysisId) {
      const row = await db.gmpAttributionAnalysis.findUnique({ where: { attributionAnalysisId } });
      return row ? mapAttributionAnalysis(row) : null;
    },

    async createAttributionResult(input) {
      const row = await db.gmpAttributionResult.create({
        data: {
          attributionResultId: `gmpares_${randomUUID()}`,
          ...input,
          attributedValue: input.attributedValue,
        },
      });
      return mapAttributionResult(row);
    },
    async listAttributionResults(attributionAnalysisId) {
      const rows = await db.gmpAttributionResult.findMany({
        where: { attributionAnalysisId },
        orderBy: [{ dimensionType: "asc" }, { dimensionValue: "asc" }, { metricKey: "asc" }],
      });
      return rows.map(mapAttributionResult);
    },

    async upsertRuleCatalogEntry(input) {
      const existing = await db.gmpRecommendationRuleCatalogEntry.findUnique({
        where: {
          projectId_ruleId_ruleVersion: {
            projectId: input.projectId,
            ruleId: input.ruleId,
            ruleVersion: input.ruleVersion,
          },
        },
      });

      if (existing) {
        const row = await db.gmpRecommendationRuleCatalogEntry.update({
          where: { recommendationRuleCatalogEntryId: existing.recommendationRuleCatalogEntryId },
          data: input,
        });
        return mapRuleCatalogEntry(row);
      }

      const row = await db.gmpRecommendationRuleCatalogEntry.create({
        data: {
          recommendationRuleCatalogEntryId: `gmprule_${randomUUID()}`,
          ...input,
        },
      });
      return mapRuleCatalogEntry(row);
    },
    async listRuleCatalogEntries(projectId) {
      const rows = await db.gmpRecommendationRuleCatalogEntry.findMany({
        where: { projectId },
        orderBy: [{ ruleId: "asc" }, { ruleVersion: "asc" }],
      });
      return rows.map(mapRuleCatalogEntry);
    },

    async createRecommendationRun(input) {
      const row = await db.gmpRecommendationRun.create({
        data: {
          recommendationRunId: `gmprun_${randomUUID()}`,
          ...input,
        },
      });
      return mapRecommendationRun(row);
    },
    async updateRecommendationRun(recommendationRunId, changes) {
      const existing = await db.gmpRecommendationRun.findUnique({ where: { recommendationRunId } });
      if (!existing) return null;
      const row = await db.gmpRecommendationRun.update({
        where: { recommendationRunId },
        data: changes,
      });
      return mapRecommendationRun(row);
    },
    async getRecommendationRunById(recommendationRunId) {
      const row = await db.gmpRecommendationRun.findUnique({ where: { recommendationRunId } });
      return row ? mapRecommendationRun(row) : null;
    },
    async listRecommendationRuns(projectId, limit = 100) {
      const rows = await db.gmpRecommendationRun.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });
      return rows.map(mapRecommendationRun);
    },

    async createRuleExecution(input) {
      const row = await db.gmpRecommendationRuleExecution.create({
        data: {
          recommendationRuleExecutionId: `gmprulex_${randomUUID()}`,
          ...input,
        },
      });
      return mapRuleExecution(row);
    },
    async listRuleExecutions(recommendationRunId) {
      const rows = await db.gmpRecommendationRuleExecution.findMany({
        where: { recommendationRunId },
        orderBy: [{ createdAt: "asc" }, { ruleId: "asc" }],
      });
      return rows.map(mapRuleExecution);
    },

    async createRecommendationRecord(input) {
      const row = await db.gmpRecommendationRecord.create({
        data: {
          recommendationId: input.recommendationId || `gmprec_${randomUUID()}`,
          ...input,
        },
      });
      return mapRecommendationRecord(row);
    },
    async getRecommendationById(recommendationId) {
      const row = await db.gmpRecommendationRecord.findUnique({ where: { recommendationId } });
      return row ? mapRecommendationRecord(row) : null;
    },
    async listRecommendations(input) {
      const rows = await db.gmpRecommendationRecord.findMany({
        where: {
          projectId: input.projectId,
          evidenceSnapshotId: input.evidenceSnapshotId,
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.max(1, Math.min(500, input.limit ?? 100)),
      });
      return rows.map(mapRecommendationRecord);
    },

    async appendLifecycleEvent(input) {
      const row = await db.gmpRecommendationLifecycleEvent.create({
        data: {
          recommendationLifecycleEventId: `gmprlife_${randomUUID()}`,
          ...input,
        },
      });
      return mapLifecycleEvent(row);
    },
    async listLifecycleEvents(recommendationId) {
      const rows = await db.gmpRecommendationLifecycleEvent.findMany({
        where: { recommendationId },
        orderBy: [{ createdAt: "asc" }, { recommendationLifecycleEventId: "asc" }],
      });
      return rows.map(mapLifecycleEvent);
    },

    async createReplayRun(input) {
      const row = await db.gmpRecommendationReplayRun.create({
        data: {
          recommendationReplayRunId: `gmprreplay_${randomUUID()}`,
          ...input,
        },
      });
      return mapReplayRun(row);
    },
    async listReplayRuns(projectId, limit = 100) {
      const rows = await db.gmpRecommendationReplayRun.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });
      return rows.map(mapReplayRun);
    },

    async createDecisionSummary(input) {
      const row = await db.gmpDecisionSupportSummary.create({
        data: {
          decisionSupportSummaryId: `gmpdss_${randomUUID()}`,
          ...input,
        },
      });
      return mapDecisionSummary(row);
    },
    async listDecisionSummaries(input) {
      const rows = await db.gmpDecisionSupportSummary.findMany({
        where: {
          projectId: input.projectId,
          evidenceSnapshotId: input.evidenceSnapshotId,
          summaryType: input.summaryType,
        },
        orderBy: [{ createdAt: "desc" }, { summaryType: "asc" }],
        take: Math.max(1, Math.min(500, input.limit ?? 100)),
      });
      return rows.map(mapDecisionSummary);
    },
  };
}

export function createInMemoryGmpRecommendationRepository(seed?: {
  analyses?: GmpAttributionAnalysis[];
  attributionResults?: GmpAttributionResult[];
  rules?: GmpRecommendationRuleCatalogEntry[];
  runs?: GmpRecommendationRun[];
  ruleExecutions?: GmpRecommendationRuleExecution[];
  recommendations?: GmpRecommendationRecord[];
  lifecycleEvents?: GmpRecommendationLifecycleEvent[];
  replayRuns?: GmpRecommendationReplayRun[];
  decisionSummaries?: GmpDecisionSupportSummary[];
}): GmpRecommendationRepository {
  const analyses = new Map((seed?.analyses ?? []).map((entry) => [entry.attributionAnalysisId, entry]));
  const attributionResults = new Map((seed?.attributionResults ?? []).map((entry) => [entry.attributionResultId, entry]));
  const rules = new Map((seed?.rules ?? []).map((entry) => [entry.recommendationRuleCatalogEntryId, entry]));
  const runs = new Map((seed?.runs ?? []).map((entry) => [entry.recommendationRunId, entry]));
  const ruleExecutions = new Map((seed?.ruleExecutions ?? []).map((entry) => [entry.recommendationRuleExecutionId, entry]));
  const recommendations = new Map((seed?.recommendations ?? []).map((entry) => [entry.recommendationId, entry]));
  const lifecycleEvents = new Map((seed?.lifecycleEvents ?? []).map((entry) => [entry.recommendationLifecycleEventId, entry]));
  const replayRuns = new Map((seed?.replayRuns ?? []).map((entry) => [entry.recommendationReplayRunId, entry]));
  const decisionSummaries = new Map((seed?.decisionSummaries ?? []).map((entry) => [entry.decisionSupportSummaryId, entry]));

  return {
    async createAttributionAnalysis(input) {
      const created: GmpAttributionAnalysis = {
        attributionAnalysisId: `gmpattr_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      analyses.set(created.attributionAnalysisId, created);
      return created;
    },
    async listAttributionAnalyses(input) {
      return [...analyses.values()]
        .filter((entry) => entry.projectId === input.projectId)
        .filter((entry) => !input.evidenceSnapshotId || entry.evidenceSnapshotId === input.evidenceSnapshotId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, Math.min(500, input.limit ?? 100)));
    },
    async getAttributionAnalysisById(attributionAnalysisId) {
      return analyses.get(attributionAnalysisId) ?? null;
    },

    async createAttributionResult(input) {
      const created: GmpAttributionResult = {
        attributionResultId: `gmpares_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      attributionResults.set(created.attributionResultId, created);
      return created;
    },
    async listAttributionResults(attributionAnalysisId) {
      return [...attributionResults.values()]
        .filter((entry) => entry.attributionAnalysisId === attributionAnalysisId)
        .sort((a, b) => a.dimensionType.localeCompare(b.dimensionType) || a.dimensionValue.localeCompare(b.dimensionValue) || a.metricKey.localeCompare(b.metricKey));
    },

    async upsertRuleCatalogEntry(input) {
      const existing = [...rules.values()].find((entry) => entry.projectId === input.projectId && entry.ruleId === input.ruleId && entry.ruleVersion === input.ruleVersion);
      if (existing) {
        const updated: GmpRecommendationRuleCatalogEntry = { ...existing, ...input };
        rules.set(existing.recommendationRuleCatalogEntryId, updated);
        return updated;
      }

      const created: GmpRecommendationRuleCatalogEntry = {
        recommendationRuleCatalogEntryId: `gmprule_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      rules.set(created.recommendationRuleCatalogEntryId, created);
      return created;
    },
    async listRuleCatalogEntries(projectId) {
      return [...rules.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.ruleVersion.localeCompare(b.ruleVersion));
    },

    async createRecommendationRun(input) {
      const now = new Date().toISOString();
      const created: GmpRecommendationRun = {
        recommendationRunId: `gmprun_${randomUUID()}`,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      runs.set(created.recommendationRunId, created);
      return created;
    },
    async updateRecommendationRun(recommendationRunId, changes) {
      const current = runs.get(recommendationRunId);
      if (!current) return null;
      const updated: GmpRecommendationRun = {
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      runs.set(recommendationRunId, updated);
      return updated;
    },
    async getRecommendationRunById(recommendationRunId) {
      return runs.get(recommendationRunId) ?? null;
    },
    async listRecommendationRuns(projectId, limit = 100) {
      return [...runs.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async createRuleExecution(input) {
      const created: GmpRecommendationRuleExecution = {
        recommendationRuleExecutionId: `gmprulex_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      ruleExecutions.set(created.recommendationRuleExecutionId, created);
      return created;
    },
    async listRuleExecutions(recommendationRunId) {
      return [...ruleExecutions.values()]
        .filter((entry) => entry.recommendationRunId === recommendationRunId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.ruleId.localeCompare(b.ruleId));
    },

    async createRecommendationRecord(input) {
      const created: GmpRecommendationRecord = {
        recommendationId: input.recommendationId || `gmprec_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      recommendations.set(created.recommendationId, created);
      return created;
    },
    async getRecommendationById(recommendationId) {
      return recommendations.get(recommendationId) ?? null;
    },
    async listRecommendations(input) {
      return [...recommendations.values()]
        .filter((entry) => entry.projectId === input.projectId)
        .filter((entry) => !input.evidenceSnapshotId || entry.evidenceSnapshotId === input.evidenceSnapshotId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, Math.min(500, input.limit ?? 100)));
    },

    async appendLifecycleEvent(input) {
      const created: GmpRecommendationLifecycleEvent = {
        recommendationLifecycleEventId: `gmprlife_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      lifecycleEvents.set(created.recommendationLifecycleEventId, created);
      return created;
    },
    async listLifecycleEvents(recommendationId) {
      return [...lifecycleEvents.values()]
        .filter((entry) => entry.recommendationId === recommendationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.recommendationLifecycleEventId.localeCompare(b.recommendationLifecycleEventId));
    },

    async createReplayRun(input) {
      const created: GmpRecommendationReplayRun = {
        recommendationReplayRunId: `gmprreplay_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      replayRuns.set(created.recommendationReplayRunId, created);
      return created;
    },
    async listReplayRuns(projectId, limit = 100) {
      return [...replayRuns.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async createDecisionSummary(input) {
      const created: GmpDecisionSupportSummary = {
        decisionSupportSummaryId: `gmpdss_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      decisionSummaries.set(created.decisionSupportSummaryId, created);
      return created;
    },
    async listDecisionSummaries(input) {
      return [...decisionSummaries.values()]
        .filter((entry) => entry.projectId === input.projectId)
        .filter((entry) => !input.evidenceSnapshotId || entry.evidenceSnapshotId === input.evidenceSnapshotId)
        .filter((entry) => !input.summaryType || entry.summaryType === input.summaryType)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.summaryType.localeCompare(b.summaryType))
        .slice(0, Math.max(1, Math.min(500, input.limit ?? 100)));
    },
  };
}
