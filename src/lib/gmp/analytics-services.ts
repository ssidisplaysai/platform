import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import type { GmpRepository } from "./repository";
import { createPrismaGmpRepository } from "./repository";
import {
  createAnalyticsAdapterRegistry,
  createDeterministicAnalyticsFixtureAdapter,
  resolveAnalyticsAdapter,
  toObservationEntity,
  type GmpAnalyticsAdapterRegistry,
  type GmpAnalyticsSourceAdapter,
} from "./analytics-adapters";
import {
  createEnvironmentAnalyticsCredentialProvider,
  type GmpAnalyticsCredentialProvider,
} from "./analytics-credentials";
import {
  canTransitionCollectionStatus,
  createAnalyticsSource,
  defaultMetricDefinitions,
  GMP_ANALYTICS_ELIGIBILITY_VERSION,
  GMP_ANALYTICS_TIMELINE_CONTRACT_VERSION,
  GMP_EVIDENCE_COMPILER_VERSION,
  stableAnalyticsFingerprint,
  type GmpAnalyticsCollection,
  type GmpAnalyticsCollectionEvent,
  type GmpAnalyticsCollectionMode,
  type GmpAnalyticsCollectionStatus,
  type GmpAnalyticsEligibilityReport,
  type GmpAnalyticsTimelineEventStatus,
  type GmpAnalyticsTimelineEventType,
  type GmpAnalyticsObservation,
  type GmpAnalyticsSource,
  type GmpEvidenceCompilerVersion,
  type GmpMeasurementLineage,
  type GmpMetricDefinition,
  type GmpNormalizedMetric,
  type GmpPerformanceSnapshot,
} from "./analytics-models";
import type { GmpAnalyticsRepository } from "./analytics-repository";
import { createPrismaGmpAnalyticsRepository } from "./analytics-repository";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.analytics";
const COLLECTION_EVENT_VERSION = "gmp-analytics-collection-event/v1";

function nowIso(): string {
  return new Date().toISOString();
}

function isRetryableStatus(status: GmpAnalyticsCollectionStatus): boolean {
  return status === "FAILED" || status === "PARTIAL" || status === "COMPLETED_WITH_WARNINGS";
}

function containsSecretLikeFields(value: unknown): boolean {
  const text = JSON.stringify(value ?? {}).toLowerCase();
  return ["token", "password", "secret", "api_key", "apikey", "authorization", "refresh_token"]
    .some((item) => text.includes(item));
}

function sanitizeArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0).sort()
    : [];
}

export type GmpCollectionRequestInput = {
  workspaceId: string;
  projectId: string;
  siteId?: string;
  analyticsSourceId: string;
  actorId: string;
  collectionMode: GmpAnalyticsCollectionMode;
  periodStart?: string;
  periodEnd?: string;
  requestedDimensions: string[];
  requestedMetrics: string[];
  idempotencyKey?: string;
  forcedRecollection?: boolean;
  sourceCursor?: Record<string, unknown>;
};

export type GmpCollectionRequestResult = {
  collection: GmpAnalyticsCollection;
  eligibility: GmpAnalyticsEligibilityReport;
  idempotencyBehavior: "CREATED" | "REUSED_ACTIVE" | "REUSED_COMPLETED";
  equivalentCollectionId?: string;
  gopExecutionId?: string;
  adapterKey: string;
  adapterVersion: string;
};

export type GmpCollectionDetail = {
  collection: GmpAnalyticsCollection;
  source: Pick<GmpAnalyticsSource, "analyticsSourceId" | "sourceType" | "sourceName" | "connectionStatus">;
  observations: Array<Pick<GmpAnalyticsObservation, "analyticsObservationId" | "sourceRecordIdentity" | "observationType" | "observationPeriodStart" | "observationPeriodEnd" | "dataQualityStatus" | "rawPayloadChecksum" | "ingestedAt">>;
  timeline: GmpAnalyticsCollectionEvent[];
  children: GmpAnalyticsCollection[];
  retryEligibility: {
    eligible: boolean;
    reason?: string;
  };
};

export type GmpCollectionTimelinePage = {
  contractVersion: string;
  events: GmpAnalyticsCollectionEvent[];
  nextCursor?: { occurredAt: string; analyticsCollectionEventId: string };
};

export type GmpAnalyticsServices = {
  listSources: (projectId: string) => Promise<GmpAnalyticsSource[]>;
  createSource: (input: {
    projectId: string;
    workspaceId?: string;
    siteId?: string;
    sourceType: string;
    sourceName: string;
    providerReference?: string;
    credentialsReference?: string;
    configuration?: Record<string, unknown>;
    capabilities?: Record<string, boolean>;
    metadata?: Record<string, unknown>;
  }) => Promise<GmpAnalyticsSource | null>;
  getSourceDetail: (analyticsSourceId: string) => Promise<{ source: GmpAnalyticsSource; capabilities: Record<string, boolean> } | null>;
  validateSource: (analyticsSourceId: string) => Promise<Record<string, unknown> | null>;
  detectSourceCapabilities: (analyticsSourceId: string) => Promise<Record<string, unknown> | null>;
  getSourceHealth: (analyticsSourceId: string) => Promise<Record<string, unknown> | null>;

  listCollections: (projectId: string) => Promise<GmpAnalyticsCollection[]>;
  evaluateCollectionEligibility: (input: {
    workspaceId?: string;
    projectId: string;
    analyticsSourceId: string;
    collectionMode?: GmpAnalyticsCollectionMode;
    requestedDimensions?: string[];
    requestedMetrics?: string[];
    periodStart?: string;
    periodEnd?: string;
    forcedRecollection?: boolean;
    sourceCursor?: Record<string, unknown>;
  }) => Promise<(GmpAnalyticsEligibilityReport & {
    inputFingerprint: string;
    equivalentActiveCollectionId?: string;
    equivalentCompletedCollectionId?: string;
    resolvedAdapterKey?: string;
    resolvedAdapterVersion?: string;
    effectiveCollectionMode: GmpAnalyticsCollectionMode;
  }) | null>;

  requestCollection: (input: GmpCollectionRequestInput) => Promise<GmpCollectionRequestResult>;
  retryCollection: (input: { workspaceId: string; collectionId: string; actorId: string; mode?: "resume" | "restart" }) => Promise<GmpCollectionRequestResult | null>;
  getCollectionDetail: (collectionId: string) => Promise<GmpCollectionDetail | null>;
  getCollectionTimeline: (input: { collectionId: string; limit?: number; after?: { occurredAt: string; analyticsCollectionEventId: string } }) => Promise<GmpCollectionTimelinePage | null>;

  listMetricDefinitions: (projectId: string) => Promise<GmpMetricDefinition[]>;
  upsertMetricDefinition: (input: Omit<GmpMetricDefinition, "metricDefinitionId" | "createdAt" | "updatedAt"> & { metricDefinitionId?: string }) => Promise<GmpMetricDefinition>;

  createSnapshotFromCollection: (input: {
    projectId: string;
    analyticsCollectionId: string;
    snapshotLabel: string;
    siteId?: string;
  }) => Promise<{ snapshot: GmpPerformanceSnapshot; metrics: GmpNormalizedMetric[]; lineage: GmpMeasurementLineage[] } | null>;
  listSnapshots: (projectId: string) => Promise<GmpPerformanceSnapshot[]>;
  getSnapshotDetail: (performanceSnapshotId: string) => Promise<{ snapshot: GmpPerformanceSnapshot; metrics: GmpNormalizedMetric[]; lineage: GmpMeasurementLineage[] } | null>;

  ensureFoundationConfig: (projectId: string) => Promise<{
    compilerVersion: GmpEvidenceCompilerVersion;
    attributionRegistryVersion: string;
    recommendationRegistryVersion: string;
  }>;

  runCollection: (input: { projectId: string; analyticsSourceId: string; actorId: string; windowStart?: string; windowEnd?: string }) => Promise<{ collection: GmpAnalyticsCollection; observationsCreated: number; normalizedMetricsCreated: number }>;
};

