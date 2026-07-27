import type { GmpEvidenceCompiledMetric, GmpEvidencePublicationReference, GmpEvidenceSnapshot } from "./evidence-models";
import { createPrismaGmpEvidenceRepository, type GmpEvidenceRepository } from "./evidence-repository";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import {
  createRecommendationChecksum,
  createRecommendationFingerprint,
  createRecommendationId,
  defaultRecommendationRules,
  GMP_ATTRIBUTION_ENGINE_VERSION,
  GMP_DECISION_SUPPORT_VERSION,
  GMP_RECOMMENDATION_ENGINE_VERSION,
  GMP_RECOMMENDATION_RULE_CATALOG_VERSION,
  GMP_RECOMMENDATION_VERSION,
  gmpRecommendationLifecycleStates,
  type GmpAttributionAnalysis,
  type GmpAttributionDimension,
  type GmpAttributionResult,
  type GmpDecisionSupportSummary,
  type GmpRecommendationConfidence,
  type GmpRecommendationLifecycleEvent,
  type GmpRecommendationLifecycleState,
  type GmpRecommendationPriority,
  type GmpRecommendationRecord,
  type GmpRecommendationRuleCatalogEntry,
  type GmpRecommendationRuleExecution,
  type GmpRecommendationRun,
  type GmpRecommendationSeverity,
} from "./recommendation-models";
import { createPrismaGmpRecommendationRepository, type GmpRecommendationRepository } from "./recommendation-repository";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / (24 * 60 * 60 * 1000));
}

function lifecycleStateOrder(state: GmpRecommendationLifecycleState): number {
  const index = gmpRecommendationLifecycleStates.indexOf(state);
  return index >= 0 ? index : 0;
}

function parseSeverity(mapping: Record<string, unknown>, key: string, fallback: GmpRecommendationSeverity): GmpRecommendationSeverity {
  const value = mapping[key];
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL") return value;
  return fallback;
}

function parsePriority(mapping: Record<string, unknown>, key: string, fallback: GmpRecommendationPriority): GmpRecommendationPriority {
  const value = mapping[key];
  if (value === "P3" || value === "P2" || value === "P1" || value === "P0") return value;
  return fallback;
}

function parseConfidence(value: string | undefined): GmpRecommendationConfidence {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "UNKNOWN") return value;
  return "UNKNOWN";
}

type EvidenceSnapshotBundle = {
  snapshot: GmpEvidenceSnapshot;
  metrics: GmpEvidenceCompiledMetric[];
  publications: GmpEvidencePublicationReference[];
};

export type AttributionEvidenceService = {
  loadSnapshotBundle: (input: {
    projectId: string;
    evidenceSnapshotId?: string;
  }) => Promise<EvidenceSnapshotBundle | null>;
};

export type AttributionRuleService = {
  dimensions: () => GmpAttributionDimension[];
};

export type AttributionEngineService = {
  analyze: (input: {
    workspaceId: string;
    projectId: string;
    siteId?: string;
    evidenceSnapshot: GmpEvidenceSnapshot;
    metrics: GmpEvidenceCompiledMetric[];
    publications: GmpEvidencePublicationReference[];
    attributionWindowDays: number;
    attributionVersion: string;
  }) => {
    analysis: Omit<GmpAttributionAnalysis, "attributionAnalysisId" | "createdAt">;
    results: Array<Omit<GmpAttributionResult, "attributionResultId" | "createdAt">>;
  };
};

export type RecommendationCatalogService = {
  ensureCatalog: (projectId: string) => Promise<GmpRecommendationRuleCatalogEntry[]>;
};

export type RecommendationEvaluationService = {
  evaluate: (input: {
    run: GmpRecommendationRun;
    evidence: EvidenceSnapshotBundle;
    attribution: GmpAttributionResult[];
    rules: GmpRecommendationRuleCatalogEntry[];
    previousSnapshotMetrics: GmpEvidenceCompiledMetric[];
  }) => {
    recommendations: Array<Omit<GmpRecommendationRecord, "recommendationId" | "createdAt">>;
    ruleExecutions: Array<Omit<GmpRecommendationRuleExecution, "recommendationRuleExecutionId" | "createdAt">>;
  };
};

export type RecommendationEngineService = {
  compile: (input: {
    workspaceId: string;
    projectId: string;
    actorId: string;
    siteId?: string;
    evidenceSnapshotId?: string;
    attributionWindowDays?: number;
    replayOfRunId?: string;
    forceVersions?: {
      ruleCatalogVersion?: string;
      attributionVersion?: string;
    };
  }) => Promise<{
    run: GmpRecommendationRun;
    attributionAnalysis: GmpAttributionAnalysis;
    attribution: GmpAttributionResult[];
    recommendations: GmpRecommendationRecord[];
    ruleExecutions: GmpRecommendationRuleExecution[];
    replayDeterministicMatch?: boolean;
  }>;
};

export type DecisionSupportService = {
  summarize: (input: {
    workspaceId: string;
    projectId: string;
    siteId?: string;
    evidence: EvidenceSnapshotBundle;
    run: GmpRecommendationRun;
    recommendations: GmpRecommendationRecord[];
  }) => Promise<GmpDecisionSupportSummary[]>;
};

export function createAttributionEvidenceService(dependencies?: {
  evidenceRepository?: GmpEvidenceRepository;
}): AttributionEvidenceService {
  const evidenceRepository = dependencies?.evidenceRepository ?? createPrismaGmpEvidenceRepository();

  return {
    async loadSnapshotBundle(input) {
      let snapshot: GmpEvidenceSnapshot | null = null;
      if (input.evidenceSnapshotId) {
        snapshot = await evidenceRepository.getEvidenceSnapshotById(input.evidenceSnapshotId);
      } else {
        snapshot = (await evidenceRepository.listEvidenceSnapshotsForProject(input.projectId, 1))[0] ?? null;
      }

      if (!snapshot) return null;

      const [metrics, publications] = await Promise.all([
        evidenceRepository.listCompiledMetrics({ projectId: snapshot.projectId, evidenceSnapshotId: snapshot.evidenceSnapshotId, limit: 500 }),
        evidenceRepository.listPublicationReferences({ projectId: snapshot.projectId, evidenceSnapshotId: snapshot.evidenceSnapshotId, limit: 500 }),
      ]);

      return { snapshot, metrics, publications };
    },
  };
}

