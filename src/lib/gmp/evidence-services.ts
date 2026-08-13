import type { GmpAnalyticsCollection, GmpAnalyticsObservation, GmpMetricDefinition } from "./analytics-models";
import { createPrismaGmpAnalyticsRepository, type GmpAnalyticsRepository } from "./analytics-repository";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import { createPrismaGmpPublishingRepository, type GmpPublishingRepository } from "./publishing-repository";
import {
  createEvidenceChecksum,
  createEvidenceInputFingerprint,
  createEvidenceSnapshotLabel,
  defaultCompilerVersionSet,
  gmpCanonicalMetricCatalog,
  type GmpCanonicalMetricCatalogEntry,
  type GmpEvidenceCompiledMetric,
  type GmpEvidenceCompilerRun,
  type GmpEvidenceCompilerVersionSet,
  type GmpEvidenceConfidenceLevel,
  type GmpEvidenceDataQualityStatus,
  type GmpEvidencePublicationReference,
  type GmpEvidenceSnapshot,
  type GmpEvidenceSnapshotCadence,
  type GmpEvidenceValidationIssue,
} from "./evidence-models";
import { createPrismaGmpEvidenceRepository, type GmpEvidenceRepository } from "./evidence-repository";

function nowIso(): string {
  return new Date().toISOString();
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function dayStartIso(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

function cadenceFromRange(periodStart: string, periodEnd: string): GmpEvidenceSnapshotCadence {
  const spanMs = Math.max(0, Date.parse(periodEnd) - Date.parse(periodStart));
  const days = spanMs / (24 * 60 * 60 * 1000);
  if (days <= 2) return "DAILY";
  if (days <= 14) return "WEEKLY";
  return "MONTHLY";
}

function confidenceFromStats(input: {
  acceptedCount: number;
  rejectedCount: number;
  publicationMatches: number;
  sourceAgreement: number;
}): GmpEvidenceConfidenceLevel {
  if (input.acceptedCount === 0) return "UNKNOWN";
  const rejectionRate = input.rejectedCount / Math.max(1, input.acceptedCount + input.rejectedCount);
  if (input.publicationMatches > 0 && input.sourceAgreement >= 2 && rejectionRate <= 0.05) return "HIGH";
  if (input.publicationMatches > 0 && rejectionRate <= 0.25) return "MEDIUM";
  return rejectionRate > 0.5 ? "LOW" : "MEDIUM";
}

function qualityFromStats(input: {
  acceptedCount: number;
  rejectedCount: number;
  hasUnsupported: boolean;
  periodEnd: string;
}): GmpEvidenceDataQualityStatus {
  if (input.acceptedCount === 0 && input.rejectedCount === 0) return "UNRESOLVED";
  if (input.acceptedCount === 0) return "INVALID";
  if (input.hasUnsupported) return "UNSUPPORTED";

  const ageDays = (Date.now() - Date.parse(input.periodEnd)) / (24 * 60 * 60 * 1000);
  if (ageDays > 35) return "STALE";

  if (input.rejectedCount > 0) return "PARTIAL";
  return "VALID";
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeBusinessGenomePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        normalized[key] = trimmed;
      }
      continue;
    }

    if (Array.isArray(value)) {
      normalized[key] = value.map((entry) => (typeof entry === "string" ? entry.trim() : entry)).filter((entry) => entry !== "");
      continue;
    }

    if (typeof value === "object") {
      normalized[key] = normalizeBusinessGenomePayload(safeRecord(value));
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

export function deriveBgeConfidenceFromEvidenceSignals(input: {
  evidenceCount: number;
  sourceAgreement?: number;
  publicationMatches?: number;
}): {
  confidenceScore: number;
  confidenceLevel: string;
  confidenceVersion: string;
} {
  const evidenceCount = Math.max(0, input.evidenceCount ?? 0);
  const sourceAgreement = Math.max(0, Math.min(3, input.sourceAgreement ?? 1));
  const publicationMatches = Math.max(0, input.publicationMatches ?? 0);

  const score = Math.min(1, Math.max(0,
    (evidenceCount > 0 ? 0.45 : 0)
    + (sourceAgreement * 0.2)
    + (publicationMatches > 0 ? 0.15 : 0)
    + (sourceAgreement >= 2 && publicationMatches > 0 ? 0.2 : 0),
  ));

  let confidenceLevel: string = "LOW";
  if (score >= 0.8) confidenceLevel = "HIGH";
  else if (score >= 0.5) confidenceLevel = "MEDIUM";

  return {
    confidenceScore: Number(score.toFixed(2)),
    confidenceLevel,
    confidenceVersion: "gmp-bge-confidence/v1",
  };
}

type CanonicalMetricPoint = {
  canonicalMetricKey: string;
  analyticsObservationId: string;
  value: number;
  measuredAt: string;
};

export type CompilerValidationService = {
  validate: (input: {
    observations: GmpAnalyticsObservation[];
    collectionsById: Map<string, GmpAnalyticsCollection>;
    periodStart: string;
    periodEnd: string;
  }) => {
    accepted: GmpAnalyticsObservation[];
    rejected: GmpAnalyticsObservation[];
    issues: GmpEvidenceValidationIssue[];
  };
};

export type ObservationNormalizationService = {
  normalize: (observations: GmpAnalyticsObservation[]) => {
    points: CanonicalMetricPoint[];
    unsupportedObservationIds: string[];
  };
};

export type MetricCompilationService = {
  compile: (input: {
    projectId: string;
    siteId?: string;
    points: CanonicalMetricPoint[];
    qualityStatus: GmpEvidenceDataQualityStatus;
    confidence: GmpEvidenceConfidenceLevel;
    compilerVersion: string;
    metricDefinitions: GmpMetricDefinition[];
  }) => {
    compiled: Array<Omit<GmpEvidenceCompiledMetric, "evidenceCompiledMetricId" | "evidenceSnapshotId" | "createdAt">>;
    enrichedMetricDefinitions: GmpMetricDefinition[];
  };
};

export type PublicationCorrelationService = {
  correlate: (input: {
    projectId: string;
    siteId?: string;
    observations: GmpAnalyticsObservation[];
    publications: Array<{ publicationRecordId: string; externalUrl: string; publishedStatus: string; publishedAt?: string | null; updatedAt: string; externalObjectId: string }>;
  }) => Array<Omit<GmpEvidencePublicationReference, "evidencePublicationReferenceId" | "evidenceSnapshotId" | "createdAt">>;
};

export type SnapshotCompilationService = {
  buildPayload: (input: {
    projectId: string;
    siteId?: string;
    periodStart: string;
    periodEnd: string;
    cadence: GmpEvidenceSnapshotCadence;
    versions: GmpEvidenceCompilerVersionSet;
    qualityStatus: GmpEvidenceDataQualityStatus;
    confidence: GmpEvidenceConfidenceLevel;
    observationIds: string[];
    rejectedObservationIds: string[];
    compiledMetrics: Array<Omit<GmpEvidenceCompiledMetric, "evidenceCompiledMetricId" | "evidenceSnapshotId" | "createdAt">>;
    publicationReferences: Array<Omit<GmpEvidencePublicationReference, "evidencePublicationReferenceId" | "evidenceSnapshotId" | "createdAt">>;
  }) => {
    checksum: string;
    label: string;
  };
};

export function createCompilerValidationService(): CompilerValidationService {
  const supportedDimensions = new Set(["date", "query", "page", "country", "device", "canonicalurl", "publicationstatus", "publicationtimestamp", "remotepostid"]);
  const supportedMetrics = new Set(["impressions", "clicks", "ctr", "average_position", "position", "sessions", "users", "engaged_sessions", "engagement_time", "engagement_rate", "conversions", "publication_status"]);

  return {
    validate(input) {
      const accepted: GmpAnalyticsObservation[] = [];
      const rejected: GmpAnalyticsObservation[] = [];
      const issues: GmpEvidenceValidationIssue[] = [];
      const identitySet = new Set<string>();

      for (const observation of input.observations) {
        const collection = input.collectionsById.get(observation.analyticsCollectionId);
        const issueCodes: string[] = [];

        if (!collection) issueCodes.push("collection_lineage_missing");
        if (!observation.analyticsObservationId || !observation.sourceRecordIdentity || !observation.observationKey) issueCodes.push("required_field_missing");
        if (!isIsoDate(observation.sourceTimestamp) || !isIsoDate(observation.observedAt)) issueCodes.push("timestamp_invalid");
        if (observation.observedAt < input.periodStart || observation.observedAt > input.periodEnd) issueCodes.push("outside_period");

        const identity = `${observation.analyticsSourceId}|${observation.sourceRecordIdentity}|${observation.sourceTimestamp}|${observation.rawPayloadChecksum}`;
        if (identitySet.has(identity)) {
          issueCodes.push("duplicate_identity");
        } else {
          identitySet.add(identity);
        }

        if (!collection?.adapterVersion?.trim()) issueCodes.push("adapter_version_missing");
        if (!Number.isFinite(observation.rawValue)) issueCodes.push("observation_integrity_invalid_raw_value");

        if (observation.rawPayload) {
          const checksumCandidates = [
            createEvidenceChecksum(observation.rawPayload),
            createEvidenceChecksum({
              sourceRecordIdentity: observation.sourceRecordIdentity,
              sourceTimestamp: observation.sourceTimestamp,
              rawPayload: observation.rawPayload,
            }),
            createEvidenceChecksum({
              dimensions: observation.dimensions,
              metrics: observation.metrics,
              rawPayload: observation.rawPayload,
              observationKey: observation.observationKey,
              rawValue: observation.rawValue,
              unit: observation.unit,
            }),
          ];

          if (!checksumCandidates.includes(observation.rawPayloadChecksum)) {
            issueCodes.push("payload_checksum_mismatch");
          }
        }

        const dimensions = Object.keys(observation.dimensions ?? {}).map((key) => key.toLowerCase());
        const unsupportedDimensions = dimensions.filter((entry) => !supportedDimensions.has(entry));
        if (unsupportedDimensions.length > 0) {
          issues.push({
            analyticsObservationId: observation.analyticsObservationId,
            code: "unsupported_dimension",
            detail: `Observation ${observation.analyticsObservationId} includes non-canonical dimensions: ${unsupportedDimensions.join(",")}.`,
          });
        }

        const metricKeys = new Set<string>([
          observation.observationKey.toLowerCase(),
          ...Object.keys(observation.metrics ?? {}).map((key) => key.toLowerCase()),
        ]);
        if ([...metricKeys].every((entry) => !supportedMetrics.has(entry))) {
          issueCodes.push("unsupported_metric");
        }

        if (issueCodes.length > 0) {
          rejected.push(observation);
          issueCodes.forEach((code) => issues.push({
            analyticsObservationId: observation.analyticsObservationId,
            code,
            detail: `Observation ${observation.analyticsObservationId} failed ${code}.`,
          }));
          continue;
        }

        accepted.push(observation);
      }

      return { accepted, rejected, issues };
    },
  };
}

export function createObservationNormalizationService(): ObservationNormalizationService {
  const canonicalBySourceMetric = new Map<string, string>();
  gmpCanonicalMetricCatalog.forEach((entry) => {
    entry.sourceMetrics.forEach((sourceMetric) => canonicalBySourceMetric.set(sourceMetric, entry.canonicalMetricKey));
  });

  return {
    normalize(observations) {
      const points: CanonicalMetricPoint[] = [];
      const unsupportedObservationIds: string[] = [];
      const seen = new Set<string>();

      for (const observation of observations) {
        const values = new Map<string, number>();
        values.set(observation.observationKey.toLowerCase(), observation.rawValue);

        Object.entries(observation.metrics ?? {}).forEach(([key, value]) => {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) values.set(key.toLowerCase(), numeric);
        });

        let mapped = false;
        values.forEach((value, sourceMetric) => {
          const canonicalMetricKey = canonicalBySourceMetric.get(sourceMetric);
          if (!canonicalMetricKey) return;

          const dedupe = `${observation.analyticsObservationId}|${canonicalMetricKey}`;
          if (seen.has(dedupe)) return;
          seen.add(dedupe);

          mapped = true;
          points.push({
            canonicalMetricKey,
            analyticsObservationId: observation.analyticsObservationId,
            value,
            measuredAt: observation.observedAt,
          });
        });

        if (!mapped) unsupportedObservationIds.push(observation.analyticsObservationId);
      }

      return { points, unsupportedObservationIds };
    },
  };
}

export function createMetricCompilationService(): MetricCompilationService {
  function resolveCatalogEntry(metricKey: string): GmpCanonicalMetricCatalogEntry {
    return gmpCanonicalMetricCatalog.find((entry) => entry.canonicalMetricKey === metricKey) ?? {
      canonicalMetricKey: metricKey,
      displayName: metricKey,
      unit: "count",
      valueType: "NUMBER",
      aggregationMethod: "SUM",
      precisionScale: 4,
      sourceMetrics: [metricKey],
    };
  }

  return {
    compile(input) {
      const grouped = new Map<string, CanonicalMetricPoint[]>();
      input.points.forEach((point) => {
        const bucket = grouped.get(point.canonicalMetricKey) ?? [];
        bucket.push(point);
        grouped.set(point.canonicalMetricKey, bucket);
      });

      const compiled: Array<Omit<GmpEvidenceCompiledMetric, "evidenceCompiledMetricId" | "evidenceSnapshotId" | "createdAt">> = [];
      const metricDefinitions = [...input.metricDefinitions];
      const metricDefinitionByKey = new Map(metricDefinitions.map((entry) => [entry.metricKey, entry]));

      [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([canonicalMetricKey, points]) => {
          const catalog = resolveCatalogEntry(canonicalMetricKey);
          const total = points.reduce((sum, item) => sum + item.value, 0);
          const value = catalog.aggregationMethod === "AVERAGE"
            ? (points.length === 0 ? 0 : total / points.length)
            : total;

          let metricDefinition = metricDefinitionByKey.get(canonicalMetricKey);
          if (!metricDefinition) {
            const now = nowIso();
            metricDefinition = {
              metricDefinitionId: "pending",
              projectId: input.projectId,
              metricKey: canonicalMetricKey,
              displayName: catalog.displayName,
              description: `Canonical metric ${catalog.displayName}`,
              unit: catalog.unit,
              aggregationMethod: catalog.aggregationMethod,
              valueType: catalog.valueType,
              precisionScale: catalog.precisionScale,
              defaultMetric: false,
              active: true,
              metadata: { compilerManaged: true },
              createdAt: now,
              updatedAt: now,
            };
            metricDefinitions.push(metricDefinition);
            metricDefinitionByKey.set(metricDefinition.metricKey, metricDefinition);
          }

          compiled.push({
            projectId: input.projectId,
            siteId: input.siteId,
            metricDefinitionId: metricDefinition.metricDefinitionId === "pending" ? undefined : metricDefinition.metricDefinitionId,
            canonicalMetricKey,
            displayName: catalog.displayName,
            unit: catalog.unit,
            valueType: catalog.valueType,
            aggregationMethod: catalog.aggregationMethod,
            precisionScale: catalog.precisionScale,
            compiledValue: Number(value.toFixed(6)),
            dataQualityStatus: input.qualityStatus,
            evidenceConfidence: input.confidence,
            compilerVersion: input.compilerVersion,
            sourceObservationIds: points.map((entry) => entry.analyticsObservationId),
            lineageFingerprint: createEvidenceChecksum({
              metric: canonicalMetricKey,
              observations: points.map((entry) => entry.analyticsObservationId).sort(),
              values: points.map((entry) => entry.value),
            }),
            metadata: {
              pointCount: points.length,
            },
          });
        });

      const sessions = compiled.find((entry) => entry.canonicalMetricKey === "sessions")?.compiledValue ?? 0;
      const engagedSessions = compiled.find((entry) => entry.canonicalMetricKey === "engaged_sessions")?.compiledValue ?? 0;
      if (sessions > 0) {
        const engagementRate = Number((engagedSessions / sessions).toFixed(6));
        const catalog = resolveCatalogEntry("engagement_rate");
        compiled.push({
          projectId: input.projectId,
          siteId: input.siteId,
          metricDefinitionId: metricDefinitionByKey.get("engagement_rate")?.metricDefinitionId,
          canonicalMetricKey: "engagement_rate",
          displayName: catalog.displayName,
          unit: catalog.unit,
          valueType: catalog.valueType,
          aggregationMethod: catalog.aggregationMethod,
          precisionScale: catalog.precisionScale,
          compiledValue: engagementRate,
          dataQualityStatus: input.qualityStatus,
          evidenceConfidence: input.confidence,
          compilerVersion: input.compilerVersion,
          sourceObservationIds: [],
          lineageFingerprint: createEvidenceChecksum({ metric: "engagement_rate", sessions, engagedSessions }),
          metadata: { derived: true },
        });
      }

      return {
        compiled: compiled.sort((a, b) => a.canonicalMetricKey.localeCompare(b.canonicalMetricKey)),
        enrichedMetricDefinitions: metricDefinitions,
      };
    },
  };
}

export function createPublicationCorrelationService(): PublicationCorrelationService {
  return {
    correlate(input) {
      const byUrl = new Map<string, string[]>();
      const byRemotePostId = new Map<string, string[]>();

      input.observations.forEach((observation) => {
        const dimensions = safeRecord(observation.dimensions);
        const canonicalUrl = typeof dimensions.canonicalUrl === "string" ? normalizeUrl(dimensions.canonicalUrl) : "";
        if (canonicalUrl) {
          const bucket = byUrl.get(canonicalUrl) ?? [];
          bucket.push(observation.analyticsObservationId);
          byUrl.set(canonicalUrl, bucket);
        }

        const remotePostId = dimensions.remotePostId == null ? "" : String(dimensions.remotePostId);
        if (remotePostId) {
          const bucket = byRemotePostId.get(remotePostId) ?? [];
          bucket.push(observation.analyticsObservationId);
          byRemotePostId.set(remotePostId, bucket);
        }
      });

      return input.publications
        .map((publication) => {
          const urlKey = normalizeUrl(publication.externalUrl ?? "");
          const urlMatches = urlKey ? (byUrl.get(urlKey) ?? []) : [];
          const remoteMatches = publication.externalObjectId ? (byRemotePostId.get(publication.externalObjectId) ?? []) : [];
          const merged = [...new Set([...urlMatches, ...remoteMatches])].sort();

          const correlationQuality: GmpEvidencePublicationReference["correlationQuality"] = merged.length > 5
            ? "HIGH"
            : merged.length > 0
              ? "MEDIUM"
              : "LOW";

          return {
            projectId: input.projectId,
            siteId: input.siteId,
            publicationRecordId: publication.publicationRecordId,
            publicationIdentity: publication.externalObjectId || publication.publicationRecordId,
            canonicalUrl: publication.externalUrl,
            publicationStatus: publication.publishedStatus,
            publicationTimestamp: publication.publishedAt ?? publication.updatedAt,
            correlationQuality,
            matchedObservationIds: merged,
            lineageFingerprint: createEvidenceChecksum({
              publicationRecordId: publication.publicationRecordId,
              matchedObservationIds: merged,
            }),
            metadata: {
              publishedStatus: publication.publishedStatus,
            },
          };
        })
        .sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl));
    },
  };
}

