import { randomUUID } from "node:crypto";
import { stableAnalyticsFingerprint } from "./analytics-models";

export const gmpEvidenceDataQualityStatuses = ["VALID", "PARTIAL", "STALE", "INVALID", "UNRESOLVED", "UNSUPPORTED"] as const;
export const gmpEvidenceConfidenceLevels = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export const gmpEvidenceSnapshotCadences = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export const gmpEvidenceCompilerRunStatuses = ["RUNNING", "COMPLETED", "FAILED"] as const;

export const GMP_EVIDENCE_COMPILER_VERSION = "gmp-evidence-compiler/v1";
export const GMP_EVIDENCE_NORMALIZATION_VERSION = "gmp-evidence-normalization/v1";
export const GMP_EVIDENCE_METRIC_CATALOG_VERSION = "gmp-evidence-metric-catalog/v1";
export const GMP_EVIDENCE_CORRELATION_VERSION = "gmp-evidence-correlation/v1";
export const GMP_EVIDENCE_SNAPSHOT_VERSION = "gmp-evidence-snapshot/v1";
export const GMP_EVIDENCE_VALIDATION_VERSION = "gmp-evidence-validation/v1";

export type GmpEvidenceDataQualityStatus = (typeof gmpEvidenceDataQualityStatuses)[number];
export type GmpEvidenceConfidenceLevel = (typeof gmpEvidenceConfidenceLevels)[number];
export type GmpEvidenceSnapshotCadence = (typeof gmpEvidenceSnapshotCadences)[number];
export type GmpEvidenceCompilerRunStatus = (typeof gmpEvidenceCompilerRunStatuses)[number];

export type GmpEvidenceCompilerVersionSet = {
  compilerVersion: string;
  normalizationVersion: string;
  metricCatalogVersion: string;
  correlationVersion: string;
  snapshotVersion: string;
  validationVersion: string;
};