export function createAttributionRuleService(): AttributionRuleService {
  const dimensions: GmpAttributionDimension[] = [
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
  ];

  return {
    dimensions() {
      return [...dimensions];
    },
  };
}

export function createAttributionEngineService(dependencies?: {
  attributionRuleService?: AttributionRuleService;
}): AttributionEngineService {
  const attributionRuleService = dependencies?.attributionRuleService ?? createAttributionRuleService();

  return {
    analyze(input) {
      const dimensionSet = new Set(attributionRuleService.dimensions());
      const aggregate = new Map<string, number>();

      const put = (dimensionType: GmpAttributionDimension, dimensionValue: string, metricKey: string, value: number) => {
        if (!dimensionSet.has(dimensionType)) return;
        const key = `${dimensionType}|${dimensionValue}|${metricKey}`;
        aggregate.set(key, (aggregate.get(key) ?? 0) + value);
      };

      input.metrics.forEach((metric) => {
        const metricValue = toNumber(metric.compiledValue);
        const page = input.publications[0]?.canonicalUrl ?? "unassigned";

        put("PROJECT", input.projectId, metric.canonicalMetricKey, metricValue);
        put("SITE", input.siteId ?? "unassigned", metric.canonicalMetricKey, metricValue);
        put("PAGE", normalizeUrl(page), metric.canonicalMetricKey, metricValue);

        if (metric.canonicalMetricKey.includes("organic")) {
          put("CHANNEL", "organic", metric.canonicalMetricKey, metricValue);
          put("ORGANIC", "organic", metric.canonicalMetricKey, metricValue);
          put("SEARCH", "search", metric.canonicalMetricKey, metricValue);
        } else {
          put("CHANNEL", "direct", metric.canonicalMetricKey, metricValue);
          put("DIRECT", "direct", metric.canonicalMetricKey, metricValue);
        }

        put("CAMPAIGN", "placeholder", metric.canonicalMetricKey, metricValue);
      });

      input.publications.forEach((publication) => {
        const publicationKey = publication.publicationIdentity || publication.publicationRecordId || publication.canonicalUrl;
        const matched = publication.matchedObservationIds.length;

        put("PUBLICATION", publicationKey, "matched_observations", matched);
        put("PAGE", normalizeUrl(publication.canonicalUrl), "matched_observations", matched);

        const referralLike = publication.canonicalUrl.includes("utm") ? "referral" : "custom_source";
        if (referralLike === "referral") {
          put("REFERRAL", "referral", "matched_observations", matched);
        } else {
          put("CUSTOM_SOURCE", "custom_source", "matched_observations", matched);
        }
      });

      const analysisPayload = {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        siteId: input.siteId ?? null,
        evidenceSnapshotId: input.evidenceSnapshot.evidenceSnapshotId,
        attributionVersion: input.attributionVersion,
        attributionWindowDays: input.attributionWindowDays,
        windowStart: input.evidenceSnapshot.periodStart,
        windowEnd: input.evidenceSnapshot.periodEnd,
        metrics: input.metrics.map((metric) => [metric.canonicalMetricKey, metric.compiledValue]),
        publications: input.publications.map((publication) => [publication.publicationIdentity, publication.canonicalUrl]),
      };

      const outputRows = [...aggregate.entries()]
        .map(([key, value]) => {
          const [dimensionType, dimensionValue, metricKey] = key.split("|");
          const confidence: GmpRecommendationConfidence = input.evidenceSnapshot.evidenceConfidence === "HIGH"
            ? "HIGH"
            : input.evidenceSnapshot.evidenceConfidence === "MEDIUM"
              ? "MEDIUM"
              : input.evidenceSnapshot.evidenceConfidence === "LOW"
                ? "LOW"
                : "UNKNOWN";

          return {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            siteId: input.siteId,
            evidenceSnapshotId: input.evidenceSnapshot.evidenceSnapshotId,
            attributionAnalysisId: "pending",
            dimensionType: dimensionType as GmpAttributionDimension,
            dimensionValue,
            metricKey,
            attributedValue: Number(value.toFixed(6)),
            confidence,
            lineageFingerprint: createRecommendationChecksum({
              dimensionType,
              dimensionValue,
              metricKey,
              value: Number(value.toFixed(6)),
              evidenceSnapshotId: input.evidenceSnapshot.evidenceSnapshotId,
            }),
            metadata: {
              attributionVersion: input.attributionVersion,
              windowDays: input.attributionWindowDays,
            },
          };
        })
        .sort((a, b) => (
          a.dimensionType.localeCompare(b.dimensionType)
          || a.dimensionValue.localeCompare(b.dimensionValue)
          || a.metricKey.localeCompare(b.metricKey)
        ));

      return {
        analysis: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: input.evidenceSnapshot.evidenceSnapshotId,
          attributionVersion: input.attributionVersion,
          attributionWindowDays: input.attributionWindowDays,
          windowStart: input.evidenceSnapshot.periodStart,
          windowEnd: input.evidenceSnapshot.periodEnd,
          inputFingerprint: createRecommendationFingerprint(analysisPayload),
          outputChecksum: createRecommendationChecksum(outputRows),
          sourceMetricCount: input.metrics.length,
          sourcePublicationCount: input.publications.length,
          metadata: {
            dimensions: attributionRuleService.dimensions(),
          },
        },
        results: outputRows,
      };
    },
  };
}

