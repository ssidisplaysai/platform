import { createHash, randomUUID } from "node:crypto";

export const gmpAnalyticsSourceStatuses = ["ACTIVE", "PAUSED", "DISABLED"] as const;
export const gmpAnalyticsConnectionStatuses = ["HEALTHY", "DEGRADED", "OFFLINE"] as const;
export const gmpAnalyticsCollectionStatuses = [
  "REQUESTED",
  "AUTHORIZED",
  "ELIGIBILITY_EVALUATED",
  "INELIGIBLE",
  "BLOCKED",
  "QUEUED",
  "RUNNING",
  "PERSISTING",
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
] as const;
export const gmpAnalyticsSnapshotStatuses = ["READY", "ARCHIVED"] as const;
export const gmpAnalyticsCollectionModes = [
  "MANUAL",
  "SCHEDULED_POLICY",
  "INCREMENTAL",
  "BACKFILL",
  "RETRY",
  "FORCED_RECOLLECTION",
] as const;
export const gmpAnalyticsErrorCategories = [
  "AUTHENTICATION",
  "AUTHORIZATION",
  "RATE_LIMIT",
  "TIMEOUT",
  "NETWORK",
  "INVALID_REQUEST",
  "INVALID_RESPONSE",
  "UNSUPPORTED",
  "CONFIGURATION",
  "CREDENTIAL_REFERENCE",
  "IDEMPOTENCY_CONFLICT",
  "PERSISTENCE",
  "GOP_UNAVAILABLE",
  "INTERNAL",
  "UNKNOWN",
] as const;
export const gmpAnalyticsTimelineEventTypes = [
  "COLLECTION_REQUESTED",
  "AUTHORIZATION_ACCEPTED",
  "AUTHORIZATION_REJECTED",
  "ELIGIBILITY_EVALUATED",
  "COLLECTION_BLOCKED",
  "COLLECTION_CREATED",
  "GOP_EXECUTION_CREATED",
  "ADAPTER_RESOLVED",
  "CREDENTIAL_REFERENCE_RESOLVED",
  "COLLECTION_STARTED",
  "BATCH_REQUESTED",
  "BATCH_RECEIVED",
  "OBSERVATIONS_VALIDATED",
  "OBSERVATIONS_PERSISTED",
  "OBSERVATIONS_REJECTED",
  "CURSOR_COMMITTED",
  "PARTIAL_FAILURE_RECORDED",
  "COLLECTION_COMPLETED",
  "COLLECTION_COMPLETED_WITH_WARNINGS",
  "COLLECTION_PARTIAL",
  "COLLECTION_FAILED",
  "RETRY_REQUESTED",
  "RETRY_AUTHORIZED",
  "RETRY_CREATED",
] as const;
export const gmpAnalyticsTimelineEventStatuses = ["ok", "running", "partial", "failed", "blocked", "rejected"] as const;

export const GMP_ANALYTICS_ELIGIBILITY_VERSION = "gmp-analytics-eligibility/v1";
export const GMP_ANALYTICS_NORMALIZATION_VERSION = "gmp-analytics-normalization/v1";
export const GMP_ANALYTICS_SNAPSHOT_VERSION = "gmp-analytics-snapshot/v1";
export const GMP_EVIDENCE_COMPILER_VERSION = "gmp-evidence-compiler/v1";
export const GMP_ANALYTICS_TIMELINE_CONTRACT_VERSION = "gmp-analytics-timeline/v1";

export type GmpAnalyticsSourceStatus = (typeof gmpAnalyticsSourceStatuses)[number];
export type GmpAnalyticsConnectionStatus = (typeof gmpAnalyticsConnectionStatuses)[number];
export type GmpAnalyticsCollectionStatus = (typeof gmpAnalyticsCollectionStatuses)[number];
export type GmpAnalyticsSnapshotStatus = (typeof gmpAnalyticsSnapshotStatuses)[number];
export type GmpAnalyticsCollectionMode = (typeof gmpAnalyticsCollectionModes)[number];
export type GmpAnalyticsErrorCategory = (typeof gmpAnalyticsErrorCategories)[number];
export type GmpAnalyticsTimelineEventType = (typeof gmpAnalyticsTimelineEventTypes)[number];
export type GmpAnalyticsTimelineEventStatus = (typeof gmpAnalyticsTimelineEventStatuses)[number];

export type GmpAnalyticsEligibilityReport = {
  eligible: boolean;
  blockingIssues: string[];
  warnings: string[];
  requiredOutputs: string[];
  missingOutputs: string[];
  eligibilityVersion: string;
};