export function createSnapshotCompilationService(): SnapshotCompilationService {
  return {
    buildPayload(input) {
      const deterministicPayload = {
        cadence: input.cadence,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        versions: input.versions,
        qualityStatus: input.qualityStatus,
        confidence: input.confidence,
        sourceObservationIds: [...input.observationIds].sort(),
        rejectedObservationIds: [...input.rejectedObservationIds].sort(),
        metrics: input.compiledMetrics
          .map((metric) => ({
            key: metric.canonicalMetricKey,
            value: metric.compiledValue,
            obs: [...metric.sourceObservationIds].sort(),
            lineage: metric.lineageFingerprint,
          }))
          .sort((a, b) => a.key.localeCompare(b.key)),
        publications: input.publicationReferences
          .map((publication) => ({
            publicationRecordId: publication.publicationRecordId,
            canonicalUrl: publication.canonicalUrl,
            matchedObservationIds: [...publication.matchedObservationIds].sort(),
            lineage: publication.lineageFingerprint,
          }))
          .sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl)),
      };

      return {
        checksum: createEvidenceChecksum(deterministicPayload),
        label: createEvidenceSnapshotLabel(input.cadence, input.periodStart, input.periodEnd),
      };
    },
  };
}

export type GmpEvidenceServices = {
  listSnapshots: (projectId: string) => Promise<GmpEvidenceSnapshot[]>;
  getSnapshotDetail: (evidenceSnapshotId: string) => Promise<{
    snapshot: GmpEvidenceSnapshot;
    metrics: GmpEvidenceCompiledMetric[];
    publications: GmpEvidencePublicationReference[];
    compilerRun: GmpEvidenceCompilerRun | null;
  } | null>;
  listMetrics: (input: { projectId: string; evidenceSnapshotId?: string }) => Promise<GmpEvidenceCompiledMetric[]>;
  listPublications: (input: { projectId: string; evidenceSnapshotId?: string }) => Promise<GmpEvidencePublicationReference[]>;
  listCompilerRuns: (projectId: string) => Promise<GmpEvidenceCompilerRun[]>;
  listMetricCatalog: (projectId: string) => Promise<GmpMetricDefinition[]>;
  recompileEvidence: (input: {
    workspaceId: string;
    projectId: string;
    actorId: string;
    siteId?: string;
    periodStart?: string;
    periodEnd?: string;
    cadence?: GmpEvidenceSnapshotCadence;
    replayOfRunId?: string;
  }) => Promise<{
    run: GmpEvidenceCompilerRun;
    snapshot: GmpEvidenceSnapshot;
    metrics: GmpEvidenceCompiledMetric[];
    publications: GmpEvidencePublicationReference[];
    replayDeterministicMatch?: boolean;
  }>;
};