export function createRecommendationCatalogService(dependencies?: {
  recommendationRepository?: GmpRecommendationRepository;
}): RecommendationCatalogService {
  const recommendationRepository = dependencies?.recommendationRepository ?? createPrismaGmpRecommendationRepository();

  return {
    async ensureCatalog(projectId) {
      const defaults = defaultRecommendationRules();
      const entries: GmpRecommendationRuleCatalogEntry[] = [];

      for (const rule of defaults) {
        entries.push(await recommendationRepository.upsertRuleCatalogEntry({
          projectId,
          ruleId: rule.ruleId,
          ruleVersion: rule.ruleVersion,
          registryVersion: GMP_RECOMMENDATION_RULE_CATALOG_VERSION,
          description: rule.description,
          inputs: rule.inputs,
          thresholds: rule.thresholds,
          outputSchema: rule.outputSchema,
          severityMapping: rule.severityMapping,
          priorityMapping: rule.priorityMapping,
          replayCompatible: rule.replayCompatible,
          active: rule.active,
          metadata: {
            managedBy: "gmp-0006d",
          },
        }));
      }

      return entries.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.ruleVersion.localeCompare(b.ruleVersion));
    },
  };
}

function evaluateRule(input: {
  rule: GmpRecommendationRuleCatalogEntry;
  run: GmpRecommendationRun;
  evidence: EvidenceSnapshotBundle;
  attribution: GmpAttributionResult[];
  previousSnapshotMetrics: GmpEvidenceCompiledMetric[];
}): {
  records: Array<Omit<GmpRecommendationRecord, "recommendationId" | "createdAt">>;
  diagnostics: Record<string, unknown>;
} {
  const now = nowIso();
  const metricMap = new Map(input.evidence.metrics.map((entry) => [entry.canonicalMetricKey, toNumber(entry.compiledValue)]));
  const previousMetricMap = new Map(input.previousSnapshotMetrics.map((entry) => [entry.canonicalMetricKey, toNumber(entry.compiledValue)]));
  const records: Array<Omit<GmpRecommendationRecord, "recommendationId" | "createdAt">> = [];

  const addRecord = (payload: {
    category: string;
    explanation: string;
    supportingEvidence: Record<string, unknown>;
    recommendedAction: string;
    confidence?: GmpRecommendationConfidence;
    severityKey?: string;
    priorityKey?: string;
  }) => {
    const severity = parseSeverity(input.rule.severityMapping, payload.severityKey ?? "triggered", "MEDIUM");
    const priority = parsePriority(input.rule.priorityMapping, payload.priorityKey ?? "triggered", "P2");
    const confidence = payload.confidence ?? parseConfidence(input.evidence.snapshot.evidenceConfidence);

    const immutablePayload = {
      ruleId: input.rule.ruleId,
      ruleVersion: input.rule.ruleVersion,
      evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
      explanation: payload.explanation,
      supportingEvidence: payload.supportingEvidence,
      recommendedAction: payload.recommendedAction,
      category: payload.category,
      severity,
      priority,
      confidence,
    };

    records.push({
      workspaceId: input.run.workspaceId,
      projectId: input.run.projectId,
      siteId: input.run.siteId,
      recommendationRunId: input.run.recommendationRunId,
      evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
      attributionAnalysisId: input.run.attributionAnalysisId,
      recommendationVersion: GMP_RECOMMENDATION_VERSION,
      ruleId: input.rule.ruleId,
      ruleVersion: input.rule.ruleVersion,
      evidenceCompilerVersion: input.evidence.snapshot.compilerVersion,
      snapshotVersion: input.evidence.snapshot.snapshotVersion,
      attributionVersion: input.run.attributionVersion,
      confidence,
      severity,
      priority,
      category: payload.category,
      explanation: payload.explanation,
      supportingEvidence: payload.supportingEvidence,
      recommendedAction: payload.recommendedAction,
      lineageFingerprint: createRecommendationChecksum({
        ruleId: input.rule.ruleId,
        snapshotId: input.evidence.snapshot.evidenceSnapshotId,
        evidence: payload.supportingEvidence,
      }),
      immutablePayloadChecksum: createRecommendationChecksum(immutablePayload),
    });
  };

  const thresholds = input.rule.thresholds;

  switch (input.rule.ruleId) {
    case "improve_declining_ctr": {
      const ctr = metricMap.get("organic_ctr") ?? 0;
      const warnBelow = toNumber(thresholds.warnBelow);
      if (ctr > 0 && ctr < warnBelow) {
        addRecord({
          category: "performance",
          explanation: `Organic CTR (${ctr.toFixed(4)}) is below threshold (${warnBelow.toFixed(4)}).`,
          supportingEvidence: { organicCtr: ctr, threshold: warnBelow },
          recommendedAction: "Review SERP snippets and title/meta alignment for affected pages.",
        });
      }
      return { records, diagnostics: { organicCtr: ctr, warnBelow } };
    }
    case "refresh_aging_content": {
      const maxAgeDays = toNumber(thresholds.maxAgeDays);
      const stalePublications = input.evidence.publications
        .map((publication) => {
          const publicationTimestamp = publication.publicationTimestamp ?? publication.createdAt;
          return {
            publicationIdentity: publication.publicationIdentity,
            canonicalUrl: publication.canonicalUrl,
            ageDays: daysBetween(publicationTimestamp, now),
          };
        })
        .filter((entry) => entry.ageDays >= maxAgeDays)
        .sort((a, b) => b.ageDays - a.ageDays);

      if (stalePublications.length > 0) {
        addRecord({
          category: "content",
          explanation: `${stalePublications.length} publication(s) exceeded freshness threshold (${maxAgeDays} days).`,
          supportingEvidence: { stalePublications, maxAgeDays },
          recommendedAction: "Queue editorial review for aging content and update critical sections.",
        });
      }

      return { records, diagnostics: { staleCount: stalePublications.length, maxAgeDays } };
    }
    case "investigate_ranking_loss": {
      const averagePosition = metricMap.get("average_position") ?? 0;
      const highAbove = toNumber(thresholds.highAbove);
      if (averagePosition > highAbove) {
        addRecord({
          category: "search",
          explanation: `Average position (${averagePosition.toFixed(2)}) exceeded threshold (${highAbove.toFixed(2)}).`,
          supportingEvidence: { averagePosition, threshold: highAbove },
          recommendedAction: "Investigate affected query clusters and optimize on-page relevance signals.",
        });
      }
      return { records, diagnostics: { averagePosition, highAbove } };
    }
    case "review_indexing_anomalies": {
      const threshold = toNumber(thresholds.lowCorrelationCount);
      const lowCorrelation = input.evidence.publications.filter((entry) => entry.correlationQuality === "LOW" || entry.correlationQuality === "UNKNOWN");
      if (lowCorrelation.length >= threshold) {
        addRecord({
          category: "indexing",
          explanation: `${lowCorrelation.length} publication correlation record(s) show LOW or UNKNOWN quality.`,
          supportingEvidence: {
            lowCorrelationCount: lowCorrelation.length,
            publications: lowCorrelation.map((entry) => ({
              publicationIdentity: entry.publicationIdentity,
              canonicalUrl: entry.canonicalUrl,
              correlationQuality: entry.correlationQuality,
            })),
          },
          recommendedAction: "Review indexing and canonical consistency for low-correlation publication references.",
        });
      }
      return { records, diagnostics: { lowCorrelationCount: lowCorrelation.length, threshold } };
    }
    case "monitor_traffic_decline": {
      const currentSessions = metricMap.get("sessions") ?? 0;
      const previousSessions = previousMetricMap.get("sessions") ?? 0;
      const declineRatio = toNumber(thresholds.declineRatio);
      const ratio = previousSessions > 0 ? (previousSessions - currentSessions) / previousSessions : 0;
      if (previousSessions > 0 && ratio >= declineRatio) {
        addRecord({
          category: "traffic",
          explanation: `Sessions declined by ${(ratio * 100).toFixed(2)}% versus prior snapshot.`,
          supportingEvidence: { currentSessions, previousSessions, declineRatio: ratio },
          recommendedAction: "Inspect recent publishing/crawl events and investigate traffic regression factors.",
        });
      }
      return { records, diagnostics: { currentSessions, previousSessions, ratio, declineRatio } };
    }
    case "validate_publication_consistency": {
      const inconsistent = input.evidence.publications.filter((entry) => entry.publicationStatus.toLowerCase() !== "published");
      const threshold = toNumber(thresholds.inconsistentCount);
      if (inconsistent.length >= threshold) {
        addRecord({
          category: "consistency",
          explanation: `${inconsistent.length} publication(s) are not in published state.`,
          supportingEvidence: {
            inconsistentCount: inconsistent.length,
            publicationStatuses: inconsistent.map((entry) => ({ identity: entry.publicationIdentity, status: entry.publicationStatus })),
          },
          recommendedAction: "Validate publication delivery consistency and resolve non-published records.",
        });
      }
      return { records, diagnostics: { inconsistentCount: inconsistent.length, threshold } };
    }
    case "detect_stale_performance": {
      const staleDays = toNumber(thresholds.staleDays);
      const snapshotAgeDays = daysBetween(input.evidence.snapshot.periodEnd, now);
      if (snapshotAgeDays >= staleDays) {
        addRecord({
          category: "freshness",
          explanation: `Snapshot age (${snapshotAgeDays} days) exceeds freshness threshold (${staleDays} days).`,
          supportingEvidence: {
            snapshotAgeDays,
            staleDays,
            snapshotPeriodEnd: input.evidence.snapshot.periodEnd,
          },
          recommendedAction: "Run evidence compiler refresh for current operating window.",
        });
      }
      return { records, diagnostics: { snapshotAgeDays, staleDays } };
    }
    case "flag_low_confidence_evidence": {
      const blocked = Array.isArray(thresholds.blockedValues) ? thresholds.blockedValues.map(String) : [];
      if (blocked.includes(input.evidence.snapshot.evidenceConfidence)) {
        addRecord({
          category: "quality",
          explanation: `Evidence confidence is ${input.evidence.snapshot.evidenceConfidence}.`,
          supportingEvidence: {
            evidenceConfidence: input.evidence.snapshot.evidenceConfidence,
            blockedValues: blocked,
          },
          recommendedAction: "Review source reliability and rerun evidence compilation after remediation.",
          severityKey: "triggered",
          priorityKey: "triggered",
          confidence: parseConfidence(input.evidence.snapshot.evidenceConfidence),
        });
      }
      return { records, diagnostics: { evidenceConfidence: input.evidence.snapshot.evidenceConfidence, blocked } };
    }
    case "review_incomplete_collection_history": {
      const rejectedAtLeast = toNumber(thresholds.rejectedAtLeast);
      const rejected = input.evidence.snapshot.rejectedObservationCount;
      const quality = input.evidence.snapshot.dataQualityStatus;
      const qualityTriggered = quality !== "VALID";
      if (qualityTriggered || rejected >= rejectedAtLeast) {
        addRecord({
          category: "governance",
          explanation: `Evidence quality=${quality} with rejected observations=${rejected}.`,
          supportingEvidence: {
            dataQualityStatus: quality,
            rejectedObservationCount: rejected,
            rejectedAtLeast,
          },
          recommendedAction: "Review collection completeness timeline and execute corrective recollection where required.",
        });
      }
      return { records, diagnostics: { dataQualityStatus: quality, rejectedObservationCount: rejected, rejectedAtLeast } };
    }
    default:
      return { records: [], diagnostics: { skipped: true } };
  }
}

