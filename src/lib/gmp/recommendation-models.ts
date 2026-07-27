import { randomUUID } from "node:crypto";
import { stableAnalyticsFingerprint } from "./analytics-models";

export const gmpAttributionDimensions = [
  "PUBLICATION",
  "SITE",
  "PROJECT",
  "CHANNEL",
  "PAGE",
  "CAMPAIGN",
  "SEARCH",
  "ORGANIC",
  "REFERRAL",
  "DIRECT",
  "CUSTOM_SOURCE",
] as const;

export const gmpRecommendationLifecycleStates = ["NEW", "REVIEWED", "ACCEPTED", "REJECTED", "DISMISSED", "EXPIRED"] as const;
export const gmpRecommendationSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const gmpRecommendationPriorities = ["P3", "P2", "P1", "P0"] as const;
export const gmpRecommendationConfidenceLevels = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const;

export const GMP_ATTRIBUTION_ENGINE_VERSION = "gmp-attribution-engine/v1";
export const GMP_RECOMMENDATION_ENGINE_VERSION = "gmp-recommendation-engine/v1";
export const GMP_RECOMMENDATION_RULE_CATALOG_VERSION = "gmp-recommendation-rule-catalog/v1";
export const GMP_DECISION_SUPPORT_VERSION = "gmp-decision-support/v1";
export const GMP_RECOMMENDATION_VERSION = "gmp-recommendation/v1";

export type GmpAttributionDimension = (typeof gmpAttributionDimensions)[number];
export type GmpRecommendationLifecycleState = (typeof gmpRecommendationLifecycleStates)[number];
export type GmpRecommendationSeverity = (typeof gmpRecommendationSeverities)[number];
export type GmpRecommendationPriority = (typeof gmpRecommendationPriorities)[number];
export type GmpRecommendationConfidence = (typeof gmpRecommendationConfidenceLevels)[number];