export function createGmpAnalyticsServices(dependencies?: {
  projectRepository?: GmpRepository;
  analyticsRepository?: GmpAnalyticsRepository;
  sourceAdapter?: GmpAnalyticsSourceAdapter;
  adapterRegistry?: GmpAnalyticsAdapterRegistry;
  credentialProvider?: GmpAnalyticsCredentialProvider;
}): GmpAnalyticsServices {
  const projectRepository = dependencies?.projectRepository ?? createPrismaGmpRepository();
  const analyticsRepository = dependencies?.analyticsRepository ?? createPrismaGmpAnalyticsRepository();
  const fallbackAdapter = dependencies?.sourceAdapter ?? createDeterministicAnalyticsFixtureAdapter();
  const adapterRegistry = dependencies?.adapterRegistry ?? createAnalyticsAdapterRegistry();
  const credentialProvider = dependencies?.credentialProvider ?? createEnvironmentAnalyticsCredentialProvider();

  async function ensureMetricDefinitions(projectId: string): Promise<GmpMetricDefinition[]> {
    const existing = await analyticsRepository.listMetricDefinitionsForProject(projectId);
    if (existing.length > 0) return existing;
    const defaults = defaultMetricDefinitions(projectId);
    const created: GmpMetricDefinition[] = [];
    for (const item of defaults) {
      created.push(await analyticsRepository.upsertMetricDefinition(item));
    }
    return created;
  }

  async function appendCollectionEvent(input: Omit<GmpAnalyticsCollectionEvent, "analyticsCollectionEventId" | "createdAt" | "eventVersion" | "timelineContractVersion"> & {
    eventType: GmpAnalyticsTimelineEventType;
    status: GmpAnalyticsTimelineEventStatus;
  }) {
    return analyticsRepository.appendCollectionEvent({
      ...input,
      timelineContractVersion: GMP_ANALYTICS_TIMELINE_CONTRACT_VERSION,
      safeOutcomeSummary: input.safeOutcomeSummary ?? input.outcomeSummary,
      eventVersion: COLLECTION_EVENT_VERSION,
    });
  }

  async function normalizeCollectionMetrics(collection: GmpAnalyticsCollection): Promise<GmpNormalizedMetric[]> {
    const existing = await analyticsRepository.listNormalizedMetricsForCollection(collection.analyticsCollectionId);
    if (existing.length > 0) {
      return existing;
    }

    const observations = await analyticsRepository.listObservationsForCollection(collection.analyticsCollectionId);
    if (observations.length === 0) {
      return [];
    }

    const metricDefinitions = await ensureMetricDefinitions(collection.projectId);
    const definitionByKey = new Map(metricDefinitions.map((entry) => [entry.metricKey, entry]));
    const normalizedMetrics: GmpNormalizedMetric[] = [];

    for (const observation of observations) {
      let definition = definitionByKey.get(observation.observationKey);
      if (!definition) {
        definition = await analyticsRepository.upsertMetricDefinition({
          projectId: collection.projectId,
          metricKey: observation.observationKey,
          displayName: observation.observationKey,
          description: `Auto-created metric definition for ${observation.observationKey}.`,
          unit: observation.unit || "count",
          aggregationMethod: "SUM",
          valueType: "NUMBER",
          precisionScale: 4,
          defaultMetric: false,
          active: true,
          metadata: { autoCreated: true },
        });
        definitionByKey.set(definition.metricKey, definition);
      }

      normalizedMetrics.push(await analyticsRepository.createNormalizedMetric({
        projectId: collection.projectId,
        analyticsSourceId: collection.analyticsSourceId,
        analyticsCollectionId: collection.analyticsCollectionId,
        metricDefinitionId: definition.metricDefinitionId,
        analyticsObservationId: observation.analyticsObservationId,
        measuredAt: observation.observedAt,
        normalizedValue: observation.rawValue,
        normalizationVersion: "gmp-analytics-normalization/v1",
        metadata: {
          unit: observation.unit,
          confidenceScore: observation.confidenceScore ?? null,
        },
      }));
    }

    return normalizedMetrics;
  }

  async function transitionCollection(
    collection: GmpAnalyticsCollection,
    nextStatus: GmpAnalyticsCollectionStatus,
    changes: Partial<GmpAnalyticsCollection> = {},
  ) {
    if (!canTransitionCollectionStatus(collection.collectionStatus, nextStatus)) {
      throw new Error(`Invalid collection transition ${collection.collectionStatus} -> ${nextStatus}`);
    }

    const updated = await analyticsRepository.updateCollection(collection.analyticsCollectionId, {
      ...changes,
      collectionStatus: nextStatus,
    });

    return updated ?? collection;
  }

  async function emitGopEvent(input: {
    collection: GmpAnalyticsCollection;
    eventType: string;
    status?: "QUEUED" | "STARTING" | "RUNNING" | "VALIDATION_STARTED" | "VALIDATION_PASSED" | "COMPLETE" | "FAILED";
    message: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    const store = getGenesisEventStore();
    await store.appendEventIdempotently({
      jobId: input.collection.analyticsCollectionId,
      moduleId: DEFAULT_MODULE_ID,
      jobType: "CUSTOM",
      type: input.eventType,
      label: input.eventType.replaceAll("_", " "),
      stage: "analytics_collection",
      status: input.status,
      message: input.message,
      source: "gmp.analytics.collection-engine",
      occurredAt: nowIso(),
      actorId: input.actorId,
      correlationId: input.collection.gopExecutionId,
      metadata: input.metadata,
      idempotencyKey: input.idempotencyKey ?? `${input.collection.analyticsCollectionId}:${input.eventType}:${input.message}`,
    });
  }

  function validateObservationPayload(payload: Omit<GmpAnalyticsObservation, "analyticsObservationId" | "createdAt">): { ok: boolean; reason?: string } {
    if (!payload.sourceRecordIdentity || payload.sourceRecordIdentity.trim().length === 0) {
      return { ok: false, reason: "missing_source_record_identity" };
    }

    if (!payload.observationType || payload.observationType.trim().length === 0) {
      return { ok: false, reason: "missing_observation_type" };
    }

    if (!payload.sourceTimestamp || Number.isNaN(Date.parse(payload.sourceTimestamp))) {
      return { ok: false, reason: "invalid_source_timestamp" };
    }

    if (!payload.dimensions || typeof payload.dimensions !== "object" || Array.isArray(payload.dimensions)) {
      return { ok: false, reason: "invalid_dimensions" };
    }

    if (!payload.metrics || typeof payload.metrics !== "object" || Array.isArray(payload.metrics)) {
      return { ok: false, reason: "invalid_metrics" };
    }

    if (containsSecretLikeFields(payload.rawPayload) || containsSecretLikeFields(payload.metrics) || containsSecretLikeFields(payload.dimensions)) {
      return { ok: false, reason: "secret_like_fields_detected" };
    }

    if (JSON.stringify(payload.rawPayload ?? {}).length > 16_000) {
      return { ok: false, reason: "payload_too_large" };
    }

    if (typeof payload.rawValue !== "number" || Number.isNaN(payload.rawValue)) {
      return { ok: false, reason: "invalid_numeric_value" };
    }

    return { ok: true };
  }

  async function executeCollection(collectionId: string, actorId: string): Promise<GmpAnalyticsCollection> {
    const current = await analyticsRepository.getCollectionById(collectionId);
    if (!current) throw new Error("Collection not found");

    const source = await analyticsRepository.getSourceById(current.analyticsSourceId);
    if (!source) {
      throw new Error("Source not found");
    }

    const adapter = resolveAnalyticsAdapter(source, adapterRegistry, fallbackAdapter);

    const runtime = getGenesisOrchestrationRuntime();
    const execution = current.gopExecutionId
      ? runtime.getExecutionById(current.gopExecutionId)
      : null;

    let working = current;
    if (!execution) {
      const createdExecution = runtime.createExecution({
        workspaceId: current.workspaceId,
        moduleId: DEFAULT_MODULE_ID,
        jobType: "CUSTOM",
        executionType: "GMP_ANALYTICS_COLLECTION_EXECUTE",
        input: {
          collectionId: current.analyticsCollectionId,
          sourceId: current.analyticsSourceId,
          projectId: current.projectId,
          siteId: current.siteId,
          requestedMetrics: current.requestedMetrics,
          requestedDimensions: current.requestedDimensions,
          collectionMode: current.collectionMode,
          inputFingerprint: current.inputFingerprint,
          adapterKey: current.adapterKey,
          adapterVersion: current.adapterVersion,
        },
      });
      working = await analyticsRepository.updateCollection(current.analyticsCollectionId, {
        gopExecutionId: createdExecution.executionId,
      }) ?? current;
    }

    await appendCollectionEvent({
      analyticsCollectionId: working.analyticsCollectionId,
      parentCollectionId: working.parentCollectionId,
      retryOfCollectionId: working.parentCollectionId,
      gopExecutionId: working.gopExecutionId,
      eventType: "GOP_EXECUTION_CREATED",
      operation: "execution",
      status: "ok",
      actorId,
      attemptNumber: working.attemptNumber,
      occurredAt: nowIso(),
      observationCount: 0,
      rejectedObservationCount: 0,
      warningCount: 0,
      outcomeSummary: "GOP execution linked",
    });

    await appendCollectionEvent({
      analyticsCollectionId: working.analyticsCollectionId,
      parentCollectionId: working.parentCollectionId,
      retryOfCollectionId: working.parentCollectionId,
      gopExecutionId: working.gopExecutionId,
      eventType: "ADAPTER_RESOLVED",
      operation: "adapter_resolution",
      status: "ok",
      actorId,
      attemptNumber: working.attemptNumber,
      occurredAt: nowIso(),
      observationCount: 0,
      rejectedObservationCount: 0,
      warningCount: 0,
      safeOutcomeSummary: `Adapter ${adapter.adapterKey}@${adapter.adapterVersion} resolved`,
      evidenceReferences: {
        adapterKey: adapter.adapterKey,
        adapterVersion: adapter.adapterVersion,
      },
    });

    await emitGopEvent({
      collection: working,
      eventType: "COLLECTION_RUNNING",
      status: "RUNNING",
      message: "Collection execution started.",
      actorId,
    });

    working = await transitionCollection(working, "RUNNING", { startedAt: nowIso() });

    await appendCollectionEvent({
      analyticsCollectionId: working.analyticsCollectionId,
      parentCollectionId: working.parentCollectionId,
      retryOfCollectionId: working.parentCollectionId,
      gopExecutionId: working.gopExecutionId,
      eventType: "COLLECTION_STARTED",
      operation: "execution",
      status: "running",
      actorId,
      attemptNumber: working.attemptNumber,
      occurredAt: nowIso(),
      observationCount: 0,
      rejectedObservationCount: 0,
      warningCount: 0,
      safeOutcomeSummary: "Collection started",
    });

    const resolvedCredential = await credentialProvider.resolveSourceCredential(source);
    const credentialSafe = resolvedCredential ? { fingerprint: resolvedCredential.fingerprint } : undefined;

    await appendCollectionEvent({
      analyticsCollectionId: working.analyticsCollectionId,
      gopExecutionId: working.gopExecutionId,
      eventType: "CREDENTIAL_REFERENCE_RESOLVED",
      operation: "credential_resolution",
      status: "ok",
      actorId,
      attemptNumber: working.attemptNumber,
      occurredAt: nowIso(),
      observationCount: 0,
      rejectedObservationCount: 0,
      warningCount: 0,
      safeDiagnostic: credentialProvider.redactDiagnostic(credentialSafe),
      outcomeSummary: resolvedCredential ? "Credential resolved" : "No credential required",
    });

    let observationCount = 0;
    let rejectedObservationCount = 0;
    let warningCount = working.warnings.length;
    let partialFailureCount = 0;
    let cursor = adapter.normalizeCursor(working.sourceCursor);
    let nextCursor: Record<string, unknown> | undefined;

    for (let batch = 1; batch <= 20; batch += 1) {
      const pageNumber = typeof cursor.page === "number" ? Math.max(1, Math.floor(cursor.page)) : batch;
      await appendCollectionEvent({
        analyticsCollectionId: working.analyticsCollectionId,
        parentCollectionId: working.parentCollectionId,
        retryOfCollectionId: working.parentCollectionId,
        gopExecutionId: working.gopExecutionId,
        eventType: "BATCH_REQUESTED",
        operation: "adapter_collect",
        status: "running",
        actorId,
        attemptNumber: working.attemptNumber,
        batchNumber: batch,
        pageNumber,
        occurredAt: nowIso(),
        observationCount,
        rejectedObservationCount,
        warningCount,
        cursorSummary: cursor,
        outcomeSummary: `Batch ${batch} requested`,
      });

      try {
        const page = await adapter.collect({
          source,
          startCursor: cursor,
          windowStart: working.requestedPeriodStart ?? undefined,
          windowEnd: working.requestedPeriodEnd ?? undefined,
          metrics: working.requestedMetrics,
          dimensions: working.requestedDimensions,
          credential: resolvedCredential ? { secretValue: resolvedCredential.secretValue } : undefined,
        });

        warningCount += page.warnings.length;

        await appendCollectionEvent({
          analyticsCollectionId: working.analyticsCollectionId,
          parentCollectionId: working.parentCollectionId,
          retryOfCollectionId: working.parentCollectionId,
          gopExecutionId: working.gopExecutionId,
          eventType: "BATCH_RECEIVED",
          operation: "adapter_collect",
          status: page.partial ? "partial" : "ok",
          actorId,
          attemptNumber: working.attemptNumber,
          batchNumber: batch,
          pageNumber,
          occurredAt: nowIso(),
          observationCount,
          rejectedObservationCount,
          warningCount,
          cursorSummary: page.nextCursor,
          outcomeSummary: `Received ${page.observations.length} observations`,
          safeDiagnostic: adapter.redactDiagnostic({ providerRequestId: page.providerRequestId, warnings: page.warnings }),
        });

        const rejectionCountBeforeBatch = rejectedObservationCount;
        for (const payload of page.observations) {
          const entity = toObservationEntity({
            source,
            analyticsCollectionId: working.analyticsCollectionId,
            collectionExecutionId: working.gopExecutionId,
            cursor,
            payload,
          });

          const validation = validateObservationPayload(entity);
          if (!validation.ok) {
            rejectedObservationCount += 1;
            await appendCollectionEvent({
              analyticsCollectionId: working.analyticsCollectionId,
              parentCollectionId: working.parentCollectionId,
              retryOfCollectionId: working.parentCollectionId,
              gopExecutionId: working.gopExecutionId,
              eventType: "OBSERVATIONS_REJECTED",
              operation: "observation_validation",
              status: "rejected",
              actorId,
              attemptNumber: working.attemptNumber,
              batchNumber: batch,
              pageNumber,
              occurredAt: nowIso(),
              observationCount,
              rejectedObservationCount,
              warningCount,
              outcomeSummary: validation.reason,
              safeDiagnostic: adapter.redactDiagnostic({ reason: validation.reason, sourceRecordIdentity: entity.sourceRecordIdentity }),
            });
            continue;
          }

          const duplicate = await analyticsRepository.findObservationByIdentity({
            analyticsSourceId: entity.analyticsSourceId,
            sourceRecordIdentity: entity.sourceRecordIdentity,
            sourceTimestamp: entity.sourceTimestamp,
            rawPayloadChecksum: entity.rawPayloadChecksum,
          });

          if (duplicate) {
            continue;
          }

          await analyticsRepository.createObservation(entity);
          observationCount += 1;
        }

        await appendCollectionEvent({
          analyticsCollectionId: working.analyticsCollectionId,
          parentCollectionId: working.parentCollectionId,
          retryOfCollectionId: working.parentCollectionId,
          gopExecutionId: working.gopExecutionId,
          eventType: "OBSERVATIONS_VALIDATED",
          operation: "observation_validation",
          status: rejectedObservationCount > rejectionCountBeforeBatch ? "partial" : "ok",
          actorId,
          attemptNumber: working.attemptNumber,
          batchNumber: batch,
          pageNumber,
          occurredAt: nowIso(),
          observationCount,
          rejectedObservationCount,
          warningCount,
          safeOutcomeSummary: `Validated ${page.observations.length} observations in batch ${batch}`,
        });

        nextCursor = page.nextCursor ? adapter.normalizeCursor(page.nextCursor) : undefined;
        working = await transitionCollection(working, "PERSISTING", {
          nextCursor,
          observationCount,
          rejectedObservationCount,
          warningCount,
          partialFailureCount,
        });

        await appendCollectionEvent({
          analyticsCollectionId: working.analyticsCollectionId,
          parentCollectionId: working.parentCollectionId,
          retryOfCollectionId: working.parentCollectionId,
          gopExecutionId: working.gopExecutionId,
          eventType: "OBSERVATIONS_PERSISTED",
          operation: "observation_persist",
          status: "ok",
          actorId,
          attemptNumber: working.attemptNumber,
          batchNumber: batch,
          pageNumber,
          occurredAt: nowIso(),
          observationCount,
          rejectedObservationCount,
          warningCount,
          safeOutcomeSummary: "Observations persisted",
        });

        await appendCollectionEvent({
          analyticsCollectionId: working.analyticsCollectionId,
          parentCollectionId: working.parentCollectionId,
          retryOfCollectionId: working.parentCollectionId,
          gopExecutionId: working.gopExecutionId,
          eventType: "CURSOR_COMMITTED",
          operation: "cursor_commit",
          status: "ok",
          actorId,
          attemptNumber: working.attemptNumber,
          batchNumber: batch,
          pageNumber,
          occurredAt: nowIso(),
          observationCount,
          rejectedObservationCount,
          warningCount,
          cursorSummary: nextCursor,
          outcomeSummary: "Cursor committed after persistence",
        });

        if (page.complete) {
          const finalStatus: GmpAnalyticsCollectionStatus = partialFailureCount > 0
            ? "PARTIAL"
            : warningCount > 0 || rejectedObservationCount > 0 || page.partial
              ? "COMPLETED_WITH_WARNINGS"
              : "COMPLETED";

          working = await transitionCollection(working, finalStatus, {
            completedAt: nowIso(),
            nextCursor,
            observationCount,
            rejectedObservationCount,
            warningCount,
            partialFailureCount,
            warnings: [...working.warnings, ...page.warnings],
          });

          await analyticsRepository.updateSource(working.analyticsSourceId, {
            lastCollectionAt: nowIso(),
            connectionStatus: partialFailureCount > 0 ? "DEGRADED" : "HEALTHY",
          });

          await analyticsRepository.createMeasurementLineage({
            projectId: working.projectId,
            analyticsSourceId: working.analyticsSourceId,
            analyticsCollectionId: working.analyticsCollectionId,
            lineageStage: "COLLECTION",
            evidenceCompilerVersion: GMP_EVIDENCE_COMPILER_VERSION,
            lineageFingerprint: stableAnalyticsFingerprint({
              collectionId: working.analyticsCollectionId,
              gopExecutionId: working.gopExecutionId,
              adapterKey: working.adapterKey,
              adapterVersion: working.adapterVersion,
              observationCount,
              rejectedObservationCount,
            }),
            metadata: {
              collectionMode: working.collectionMode,
              cursor: nextCursor,
            },
          });

          const finalEventType = finalStatus === "COMPLETED"
            ? "COLLECTION_COMPLETED"
            : finalStatus === "COMPLETED_WITH_WARNINGS"
              ? "COLLECTION_COMPLETED_WITH_WARNINGS"
              : "COLLECTION_PARTIAL";

          await appendCollectionEvent({
            analyticsCollectionId: working.analyticsCollectionId,
            parentCollectionId: working.parentCollectionId,
            retryOfCollectionId: working.parentCollectionId,
            gopExecutionId: working.gopExecutionId,
            eventType: finalEventType,
            operation: "collection_complete",
            status: "ok",
            actorId,
            attemptNumber: working.attemptNumber,
            occurredAt: nowIso(),
            observationCount,
            rejectedObservationCount,
            warningCount,
            cursorSummary: nextCursor,
            outcomeSummary: `Collection ${finalStatus}`,
          });

          await emitGopEvent({
            collection: working,
            eventType: finalStatus,
            status: finalStatus === "FAILED" ? "FAILED" : "COMPLETE",
            message: `Collection finished with status ${finalStatus}`,
            actorId,
            metadata: {
              observationCount,
              rejectedObservationCount,
              warningCount,
            },
          });

          return working;
        }

        cursor = nextCursor ?? cursor;
      } catch (error) {
        const classified = adapter.classifyError(error);
        partialFailureCount += 1;

        await appendCollectionEvent({
          analyticsCollectionId: working.analyticsCollectionId,
          parentCollectionId: working.parentCollectionId,
          retryOfCollectionId: working.parentCollectionId,
          gopExecutionId: working.gopExecutionId,
          eventType: "PARTIAL_FAILURE_RECORDED",
          operation: "adapter_collect",
          status: "failed",
          actorId,
          attemptNumber: working.attemptNumber,
          batchNumber: batch,
          pageNumber,
          occurredAt: nowIso(),
          observationCount,
          rejectedObservationCount,
          warningCount,
          cursorSummary: cursor,
          errorCategory: classified.category,
          safeOutcomeSummary: classified.summary,
          outcomeSummary: classified.summary,
          safeDiagnostic: adapter.redactDiagnostic({
            category: classified.category,
            summary: classified.summary,
            retryable: classified.retryable,
          }),
        });

        const finalStatus: GmpAnalyticsCollectionStatus = observationCount > 0 ? "PARTIAL" : "FAILED";
        working = await transitionCollection(working, finalStatus, {
          failedAt: nowIso(),
          completedAt: nowIso(),
          nextCursor: cursor,
          observationCount,
          rejectedObservationCount,
          warningCount,
          partialFailureCount,
          errorCategory: classified.category,
          errorSummary: classified.summary,
          blockingIssues: [...working.blockingIssues, classified.summary],
        });

        await emitGopEvent({
          collection: working,
          eventType: "COLLECTION_FAILED",
          status: "FAILED",
          message: classified.summary,
          actorId,
          metadata: { errorCategory: classified.category, retryable: classified.retryable },
        });

        return working;
      }
    }

    const timedOut = await transitionCollection(working, "PARTIAL", {
      completedAt: nowIso(),
      nextCursor: cursor,
      partialFailureCount: partialFailureCount + 1,
      errorCategory: "TIMEOUT",
      errorSummary: "Collection exceeded deterministic batch limit.",
    });

    return timedOut;
  }

  return {
    async listSources(projectId) {
      return analyticsRepository.listSourcesForProject(projectId);
    },

    async createSource(input) {
      const project = await projectRepository.getProjectById(input.projectId);
      if (!project) return null;

      const source = createAnalyticsSource({
        ...input,
        workspaceId: input.workspaceId ?? project.workspaceId,
      });

      const adapter = adapterRegistry.resolveBySource(source) ?? fallbackAdapter;
      const created = await analyticsRepository.createSource({
        ...source,
        adapterKey: adapter.adapterKey,
        adapterVersion: adapter.adapterVersion,
      });

      const capabilities = input.capabilities ?? Object.fromEntries(
        (await adapter.detectCapabilities(created)).capabilities.map((item) => [item, true]),
      );

      for (const [capabilityKey, supported] of Object.entries(capabilities)) {
        await analyticsRepository.upsertSourceCapability({
          analyticsSourceId: created.analyticsSourceId,
          capabilityKey,
          supported: Boolean(supported),
          metadata: { adapterVersion: adapter.adapterVersion },
        });
      }

      await ensureMetricDefinitions(project.projectId);
      return created;
    },

    async getSourceDetail(analyticsSourceId) {
      const source = await analyticsRepository.getSourceById(analyticsSourceId);
      if (!source) return null;
      const capabilities = await analyticsRepository.listSourceCapabilities(analyticsSourceId);
      return {
        source,
        capabilities: capabilities.reduce<Record<string, boolean>>((acc, entry) => {
          acc[entry.capabilityKey] = entry.supported;
          return acc;
        }, {}),
      };
    },

    async validateSource(analyticsSourceId) {
      const source = await analyticsRepository.getSourceById(analyticsSourceId);
      if (!source) return null;
      const adapter = resolveAnalyticsAdapter(source, adapterRegistry, fallbackAdapter);
      const credential = await credentialProvider.resolveSourceCredential(source);
      const validation = await adapter.validateConnection(source, credential ? { secretValue: credential.secretValue } : undefined);
      return {
        sourceId: source.analyticsSourceId,
        validation,
      };
    },

    async detectSourceCapabilities(analyticsSourceId) {
      const source = await analyticsRepository.getSourceById(analyticsSourceId);
      if (!source) return null;
      const adapter = resolveAnalyticsAdapter(source, adapterRegistry, fallbackAdapter);
      const detection = await adapter.detectCapabilities(source);
      for (const capabilityKey of detection.capabilities) {
        await analyticsRepository.upsertSourceCapability({
          analyticsSourceId,
          capabilityKey,
          supported: true,
          metadata: { adapterVersion: detection.adapterVersion, detectedAt: detection.detectedAt },
        });
      }
      return {
        sourceId: analyticsSourceId,
        ...detection,
      };
    },

    async getSourceHealth(analyticsSourceId) {
      const source = await analyticsRepository.getSourceById(analyticsSourceId);
      if (!source) return null;

      const adapter = resolveAnalyticsAdapter(source, adapterRegistry, fallbackAdapter);
      const adapterHealth = await adapter.checkHealth(source);
      const credentialValidation = await credentialProvider.validateSourceCredential(source);
      const collections = await analyticsRepository.listCollectionsForProject(source.projectId);
      const sourceCollections = collections.filter((entry) => entry.analyticsSourceId === analyticsSourceId);
      const lastSuccess = sourceCollections.find((entry) => entry.collectionStatus === "COMPLETED" || entry.collectionStatus === "COMPLETED_WITH_WARNINGS");
      const lastFailure = sourceCollections.find((entry) => entry.collectionStatus === "FAILED" || entry.collectionStatus === "PARTIAL");

      const blockingIssues: string[] = [];
      const warnings: string[] = [];
      if (!credentialValidation.ok) {
        blockingIssues.push(credentialValidation.reason ?? "credential_invalid");
      }
      if (adapterHealth.status !== "HEALTHY") {
        warnings.push(`adapter_${adapterHealth.status.toLowerCase()}`);
      }

      return {
        sourceId: analyticsSourceId,
        status: blockingIssues.length > 0 ? "BLOCKED" : warnings.length > 0 ? "DEGRADED" : "HEALTHY",
        connectionHealth: adapterHealth.status,
        credentialReferenceHealth: credentialValidation.ok ? "HEALTHY" : "BLOCKED",
        adapterHealth,
        collectionHealth: {
          activeCollection: sourceCollections.find((entry) => entry.collectionStatus === "QUEUED" || entry.collectionStatus === "RUNNING")?.analyticsCollectionId,
          lastSuccessfulCollection: lastSuccess?.analyticsCollectionId,
          lastFailedCollection: lastFailure?.analyticsCollectionId,
        },
        freshnessHealth: {
          lastCollectionAt: source.lastCollectionAt,
          stale: !source.lastCollectionAt,
        },
        cursorHealth: {
          latestCursor: lastSuccess?.nextCursor,
        },
        errorRate: {
          failureCount: sourceCollections.filter((entry) => entry.collectionStatus === "FAILED" || entry.collectionStatus === "PARTIAL").length,
          totalCount: sourceCollections.length,
        },
        blockingIssues,
        warnings,
        recommendedActions: blockingIssues.length > 0 ? ["validate_credentials"] : warnings.length > 0 ? ["inspect_provider_health"] : [],
        healthModelVersion: "gmp-analytics-health/v1",
        generatedAt: nowIso(),
      };
    },

    async listCollections(projectId) {
      return analyticsRepository.listCollectionsForProject(projectId);
    },

    async evaluateCollectionEligibility(input) {
      const source = await analyticsRepository.getSourceById(input.analyticsSourceId);
      if (!source || source.projectId !== input.projectId) return null;

      const adapter = resolveAnalyticsAdapter(source, adapterRegistry, fallbackAdapter);
      const requestedDimensions = sanitizeArray(input.requestedDimensions);
      const requestedMetrics = sanitizeArray(input.requestedMetrics);
      const sourceCursor = adapter.normalizeCursor(input.sourceCursor);
      const collectionMode = input.collectionMode ?? source.collectionMode ?? "MANUAL";
      const inputFingerprint = stableAnalyticsFingerprint({
        workspaceId: input.workspaceId ?? source.workspaceId ?? DEFAULT_WORKSPACE_ID,
        projectId: input.projectId,
        siteId: source.siteId,
        analyticsSourceId: input.analyticsSourceId,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        requestedDimensions,
        requestedMetrics,
        collectionMode,
        adapterKey: adapter.adapterKey,
        adapterVersion: adapter.adapterVersion,
        sourceCursor,
        contractVersion: "gmp-analytics-collection/v1",
      });

      const blockingIssues: string[] = [];
      const warnings: string[] = [];
      if (source.sourceStatus !== "ACTIVE") {
        blockingIssues.push(`source_inactive:${source.sourceStatus}`);
      }
      if (source.connectionStatus === "OFFLINE") {
        blockingIssues.push("source_offline");
      }

      if (input.periodStart && Number.isNaN(Date.parse(input.periodStart))) {
        blockingIssues.push("invalid_period_start");
      }
      if (input.periodEnd && Number.isNaN(Date.parse(input.periodEnd))) {
        blockingIssues.push("invalid_period_end");
      }
      if (input.periodStart && input.periodEnd) {
        const diffMs = new Date(input.periodEnd).getTime() - new Date(input.periodStart).getTime();
        if (diffMs < 0) blockingIssues.push("period_end_before_start");
        const maxDays = 365;
        if (diffMs > maxDays * 24 * 60 * 60 * 1000) blockingIssues.push("period_exceeds_max_range");
      }

      if (collectionMode === "BACKFILL" && !input.periodStart) {
        blockingIssues.push("backfill_requires_period_start");
      }

      if (input.forcedRecollection && collectionMode !== "FORCED_RECOLLECTION") {
        warnings.push("forced_recollection_flag_without_mode");
      }

      const sourceCapabilities = await analyticsRepository.listSourceCapabilities(input.analyticsSourceId);
      const capabilityMap = new Map(sourceCapabilities.map((entry) => [entry.capabilityKey, entry.supported]));
      const metricDefinitions = await ensureMetricDefinitions(input.projectId);
      const requiredOutputs = requestedMetrics.length > 0
        ? requestedMetrics
        : metricDefinitions.filter((entry) => entry.defaultMetric).map((entry) => entry.metricKey);
      const missingOutputs = requiredOutputs.filter((output) => capabilityMap.get(output) === false);
      if (missingOutputs.length > 0) {
        blockingIssues.push("required_outputs_missing");
      }

      const requiresCredential = adapter.sourceType !== "CUSTOM" && adapter.sourceType !== "FIXTURE";
      if (requiresCredential) {
        const credentialCheck = await credentialProvider.validateSourceCredential(source);
        if (!credentialCheck.ok) {
          blockingIssues.push(credentialCheck.reason ?? "credential_reference_invalid");
        }
      }

      const equivalentActive = await analyticsRepository.findEquivalentCollection({
        projectId: input.projectId,
        analyticsSourceId: input.analyticsSourceId,
        inputFingerprint,
        statuses: ["REQUESTED", "AUTHORIZED", "ELIGIBILITY_EVALUATED", "QUEUED", "RUNNING", "PERSISTING"],
      });
      const equivalentCompleted = await analyticsRepository.findEquivalentCollection({
        projectId: input.projectId,
        analyticsSourceId: input.analyticsSourceId,
        inputFingerprint,
        statuses: ["COMPLETED", "COMPLETED_WITH_WARNINGS", "PARTIAL"],
      });

      if (equivalentActive) {
        warnings.push("equivalent_active_collection_exists");
      }

      return {
        eligible: blockingIssues.length === 0,
        blockingIssues,
        warnings,
        requiredOutputs,
        missingOutputs,
        eligibilityVersion: GMP_ANALYTICS_ELIGIBILITY_VERSION,
        inputFingerprint,
        equivalentActiveCollectionId: equivalentActive?.analyticsCollectionId,
        equivalentCompletedCollectionId: equivalentCompleted?.analyticsCollectionId,
        resolvedAdapterKey: adapter.adapterKey,
        resolvedAdapterVersion: adapter.adapterVersion,
        effectiveCollectionMode: collectionMode,
      };
    },

    async requestCollection(input) {
      const project = await projectRepository.getProjectById(input.projectId);
      if (!project || project.workspaceId !== input.workspaceId) {
        throw new Error("Project not found");
      }

      const source = await analyticsRepository.getSourceById(input.analyticsSourceId);
      if (!source || source.projectId !== input.projectId) {
        throw new Error("Source not found");
      }

      const eligibility = await this.evaluateCollectionEligibility({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        analyticsSourceId: input.analyticsSourceId,
        collectionMode: input.collectionMode,
        requestedDimensions: input.requestedDimensions,
        requestedMetrics: input.requestedMetrics,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        forcedRecollection: input.forcedRecollection,
        sourceCursor: input.sourceCursor,
      });

      if (!eligibility) {
        throw new Error("Eligibility unavailable");
      }

      if (eligibility.equivalentActiveCollectionId && !input.forcedRecollection) {
        const existing = await analyticsRepository.getCollectionById(eligibility.equivalentActiveCollectionId);
        if (existing) {
          return {
            collection: existing,
            eligibility,
            idempotencyBehavior: "REUSED_ACTIVE",
            equivalentCollectionId: existing.analyticsCollectionId,
            gopExecutionId: existing.gopExecutionId,
            adapterKey: existing.adapterKey,
            adapterVersion: existing.adapterVersion,
          };
        }
      }

      if (eligibility.equivalentCompletedCollectionId && !input.forcedRecollection) {
        const existing = await analyticsRepository.getCollectionById(eligibility.equivalentCompletedCollectionId);
        if (existing) {
          return {
            collection: existing,
            eligibility,
            idempotencyBehavior: "REUSED_COMPLETED",
            equivalentCollectionId: existing.analyticsCollectionId,
            gopExecutionId: existing.gopExecutionId,
            adapterKey: existing.adapterKey,
            adapterVersion: existing.adapterVersion,
          };
        }
      }

      const adapter = resolveAnalyticsAdapter(source, adapterRegistry, fallbackAdapter);
      const idempotencyKey = input.idempotencyKey ?? `${input.projectId}:${input.analyticsSourceId}:${eligibility.inputFingerprint}`;

      const created = await analyticsRepository.createCollection({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        analyticsSourceId: input.analyticsSourceId,
        siteId: input.siteId ?? source.siteId,
        collectionStatus: "REQUESTED",
        requestedPeriodStart: input.periodStart ?? null,
        requestedPeriodEnd: input.periodEnd ?? null,
        requestedDimensions: sanitizeArray(input.requestedDimensions),
        requestedMetrics: sanitizeArray(input.requestedMetrics),
        collectionMode: input.collectionMode,
        gopExecutionId: undefined,
        attemptNumber: 1,
        parentCollectionId: undefined,
        sourceCursor: adapter.normalizeCursor(input.sourceCursor),
        nextCursor: undefined,
        idempotencyKey,
        inputFingerprint: eligibility.inputFingerprint,
        adapterKey: adapter.adapterKey,
        adapterVersion: adapter.adapterVersion,
        requestedBy: input.actorId,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        collectionWindowStart: input.periodStart ?? null,
        collectionWindowEnd: input.periodEnd ?? null,
        eligibilityVersion: eligibility.eligibilityVersion,
        errorCategory: undefined,
        errorSummary: undefined,
        warningCount: 0,
        observationCount: 0,
        rejectedObservationCount: 0,
        partialFailureCount: 0,
        forcedRecollection: Boolean(input.forcedRecollection),
        blockingIssues: eligibility.blockingIssues,
        warnings: eligibility.warnings,
        metadata: {
          requestedMetrics: sanitizeArray(input.requestedMetrics),
          requestedDimensions: sanitizeArray(input.requestedDimensions),
        },
      });

      await appendCollectionEvent({
        analyticsCollectionId: created.analyticsCollectionId,
        parentCollectionId: undefined,
        retryOfCollectionId: undefined,
        gopExecutionId: undefined,
        eventType: "COLLECTION_REQUESTED",
        operation: "request",
        status: "ok",
        actorId: input.actorId,
        occurredAt: nowIso(),
        observationCount: 0,
        rejectedObservationCount: 0,
        warningCount: eligibility.warnings.length,
        outcomeSummary: "Collection request accepted",
      });

      await appendCollectionEvent({
        analyticsCollectionId: created.analyticsCollectionId,
        parentCollectionId: undefined,
        retryOfCollectionId: undefined,
        gopExecutionId: undefined,
        eventType: "COLLECTION_CREATED",
        operation: "request",
        status: "ok",
        actorId: input.actorId,
        attemptNumber: created.attemptNumber,
        occurredAt: nowIso(),
        observationCount: 0,
        rejectedObservationCount: 0,
        warningCount: eligibility.warnings.length,
        safeOutcomeSummary: "Governed collection created",
      });

      let working = await transitionCollection(created, "AUTHORIZED");
      await appendCollectionEvent({
        analyticsCollectionId: working.analyticsCollectionId,
        gopExecutionId: undefined,
        eventType: "AUTHORIZATION_ACCEPTED",
        operation: "authorization",
        status: "ok",
        actorId: input.actorId,
        occurredAt: nowIso(),
        observationCount: 0,
        rejectedObservationCount: 0,
        warningCount: eligibility.warnings.length,
      });

      working = await transitionCollection(working, "ELIGIBILITY_EVALUATED");
      await appendCollectionEvent({
        analyticsCollectionId: working.analyticsCollectionId,
        gopExecutionId: undefined,
        eventType: "ELIGIBILITY_EVALUATED",
        operation: "eligibility",
        status: eligibility.eligible ? "ok" : "blocked",
        actorId: input.actorId,
        occurredAt: nowIso(),
        observationCount: 0,
        rejectedObservationCount: 0,
        warningCount: eligibility.warnings.length,
        outcomeSummary: eligibility.eligible ? "Eligible" : "Ineligible",
        safeDiagnostic: credentialProvider.redactDiagnostic({ blockingIssues: eligibility.blockingIssues, warnings: eligibility.warnings }),
      });

      if (!eligibility.eligible) {
        const ineligible = await transitionCollection(working, "INELIGIBLE", {
          warningCount: eligibility.warnings.length,
          completedAt: nowIso(),
        });

        await appendCollectionEvent({
          analyticsCollectionId: ineligible.analyticsCollectionId,
          parentCollectionId: ineligible.parentCollectionId,
          retryOfCollectionId: ineligible.parentCollectionId,
          gopExecutionId: ineligible.gopExecutionId,
          eventType: "COLLECTION_BLOCKED",
          operation: "eligibility",
          status: "blocked",
          actorId: input.actorId,
          attemptNumber: ineligible.attemptNumber,
          occurredAt: nowIso(),
          observationCount: ineligible.observationCount,
          rejectedObservationCount: ineligible.rejectedObservationCount,
          warningCount: ineligible.warningCount,
          safeOutcomeSummary: "Collection blocked by eligibility constraints",
          safeDiagnostic: credentialProvider.redactDiagnostic({
            blockingIssues: ineligible.blockingIssues,
            warnings: ineligible.warnings,
          }),
        });

        return {
          collection: ineligible,
          eligibility,
          idempotencyBehavior: "CREATED",
          gopExecutionId: ineligible.gopExecutionId,
          adapterKey: ineligible.adapterKey,
          adapterVersion: ineligible.adapterVersion,
        };
      }

      const queued = await transitionCollection(working, "QUEUED");
      const executed = await executeCollection(queued.analyticsCollectionId, input.actorId);

      return {
        collection: executed,
        eligibility,
        idempotencyBehavior: "CREATED",
        gopExecutionId: executed.gopExecutionId,
        adapterKey: executed.adapterKey,
        adapterVersion: executed.adapterVersion,
      };
    },

    async retryCollection(input) {
      const parent = await analyticsRepository.getCollectionById(input.collectionId);
      if (!parent) return null;
      if (!isRetryableStatus(parent.collectionStatus)) return null;

      await appendCollectionEvent({
        analyticsCollectionId: parent.analyticsCollectionId,
        parentCollectionId: parent.parentCollectionId,
        retryOfCollectionId: parent.parentCollectionId,
        gopExecutionId: parent.gopExecutionId,
        eventType: "RETRY_REQUESTED",
        operation: "retry",
        status: "ok",
        actorId: input.actorId,
        attemptNumber: parent.attemptNumber,
        occurredAt: nowIso(),
        observationCount: parent.observationCount,
        rejectedObservationCount: parent.rejectedObservationCount,
        warningCount: parent.warningCount,
        safeOutcomeSummary: "Retry requested",
      });

      await appendCollectionEvent({
        analyticsCollectionId: parent.analyticsCollectionId,
        parentCollectionId: parent.parentCollectionId,
        retryOfCollectionId: parent.parentCollectionId,
        gopExecutionId: parent.gopExecutionId,
        eventType: "RETRY_AUTHORIZED",
        operation: "retry",
        status: "ok",
        actorId: input.actorId,
        attemptNumber: parent.attemptNumber,
        occurredAt: nowIso(),
        observationCount: parent.observationCount,
        rejectedObservationCount: parent.rejectedObservationCount,
        warningCount: parent.warningCount,
        safeOutcomeSummary: "Retry authorized",
      });

      const mode = input.mode ?? "resume";
      const childResult = await this.requestCollection({
        workspaceId: input.workspaceId,
        projectId: parent.projectId,
        siteId: parent.siteId,
        analyticsSourceId: parent.analyticsSourceId,
        actorId: input.actorId,
        collectionMode: "RETRY",
        periodStart: parent.requestedPeriodStart ?? undefined,
        periodEnd: parent.requestedPeriodEnd ?? undefined,
        requestedDimensions: parent.requestedDimensions,
        requestedMetrics: parent.requestedMetrics,
        idempotencyKey: `${parent.idempotencyKey}:retry:${parent.attemptNumber + 1}`,
        forcedRecollection: false,
        sourceCursor: mode === "resume" ? (parent.nextCursor ?? parent.sourceCursor) : undefined,
      });

      const updated = await analyticsRepository.updateCollection(childResult.collection.analyticsCollectionId, {
        parentCollectionId: parent.analyticsCollectionId,
        attemptNumber: parent.attemptNumber + 1,
      });

      if (updated) {
        await appendCollectionEvent({
          analyticsCollectionId: updated.analyticsCollectionId,
          parentCollectionId: updated.parentCollectionId,
          retryOfCollectionId: parent.analyticsCollectionId,
          gopExecutionId: updated.gopExecutionId,
          eventType: "RETRY_CREATED",
          operation: "retry",
          status: "ok",
          actorId: input.actorId,
          attemptNumber: updated.attemptNumber,
          occurredAt: nowIso(),
          observationCount: updated.observationCount,
          rejectedObservationCount: updated.rejectedObservationCount,
          warningCount: updated.warningCount,
          outcomeSummary: `Retry ${updated.attemptNumber} created from ${parent.analyticsCollectionId}`,
        });

        return { ...childResult, collection: updated };
      }

      return childResult;
    },

    async getCollectionDetail(collectionId) {
      const collection = await analyticsRepository.getCollectionById(collectionId);
      if (!collection) return null;
      const source = await analyticsRepository.getSourceById(collection.analyticsSourceId);
      if (!source) return null;

      const observations = await analyticsRepository.listObservationsForCollection(collectionId);
      const timelinePage = await this.getCollectionTimeline({ collectionId, limit: 200 });
      const children = await analyticsRepository.listChildCollections(collectionId);

      return {
        collection,
        source: {
          analyticsSourceId: source.analyticsSourceId,
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          connectionStatus: source.connectionStatus,
        },
        observations: observations.map((item) => ({
          analyticsObservationId: item.analyticsObservationId,
          sourceRecordIdentity: item.sourceRecordIdentity,
          observationType: item.observationType,
          observationPeriodStart: item.observationPeriodStart,
          observationPeriodEnd: item.observationPeriodEnd,
          dataQualityStatus: item.dataQualityStatus,
          rawPayloadChecksum: item.rawPayloadChecksum,
          ingestedAt: item.ingestedAt,
        })),
        timeline: timelinePage?.events ?? [],
        children,
        retryEligibility: {
          eligible: isRetryableStatus(collection.collectionStatus),
          reason: isRetryableStatus(collection.collectionStatus)
            ? undefined
            : `Collection status ${collection.collectionStatus} is not retryable`,
        },
      };
    },

    async getCollectionTimeline(input) {
      const collection = await analyticsRepository.getCollectionById(input.collectionId);
      if (!collection) {
        return null;
      }

      const pageSize = Math.max(1, Math.min(200, input.limit ?? 100));
      const events = await analyticsRepository.listCollectionEvents({
        analyticsCollectionId: input.collectionId,
        limit: pageSize + 1,
        after: input.after,
      });

      const boundedEvents = events.slice(0, pageSize);
      const nextCursor = events.length > pageSize
        ? {
          occurredAt: boundedEvents[boundedEvents.length - 1]!.occurredAt,
          analyticsCollectionEventId: boundedEvents[boundedEvents.length - 1]!.analyticsCollectionEventId,
        }
        : undefined;

      return {
        contractVersion: GMP_ANALYTICS_TIMELINE_CONTRACT_VERSION,
        events: boundedEvents,
        nextCursor,
      };
    },

    async listMetricDefinitions(projectId) {
      return ensureMetricDefinitions(projectId);
    },

    async upsertMetricDefinition(input) {
      return analyticsRepository.upsertMetricDefinition(input);
    },

    async createSnapshotFromCollection(input) {
      const collection = await analyticsRepository.getCollectionById(input.analyticsCollectionId);
      if (!collection || collection.projectId !== input.projectId) {
        return null;
      }

      const observations = await analyticsRepository.listObservationsForCollection(input.analyticsCollectionId);
      if (observations.length === 0) {
        return null;
      }

      const normalizedMetrics = await normalizeCollectionMetrics(collection);

      const values = normalizedMetrics.map((entry) => entry.normalizedValue);
      const baselineScore = values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : undefined;

      const snapshot = await analyticsRepository.createSnapshot({
        projectId: input.projectId,
        siteId: input.siteId ?? collection.siteId,
        snapshotStatus: "READY",
        snapshotLabel: input.snapshotLabel,
        snapshotWindowStart: collection.collectionWindowStart ?? collection.requestedPeriodStart ?? collection.createdAt,
        snapshotWindowEnd: collection.collectionWindowEnd ?? collection.requestedPeriodEnd ?? collection.updatedAt,
        totalMetrics: normalizedMetrics.length,
        baselineScore,
        trendDelta: undefined,
        metadata: {
          immutable: true,
          sourceCollectionId: collection.analyticsCollectionId,
          sourceCollectionStatus: collection.collectionStatus,
          generatedAt: nowIso(),
        },
      });

      const lineage = await analyticsRepository.createMeasurementLineage({
        projectId: input.projectId,
        analyticsSourceId: collection.analyticsSourceId,
        analyticsCollectionId: collection.analyticsCollectionId,
        performanceSnapshotId: snapshot.performanceSnapshotId,
        lineageStage: "SNAPSHOT",
        evidenceCompilerVersion: GMP_EVIDENCE_COMPILER_VERSION,
        lineageFingerprint: stableAnalyticsFingerprint({
          snapshotId: snapshot.performanceSnapshotId,
          collectionId: collection.analyticsCollectionId,
          metricCount: normalizedMetrics.length,
        }),
        metadata: {
          immutable: true,
          metricIds: normalizedMetrics.map((entry) => entry.normalizedMetricId),
        },
      });

      return {
        snapshot,
        metrics: normalizedMetrics,
        lineage: [lineage],
      };
    },

    async listSnapshots(projectId) {
      return analyticsRepository.listSnapshotsForProject(projectId);
    },

    async getSnapshotDetail(performanceSnapshotId) {
      const snapshot = await analyticsRepository.getSnapshotById(performanceSnapshotId);
      if (!snapshot) return null;

      const lineages = await analyticsRepository.listLineageForSnapshot(performanceSnapshotId);
      const metricIds = new Set(
        lineages.flatMap((entry) => {
          const ids = entry.metadata?.metricIds;
          return Array.isArray(ids) ? ids.map(String) : [];
        }),
      );

      const collectionId = lineages.find((entry) => entry.analyticsCollectionId)?.analyticsCollectionId;
      const collectionMetrics = collectionId
        ? await analyticsRepository.listNormalizedMetricsForCollection(collectionId)
        : [];

      return {
        snapshot,
        metrics: collectionMetrics.filter((entry) => metricIds.size === 0 || metricIds.has(entry.normalizedMetricId)),
        lineage: lineages,
      };
    },

    async ensureFoundationConfig(projectId) {
      const compilerVersion = await analyticsRepository.upsertEvidenceCompilerVersion({
        projectId,
        compilerName: "gmp-evidence-compiler",
        compilerVersion: GMP_EVIDENCE_COMPILER_VERSION,
        releasedAt: null,
        metadata: { stage: "collection-engine" },
      });

      const attribution = await analyticsRepository.upsertAttributionRegistry({
        projectId,
        registryStatus: "ACTIVE",
        registryVersion: "gmp-attribution-registry/v1",
        metadata: { note: "Activated by GMP-0006D attribution engine." },
      });

      const recommendation = await analyticsRepository.upsertRecommendationRegistry({
        projectId,
        registryStatus: "ACTIVE",
        registryVersion: "gmp-recommendation-registry/v1",
        metadata: { note: "Activated by GMP-0006D recommendation engine." },
      });

      return {
        compilerVersion,
        attributionRegistryVersion: attribution.registryVersion,
        recommendationRegistryVersion: recommendation.registryVersion,
      };
    },

    async runCollection(input) {
      const source = await analyticsRepository.getSourceById(input.analyticsSourceId);
      if (!source) {
        throw new Error("Source not found");
      }

      const project = await projectRepository.getProjectById(input.projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const eligibility = await this.evaluateCollectionEligibility({
        workspaceId: project.workspaceId,
        projectId: input.projectId,
        analyticsSourceId: input.analyticsSourceId,
        collectionMode: "MANUAL",
        requestedDimensions: [],
        requestedMetrics: [],
        periodStart: input.windowStart,
        periodEnd: input.windowEnd,
      });

      if (!eligibility || !eligibility.eligible) {
        const blocked = await analyticsRepository.createCollection({
          workspaceId: project.workspaceId,
          projectId: input.projectId,
          analyticsSourceId: input.analyticsSourceId,
          siteId: source.siteId,
          collectionStatus: "BLOCKED",
          requestedPeriodStart: input.windowStart ?? null,
          requestedPeriodEnd: input.windowEnd ?? null,
          requestedDimensions: [],
          requestedMetrics: [],
          collectionMode: "MANUAL",
          gopExecutionId: undefined,
          attemptNumber: 1,
          parentCollectionId: undefined,
          sourceCursor: undefined,
          nextCursor: undefined,
          idempotencyKey: `${input.projectId}:${input.analyticsSourceId}:blocked:${Date.now()}`,
          inputFingerprint: stableAnalyticsFingerprint({
            projectId: input.projectId,
            analyticsSourceId: input.analyticsSourceId,
            reason: "ineligible",
          }),
          adapterKey: source.adapterKey ?? "fixture.analytics.default",
          adapterVersion: source.adapterVersion ?? "v1",
          requestedBy: input.actorId,
          startedAt: null,
          completedAt: nowIso(),
          failedAt: null,
          collectionWindowStart: input.windowStart ?? null,
          collectionWindowEnd: input.windowEnd ?? null,
          eligibilityVersion: GMP_ANALYTICS_ELIGIBILITY_VERSION,
          errorCategory: "CONFIGURATION",
          errorSummary: "Collection blocked by eligibility requirements.",
          warningCount: eligibility?.warnings.length ?? 0,
          observationCount: 0,
          rejectedObservationCount: 0,
          partialFailureCount: 0,
          forcedRecollection: false,
          blockingIssues: eligibility?.blockingIssues ?? ["eligibility_check_failed"],
          warnings: eligibility?.warnings ?? [],
          metadata: {
            compatibilityStatus: "BLOCKED",
            missingOutputs: eligibility?.missingOutputs ?? [],
          },
        });

        return {
          collection: blocked,
          observationsCreated: 0,
          normalizedMetricsCreated: 0,
        };
      }

      const result = await this.requestCollection({
        workspaceId: project.workspaceId,
        projectId: input.projectId,
        analyticsSourceId: input.analyticsSourceId,
        actorId: input.actorId,
        collectionMode: "MANUAL",
        periodStart: input.windowStart,
        periodEnd: input.windowEnd,
        requestedDimensions: [],
        requestedMetrics: [],
      });

      const normalizedMetrics = result.collection.collectionStatus === "COMPLETED" || result.collection.collectionStatus === "COMPLETED_WITH_WARNINGS"
        ? await normalizeCollectionMetrics(result.collection)
        : [];

      return {
        collection: result.collection,
        observationsCreated: result.collection.observationCount,
        normalizedMetricsCreated: normalizedMetrics.length,
      };
    },
  };
}