export function createRecommendationEvaluationService(): RecommendationEvaluationService {
  return {
    evaluate(input) {
      const recommendations: Array<Omit<GmpRecommendationRecord, "recommendationId" | "createdAt">> = [];
      const ruleExecutions: Array<Omit<GmpRecommendationRuleExecution, "recommendationRuleExecutionId" | "createdAt">> = [];

      for (const rule of [...input.rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.ruleVersion.localeCompare(b.ruleVersion))) {
        const { records, diagnostics } = evaluateRule({
          rule,
          run: input.run,
          evidence: input.evidence,
          attribution: input.attribution,
          previousSnapshotMetrics: input.previousSnapshotMetrics,
        });

        recommendations.push(...records);
        ruleExecutions.push({
          recommendationRunId: input.run.recommendationRunId,
          workspaceId: input.run.workspaceId,
          projectId: input.run.projectId,
          evidenceSnapshotId: input.run.evidenceSnapshotId,
          ruleId: rule.ruleId,
          ruleVersion: rule.ruleVersion,
          matched: records.length > 0,
          producedCount: records.length,
          executionChecksum: createRecommendationChecksum({
            ruleId: rule.ruleId,
            ruleVersion: rule.ruleVersion,
            diagnostics,
            producedCount: records.length,
          }),
          diagnostics,
        });
      }

      return { recommendations, ruleExecutions };
    },
  };
}