export type GmpEvidenceCompilerRun = {
  evidenceCompilerRunId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  replayOfRunId?: string;
  runStatus: GmpEvidenceCompilerRunStatus;
  triggerType: "MANUAL" | "REPLAY";
  cadence: GmpEvidenceSnapshotCadence;
  periodStart: string;
  periodEnd: string;
  compilerVersion: string;
  normalizationVersion: string;
  metricCatalogVersion: string;
  correlationVersion: string;
  snapshotVersion: string;
  validationVersion: string;
  inputFingerprint: string;
  outputChecksum?: string;
  evidenceSnapshotId?: string;
  observationCount: number;
  rejectedObservationCount: number;
  compiledMetricCount: number;
  publicationReferenceCount: number;
  qualityStatus: GmpEvidenceDataQualityStatus;
  confidenceStatus: GmpEvidenceConfidenceLevel;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpEvidenceSnapshot = {
  evidenceSnapshotId: string;
  performanceSnapshotId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  cadence: GmpEvidenceSnapshotCadence;
  periodStart: string;
  periodEnd: string;
  compilerVersion: string;
  normalizationVersion: string;
  metricCatalogVersion: string;
  correlationVersion: string;
  snapshotVersion: string;
  validationVersion: string;
  dataQualityStatus: GmpEvidenceDataQualityStatus;
  evidenceConfidence: GmpEvidenceConfidenceLevel;
  snapshotChecksum: string;
  sourceObservationCount: number;
  rejectedObservationCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpEvidenceCompiledMetric = {
  evidenceCompiledMetricId: string;
  evidenceSnapshotId: string;
  projectId: string;
  siteId?: string;
  metricDefinitionId?: string;
  canonicalMetricKey: string;
  displayName: string;
  unit: string;
  valueType: "NUMBER" | "PERCENT" | "CURRENCY";
  aggregationMethod: "SUM" | "AVERAGE" | "LATEST";
  precisionScale: number;
  compiledValue: number;
  dataQualityStatus: GmpEvidenceDataQualityStatus;
  evidenceConfidence: GmpEvidenceConfidenceLevel;
  compilerVersion: string;
  sourceObservationIds: string[];
  lineageFingerprint: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpEvidencePublicationReference = {
  evidencePublicationReferenceId: string;
  evidenceSnapshotId: string;
  projectId: string;
  siteId?: string;
  publicationRecordId?: string;
  publicationIdentity: string;
  canonicalUrl: string;
  publicationStatus: string;
  publicationTimestamp?: string | null;
  correlationQuality: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  matchedObservationIds: string[];
  lineageFingerprint: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpEvidenceValidationIssue = {
  analyticsObservationId: string;
  code: string;
  detail: string;
};

export type GmpCanonicalMetricCatalogEntry = {
  canonicalMetricKey: string;
  displayName: string;
  unit: string;
  valueType: "NUMBER" | "PERCENT" | "CURRENCY";
  aggregationMethod: "SUM" | "AVERAGE" | "LATEST";
  precisionScale: number;
  sourceMetrics: string[];
};

export const gmpCanonicalMetricCatalog: GmpCanonicalMetricCatalogEntry[] = [
  {
    canonicalMetricKey: "organic_impressions",
    displayName: "Organic Impressions",
    unit: "count",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 0,
    sourceMetrics: ["impressions"],
  },
  {
    canonicalMetricKey: "organic_clicks",
    displayName: "Organic Clicks",
    unit: "count",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 0,
    sourceMetrics: ["clicks"],
  },
  {
    canonicalMetricKey: "organic_ctr",
    displayName: "Organic CTR",
    unit: "ratio",
    valueType: "PERCENT",
    aggregationMethod: "AVERAGE",
    precisionScale: 6,
    sourceMetrics: ["ctr"],
  },
  {
    canonicalMetricKey: "average_position",
    displayName: "Average Position",
    unit: "position",
    valueType: "NUMBER",
    aggregationMethod: "AVERAGE",
    precisionScale: 4,
    sourceMetrics: ["average_position", "position"],
  },
  {
    canonicalMetricKey: "sessions",
    displayName: "Sessions",
    unit: "count",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 0,
    sourceMetrics: ["sessions"],
  },
  {
    canonicalMetricKey: "users",
    displayName: "Users",
    unit: "count",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 0,
    sourceMetrics: ["users"],
  },
  {
    canonicalMetricKey: "engaged_sessions",
    displayName: "Engaged Sessions",
    unit: "count",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 0,
    sourceMetrics: ["engaged_sessions"],
  },
  {
    canonicalMetricKey: "engagement_time",
    displayName: "Engagement Time",
    unit: "seconds",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 2,
    sourceMetrics: ["engagement_time"],
  },
  {
    canonicalMetricKey: "engagement_rate",
    displayName: "Engagement Rate",
    unit: "ratio",
    valueType: "PERCENT",
    aggregationMethod: "AVERAGE",
    precisionScale: 6,
    sourceMetrics: ["engagement_rate"],
  },
  {
    canonicalMetricKey: "conversions",
    displayName: "Conversions",
    unit: "count",
    valueType: "NUMBER",
    aggregationMethod: "SUM",
    precisionScale: 0,
    sourceMetrics: ["conversions"],
  },
];

export function defaultCompilerVersionSet(): GmpEvidenceCompilerVersionSet {
  return {
    compilerVersion: GMP_EVIDENCE_COMPILER_VERSION,
    normalizationVersion: GMP_EVIDENCE_NORMALIZATION_VERSION,
    metricCatalogVersion: GMP_EVIDENCE_METRIC_CATALOG_VERSION,
    correlationVersion: GMP_EVIDENCE_CORRELATION_VERSION,
    snapshotVersion: GMP_EVIDENCE_SNAPSHOT_VERSION,
    validationVersion: GMP_EVIDENCE_VALIDATION_VERSION,
  };
}

export function createEvidenceInputFingerprint(value: unknown): string {
  return stableAnalyticsFingerprint(value);
}

export function createEvidenceChecksum(value: unknown): string {
  return stableAnalyticsFingerprint(value);
}

export function createEvidenceSnapshotLabel(cadence: GmpEvidenceSnapshotCadence, periodStart: string, periodEnd: string): string {
  return `Evidence ${cadence} ${periodStart.slice(0, 10)}..${periodEnd.slice(0, 10)}`;
}

export function createEvidenceSnapshotId(): string {
  return `gmpevs_${randomUUID()}`;
}