export type GmpAttributionAnalysis = {
  attributionAnalysisId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  evidenceSnapshotId: string;
  attributionVersion: string;
  attributionWindowDays: number;
  windowStart: string;
  windowEnd: string;
  inputFingerprint: string;
  outputChecksum: string;
  sourceMetricCount: number;
  sourcePublicationCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpAttributionResult = {
  attributionResultId: string;
  attributionAnalysisId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  evidenceSnapshotId: string;
  dimensionType: GmpAttributionDimension;
  dimensionValue: string;
  metricKey: string;
  attributedValue: number;
  confidence: GmpRecommendationConfidence;
  lineageFingerprint: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpRecommendationRuleCatalogEntry = {
  recommendationRuleCatalogEntryId: string;
  projectId: string;
  ruleId: string;
  ruleVersion: string;
  registryVersion: string;
  description: string;
  inputs: string[];
  thresholds: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  severityMapping: Record<string, GmpRecommendationSeverity>;
  priorityMapping: Record<string, GmpRecommendationPriority>;
  replayCompatible: boolean;
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpRecommendationRun = {
  recommendationRunId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  evidenceSnapshotId: string;
  attributionAnalysisId: string;
  replayOfRunId?: string;
  triggerType: "MANUAL" | "REPLAY";
  runStatus: "RUNNING" | "COMPLETED" | "FAILED";
  recommendationEngineVersion: string;
  ruleCatalogVersion: string;
  attributionVersion: string;
  decisionSupportVersion: string;
  inputFingerprint: string;
  outputChecksum?: string;
  recommendationCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpRecommendationRuleExecution = {
  recommendationRuleExecutionId: string;
  recommendationRunId: string;
  workspaceId: string;
  projectId: string;
  evidenceSnapshotId: string;
  ruleId: string;
  ruleVersion: string;
  matched: boolean;
  producedCount: number;
  executionChecksum: string;
  diagnostics?: Record<string, unknown>;
  createdAt: string;
};

export type GmpRecommendationRecord = {
  recommendationId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  recommendationRunId: string;
  evidenceSnapshotId: string;
  attributionAnalysisId: string;
  recommendationVersion: string;
  ruleId: string;
  ruleVersion: string;
  evidenceCompilerVersion: string;
  snapshotVersion: string;
  attributionVersion: string;
  confidence: GmpRecommendationConfidence;
  severity: GmpRecommendationSeverity;
  priority: GmpRecommendationPriority;
  category: string;
  explanation: string;
  supportingEvidence: Record<string, unknown>;
  recommendedAction: string;
  lineageFingerprint: string;
  immutablePayloadChecksum: string;
  createdAt: string;
};

export type GmpRecommendationLifecycleEvent = {
  recommendationLifecycleEventId: string;
  recommendationId: string;
  workspaceId: string;
  projectId: string;
  lifecycleState: GmpRecommendationLifecycleState;
  actorId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpRecommendationReplayRun = {
  recommendationReplayRunId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  evidenceSnapshotId: string;
  recommendationRunId: string;
  ruleCatalogVersion: string;
  attributionVersion: string;
  replayChecksum: string;
  recommendationCount: number;
  deterministicMatch?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpDecisionSupportSummary = {
  decisionSupportSummaryId: string;
  workspaceId: string;
  projectId: string;
  siteId?: string;
  evidenceSnapshotId: string;
  recommendationRunId?: string;
  summaryType: "RECOMMENDATION_SUMMARY" | "TREND_SUMMARY" | "HEALTH_SUMMARY" | "SITE_HEALTH" | "PROJECT_HEALTH" | "EVIDENCE_QUALITY_SUMMARY";
  summaryKey: string;
  summaryValue: Record<string, unknown>;
  summaryChecksum: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpRecommendationRuleDefinition = {
  ruleId: string;
  ruleVersion: string;
  description: string;
  inputs: string[];
  thresholds: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  severityMapping: Record<string, GmpRecommendationSeverity>;
  priorityMapping: Record<string, GmpRecommendationPriority>;
  replayCompatible: boolean;
  active: boolean;
};

export function createRecommendationChecksum(value: unknown): string {
  return stableAnalyticsFingerprint(value);
}

export function createRecommendationId(): string {
  return `gmprec_${randomUUID()}`;
}

export function createRecommendationFingerprint(value: unknown): string {
  return stableAnalyticsFingerprint(value);
}

export function defaultRecommendationRules(): GmpRecommendationRuleDefinition[] {
  return [
    {
      ruleId: "improve_declining_ctr",
      ruleVersion: "1.0.0",
      description: "Flag low organic CTR for operator review.",
      inputs: ["organic_ctr"],
      thresholds: { warnBelow: 0.02 },
      outputSchema: { category: "performance", fields: ["value", "threshold"] },
      severityMapping: { triggered: "HIGH", default: "LOW" },
      priorityMapping: { triggered: "P1", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "refresh_aging_content",
      ruleVersion: "1.0.0",
      description: "Flag publications older than age threshold.",
      inputs: ["publicationTimestamp"],
      thresholds: { maxAgeDays: 120 },
      outputSchema: { category: "content", fields: ["ageDays", "publicationIdentity"] },
      severityMapping: { triggered: "MEDIUM", default: "LOW" },
      priorityMapping: { triggered: "P2", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "investigate_ranking_loss",
      ruleVersion: "1.0.0",
      description: "Flag ranking deterioration from average position.",
      inputs: ["average_position"],
      thresholds: { highAbove: 20 },
      outputSchema: { category: "search", fields: ["value", "threshold"] },
      severityMapping: { triggered: "HIGH", default: "LOW" },
      priorityMapping: { triggered: "P1", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "review_indexing_anomalies",
      ruleVersion: "1.0.0",
      description: "Flag low-correlation publication evidence.",
      inputs: ["publication_correlations"],
      thresholds: { lowCorrelationCount: 1 },
      outputSchema: { category: "indexing", fields: ["lowCorrelationCount"] },
      severityMapping: { triggered: "MEDIUM", default: "LOW" },
      priorityMapping: { triggered: "P2", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "monitor_traffic_decline",
      ruleVersion: "1.0.0",
      description: "Flag significant sessions decline versus prior snapshot.",
      inputs: ["sessions_current", "sessions_previous"],
      thresholds: { declineRatio: 0.2 },
      outputSchema: { category: "traffic", fields: ["declineRatio"] },
      severityMapping: { triggered: "HIGH", default: "LOW" },
      priorityMapping: { triggered: "P1", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "validate_publication_consistency",
      ruleVersion: "1.0.0",
      description: "Flag non-published publication states.",
      inputs: ["publicationStatus"],
      thresholds: { inconsistentCount: 1 },
      outputSchema: { category: "consistency", fields: ["inconsistentCount"] },
      severityMapping: { triggered: "MEDIUM", default: "LOW" },
      priorityMapping: { triggered: "P2", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "detect_stale_performance",
      ruleVersion: "1.0.0",
      description: "Flag stale evidence snapshots by age.",
      inputs: ["snapshot_age_days"],
      thresholds: { staleDays: 35 },
      outputSchema: { category: "freshness", fields: ["snapshotAgeDays"] },
      severityMapping: { triggered: "MEDIUM", default: "LOW" },
      priorityMapping: { triggered: "P2", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "flag_low_confidence_evidence",
      ruleVersion: "1.0.0",
      description: "Flag evidence confidence levels LOW or UNKNOWN.",
      inputs: ["evidenceConfidence"],
      thresholds: { blockedValues: ["LOW", "UNKNOWN"] },
      outputSchema: { category: "quality", fields: ["evidenceConfidence"] },
      severityMapping: { triggered: "HIGH", default: "LOW" },
      priorityMapping: { triggered: "P1", default: "P3" },
      replayCompatible: true,
      active: true,
    },
    {
      ruleId: "review_incomplete_collection_history",
      ruleVersion: "1.0.0",
      description: "Flag non-valid snapshot quality or rejected observations.",
      inputs: ["dataQualityStatus", "rejectedObservationCount"],
      thresholds: { rejectedAtLeast: 1 },
      outputSchema: { category: "governance", fields: ["dataQualityStatus", "rejectedObservationCount"] },
      severityMapping: { triggered: "MEDIUM", default: "LOW" },
      priorityMapping: { triggered: "P2", default: "P3" },
      replayCompatible: true,
      active: true,
    },
  ];
}