export type GmpAnalyticsSource = {
  analyticsSourceId: string;
  projectId: string;
  workspaceId?: string;
  siteId?: string;
  sourceType: string;
  sourceName: string;
  sourceStatus: GmpAnalyticsSourceStatus;
  connectionStatus: GmpAnalyticsConnectionStatus;
  collectionMode: GmpAnalyticsCollectionMode;
  adapterKey?: string;
  adapterVersion?: string;
  providerReference?: string;
  credentialsReference?: string;
  configuration?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastHealthCheckAt?: string | null;
  lastCollectionAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GmpAnalyticsSourceCapability = {
  analyticsSourceCapabilityId: string;
  analyticsSourceId: string;
  capabilityKey: string;
  supported: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpAnalyticsCollection = {
  analyticsCollectionId: string;
  workspaceId: string;
  projectId: string;
  analyticsSourceId: string;
  siteId?: string;
  collectionStatus: GmpAnalyticsCollectionStatus;
  requestedPeriodStart?: string | null;
  requestedPeriodEnd?: string | null;
  requestedDimensions: string[];
  requestedMetrics: string[];
  collectionMode: GmpAnalyticsCollectionMode;
  gopExecutionId?: string;
  attemptNumber: number;
  parentCollectionId?: string;
  sourceCursor?: Record<string, unknown>;
  nextCursor?: Record<string, unknown>;
  idempotencyKey: string;
  inputFingerprint: string;
  adapterKey: string;
  adapterVersion: string;
  requestedBy: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  collectionWindowStart?: string | null;
  collectionWindowEnd?: string | null;
  eligibilityVersion: string;
  errorCategory?: GmpAnalyticsErrorCategory;
  errorSummary?: string;
  warningCount: number;
  observationCount: number;
  rejectedObservationCount: number;
  partialFailureCount: number;
  forcedRecollection: boolean;
  blockingIssues: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpAnalyticsObservation = {
  analyticsObservationId: string;
  projectId: string;
  analyticsSourceId: string;
  analyticsCollectionId: string;
  sourceRecordIdentity: string;
  observationType: string;
  sourceTimestamp: string;
  observationPeriodStart?: string | null;
  observationPeriodEnd?: string | null;
  dimensions: Record<string, unknown>;
  metrics: Record<string, unknown>;
  rawPayloadChecksum: string;
  rawPayload?: Record<string, unknown>;
  rawPayloadReference?: Record<string, unknown>;
  providerBatchId?: string;
  providerCursor?: Record<string, unknown>;
  collectionExecutionId?: string;
  dataQualityStatus: "VALID" | "REJECTED" | "PARTIAL";
  diagnosticSummary?: string;
  ingestedAt: string;
  supersededByObservationId?: string;
  correctedFromObservationId?: string;
  observedAt: string;
  observationKey: string;
  dimensionKey?: string;
  rawValue: number;
  unit: string;
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpMetricDefinition = {
  metricDefinitionId: string;
  projectId: string;
  metricKey: string;
  displayName: string;
  description?: string;
  unit: string;
  aggregationMethod: "SUM" | "AVERAGE" | "LATEST";
  valueType: "NUMBER" | "CURRENCY" | "PERCENT";
  precisionScale: number;
  defaultMetric: boolean;
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpNormalizedMetric = {
  normalizedMetricId: string;
  projectId: string;
  analyticsSourceId: string;
  analyticsCollectionId: string;
  metricDefinitionId: string;
  analyticsObservationId: string;
  measuredAt: string;
  normalizedValue: number;
  normalizationVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpPerformanceSnapshot = {
  performanceSnapshotId: string;
  projectId: string;
  siteId?: string;
  snapshotStatus: GmpAnalyticsSnapshotStatus;
  snapshotLabel: string;
  snapshotWindowStart: string;
  snapshotWindowEnd: string;
  totalMetrics: number;
  baselineScore?: number;
  trendDelta?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpMeasurementLineage = {
  measurementLineageId: string;
  projectId: string;
  analyticsSourceId: string;
  analyticsCollectionId?: string;
  analyticsObservationId?: string;
  normalizedMetricId?: string;
  performanceSnapshotId?: string;
  lineageStage: "COLLECTION" | "NORMALIZATION" | "SNAPSHOT";
  evidenceCompilerVersion: string;
  lineageFingerprint: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpAnalyticsCollectionEvent = {
  analyticsCollectionEventId: string;
  analyticsCollectionId: string;
  parentCollectionId?: string;
  retryOfCollectionId?: string;
  gopExecutionId?: string;
  eventType: GmpAnalyticsTimelineEventType;
  operation: string;
  status: GmpAnalyticsTimelineEventStatus;
  actorId?: string;
  attemptNumber?: number;
  batchNumber?: number;
  pageNumber?: number;
  occurredAt: string;
  observationCount: number;
  rejectedObservationCount: number;
  warningCount: number;
  cursorSummary?: Record<string, unknown>;
  errorCategory?: GmpAnalyticsErrorCategory;
  safeOutcomeSummary?: string;
  outcomeSummary?: string;
  safeDiagnostic?: string;
  evidenceReferences?: Record<string, unknown>;
  timelineContractVersion?: string;
  eventVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export function serializeTimelineEventDeterministically(event: GmpAnalyticsCollectionEvent): string {
  const canonical = {
    analyticsCollectionEventId: event.analyticsCollectionEventId,
    analyticsCollectionId: event.analyticsCollectionId,
    parentCollectionId: event.parentCollectionId ?? null,
    retryOfCollectionId: event.retryOfCollectionId ?? null,
    gopExecutionId: event.gopExecutionId ?? null,
    eventType: event.eventType,
    operation: event.operation,
    status: event.status,
    actorId: event.actorId ?? null,
    attemptNumber: event.attemptNumber ?? null,
    batchNumber: event.batchNumber ?? null,
    pageNumber: event.pageNumber ?? null,
    occurredAt: event.occurredAt,
    observationCount: event.observationCount,
    rejectedObservationCount: event.rejectedObservationCount,
    warningCount: event.warningCount,
    cursorSummary: event.cursorSummary ?? null,
    errorCategory: event.errorCategory ?? null,
    safeOutcomeSummary: event.safeOutcomeSummary ?? null,
    safeDiagnostic: event.safeDiagnostic ?? null,
    evidenceReferences: event.evidenceReferences ?? null,
    timelineContractVersion: event.timelineContractVersion ?? null,
    eventVersion: event.eventVersion,
    metadata: event.metadata ?? null,
    createdAt: event.createdAt,
  };
  return JSON.stringify(canonical);
}

export type GmpEvidenceCompilerVersion = {
  evidenceCompilerVersionId: string;
  projectId: string;
  compilerName: string;
  compilerVersion: string;
  normalizationVersion?: string;
  metricCatalogVersion?: string;
  correlationVersion?: string;
  snapshotVersion?: string;
  validationVersion?: string;
  releasedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpAnalyticsAttributionRegistry = {
  attributionRegistryId: string;
  projectId: string;
  registryStatus: string;
  registryVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpAnalyticsRecommendationRegistry = {
  recommendationRegistryId: string;
  projectId: string;
  registryStatus: string;
  registryVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function stableAnalyticsFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createAnalyticsSource(input: {
  projectId: string;
  workspaceId?: string;
  siteId?: string;
  sourceType: string;
  sourceName: string;
  adapterKey?: string;
  adapterVersion?: string;
  providerReference?: string;
  credentialsReference?: string;
  configuration?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): GmpAnalyticsSource {
  const now = new Date().toISOString();
  return {
    analyticsSourceId: `gmpasrc_${randomUUID()}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    siteId: input.siteId,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    sourceStatus: "ACTIVE",
    connectionStatus: "HEALTHY",
    collectionMode: "MANUAL",
    adapterKey: input.adapterKey,
    adapterVersion: input.adapterVersion,
    providerReference: input.providerReference,
    credentialsReference: input.credentialsReference,
    configuration: input.configuration ?? {},
    metadata: input.metadata,
    lastHealthCheckAt: null,
    lastCollectionAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultMetricDefinitions(projectId: string): GmpMetricDefinition[] {
  const now = new Date().toISOString();
  return [
    {
      metricDefinitionId: `gmpmetric_${randomUUID()}`,
      projectId,
      metricKey: "sessions",
      displayName: "Sessions",
      unit: "count",
      aggregationMethod: "SUM",
      valueType: "NUMBER",
      precisionScale: 0,
      defaultMetric: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      metricDefinitionId: `gmpmetric_${randomUUID()}`,
      projectId,
      metricKey: "conversions",
      displayName: "Conversions",
      unit: "count",
      aggregationMethod: "SUM",
      valueType: "NUMBER",
      precisionScale: 0,
      defaultMetric: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      metricDefinitionId: `gmpmetric_${randomUUID()}`,
      projectId,
      metricKey: "revenue",
      displayName: "Revenue",
      unit: "usd",
      aggregationMethod: "SUM",
      valueType: "CURRENCY",
      precisionScale: 2,
      defaultMetric: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

const collectionTerminalStates: GmpAnalyticsCollectionStatus[] = [
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
  "INELIGIBLE",
  "BLOCKED",
];

export function canTransitionCollectionStatus(current: GmpAnalyticsCollectionStatus, next: GmpAnalyticsCollectionStatus): boolean {
  if (current === next) {
    return true;
  }

  if (collectionTerminalStates.includes(current)) {
    return false;
  }

  const order: Record<GmpAnalyticsCollectionStatus, number> = {
    REQUESTED: 1,
    AUTHORIZED: 2,
    ELIGIBILITY_EVALUATED: 3,
    INELIGIBLE: 4,
    BLOCKED: 4,
    QUEUED: 5,
    RUNNING: 6,
    PERSISTING: 7,
    COMPLETED: 8,
    COMPLETED_WITH_WARNINGS: 8,
    PARTIAL: 8,
    FAILED: 8,
    CANCELLED: 8,
  };

  return order[next] >= order[current];
}
