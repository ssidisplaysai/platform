/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpEvidenceCompiledMetric,
  GmpEvidenceCompilerRun,
  GmpEvidencePublicationReference,
  GmpEvidenceSnapshot,
} from "./evidence-models";

function asJson(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapRun(row: any): GmpEvidenceCompilerRun {
  return {
    evidenceCompilerRunId: row.evidenceCompilerRunId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    replayOfRunId: row.replayOfRunId ?? undefined,
    runStatus: row.runStatus,
    triggerType: row.triggerType,
    cadence: row.cadence,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    compilerVersion: row.compilerVersion,
    normalizationVersion: row.normalizationVersion,
    metricCatalogVersion: row.metricCatalogVersion,
    correlationVersion: row.correlationVersion,
    snapshotVersion: row.snapshotVersion,
    validationVersion: row.validationVersion,
    inputFingerprint: row.inputFingerprint,
    outputChecksum: row.outputChecksum ?? undefined,
    evidenceSnapshotId: row.evidenceSnapshotId ?? undefined,
    observationCount: row.observationCount,
    rejectedObservationCount: row.rejectedObservationCount,
    compiledMetricCount: row.compiledMetricCount,
    publicationReferenceCount: row.publicationReferenceCount,
    qualityStatus: row.qualityStatus,
    confidenceStatus: row.confidenceStatus,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSnapshot(row: any): GmpEvidenceSnapshot {
  return {
    evidenceSnapshotId: row.evidenceSnapshotId,
    performanceSnapshotId: row.performanceSnapshotId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    cadence: row.cadence,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    compilerVersion: row.compilerVersion,
    normalizationVersion: row.normalizationVersion,
    metricCatalogVersion: row.metricCatalogVersion,
    correlationVersion: row.correlationVersion,
    snapshotVersion: row.snapshotVersion,
    validationVersion: row.validationVersion,
    dataQualityStatus: row.dataQualityStatus,
    evidenceConfidence: row.evidenceConfidence,
    snapshotChecksum: row.snapshotChecksum,
    sourceObservationCount: row.sourceObservationCount,
    rejectedObservationCount: row.rejectedObservationCount,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCompiledMetric(row: any): GmpEvidenceCompiledMetric {
  return {
    evidenceCompiledMetricId: row.evidenceCompiledMetricId,
    evidenceSnapshotId: row.evidenceSnapshotId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    metricDefinitionId: row.metricDefinitionId ?? undefined,
    canonicalMetricKey: row.canonicalMetricKey,
    displayName: row.displayName,
    unit: row.unit,
    valueType: row.valueType,
    aggregationMethod: row.aggregationMethod,
    precisionScale: row.precisionScale,
    compiledValue: Number(row.compiledValue),
    dataQualityStatus: row.dataQualityStatus,
    evidenceConfidence: row.evidenceConfidence,
    compilerVersion: row.compilerVersion,
    sourceObservationIds: asStringArray(row.sourceObservationIds),
    lineageFingerprint: row.lineageFingerprint,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPublicationReference(row: any): GmpEvidencePublicationReference {
  return {
    evidencePublicationReferenceId: row.evidencePublicationReferenceId,
    evidenceSnapshotId: row.evidenceSnapshotId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    publicationRecordId: row.publicationRecordId ?? undefined,
    publicationIdentity: row.publicationIdentity,
    canonicalUrl: row.canonicalUrl,
    publicationStatus: row.publicationStatus,
    publicationTimestamp: iso(row.publicationTimestamp),
    correlationQuality: row.correlationQuality,
    matchedObservationIds: asStringArray(row.matchedObservationIds),
    lineageFingerprint: row.lineageFingerprint,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export type GmpEvidenceRepository = {
  createCompilerRun: (input: Omit<GmpEvidenceCompilerRun, "evidenceCompilerRunId" | "createdAt" | "updatedAt">) => Promise<GmpEvidenceCompilerRun>;
  updateCompilerRun: (evidenceCompilerRunId: string, changes: Partial<GmpEvidenceCompilerRun>) => Promise<GmpEvidenceCompilerRun | null>;
  getCompilerRunById: (evidenceCompilerRunId: string) => Promise<GmpEvidenceCompilerRun | null>;
  listCompilerRunsForProject: (projectId: string, limit?: number) => Promise<GmpEvidenceCompilerRun[]>;

  createEvidenceSnapshot: (input: Omit<GmpEvidenceSnapshot, "evidenceSnapshotId" | "createdAt">) => Promise<GmpEvidenceSnapshot>;
  getEvidenceSnapshotById: (evidenceSnapshotId: string) => Promise<GmpEvidenceSnapshot | null>;
  listEvidenceSnapshotsForProject: (projectId: string, limit?: number) => Promise<GmpEvidenceSnapshot[]>;

  createCompiledMetric: (input: Omit<GmpEvidenceCompiledMetric, "evidenceCompiledMetricId" | "createdAt">) => Promise<GmpEvidenceCompiledMetric>;
  listCompiledMetrics: (input: { projectId: string; evidenceSnapshotId?: string; limit?: number }) => Promise<GmpEvidenceCompiledMetric[]>;

  createPublicationReference: (input: Omit<GmpEvidencePublicationReference, "evidencePublicationReferenceId" | "createdAt">) => Promise<GmpEvidencePublicationReference>;
  listPublicationReferences: (input: { projectId: string; evidenceSnapshotId?: string; limit?: number }) => Promise<GmpEvidencePublicationReference[]>;
};

export function createPrismaGmpEvidenceRepository(prisma: PrismaClient = getPrismaClient()): GmpEvidenceRepository {
  const db = prisma as unknown as Record<string, any>;

  return {
    async createCompilerRun(input) {
      const row = await db.gmpEvidenceCompilerRun.create({
        data: {
          evidenceCompilerRunId: `gmpecr_${randomUUID()}`,
          ...input,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
        },
      });
      return mapRun(row);
    },
    async updateCompilerRun(evidenceCompilerRunId, changes) {
      const existing = await db.gmpEvidenceCompilerRun.findUnique({ where: { evidenceCompilerRunId } });
      if (!existing) return null;
      const row = await db.gmpEvidenceCompilerRun.update({
        where: { evidenceCompilerRunId },
        data: {
          ...changes,
          periodStart: changes.periodStart ? new Date(changes.periodStart) : undefined,
          periodEnd: changes.periodEnd ? new Date(changes.periodEnd) : undefined,
        },
      });
      return mapRun(row);
    },
    async getCompilerRunById(evidenceCompilerRunId) {
      const row = await db.gmpEvidenceCompilerRun.findUnique({ where: { evidenceCompilerRunId } });
      return row ? mapRun(row) : null;
    },
    async listCompilerRunsForProject(projectId, limit = 50) {
      const rows = await db.gmpEvidenceCompilerRun.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });
      return rows.map(mapRun);
    },

    async createEvidenceSnapshot(input) {
      const row = await db.gmpEvidenceSnapshot.create({
        data: {
          evidenceSnapshotId: `gmpevs_${randomUUID()}`,
          ...input,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
        },
      });
      return mapSnapshot(row);
    },
    async getEvidenceSnapshotById(evidenceSnapshotId) {
      const row = await db.gmpEvidenceSnapshot.findUnique({ where: { evidenceSnapshotId } });
      return row ? mapSnapshot(row) : null;
    },
    async listEvidenceSnapshotsForProject(projectId, limit = 50) {
      const rows = await db.gmpEvidenceSnapshot.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });
      return rows.map(mapSnapshot);
    },

    async createCompiledMetric(input) {
      const row = await db.gmpEvidenceCompiledMetric.create({
        data: {
          evidenceCompiledMetricId: `gmpecm_${randomUUID()}`,
          ...input,
          compiledValue: input.compiledValue,
          sourceObservationIds: input.sourceObservationIds,
        },
      });
      return mapCompiledMetric(row);
    },
    async listCompiledMetrics(input) {
      const rows = await db.gmpEvidenceCompiledMetric.findMany({
        where: {
          projectId: input.projectId,
          evidenceSnapshotId: input.evidenceSnapshotId,
        },
        orderBy: [{ createdAt: "desc" }, { canonicalMetricKey: "asc" }],
        take: Math.max(1, Math.min(500, input.limit ?? 100)),
      });
      return rows.map(mapCompiledMetric);
    },

    async createPublicationReference(input) {
      const row = await db.gmpEvidencePublicationReference.create({
        data: {
          evidencePublicationReferenceId: `gmpepr_${randomUUID()}`,
          ...input,
          publicationTimestamp: input.publicationTimestamp ? new Date(input.publicationTimestamp) : null,
          matchedObservationIds: input.matchedObservationIds,
        },
      });
      return mapPublicationReference(row);
    },
    async listPublicationReferences(input) {
      const rows = await db.gmpEvidencePublicationReference.findMany({
        where: {
          projectId: input.projectId,
          evidenceSnapshotId: input.evidenceSnapshotId,
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.max(1, Math.min(500, input.limit ?? 100)),
      });
      return rows.map(mapPublicationReference);
    },
  };
}

export function createInMemoryGmpEvidenceRepository(seed?: {
  runs?: GmpEvidenceCompilerRun[];
  snapshots?: GmpEvidenceSnapshot[];
  compiledMetrics?: GmpEvidenceCompiledMetric[];
  publicationReferences?: GmpEvidencePublicationReference[];
}): GmpEvidenceRepository {
  const runs = new Map((seed?.runs ?? []).map((entry) => [entry.evidenceCompilerRunId, entry]));
  const snapshots = new Map((seed?.snapshots ?? []).map((entry) => [entry.evidenceSnapshotId, entry]));
  const compiledMetrics = new Map((seed?.compiledMetrics ?? []).map((entry) => [entry.evidenceCompiledMetricId, entry]));
  const publicationReferences = new Map((seed?.publicationReferences ?? []).map((entry) => [entry.evidencePublicationReferenceId, entry]));

  return {
    async createCompilerRun(input) {
      const now = new Date().toISOString();
      const created: GmpEvidenceCompilerRun = {
        evidenceCompilerRunId: `gmpecr_${randomUUID()}`,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      runs.set(created.evidenceCompilerRunId, created);
      return created;
    },
    async updateCompilerRun(evidenceCompilerRunId, changes) {
      const current = runs.get(evidenceCompilerRunId);
      if (!current) return null;
      const updated: GmpEvidenceCompilerRun = {
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      runs.set(evidenceCompilerRunId, updated);
      return updated;
    },
    async getCompilerRunById(evidenceCompilerRunId) {
      return runs.get(evidenceCompilerRunId) ?? null;
    },
    async listCompilerRunsForProject(projectId, limit = 50) {
      return [...runs.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async createEvidenceSnapshot(input) {
      const created: GmpEvidenceSnapshot = {
        evidenceSnapshotId: `gmpevs_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      snapshots.set(created.evidenceSnapshotId, created);
      return created;
    },
    async getEvidenceSnapshotById(evidenceSnapshotId) {
      return snapshots.get(evidenceSnapshotId) ?? null;
    },
    async listEvidenceSnapshotsForProject(projectId, limit = 50) {
      return [...snapshots.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async createCompiledMetric(input) {
      const created: GmpEvidenceCompiledMetric = {
        evidenceCompiledMetricId: `gmpecm_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      compiledMetrics.set(created.evidenceCompiledMetricId, created);
      return created;
    },
    async listCompiledMetrics(input) {
      return [...compiledMetrics.values()]
        .filter((entry) => entry.projectId === input.projectId)
        .filter((entry) => !input.evidenceSnapshotId || entry.evidenceSnapshotId === input.evidenceSnapshotId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.canonicalMetricKey.localeCompare(b.canonicalMetricKey))
        .slice(0, Math.max(1, Math.min(500, input.limit ?? 100)));
    },

    async createPublicationReference(input) {
      const created: GmpEvidencePublicationReference = {
        evidencePublicationReferenceId: `gmpepr_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      publicationReferences.set(created.evidencePublicationReferenceId, created);
      return created;
    },
    async listPublicationReferences(input) {
      return [...publicationReferences.values()]
        .filter((entry) => entry.projectId === input.projectId)
        .filter((entry) => !input.evidenceSnapshotId || entry.evidenceSnapshotId === input.evidenceSnapshotId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, Math.min(500, input.limit ?? 100)));
    },
  };
}
