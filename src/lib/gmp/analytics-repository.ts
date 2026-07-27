/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpAnalyticsAttributionRegistry,
  GmpAnalyticsCollection,
  GmpAnalyticsCollectionEvent,
  GmpAnalyticsObservation,
  GmpAnalyticsRecommendationRegistry,
  GmpAnalyticsSource,
  GmpAnalyticsSourceCapability,
  GmpEvidenceCompilerVersion,
  GmpMeasurementLineage,
  GmpMetricDefinition,
  GmpNormalizedMetric,
  GmpPerformanceSnapshot,
} from "./analytics-models";

function asJson(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapSource(row: any): GmpAnalyticsSource {
  return {
    analyticsSourceId: row.analyticsSourceId,
    projectId: row.projectId,
    workspaceId: row.workspaceId ?? undefined,
    siteId: row.siteId ?? undefined,
    sourceType: row.sourceType,
    sourceName: row.sourceName,
    sourceStatus: row.sourceStatus,
    connectionStatus: row.connectionStatus,
    collectionMode: row.collectionMode,
    adapterKey: row.adapterKey ?? undefined,
    adapterVersion: row.adapterVersion ?? undefined,
    providerReference: row.providerReference ?? undefined,
    credentialsReference: row.credentialsReference ?? undefined,
    configuration: asJson(row.configuration),
    metadata: asJson(row.metadata),
    lastHealthCheckAt: iso(row.lastHealthCheckAt),
    lastCollectionAt: iso(row.lastCollectionAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCapability(row: any): GmpAnalyticsSourceCapability {
  return {
    analyticsSourceCapabilityId: row.analyticsSourceCapabilityId,
    analyticsSourceId: row.analyticsSourceId,
    capabilityKey: row.capabilityKey,
    supported: Boolean(row.supported),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCollection(row: any): GmpAnalyticsCollection {
  return {
    analyticsCollectionId: row.analyticsCollectionId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    analyticsSourceId: row.analyticsSourceId,
    siteId: row.siteId ?? undefined,
    collectionStatus: row.collectionStatus,
    requestedPeriodStart: iso(row.requestedPeriodStart),
    requestedPeriodEnd: iso(row.requestedPeriodEnd),
    requestedDimensions: asStringArray(row.requestedDimensions),
    requestedMetrics: asStringArray(row.requestedMetrics),
    collectionMode: row.collectionMode,
    gopExecutionId: row.gopExecutionId ?? undefined,
    attemptNumber: row.attemptNumber,
    parentCollectionId: row.parentCollectionId ?? undefined,
    sourceCursor: asJson(row.sourceCursor),
    nextCursor: asJson(row.nextCursor),
    idempotencyKey: row.idempotencyKey,
    inputFingerprint: row.inputFingerprint,
    adapterKey: row.adapterKey,
    adapterVersion: row.adapterVersion,
    requestedBy: row.requestedBy,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    collectionWindowStart: iso(row.collectionWindowStart),
    collectionWindowEnd: iso(row.collectionWindowEnd),
    eligibilityVersion: row.eligibilityVersion,
    errorCategory: row.errorCategory ?? undefined,
    errorSummary: row.errorSummary ?? undefined,
    warningCount: row.warningCount,
    observationCount: row.observationCount,
    rejectedObservationCount: row.rejectedObservationCount,
    partialFailureCount: row.partialFailureCount,
    forcedRecollection: Boolean(row.forcedRecollection),
    blockingIssues: asStringArray(row.blockingIssues),
    warnings: asStringArray(row.warnings),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapObservation(row: any): GmpAnalyticsObservation {
  return {
    analyticsObservationId: row.analyticsObservationId,
    projectId: row.projectId,
    analyticsSourceId: row.analyticsSourceId,
    analyticsCollectionId: row.analyticsCollectionId,
    sourceRecordIdentity: row.sourceRecordIdentity,
    observationType: row.observationType,
    sourceTimestamp: row.sourceTimestamp.toISOString(),
    observationPeriodStart: iso(row.observationPeriodStart),
    observationPeriodEnd: iso(row.observationPeriodEnd),
    dimensions: asRecord(row.dimensions),
    metrics: asRecord(row.metrics),
    rawPayloadChecksum: row.rawPayloadChecksum,
    rawPayload: asJson(row.rawPayload),
    rawPayloadReference: asJson(row.rawPayloadReference),
    providerBatchId: row.providerBatchId ?? undefined,
    providerCursor: asJson(row.providerCursor),
    collectionExecutionId: row.collectionExecutionId ?? undefined,
    dataQualityStatus: row.dataQualityStatus,
    diagnosticSummary: row.diagnosticSummary ?? undefined,
    ingestedAt: row.ingestedAt.toISOString(),
    supersededByObservationId: row.supersededByObservationId ?? undefined,
    correctedFromObservationId: row.correctedFromObservationId ?? undefined,
    observedAt: row.observedAt.toISOString(),
    observationKey: row.observationKey,
    dimensionKey: row.dimensionKey ?? undefined,
    rawValue: Number(row.rawValue),
    unit: row.unit,
    confidenceScore: row.confidenceScore == null ? undefined : Number(row.confidenceScore),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCollectionEvent(row: any): GmpAnalyticsCollectionEvent {
  return {
    analyticsCollectionEventId: row.analyticsCollectionEventId,
    analyticsCollectionId: row.analyticsCollectionId,
    parentCollectionId: row.parentCollectionId ?? undefined,
    retryOfCollectionId: row.retryOfCollectionId ?? undefined,
    gopExecutionId: row.gopExecutionId ?? undefined,
    eventType: row.eventType,
    operation: row.operation,
    status: row.status,
    actorId: row.actorId ?? undefined,
    attemptNumber: row.attemptNumber ?? undefined,
    batchNumber: row.batchNumber ?? undefined,
    pageNumber: row.pageNumber ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    observationCount: row.observationCount,
    rejectedObservationCount: row.rejectedObservationCount,
    warningCount: row.warningCount,
    cursorSummary: asJson(row.cursorSummary),
    errorCategory: row.errorCategory ?? undefined,
    safeOutcomeSummary: row.safeOutcomeSummary ?? row.outcomeSummary ?? undefined,
    outcomeSummary: row.outcomeSummary ?? undefined,
    safeDiagnostic: row.safeDiagnostic ?? undefined,
    evidenceReferences: asJson(row.evidenceReferences),
    timelineContractVersion: row.timelineContractVersion ?? undefined,
    eventVersion: row.eventVersion,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapMetricDefinition(row: any): GmpMetricDefinition {
  return {
    metricDefinitionId: row.metricDefinitionId,
    projectId: row.projectId,
    metricKey: row.metricKey,
    displayName: row.displayName,
    description: row.description ?? undefined,
    unit: row.unit,
    aggregationMethod: row.aggregationMethod,
    valueType: row.valueType,
    precisionScale: row.precisionScale,
    defaultMetric: Boolean(row.defaultMetric),
    active: Boolean(row.active),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapNormalizedMetric(row: any): GmpNormalizedMetric {
  return {
    normalizedMetricId: row.normalizedMetricId,
    projectId: row.projectId,
    analyticsSourceId: row.analyticsSourceId,
    analyticsCollectionId: row.analyticsCollectionId,
    metricDefinitionId: row.metricDefinitionId,
    analyticsObservationId: row.analyticsObservationId,
    measuredAt: row.measuredAt.toISOString(),
    normalizedValue: Number(row.normalizedValue),
    normalizationVersion: row.normalizationVersion,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSnapshot(row: any): GmpPerformanceSnapshot {
  return {
    performanceSnapshotId: row.performanceSnapshotId,
    projectId: row.projectId,
    siteId: row.siteId ?? undefined,
    snapshotStatus: row.snapshotStatus,
    snapshotLabel: row.snapshotLabel,
    snapshotWindowStart: row.snapshotWindowStart.toISOString(),
    snapshotWindowEnd: row.snapshotWindowEnd.toISOString(),
    totalMetrics: row.totalMetrics,
    baselineScore: row.baselineScore == null ? undefined : Number(row.baselineScore),
    trendDelta: row.trendDelta == null ? undefined : Number(row.trendDelta),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapLineage(row: any): GmpMeasurementLineage {
  return {
    measurementLineageId: row.measurementLineageId,
    projectId: row.projectId,
    analyticsSourceId: row.analyticsSourceId,
    analyticsCollectionId: row.analyticsCollectionId ?? undefined,
    analyticsObservationId: row.analyticsObservationId ?? undefined,
    normalizedMetricId: row.normalizedMetricId ?? undefined,
    performanceSnapshotId: row.performanceSnapshotId ?? undefined,
    lineageStage: row.lineageStage,
    evidenceCompilerVersion: row.evidenceCompilerVersion,
    lineageFingerprint: row.lineageFingerprint,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCompilerVersion(row: any): GmpEvidenceCompilerVersion {
  return {
    evidenceCompilerVersionId: row.evidenceCompilerVersionId,
    projectId: row.projectId,
    compilerName: row.compilerName,
    compilerVersion: row.compilerVersion,
    normalizationVersion: row.normalizationVersion ?? undefined,
    metricCatalogVersion: row.metricCatalogVersion ?? undefined,
    correlationVersion: row.correlationVersion ?? undefined,
    snapshotVersion: row.snapshotVersion ?? undefined,
    validationVersion: row.validationVersion ?? undefined,
    releasedAt: iso(row.releasedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAttributionRegistry(row: any): GmpAnalyticsAttributionRegistry {
  return {
    attributionRegistryId: row.attributionRegistryId,
    projectId: row.projectId,
    registryStatus: row.registryStatus,
    registryVersion: row.registryVersion,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRecommendationRegistry(row: any): GmpAnalyticsRecommendationRegistry {
  return {
    recommendationRegistryId: row.recommendationRegistryId,
    projectId: row.projectId,
    registryStatus: row.registryStatus,
    registryVersion: row.registryVersion,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type GmpAnalyticsRepository = {
  createSource: (input: Omit<GmpAnalyticsSource, "analyticsSourceId" | "createdAt" | "updatedAt">) => Promise<GmpAnalyticsSource>;
  updateSource: (analyticsSourceId: string, changes: Partial<GmpAnalyticsSource>) => Promise<GmpAnalyticsSource | null>;
  getSourceById: (analyticsSourceId: string) => Promise<GmpAnalyticsSource | null>;
  listSourcesForProject: (projectId: string) => Promise<GmpAnalyticsSource[]>;

  upsertSourceCapability: (input: Omit<GmpAnalyticsSourceCapability, "analyticsSourceCapabilityId" | "createdAt" | "updatedAt">) => Promise<GmpAnalyticsSourceCapability>;
  listSourceCapabilities: (analyticsSourceId: string) => Promise<GmpAnalyticsSourceCapability[]>;

  createCollection: (input: Omit<GmpAnalyticsCollection, "analyticsCollectionId" | "createdAt" | "updatedAt">) => Promise<GmpAnalyticsCollection>;
  updateCollection: (analyticsCollectionId: string, changes: Partial<GmpAnalyticsCollection>) => Promise<GmpAnalyticsCollection | null>;
  getCollectionById: (analyticsCollectionId: string) => Promise<GmpAnalyticsCollection | null>;
  listCollectionsForProject: (projectId: string) => Promise<GmpAnalyticsCollection[]>;
  findEquivalentCollection: (input: { projectId: string; analyticsSourceId: string; inputFingerprint: string; statuses?: string[] }) => Promise<GmpAnalyticsCollection | null>;
  listChildCollections: (parentCollectionId: string) => Promise<GmpAnalyticsCollection[]>;

  createObservation: (input: Omit<GmpAnalyticsObservation, "analyticsObservationId" | "createdAt">) => Promise<GmpAnalyticsObservation>;
  listObservationsForCollection: (analyticsCollectionId: string) => Promise<GmpAnalyticsObservation[]>;
  findObservationByIdentity: (input: { analyticsSourceId: string; sourceRecordIdentity: string; sourceTimestamp: string; rawPayloadChecksum: string }) => Promise<GmpAnalyticsObservation | null>;

  appendCollectionEvent: (input: Omit<GmpAnalyticsCollectionEvent, "analyticsCollectionEventId" | "createdAt">) => Promise<GmpAnalyticsCollectionEvent>;
  listCollectionEvents: (input: {
    analyticsCollectionId: string;
    limit?: number;
    after?: { occurredAt: string; analyticsCollectionEventId: string };
  }) => Promise<GmpAnalyticsCollectionEvent[]>;

  upsertMetricDefinition: (input: Omit<GmpMetricDefinition, "metricDefinitionId" | "createdAt" | "updatedAt"> & { metricDefinitionId?: string }) => Promise<GmpMetricDefinition>;
  listMetricDefinitionsForProject: (projectId: string) => Promise<GmpMetricDefinition[]>;

  createNormalizedMetric: (input: Omit<GmpNormalizedMetric, "normalizedMetricId" | "createdAt">) => Promise<GmpNormalizedMetric>;
  listNormalizedMetricsForCollection: (analyticsCollectionId: string) => Promise<GmpNormalizedMetric[]>;

  createSnapshot: (input: Omit<GmpPerformanceSnapshot, "performanceSnapshotId" | "createdAt" | "updatedAt">) => Promise<GmpPerformanceSnapshot>;
  getSnapshotById: (performanceSnapshotId: string) => Promise<GmpPerformanceSnapshot | null>;
  listSnapshotsForProject: (projectId: string) => Promise<GmpPerformanceSnapshot[]>;

  createMeasurementLineage: (input: Omit<GmpMeasurementLineage, "measurementLineageId" | "createdAt">) => Promise<GmpMeasurementLineage>;
  listLineageForSnapshot: (performanceSnapshotId: string) => Promise<GmpMeasurementLineage[]>;

  upsertEvidenceCompilerVersion: (input: Omit<GmpEvidenceCompilerVersion, "evidenceCompilerVersionId" | "createdAt" | "updatedAt">) => Promise<GmpEvidenceCompilerVersion>;
  getLatestEvidenceCompilerVersion: (projectId: string) => Promise<GmpEvidenceCompilerVersion | null>;

  upsertAttributionRegistry: (input: Omit<GmpAnalyticsAttributionRegistry, "attributionRegistryId" | "createdAt" | "updatedAt">) => Promise<GmpAnalyticsAttributionRegistry>;
  upsertRecommendationRegistry: (input: Omit<GmpAnalyticsRecommendationRegistry, "recommendationRegistryId" | "createdAt" | "updatedAt">) => Promise<GmpAnalyticsRecommendationRegistry>;
};

export function createPrismaGmpAnalyticsRepository(prisma: PrismaClient = getPrismaClient()): GmpAnalyticsRepository {
  const db = prisma as unknown as Record<string, any>;

  return {
    async createSource(input) {
      const row = await db.gmpAnalyticsSource.create({ data: { analyticsSourceId: `gmpasrc_${randomUUID()}`, ...input } });
      return mapSource(row);
    },
    async updateSource(analyticsSourceId, changes) {
      const existing = await db.gmpAnalyticsSource.findUnique({ where: { analyticsSourceId } });
      if (!existing) return null;
      const row = await db.gmpAnalyticsSource.update({ where: { analyticsSourceId }, data: changes });
      return mapSource(row);
    },
    async getSourceById(analyticsSourceId) {
      const row = await db.gmpAnalyticsSource.findUnique({ where: { analyticsSourceId } });
      return row ? mapSource(row) : null;
    },
    async listSourcesForProject(projectId) {
      const rows = await db.gmpAnalyticsSource.findMany({ where: { projectId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapSource);
    },

    async upsertSourceCapability(input) {
      const existing = await db.gmpAnalyticsSourceCapability.findUnique({ where: { analyticsSourceId_capabilityKey: { analyticsSourceId: input.analyticsSourceId, capabilityKey: input.capabilityKey } } });
      if (existing) {
        const row = await db.gmpAnalyticsSourceCapability.update({ where: { analyticsSourceCapabilityId: existing.analyticsSourceCapabilityId }, data: input });
        return mapCapability(row);
      }
      const row = await db.gmpAnalyticsSourceCapability.create({ data: { analyticsSourceCapabilityId: `gmpacap_${randomUUID()}`, ...input } });
      return mapCapability(row);
    },
    async listSourceCapabilities(analyticsSourceId) {
      const rows = await db.gmpAnalyticsSourceCapability.findMany({ where: { analyticsSourceId }, orderBy: [{ capabilityKey: "asc" }] });
      return rows.map(mapCapability);
    },

    async createCollection(input) {
      const row = await db.gmpAnalyticsCollection.create({ data: { analyticsCollectionId: `gmpacol_${randomUUID()}`, ...input } });
      return mapCollection(row);
    },
    async updateCollection(analyticsCollectionId, changes) {
      const existing = await db.gmpAnalyticsCollection.findUnique({ where: { analyticsCollectionId } });
      if (!existing) return null;
      const row = await db.gmpAnalyticsCollection.update({ where: { analyticsCollectionId }, data: changes });
      return mapCollection(row);
    },
    async getCollectionById(analyticsCollectionId) {
      const row = await db.gmpAnalyticsCollection.findUnique({ where: { analyticsCollectionId } });
      return row ? mapCollection(row) : null;
    },
    async listCollectionsForProject(projectId) {
      const rows = await db.gmpAnalyticsCollection.findMany({ where: { projectId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapCollection);
    },
    async findEquivalentCollection(input) {
      const rows = await db.gmpAnalyticsCollection.findMany({
        where: {
          projectId: input.projectId,
          analyticsSourceId: input.analyticsSourceId,
          inputFingerprint: input.inputFingerprint,
          collectionStatus: input.statuses ? { in: input.statuses } : undefined,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      });
      return rows[0] ? mapCollection(rows[0]) : null;
    },
    async listChildCollections(parentCollectionId) {
      const rows = await db.gmpAnalyticsCollection.findMany({
        where: { parentCollectionId },
        orderBy: [{ createdAt: "asc" }],
      });
      return rows.map(mapCollection);
    },

    async createObservation(input) {
      const row = await db.gmpAnalyticsObservation.create({ data: { analyticsObservationId: `gmpaobs_${randomUUID()}`, ...input } });
      return mapObservation(row);
    },
    async listObservationsForCollection(analyticsCollectionId) {
      const rows = await db.gmpAnalyticsObservation.findMany({ where: { analyticsCollectionId }, orderBy: [{ observedAt: "asc" }] });
      return rows.map(mapObservation);
    },
    async findObservationByIdentity(input) {
      const row = await db.gmpAnalyticsObservation.findUnique({
        where: {
          analyticsSourceId_sourceRecordIdentity_sourceTimestamp_rawPayloadChecksum: {
            analyticsSourceId: input.analyticsSourceId,
            sourceRecordIdentity: input.sourceRecordIdentity,
            sourceTimestamp: new Date(input.sourceTimestamp),
            rawPayloadChecksum: input.rawPayloadChecksum,
          },
        },
      });
      return row ? mapObservation(row) : null;
    },

    async appendCollectionEvent(input) {
      const row = await db.gmpAnalyticsCollectionEvent.create({
        data: {
          analyticsCollectionEventId: `gmpace_${randomUUID()}`,
          ...input,
          occurredAt: new Date(input.occurredAt),
        },
      });
      return mapCollectionEvent(row);
    },
    async listCollectionEvents(input) {
      const limit = Math.max(1, Math.min(500, input.limit ?? 100));
      const rows = await db.gmpAnalyticsCollectionEvent.findMany({
        where: { analyticsCollectionId: input.analyticsCollectionId },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { analyticsCollectionEventId: "asc" }],
      });

      const filtered = input.after
        ? rows.filter((row: any) => {
          const occurredAt = row.occurredAt.toISOString();
          if (occurredAt > input.after!.occurredAt) return true;
          if (occurredAt < input.after!.occurredAt) return false;
          return String(row.analyticsCollectionEventId) > input.after!.analyticsCollectionEventId;
        })
        : rows;

      return filtered.slice(0, limit).map(mapCollectionEvent);
    },

    async upsertMetricDefinition(input) {
      const existing = await db.gmpMetricDefinition.findUnique({ where: { projectId_metricKey: { projectId: input.projectId, metricKey: input.metricKey } } });
      if (existing) {
        const row = await db.gmpMetricDefinition.update({ where: { metricDefinitionId: existing.metricDefinitionId }, data: input });
        return mapMetricDefinition(row);
      }
      const row = await db.gmpMetricDefinition.create({ data: { metricDefinitionId: input.metricDefinitionId ?? `gmpmetric_${randomUUID()}`, ...input } });
      return mapMetricDefinition(row);
    },
    async listMetricDefinitionsForProject(projectId) {
      const rows = await db.gmpMetricDefinition.findMany({ where: { projectId }, orderBy: [{ metricKey: "asc" }] });
      return rows.map(mapMetricDefinition);
    },

    async createNormalizedMetric(input) {
      const row = await db.gmpNormalizedMetric.create({ data: { normalizedMetricId: `gmpnmetric_${randomUUID()}`, ...input } });
      return mapNormalizedMetric(row);
    },
    async listNormalizedMetricsForCollection(analyticsCollectionId) {
      const rows = await db.gmpNormalizedMetric.findMany({ where: { analyticsCollectionId }, orderBy: [{ measuredAt: "asc" }] });
      return rows.map(mapNormalizedMetric);
    },

    async createSnapshot(input) {
      const row = await db.gmpPerformanceSnapshot.create({ data: { performanceSnapshotId: `gmpsnap_${randomUUID()}`, ...input } });
      return mapSnapshot(row);
    },
    async getSnapshotById(performanceSnapshotId) {
      const row = await db.gmpPerformanceSnapshot.findUnique({ where: { performanceSnapshotId } });
      return row ? mapSnapshot(row) : null;
    },
    async listSnapshotsForProject(projectId) {
      const rows = await db.gmpPerformanceSnapshot.findMany({ where: { projectId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapSnapshot);
    },

    async createMeasurementLineage(input) {
      const row = await db.gmpMeasurementLineage.create({ data: { measurementLineageId: `gmplineage_${randomUUID()}`, ...input } });
      return mapLineage(row);
    },
    async listLineageForSnapshot(performanceSnapshotId) {
      const rows = await db.gmpMeasurementLineage.findMany({ where: { performanceSnapshotId }, orderBy: [{ createdAt: "asc" }] });
      return rows.map(mapLineage);
    },

    async upsertEvidenceCompilerVersion(input) {
      const existing = await db.gmpEvidenceCompilerVersion.findUnique({ where: { projectId_compilerName_compilerVersion: { projectId: input.projectId, compilerName: input.compilerName, compilerVersion: input.compilerVersion } } });
      if (existing) {
        const row = await db.gmpEvidenceCompilerVersion.update({ where: { evidenceCompilerVersionId: existing.evidenceCompilerVersionId }, data: input });
        return mapCompilerVersion(row);
      }
      const row = await db.gmpEvidenceCompilerVersion.create({ data: { evidenceCompilerVersionId: `gmpecv_${randomUUID()}`, ...input } });
      return mapCompilerVersion(row);
    },
    async getLatestEvidenceCompilerVersion(projectId) {
      const row = await db.gmpEvidenceCompilerVersion.findFirst({ where: { projectId }, orderBy: [{ updatedAt: "desc" }] });
      return row ? mapCompilerVersion(row) : null;
    },

    async upsertAttributionRegistry(input) {
      const existing = await db.gmpAnalyticsAttributionRegistry.findFirst({ where: { projectId: input.projectId }, orderBy: [{ updatedAt: "desc" }] });
      if (existing) {
        const row = await db.gmpAnalyticsAttributionRegistry.update({ where: { attributionRegistryId: existing.attributionRegistryId }, data: input });
        return mapAttributionRegistry(row);
      }
      const row = await db.gmpAnalyticsAttributionRegistry.create({ data: { attributionRegistryId: `gmpattr_${randomUUID()}`, ...input } });
      return mapAttributionRegistry(row);
    },
    async upsertRecommendationRegistry(input) {
      const existing = await db.gmpAnalyticsRecommendationRegistry.findFirst({ where: { projectId: input.projectId }, orderBy: [{ updatedAt: "desc" }] });
      if (existing) {
        const row = await db.gmpAnalyticsRecommendationRegistry.update({ where: { recommendationRegistryId: existing.recommendationRegistryId }, data: input });
        return mapRecommendationRegistry(row);
      }
      const row = await db.gmpAnalyticsRecommendationRegistry.create({ data: { recommendationRegistryId: `gmpreco_${randomUUID()}`, ...input } });
      return mapRecommendationRegistry(row);
    },
  };
}

export function createInMemoryGmpAnalyticsRepository(seed?: {
  sources?: GmpAnalyticsSource[];
  capabilities?: GmpAnalyticsSourceCapability[];
  collections?: GmpAnalyticsCollection[];
  observations?: GmpAnalyticsObservation[];
  collectionEvents?: GmpAnalyticsCollectionEvent[];
  metricDefinitions?: GmpMetricDefinition[];
  normalizedMetrics?: GmpNormalizedMetric[];
  snapshots?: GmpPerformanceSnapshot[];
  lineages?: GmpMeasurementLineage[];
  compilerVersions?: GmpEvidenceCompilerVersion[];
  attributionRegistries?: GmpAnalyticsAttributionRegistry[];
  recommendationRegistries?: GmpAnalyticsRecommendationRegistry[];
}): GmpAnalyticsRepository {
  const sources = new Map((seed?.sources ?? []).map((entry) => [entry.analyticsSourceId, entry]));
  const capabilities = new Map((seed?.capabilities ?? []).map((entry) => [entry.analyticsSourceCapabilityId, entry]));
  const collections = new Map((seed?.collections ?? []).map((entry) => [entry.analyticsCollectionId, entry]));
  const observations = new Map((seed?.observations ?? []).map((entry) => [entry.analyticsObservationId, entry]));
  const collectionEvents = new Map((seed?.collectionEvents ?? []).map((entry) => [entry.analyticsCollectionEventId, entry]));
  const metricDefinitions = new Map((seed?.metricDefinitions ?? []).map((entry) => [entry.metricDefinitionId, entry]));
  const normalizedMetrics = new Map((seed?.normalizedMetrics ?? []).map((entry) => [entry.normalizedMetricId, entry]));
  const snapshots = new Map((seed?.snapshots ?? []).map((entry) => [entry.performanceSnapshotId, entry]));
  const lineages = new Map((seed?.lineages ?? []).map((entry) => [entry.measurementLineageId, entry]));
  const compilerVersions = new Map((seed?.compilerVersions ?? []).map((entry) => [entry.evidenceCompilerVersionId, entry]));
  const attributionRegistries = new Map((seed?.attributionRegistries ?? []).map((entry) => [entry.attributionRegistryId, entry]));
  const recommendationRegistries = new Map((seed?.recommendationRegistries ?? []).map((entry) => [entry.recommendationRegistryId, entry]));

  return {
    async createSource(input) {
      const now = new Date().toISOString();
      const created: GmpAnalyticsSource = { analyticsSourceId: `gmpasrc_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      sources.set(created.analyticsSourceId, created);
      return created;
    },
    async updateSource(analyticsSourceId, changes) {
      const current = sources.get(analyticsSourceId);
      if (!current) return null;
      const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
      sources.set(analyticsSourceId, updated);
      return updated;
    },
    async getSourceById(analyticsSourceId) {
      return sources.get(analyticsSourceId) ?? null;
    },
    async listSourcesForProject(projectId) {
      return [...sources.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async upsertSourceCapability(input) {
      const existing = [...capabilities.values()].find((entry) => entry.analyticsSourceId === input.analyticsSourceId && entry.capabilityKey === input.capabilityKey);
      if (existing) {
        const updated: GmpAnalyticsSourceCapability = { ...existing, ...input, updatedAt: new Date().toISOString() };
        capabilities.set(updated.analyticsSourceCapabilityId, updated);
        return updated;
      }
      const now = new Date().toISOString();
      const created: GmpAnalyticsSourceCapability = { analyticsSourceCapabilityId: `gmpacap_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      capabilities.set(created.analyticsSourceCapabilityId, created);
      return created;
    },
    async listSourceCapabilities(analyticsSourceId) {
      return [...capabilities.values()]
        .filter((entry) => entry.analyticsSourceId === analyticsSourceId)
        .sort((left, right) => left.capabilityKey.localeCompare(right.capabilityKey));
    },

    async createCollection(input) {
      const now = new Date().toISOString();
      const created: GmpAnalyticsCollection = { analyticsCollectionId: `gmpacol_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      collections.set(created.analyticsCollectionId, created);
      return created;
    },
    async updateCollection(analyticsCollectionId, changes) {
      const current = collections.get(analyticsCollectionId);
      if (!current) return null;
      const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
      collections.set(analyticsCollectionId, updated);
      return updated;
    },
    async getCollectionById(analyticsCollectionId) {
      return collections.get(analyticsCollectionId) ?? null;
    },
    async listCollectionsForProject(projectId) {
      return [...collections.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async findEquivalentCollection(input) {
      const statuses = new Set(input.statuses ?? []);
      return [...collections.values()]
        .filter((entry) => entry.projectId === input.projectId)
        .filter((entry) => entry.analyticsSourceId === input.analyticsSourceId)
        .filter((entry) => entry.inputFingerprint === input.inputFingerprint)
        .filter((entry) => statuses.size === 0 || statuses.has(entry.collectionStatus))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    },
    async listChildCollections(parentCollectionId) {
      return [...collections.values()]
        .filter((entry) => entry.parentCollectionId === parentCollectionId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },

    async createObservation(input) {
      const created: GmpAnalyticsObservation = { analyticsObservationId: `gmpaobs_${randomUUID()}`, createdAt: new Date().toISOString(), ...input };
      observations.set(created.analyticsObservationId, created);
      return created;
    },
    async listObservationsForCollection(analyticsCollectionId) {
      return [...observations.values()]
        .filter((entry) => entry.analyticsCollectionId === analyticsCollectionId)
        .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
    },
    async findObservationByIdentity(input) {
      return [...observations.values()].find((entry) => (
        entry.analyticsSourceId === input.analyticsSourceId
        && entry.sourceRecordIdentity === input.sourceRecordIdentity
        && entry.sourceTimestamp === input.sourceTimestamp
        && entry.rawPayloadChecksum === input.rawPayloadChecksum
      )) ?? null;
    },

    async appendCollectionEvent(input) {
      const created: GmpAnalyticsCollectionEvent = {
        analyticsCollectionEventId: `gmpace_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      collectionEvents.set(created.analyticsCollectionEventId, created);
      return created;
    },
    async listCollectionEvents(input) {
      const limit = Math.max(1, Math.min(500, input.limit ?? 100));
      const sorted = [...collectionEvents.values()]
        .filter((entry) => entry.analyticsCollectionId === input.analyticsCollectionId)
        .sort((left, right) => (
          left.occurredAt.localeCompare(right.occurredAt)
          || left.createdAt.localeCompare(right.createdAt)
          || left.analyticsCollectionEventId.localeCompare(right.analyticsCollectionEventId)
        ));

      const filtered = input.after
        ? sorted.filter((entry) => (
          entry.occurredAt > input.after!.occurredAt
          || (entry.occurredAt === input.after!.occurredAt && entry.analyticsCollectionEventId > input.after!.analyticsCollectionEventId)
        ))
        : sorted;

      return filtered.slice(0, limit);
    },

    async upsertMetricDefinition(input) {
      const existing = [...metricDefinitions.values()].find((entry) => entry.projectId === input.projectId && entry.metricKey === input.metricKey);
      if (existing) {
        const updated: GmpMetricDefinition = { ...existing, ...input, updatedAt: new Date().toISOString() };
        metricDefinitions.set(updated.metricDefinitionId, updated);
        return updated;
      }
      const now = new Date().toISOString();
      const created: GmpMetricDefinition = {
        metricDefinitionId: input.metricDefinitionId ?? `gmpmetric_${randomUUID()}`,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      metricDefinitions.set(created.metricDefinitionId, created);
      return created;
    },
    async listMetricDefinitionsForProject(projectId) {
      return [...metricDefinitions.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((left, right) => left.metricKey.localeCompare(right.metricKey));
    },

    async createNormalizedMetric(input) {
      const created: GmpNormalizedMetric = { normalizedMetricId: `gmpnmetric_${randomUUID()}`, createdAt: new Date().toISOString(), ...input };
      normalizedMetrics.set(created.normalizedMetricId, created);
      return created;
    },
    async listNormalizedMetricsForCollection(analyticsCollectionId) {
      return [...normalizedMetrics.values()]
        .filter((entry) => entry.analyticsCollectionId === analyticsCollectionId)
        .sort((left, right) => left.measuredAt.localeCompare(right.measuredAt));
    },

    async createSnapshot(input) {
      const now = new Date().toISOString();
      const created: GmpPerformanceSnapshot = { performanceSnapshotId: `gmpsnap_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      snapshots.set(created.performanceSnapshotId, created);
      return created;
    },
    async getSnapshotById(performanceSnapshotId) {
      return snapshots.get(performanceSnapshotId) ?? null;
    },
    async listSnapshotsForProject(projectId) {
      return [...snapshots.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },

    async createMeasurementLineage(input) {
      const created: GmpMeasurementLineage = { measurementLineageId: `gmplineage_${randomUUID()}`, createdAt: new Date().toISOString(), ...input };
      lineages.set(created.measurementLineageId, created);
      return created;
    },
    async listLineageForSnapshot(performanceSnapshotId) {
      return [...lineages.values()]
        .filter((entry) => entry.performanceSnapshotId === performanceSnapshotId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },

    async upsertEvidenceCompilerVersion(input) {
      const existing = [...compilerVersions.values()].find((entry) => entry.projectId === input.projectId && entry.compilerName === input.compilerName && entry.compilerVersion === input.compilerVersion);
      if (existing) {
        const updated: GmpEvidenceCompilerVersion = { ...existing, ...input, updatedAt: new Date().toISOString() };
        compilerVersions.set(updated.evidenceCompilerVersionId, updated);
        return updated;
      }
      const now = new Date().toISOString();
      const created: GmpEvidenceCompilerVersion = { evidenceCompilerVersionId: `gmpecv_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      compilerVersions.set(created.evidenceCompilerVersionId, created);
      return created;
    },
    async getLatestEvidenceCompilerVersion(projectId) {
      return [...compilerVersions.values()]
        .filter((entry) => entry.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    },

    async upsertAttributionRegistry(input) {
      const existing = [...attributionRegistries.values()].find((entry) => entry.projectId === input.projectId);
      if (existing) {
        const updated: GmpAnalyticsAttributionRegistry = { ...existing, ...input, updatedAt: new Date().toISOString() };
        attributionRegistries.set(updated.attributionRegistryId, updated);
        return updated;
      }
      const now = new Date().toISOString();
      const created: GmpAnalyticsAttributionRegistry = { attributionRegistryId: `gmpattr_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      attributionRegistries.set(created.attributionRegistryId, created);
      return created;
    },
    async upsertRecommendationRegistry(input) {
      const existing = [...recommendationRegistries.values()].find((entry) => entry.projectId === input.projectId);
      if (existing) {
        const updated: GmpAnalyticsRecommendationRegistry = { ...existing, ...input, updatedAt: new Date().toISOString() };
        recommendationRegistries.set(updated.recommendationRegistryId, updated);
        return updated;
      }
      const now = new Date().toISOString();
      const created: GmpAnalyticsRecommendationRegistry = { recommendationRegistryId: `gmpreco_${randomUUID()}`, createdAt: now, updatedAt: now, ...input };
      recommendationRegistries.set(created.recommendationRegistryId, created);
      return created;
    },
  };
}