export function createGmpEvidenceServices(dependencies?: {
  projectRepository?: GmpRepository;
  analyticsRepository?: GmpAnalyticsRepository;
  publishingRepository?: GmpPublishingRepository;
  evidenceRepository?: GmpEvidenceRepository;
  compilerValidationService?: CompilerValidationService;
  normalizationService?: ObservationNormalizationService;
  metricCompilationService?: MetricCompilationService;
  publicationCorrelationService?: PublicationCorrelationService;
  snapshotCompilationService?: SnapshotCompilationService;
}): GmpEvidenceServices {
  const projectRepository = dependencies?.projectRepository ?? createPrismaGmpRepository();
  const analyticsRepository = dependencies?.analyticsRepository ?? createPrismaGmpAnalyticsRepository();
  const publishingRepository = dependencies?.publishingRepository ?? createPrismaGmpPublishingRepository();
  const evidenceRepository = dependencies?.evidenceRepository ?? createPrismaGmpEvidenceRepository();

  const compilerValidationService = dependencies?.compilerValidationService ?? createCompilerValidationService();
  const normalizationService = dependencies?.normalizationService ?? createObservationNormalizationService();
  const metricCompilationService = dependencies?.metricCompilationService ?? createMetricCompilationService();
  const publicationCorrelationService = dependencies?.publicationCorrelationService ?? createPublicationCorrelationService();
  const snapshotCompilationService = dependencies?.snapshotCompilationService ?? createSnapshotCompilationService();

  const versions = defaultCompilerVersionSet();

  return {
    async listSnapshots(projectId) {
      return evidenceRepository.listEvidenceSnapshotsForProject(projectId, 100);
    },

    async getSnapshotDetail(evidenceSnapshotId) {
      const snapshot = await evidenceRepository.getEvidenceSnapshotById(evidenceSnapshotId);
      if (!snapshot) return null;

      const [metrics, publications, runs] = await Promise.all([
        evidenceRepository.listCompiledMetrics({ projectId: snapshot.projectId, evidenceSnapshotId, limit: 500 }),
        evidenceRepository.listPublicationReferences({ projectId: snapshot.projectId, evidenceSnapshotId, limit: 500 }),
        evidenceRepository.listCompilerRunsForProject(snapshot.projectId, 200),
      ]);
      const compilerRun = runs.find((entry) => entry.evidenceSnapshotId === evidenceSnapshotId) ?? null;

      return { snapshot, metrics, publications, compilerRun };
    },

    async listMetrics(input) {
      return evidenceRepository.listCompiledMetrics({ ...input, limit: 200 });
    },

    async listPublications(input) {
      return evidenceRepository.listPublicationReferences({ ...input, limit: 200 });
    },

    async listCompilerRuns(projectId) {
      return evidenceRepository.listCompilerRunsForProject(projectId, 100);
    },

    async listMetricCatalog(projectId) {
      const existing = await analyticsRepository.listMetricDefinitionsForProject(projectId);
      if (existing.length > 0) return existing;

      const now = nowIso();
      const created: GmpMetricDefinition[] = [];
      for (const entry of gmpCanonicalMetricCatalog) {
        created.push(await analyticsRepository.upsertMetricDefinition({
          projectId,
          metricKey: entry.canonicalMetricKey,
          displayName: entry.displayName,
          description: `Canonical evidence metric ${entry.displayName}`,
          unit: entry.unit,
          aggregationMethod: entry.aggregationMethod,
          valueType: entry.valueType,
          precisionScale: entry.precisionScale,
          defaultMetric: false,
          active: true,
          metadata: {
            metricCatalogVersion: versions.metricCatalogVersion,
            createdAt: now,
          },
        }));
      }
      return created;
    },

    async recompileEvidence(input) {
      const project = await projectRepository.getProjectById(input.projectId);
      if (!project || project.workspaceId !== input.workspaceId) {
        throw new Error("Project not found in workspace.");
      }

      const periodEnd = input.periodEnd && isIsoDate(input.periodEnd) ? input.periodEnd : nowIso();
      const periodStart = input.periodStart && isIsoDate(input.periodStart)
        ? input.periodStart
        : dayStartIso(new Date(Date.parse(periodEnd) - (7 * 24 * 60 * 60 * 1000)));
      const cadence = input.cadence ?? cadenceFromRange(periodStart, periodEnd);

      const collections = (await analyticsRepository.listCollectionsForProject(input.projectId))
        .filter((entry) => !input.siteId || entry.siteId === input.siteId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const collectionsById = new Map(collections.map((entry) => [entry.analyticsCollectionId, entry]));

      const observationBuckets = await Promise.all(
        collections.map(async (collection) => analyticsRepository.listObservationsForCollection(collection.analyticsCollectionId)),
      );
      const observations = observationBuckets
        .flat()
        .filter((entry) => entry.observedAt >= periodStart && entry.observedAt <= periodEnd)
        .sort((a, b) => (
          a.observedAt.localeCompare(b.observedAt)
          || a.analyticsObservationId.localeCompare(b.analyticsObservationId)
        ));

      const runInputFingerprint = createEvidenceInputFingerprint({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        siteId: input.siteId ?? null,
        periodStart,
        periodEnd,
        cadence,
        observationIds: observations.map((entry) => entry.analyticsObservationId),
        versions,
      });

      let run = await evidenceRepository.createCompilerRun({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        siteId: input.siteId,
        replayOfRunId: input.replayOfRunId,
        runStatus: "RUNNING",
        triggerType: input.replayOfRunId ? "REPLAY" : "MANUAL",
        cadence,
        periodStart,
        periodEnd,
        compilerVersion: versions.compilerVersion,
        normalizationVersion: versions.normalizationVersion,
        metricCatalogVersion: versions.metricCatalogVersion,
        correlationVersion: versions.correlationVersion,
        snapshotVersion: versions.snapshotVersion,
        validationVersion: versions.validationVersion,
        inputFingerprint: runInputFingerprint,
        outputChecksum: undefined,
        evidenceSnapshotId: undefined,
        observationCount: observations.length,
        rejectedObservationCount: 0,
        compiledMetricCount: 0,
        publicationReferenceCount: 0,
        qualityStatus: "UNRESOLVED",
        confidenceStatus: "UNKNOWN",
        metadata: { actorId: input.actorId },
      });

      try {
        const compilerVersion = await analyticsRepository.upsertEvidenceCompilerVersion({
          projectId: input.projectId,
          compilerName: "gmp-evidence-compiler",
          compilerVersion: versions.compilerVersion,
          normalizationVersion: versions.normalizationVersion,
          metricCatalogVersion: versions.metricCatalogVersion,
          correlationVersion: versions.correlationVersion,
          snapshotVersion: versions.snapshotVersion,
          validationVersion: versions.validationVersion,
          releasedAt: null,
          metadata: { stage: "enterprise-evidence-compiler" },
        });

        const validation = compilerValidationService.validate({
          observations,
          collectionsById,
          periodStart,
          periodEnd,
        });

        const normalized = normalizationService.normalize(validation.accepted);
        const qualityStatus = qualityFromStats({
          acceptedCount: validation.accepted.length,
          rejectedCount: validation.rejected.length,
          hasUnsupported: normalized.unsupportedObservationIds.length > 0,
          periodEnd,
        });

        const publicationRecords = await publishingRepository.listPublicationRecordsForProject(input.projectId, 500);
        const publicationReferencesDraft = publicationCorrelationService.correlate({
          projectId: input.projectId,
          siteId: input.siteId,
          observations: validation.accepted,
          publications: publicationRecords.map((entry) => ({
            publicationRecordId: entry.publicationRecordId,
            externalUrl: entry.externalUrl,
            publishedStatus: entry.publishedStatus,
            publishedAt: entry.publishedAt,
            updatedAt: entry.updatedAt,
            externalObjectId: entry.externalObjectId,
          })),
        });

        const confidence = confidenceFromStats({
          acceptedCount: validation.accepted.length,
          rejectedCount: validation.rejected.length,
          publicationMatches: publicationReferencesDraft.filter((entry) => entry.matchedObservationIds.length > 0).length,
          sourceAgreement: new Set(validation.accepted.map((entry) => entry.analyticsSourceId)).size,
        });

        const metricCatalog = await this.listMetricCatalog(input.projectId);
        const compiledResult = metricCompilationService.compile({
          projectId: input.projectId,
          siteId: input.siteId,
          points: normalized.points,
          qualityStatus,
          confidence,
          compilerVersion: compilerVersion.compilerVersion,
          metricDefinitions: metricCatalog,
        });

        for (const metricDefinition of compiledResult.enrichedMetricDefinitions) {
          if (metricDefinition.metricDefinitionId === "pending") {
            const upserted = await analyticsRepository.upsertMetricDefinition({
              ...metricDefinition,
              metricDefinitionId: undefined,
            });
            metricDefinition.metricDefinitionId = upserted.metricDefinitionId;
          }
        }

        const materializedCompiled = compiledResult.compiled.map((entry) => ({
          ...entry,
          metricDefinitionId: entry.metricDefinitionId ?? compiledResult.enrichedMetricDefinitions.find((definition) => definition.metricKey === entry.canonicalMetricKey)?.metricDefinitionId,
        }));

        const snapshotPayload = snapshotCompilationService.buildPayload({
          projectId: input.projectId,
          siteId: input.siteId,
          periodStart,
          periodEnd,
          cadence,
          versions,
          qualityStatus,
          confidence,
          observationIds: validation.accepted.map((entry) => entry.analyticsObservationId),
          rejectedObservationIds: validation.rejected.map((entry) => entry.analyticsObservationId),
          compiledMetrics: materializedCompiled,
          publicationReferences: publicationReferencesDraft,
        });

        const snapshotRecord = await analyticsRepository.createSnapshot({
          projectId: input.projectId,
          siteId: input.siteId,
          snapshotStatus: "READY",
          snapshotLabel: snapshotPayload.label,
          snapshotWindowStart: periodStart,
          snapshotWindowEnd: periodEnd,
          totalMetrics: materializedCompiled.length,
          baselineScore: undefined,
          trendDelta: undefined,
          metadata: {
            evidence: {
              qualityStatus,
              confidence,
              checksum: snapshotPayload.checksum,
              compilerVersion: versions.compilerVersion,
            },
          },
        });

        const evidenceSnapshot = await evidenceRepository.createEvidenceSnapshot({
          performanceSnapshotId: snapshotRecord.performanceSnapshotId,
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          siteId: input.siteId,
          cadence,
          periodStart,
          periodEnd,
          compilerVersion: versions.compilerVersion,
          normalizationVersion: versions.normalizationVersion,
          metricCatalogVersion: versions.metricCatalogVersion,
          correlationVersion: versions.correlationVersion,
          snapshotVersion: versions.snapshotVersion,
          validationVersion: versions.validationVersion,
          dataQualityStatus: qualityStatus,
          evidenceConfidence: confidence,
          snapshotChecksum: snapshotPayload.checksum,
          sourceObservationCount: validation.accepted.length,
          rejectedObservationCount: validation.rejected.length,
          metadata: {
            validationIssueCount: validation.issues.length,
            unsupportedObservationIds: normalized.unsupportedObservationIds,
          },
        });

        const compiledMetrics = await Promise.all(materializedCompiled.map((entry) => evidenceRepository.createCompiledMetric({
          ...entry,
          evidenceSnapshotId: evidenceSnapshot.evidenceSnapshotId,
        })));

        const publicationReferences = await Promise.all(publicationReferencesDraft.map((entry) => evidenceRepository.createPublicationReference({
          ...entry,
          evidenceSnapshotId: evidenceSnapshot.evidenceSnapshotId,
        })));

        for (const metric of compiledMetrics) {
          await analyticsRepository.createMeasurementLineage({
            projectId: input.projectId,
            analyticsSourceId: "gmp-evidence-compiler",
            analyticsCollectionId: undefined,
            analyticsObservationId: metric.sourceObservationIds[0],
            normalizedMetricId: undefined,
            performanceSnapshotId: snapshotRecord.performanceSnapshotId,
            lineageStage: "SNAPSHOT",
            evidenceCompilerVersion: versions.compilerVersion,
            lineageFingerprint: metric.lineageFingerprint,
            metadata: {
              evidenceSnapshotId: evidenceSnapshot.evidenceSnapshotId,
              canonicalMetricKey: metric.canonicalMetricKey,
            },
          });
        }

        let replayDeterministicMatch: boolean | undefined;
        if (input.replayOfRunId) {
          const priorRun = await evidenceRepository.getCompilerRunById(input.replayOfRunId);
          replayDeterministicMatch = Boolean(priorRun?.outputChecksum && priorRun.outputChecksum === snapshotPayload.checksum);
        }

        run = (await evidenceRepository.updateCompilerRun(run.evidenceCompilerRunId, {
          runStatus: "COMPLETED",
          evidenceSnapshotId: evidenceSnapshot.evidenceSnapshotId,
          outputChecksum: snapshotPayload.checksum,
          rejectedObservationCount: validation.rejected.length,
          compiledMetricCount: compiledMetrics.length,
          publicationReferenceCount: publicationReferences.length,
          qualityStatus,
          confidenceStatus: confidence,
          metadata: {
            actorId: input.actorId,
            validationIssueCount: validation.issues.length,
            replayDeterministicMatch,
          },
        })) ?? run;

        return {
          run,
          snapshot: evidenceSnapshot,
          metrics: compiledMetrics,
          publications: publicationReferences,
          replayDeterministicMatch,
        };
      } catch (error) {
        await evidenceRepository.updateCompilerRun(run.evidenceCompilerRunId, {
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