export function createDecisionSupportService(dependencies?: {
  recommendationRepository?: GmpRecommendationRepository;
}): DecisionSupportService {
  const recommendationRepository = dependencies?.recommendationRepository ?? createPrismaGmpRecommendationRepository();

  return {
    async summarize(input) {
      const lifecycleByRecommendation = new Map<string, GmpRecommendationLifecycleState>();

      for (const recommendation of input.recommendations) {
        const events = await recommendationRepository.listLifecycleEvents(recommendation.recommendationId);
        const latest = [...events].sort((a, b) => (
          a.createdAt.localeCompare(b.createdAt)
          || lifecycleStateOrder(a.lifecycleState) - lifecycleStateOrder(b.lifecycleState)
        )).at(-1);
        lifecycleByRecommendation.set(recommendation.recommendationId, latest?.lifecycleState ?? "NEW");
      }

      const severityCounts = input.recommendations.reduce<Record<string, number>>((acc, recommendation) => {
        acc[recommendation.severity] = (acc[recommendation.severity] ?? 0) + 1;
        return acc;
      }, {});

      const stateCounts = [...lifecycleByRecommendation.values()].reduce<Record<string, number>>((acc, state) => {
        acc[state] = (acc[state] ?? 0) + 1;
        return acc;
      }, {});

      const healthScore = Math.max(0, 100 - ((severityCounts.CRITICAL ?? 0) * 25) - ((severityCounts.HIGH ?? 0) * 10));

      const summaries: Array<Omit<GmpDecisionSupportSummary, "decisionSupportSummaryId" | "createdAt">> = [
        {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
          recommendationRunId: input.run.recommendationRunId,
          summaryType: "RECOMMENDATION_SUMMARY",
          summaryKey: "recommendation_counts",
          summaryValue: {
            totalRecommendations: input.recommendations.length,
            severityCounts,
            stateCounts,
          },
          summaryChecksum: createRecommendationChecksum({ severityCounts, stateCounts, total: input.recommendations.length }),
          metadata: { version: GMP_DECISION_SUPPORT_VERSION },
        },
        {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
          recommendationRunId: input.run.recommendationRunId,
          summaryType: "HEALTH_SUMMARY",
          summaryKey: "recommendation_health",
          summaryValue: {
            healthScore,
            evidenceQuality: input.evidence.snapshot.dataQualityStatus,
            evidenceConfidence: input.evidence.snapshot.evidenceConfidence,
          },
          summaryChecksum: createRecommendationChecksum({ healthScore, quality: input.evidence.snapshot.dataQualityStatus, confidence: input.evidence.snapshot.evidenceConfidence }),
          metadata: { version: GMP_DECISION_SUPPORT_VERSION },
        },
        {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
          recommendationRunId: input.run.recommendationRunId,
          summaryType: "SITE_HEALTH",
          summaryKey: input.siteId ?? "unassigned-site",
          summaryValue: {
            siteId: input.siteId ?? null,
            healthScore,
            highPriorityRecommendations: input.recommendations.filter((entry) => entry.priority === "P0" || entry.priority === "P1").length,
          },
          summaryChecksum: createRecommendationChecksum({ siteId: input.siteId ?? null, healthScore }),
          metadata: { version: GMP_DECISION_SUPPORT_VERSION },
        },
        {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
          recommendationRunId: input.run.recommendationRunId,
          summaryType: "PROJECT_HEALTH",
          summaryKey: input.projectId,
          summaryValue: {
            projectId: input.projectId,
            healthScore,
            recommendationCount: input.recommendations.length,
          },
          summaryChecksum: createRecommendationChecksum({ projectId: input.projectId, healthScore, recommendationCount: input.recommendations.length }),
          metadata: { version: GMP_DECISION_SUPPORT_VERSION },
        },
        {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: input.evidence.snapshot.evidenceSnapshotId,
          recommendationRunId: input.run.recommendationRunId,
          summaryType: "EVIDENCE_QUALITY_SUMMARY",
          summaryKey: "evidence_quality",
          summaryValue: {
            dataQualityStatus: input.evidence.snapshot.dataQualityStatus,
            evidenceConfidence: input.evidence.snapshot.evidenceConfidence,
            sourceObservationCount: input.evidence.snapshot.sourceObservationCount,
            rejectedObservationCount: input.evidence.snapshot.rejectedObservationCount,
          },
          summaryChecksum: createRecommendationChecksum({
            quality: input.evidence.snapshot.dataQualityStatus,
            confidence: input.evidence.snapshot.evidenceConfidence,
            sourceObservationCount: input.evidence.snapshot.sourceObservationCount,
            rejectedObservationCount: input.evidence.snapshot.rejectedObservationCount,
          }),
          metadata: { version: GMP_DECISION_SUPPORT_VERSION },
        },
      ];

      const persisted: GmpDecisionSupportSummary[] = [];
      for (const summary of summaries) {
        persisted.push(await recommendationRepository.createDecisionSummary(summary));
      }
      return persisted;
    },
  };
}

export function createRecommendationEngineService(dependencies?: {
  recommendationRepository?: GmpRecommendationRepository;
  evidenceRepository?: GmpEvidenceRepository;
  attributionEvidenceService?: AttributionEvidenceService;
  attributionEngineService?: AttributionEngineService;
  recommendationCatalogService?: RecommendationCatalogService;
  recommendationEvaluationService?: RecommendationEvaluationService;
  decisionSupportService?: DecisionSupportService;
}): RecommendationEngineService {
  const recommendationRepository = dependencies?.recommendationRepository ?? createPrismaGmpRecommendationRepository();
  const evidenceRepository = dependencies?.evidenceRepository ?? createPrismaGmpEvidenceRepository();
  const attributionEvidenceService = dependencies?.attributionEvidenceService ?? createAttributionEvidenceService();
  const attributionEngineService = dependencies?.attributionEngineService ?? createAttributionEngineService();
  const recommendationCatalogService = dependencies?.recommendationCatalogService ?? createRecommendationCatalogService({ recommendationRepository });
  const recommendationEvaluationService = dependencies?.recommendationEvaluationService ?? createRecommendationEvaluationService();
  const decisionSupportService = dependencies?.decisionSupportService ?? createDecisionSupportService({ recommendationRepository });

  return {
    async compile(input) {
      const evidence = await attributionEvidenceService.loadSnapshotBundle({
        projectId: input.projectId,
        evidenceSnapshotId: input.evidenceSnapshotId,
      });

      if (!evidence) throw new Error("Evidence snapshot not found.");

      const attributionVersion = input.forceVersions?.attributionVersion ?? GMP_ATTRIBUTION_ENGINE_VERSION;
      const ruleCatalogVersion = input.forceVersions?.ruleCatalogVersion ?? GMP_RECOMMENDATION_RULE_CATALOG_VERSION;
      const attributionWindowDays = Math.max(1, Math.min(365, input.attributionWindowDays ?? 30));

      const runInputFingerprint = createRecommendationFingerprint({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        siteId: input.siteId ?? null,
        evidenceSnapshotId: evidence.snapshot.evidenceSnapshotId,
        attributionVersion,
        ruleCatalogVersion,
        attributionWindowDays,
        metrics: evidence.metrics.map((entry) => [entry.canonicalMetricKey, entry.compiledValue]),
        publications: evidence.publications.map((entry) => [entry.publicationIdentity, entry.canonicalUrl]),
      });

      let run = await recommendationRepository.createRecommendationRun({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        siteId: input.siteId,
        evidenceSnapshotId: evidence.snapshot.evidenceSnapshotId,
        attributionAnalysisId: "pending",
        replayOfRunId: input.replayOfRunId,
        triggerType: input.replayOfRunId ? "REPLAY" : "MANUAL",
        runStatus: "RUNNING",
        recommendationEngineVersion: GMP_RECOMMENDATION_ENGINE_VERSION,
        ruleCatalogVersion,
        attributionVersion,
        decisionSupportVersion: GMP_DECISION_SUPPORT_VERSION,
        inputFingerprint: runInputFingerprint,
        outputChecksum: undefined,
        recommendationCount: 0,
        metadata: {
          actorId: input.actorId,
        },
      });

      try {
        const attributionDraft = attributionEngineService.analyze({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshot: evidence.snapshot,
          metrics: evidence.metrics,
          publications: evidence.publications,
          attributionWindowDays,
          attributionVersion,
        });

        const attributionAnalysis = await recommendationRepository.createAttributionAnalysis(attributionDraft.analysis);
        run = (await recommendationRepository.updateRecommendationRun(run.recommendationRunId, {
          attributionAnalysisId: attributionAnalysis.attributionAnalysisId,
        })) ?? run;

        const attributionResults: GmpAttributionResult[] = [];
        for (const row of attributionDraft.results) {
          attributionResults.push(await recommendationRepository.createAttributionResult({
            ...row,
            attributionAnalysisId: attributionAnalysis.attributionAnalysisId,
          }));
        }

        const rules = (await recommendationCatalogService.ensureCatalog(input.projectId))
          .filter((entry) => entry.registryVersion === ruleCatalogVersion && entry.active);

        const previousSnapshot = (await evidenceRepository.listEvidenceSnapshotsForProject(input.projectId, 2))
          .find((entry) => entry.evidenceSnapshotId !== evidence.snapshot.evidenceSnapshotId);
        const previousSnapshotMetrics = previousSnapshot
          ? await evidenceRepository.listCompiledMetrics({ projectId: input.projectId, evidenceSnapshotId: previousSnapshot.evidenceSnapshotId, limit: 500 })
          : [];

        const evaluated = recommendationEvaluationService.evaluate({
          run,
          evidence,
          attribution: attributionResults,
          rules,
          previousSnapshotMetrics,
        });

        const persistedRecommendations: GmpRecommendationRecord[] = [];
        for (const recommendation of evaluated.recommendations) {
          const record = await recommendationRepository.createRecommendationRecord({
            ...recommendation,
            recommendationId: createRecommendationId(),
          });
          persistedRecommendations.push(record);

          await recommendationRepository.appendLifecycleEvent({
            recommendationId: record.recommendationId,
            workspaceId: record.workspaceId,
            projectId: record.projectId,
            lifecycleState: "NEW",
            actorId: input.actorId,
            reason: "Generated by deterministic recommendation engine.",
            metadata: {
              recommendationRunId: run.recommendationRunId,
            },
          });
        }

        const ruleExecutions: GmpRecommendationRuleExecution[] = [];
        for (const execution of evaluated.ruleExecutions) {
          ruleExecutions.push(await recommendationRepository.createRuleExecution(execution));
        }

        const outputChecksum = createRecommendationChecksum({
          recommendations: persistedRecommendations.map((entry) => entry.immutablePayloadChecksum).sort((a, b) => a.localeCompare(b)),
          ruleExecutions: ruleExecutions.map((entry) => ({
            ruleId: entry.ruleId,
            checksum: entry.executionChecksum,
            producedCount: entry.producedCount,
          })).sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
        });

        let replayDeterministicMatch: boolean | undefined;
        if (input.replayOfRunId) {
          const priorRun = await recommendationRepository.getRecommendationRunById(input.replayOfRunId);
          replayDeterministicMatch = Boolean(priorRun?.outputChecksum && priorRun.outputChecksum === outputChecksum);
        }

        run = (await recommendationRepository.updateRecommendationRun(run.recommendationRunId, {
          runStatus: "COMPLETED",
          outputChecksum,
          recommendationCount: persistedRecommendations.length,
          metadata: {
            actorId: input.actorId,
            replayDeterministicMatch,
          },
        })) ?? run;

        await recommendationRepository.createReplayRun({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidenceSnapshotId: evidence.snapshot.evidenceSnapshotId,
          recommendationRunId: run.recommendationRunId,
          ruleCatalogVersion: run.ruleCatalogVersion,
          attributionVersion: run.attributionVersion,
          replayChecksum: outputChecksum,
          recommendationCount: persistedRecommendations.length,
          deterministicMatch: replayDeterministicMatch,
          metadata: {
            triggerType: run.triggerType,
            replayOfRunId: run.replayOfRunId,
          },
        });

        await decisionSupportService.summarize({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          evidence,
          run,
          recommendations: persistedRecommendations,
        });

        return {
          run,
          attributionAnalysis,
          attribution: attributionResults,
          recommendations: persistedRecommendations,
          ruleExecutions,
          replayDeterministicMatch,
        };
      } catch (error) {
        await recommendationRepository.updateRecommendationRun(run.recommendationRunId, {
          runStatus: "FAILED",
          metadata: {
            actorId: input.actorId,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    },
  };
}

export type GmpRecommendationServices = {
  compileRecommendations: (input: {
    workspaceId: string;
    projectId: string;
    actorId: string;
    siteId?: string;
    evidenceSnapshotId?: string;
    attributionWindowDays?: number;
    replayOfRunId?: string;
    ruleCatalogVersion?: string;
    attributionVersion?: string;
  }) => Promise<{
    run: GmpRecommendationRun;
    attributionAnalysis: GmpAttributionAnalysis;
    attribution: GmpAttributionResult[];
    recommendations: GmpRecommendationRecord[];
    ruleExecutions: GmpRecommendationRuleExecution[];
    replayDeterministicMatch?: boolean;
  }>;
  listRecommendations: (input: { projectId: string; evidenceSnapshotId?: string }) => Promise<Array<GmpRecommendationRecord & { lifecycleState: GmpRecommendationLifecycleState }>>;
  getRecommendationDetail: (recommendationId: string) => Promise<{
    recommendation: GmpRecommendationRecord;
    lifecycle: GmpRecommendationLifecycleEvent[];
    run: GmpRecommendationRun | null;
    attribution: GmpAttributionResult[];
  } | null>;
  listRuleCatalog: (projectId: string) => Promise<GmpRecommendationRuleCatalogEntry[]>;
  listAttribution: (input: { projectId: string; evidenceSnapshotId?: string }) => Promise<{ analysis: GmpAttributionAnalysis; results: GmpAttributionResult[] }[]>;
  listDecisionSupport: (input: { projectId: string; evidenceSnapshotId?: string }) => Promise<GmpDecisionSupportSummary[]>;
  getRecommendationHealth: (input: { projectId: string; evidenceSnapshotId?: string }) => Promise<Record<string, unknown>>;
  replayRecommendations: (input: {
    workspaceId: string;
    projectId: string;
    actorId: string;
    evidenceSnapshotId: string;
    ruleCatalogVersion: string;
    attributionVersion: string;
    replayOfRunId?: string;
  }) => Promise<{
    run: GmpRecommendationRun;
    replayDeterministicMatch?: boolean;
    recommendationCount: number;
  }>;
  reviewRecommendation: (input: {
    workspaceId: string;
    projectId: string;
    recommendationId: string;
    actorId: string;
    state: Extract<GmpRecommendationLifecycleState, "REVIEWED" | "ACCEPTED" | "REJECTED">;
    reason?: string;
  }) => Promise<GmpRecommendationLifecycleEvent>;
  dismissRecommendation: (input: {
    workspaceId: string;
    projectId: string;
    recommendationId: string;
    actorId: string;
    reason?: string;
  }) => Promise<GmpRecommendationLifecycleEvent>;
};

export function createGmpRecommendationServices(dependencies?: {
  projectRepository?: GmpRepository;
  evidenceRepository?: GmpEvidenceRepository;
  recommendationRepository?: GmpRecommendationRepository;
  attributionEvidenceService?: AttributionEvidenceService;
  attributionRuleService?: AttributionRuleService;
  attributionEngineService?: AttributionEngineService;
  recommendationCatalogService?: RecommendationCatalogService;
  recommendationEvaluationService?: RecommendationEvaluationService;
  recommendationEngineService?: RecommendationEngineService;
  decisionSupportService?: DecisionSupportService;
}): GmpRecommendationServices {
  const projectRepository = dependencies?.projectRepository ?? createPrismaGmpRepository();
  const evidenceRepository = dependencies?.evidenceRepository ?? createPrismaGmpEvidenceRepository();
  const recommendationRepository = dependencies?.recommendationRepository ?? createPrismaGmpRecommendationRepository();

  const attributionEvidenceService = dependencies?.attributionEvidenceService ?? createAttributionEvidenceService({ evidenceRepository });
  const attributionRuleService = dependencies?.attributionRuleService ?? createAttributionRuleService();
  const attributionEngineService = dependencies?.attributionEngineService ?? createAttributionEngineService({ attributionRuleService });
  const recommendationCatalogService = dependencies?.recommendationCatalogService ?? createRecommendationCatalogService({ recommendationRepository });
  const recommendationEvaluationService = dependencies?.recommendationEvaluationService ?? createRecommendationEvaluationService();
  const decisionSupportService = dependencies?.decisionSupportService ?? createDecisionSupportService({ recommendationRepository });

  const recommendationEngineService = dependencies?.recommendationEngineService ?? createRecommendationEngineService({
    recommendationRepository,
    evidenceRepository,
    attributionEvidenceService,
    attributionEngineService,
    recommendationCatalogService,
    recommendationEvaluationService,
    decisionSupportService,
  });

  async function ensureProject(projectId: string, workspaceId: string) {
    const project = await projectRepository.getProjectById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("Project not found in workspace.");
    }
    return project;
  }

  async function currentLifecycleState(recommendationId: string): Promise<GmpRecommendationLifecycleState> {
    const events = await recommendationRepository.listLifecycleEvents(recommendationId);
    const latest = [...events]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || lifecycleStateOrder(a.lifecycleState) - lifecycleStateOrder(b.lifecycleState))
      .at(-1);
    return latest?.lifecycleState ?? "NEW";
  }

  return {
    async compileRecommendations(input) {
      await ensureProject(input.projectId, input.workspaceId);

      return recommendationEngineService.compile({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        actorId: input.actorId,
        siteId: input.siteId,
        evidenceSnapshotId: input.evidenceSnapshotId,
        attributionWindowDays: input.attributionWindowDays,
        replayOfRunId: input.replayOfRunId,
        forceVersions: {
          ruleCatalogVersion: input.ruleCatalogVersion,
          attributionVersion: input.attributionVersion,
        },
      });
    },

    async listRecommendations(input) {
      const recommendations = await recommendationRepository.listRecommendations({
        projectId: input.projectId,
        evidenceSnapshotId: input.evidenceSnapshotId,
        limit: 200,
      });

      const hydrated = await Promise.all(recommendations.map(async (recommendation) => ({
        ...recommendation,
        lifecycleState: await currentLifecycleState(recommendation.recommendationId),
      })));

      return hydrated;
    },

    async getRecommendationDetail(recommendationId) {
      const recommendation = await recommendationRepository.getRecommendationById(recommendationId);
      if (!recommendation) return null;

      const [lifecycle, run, attribution] = await Promise.all([
        recommendationRepository.listLifecycleEvents(recommendationId),
        recommendationRepository.getRecommendationRunById(recommendation.recommendationRunId),
        recommendationRepository.listAttributionResults(recommendation.attributionAnalysisId),
      ]);

      return {
        recommendation,
        lifecycle,
        run,
        attribution,
      };
    },

    async listRuleCatalog(projectId) {
      return recommendationCatalogService.ensureCatalog(projectId);
    },

    async listAttribution(input) {
      const analyses = await recommendationRepository.listAttributionAnalyses({
        projectId: input.projectId,
        evidenceSnapshotId: input.evidenceSnapshotId,
        limit: 50,
      });

      const withResults = await Promise.all(analyses.map(async (analysis) => ({
        analysis,
        results: await recommendationRepository.listAttributionResults(analysis.attributionAnalysisId),
      })));

      return withResults;
    },

    async listDecisionSupport(input) {
      return recommendationRepository.listDecisionSummaries({
        projectId: input.projectId,
        evidenceSnapshotId: input.evidenceSnapshotId,
        limit: 100,
      });
    },

    async getRecommendationHealth(input) {
      const recommendations = await this.listRecommendations(input);
      const severityCounts = recommendations.reduce<Record<string, number>>((acc, recommendation) => {
        acc[recommendation.severity] = (acc[recommendation.severity] ?? 0) + 1;
        return acc;
      }, {});

      const stateCounts = recommendations.reduce<Record<string, number>>((acc, recommendation) => {
        acc[recommendation.lifecycleState] = (acc[recommendation.lifecycleState] ?? 0) + 1;
        return acc;
      }, {});

      const summaries = await recommendationRepository.listDecisionSummaries({
        projectId: input.projectId,
        evidenceSnapshotId: input.evidenceSnapshotId,
        summaryType: "HEALTH_SUMMARY",
        limit: 1,
      });

      return {
        recommendationCount: recommendations.length,
        severityCounts,
        stateCounts,
        latestHealthSummary: summaries[0] ?? null,
      };
    },

    async replayRecommendations(input) {
      await ensureProject(input.projectId, input.workspaceId);

      const compiled = await recommendationEngineService.compile({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        actorId: input.actorId,
        evidenceSnapshotId: input.evidenceSnapshotId,
        replayOfRunId: input.replayOfRunId,
        forceVersions: {
          ruleCatalogVersion: input.ruleCatalogVersion,
          attributionVersion: input.attributionVersion,
        },
      });

      return {
        run: compiled.run,
        replayDeterministicMatch: compiled.replayDeterministicMatch,
        recommendationCount: compiled.recommendations.length,
      };
    },

    async reviewRecommendation(input) {
      await ensureProject(input.projectId, input.workspaceId);

      const recommendation = await recommendationRepository.getRecommendationById(input.recommendationId);
      if (!recommendation || recommendation.projectId !== input.projectId || recommendation.workspaceId !== input.workspaceId) {
        throw new Error("Recommendation not found.");
      }

      return recommendationRepository.appendLifecycleEvent({
        recommendationId: recommendation.recommendationId,
        workspaceId: recommendation.workspaceId,
        projectId: recommendation.projectId,
        lifecycleState: input.state,
        actorId: input.actorId,
        reason: input.reason,
        metadata: {
          action: "review",
        },
      });
    },

    async dismissRecommendation(input) {
      await ensureProject(input.projectId, input.workspaceId);

      const recommendation = await recommendationRepository.getRecommendationById(input.recommendationId);
      if (!recommendation || recommendation.projectId !== input.projectId || recommendation.workspaceId !== input.workspaceId) {
        throw new Error("Recommendation not found.");
      }

      return recommendationRepository.appendLifecycleEvent({
        recommendationId: recommendation.recommendationId,
        workspaceId: recommendation.workspaceId,
        projectId: recommendation.projectId,
        lifecycleState: "DISMISSED",
        actorId: input.actorId,
        reason: input.reason,
        metadata: {
          action: "dismiss",
        },
      });
    },
  };
}
