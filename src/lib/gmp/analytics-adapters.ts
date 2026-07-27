import { stableAnalyticsFingerprint, type GmpAnalyticsErrorCategory, type GmpAnalyticsObservation, type GmpAnalyticsSource } from "./analytics-models";

const secretKeys = [
  "token",
  "password",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "refresh_token",
  "client_secret",
  "private_key",
  "service_account",
  "bearer",
];

export type GmpAnalyticsAdapterHealth = {
  status: "HEALTHY" | "DEGRADED" | "OFFLINE";
  latencyMs: number;
  checkedAt: string;
  notes: string[];
};

export type GmpAnalyticsSourceDescription = {
  adapterKey: string;
  adapterVersion: string;
  sourceType: string;
  displayName: string;
  requiredCredentials: boolean;
};

export type GmpAnalyticsConnectionValidation = {
  ok: boolean;
  blockingIssues: string[];
  warnings: string[];
  providerIdentity?: string;
  adapterVersion: string;
  validatedAt: string;
};

export type GmpAnalyticsCapabilityDetection = {
  capabilities: string[];
  adapterVersion: string;
  detectedAt: string;
  warnings: string[];
};

export type GmpAnalyticsCollectionPayload = {
  sourceRecordIdentity: string;
  observationType: string;
  sourceTimestamp: string;
  observationPeriodStart?: string;
  observationPeriodEnd?: string;
  dimensions: Record<string, unknown>;
  metrics: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  providerBatchId?: string;
  observationKey: string;
  rawValue: number;
  unit: string;
  confidenceScore?: number;
};

export type GmpAnalyticsCollectionPage = {
  observations: GmpAnalyticsCollectionPayload[];
  nextCursor?: Record<string, unknown>;
  complete: boolean;
  partial: boolean;
  warnings: string[];
  providerRequestId?: string;
  providerBatchId?: string;
};

export type GmpAnalyticsAdapterError = {
  category: GmpAnalyticsErrorCategory;
  summary: string;
  retryable: boolean;
  recommendedAction: string;
  providerStatusCode?: number;
  adapterKey: string;
  adapterVersion: string;
  redacted: boolean;
};

export type GmpAnalyticsSourceAdapter = {
  adapterKey: string;
  adapterVersion: string;
  sourceType: string;
  requiredOutputs: string[];
  describeSource: (source: GmpAnalyticsSource) => Promise<GmpAnalyticsSourceDescription>;
  validateConnection: (source: GmpAnalyticsSource, credential?: Record<string, unknown>) => Promise<GmpAnalyticsConnectionValidation>;
  detectCapabilities: (source: GmpAnalyticsSource) => Promise<GmpAnalyticsCapabilityDetection>;
  checkHealth: (source: GmpAnalyticsSource) => Promise<GmpAnalyticsAdapterHealth>;
  collect: (input: {
    source: GmpAnalyticsSource;
    startCursor?: Record<string, unknown>;
    windowStart?: string;
    windowEnd?: string;
    metrics: string[];
    dimensions: string[];
    credential?: Record<string, unknown>;
  }) => Promise<GmpAnalyticsCollectionPage>;
  normalizeCursor: (cursor?: Record<string, unknown>) => Record<string, unknown>;
  classifyError: (error: unknown) => GmpAnalyticsAdapterError;
  redactDiagnostic: (value: unknown) => string;
};

export type GmpAnalyticsAdapterRegistry = {
  register: (adapter: GmpAnalyticsSourceAdapter) => void;
  resolveBySource: (source: GmpAnalyticsSource) => GmpAnalyticsSourceAdapter | null;
  resolveByKey: (adapterKey: string) => GmpAnalyticsSourceAdapter | null;
  list: () => GmpAnalyticsSourceDescription[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      output[key] = secretKeys.some((item) => lowered.includes(item)) ? "[REDACTED]" : redactValue(fieldValue);
    }
    return output;
  }

  if (typeof value === "string" && value.length > 200) {
    return `${value.slice(0, 200)}...[truncated]`;
  }

  return value;
}

function summarizeDiagnostic(value: unknown): string {
  return JSON.stringify(redactValue(value));
}

function classifyFixtureError(adapterKey: string, adapterVersion: string, error: unknown): GmpAnalyticsAdapterError {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown adapter error");
  const normalized = message.toLowerCase();

  const base = {
    summary: message,
    adapterKey,
    adapterVersion,
    redacted: true,
  };

  if (normalized.includes("rate")) {
    return { ...base, category: "RATE_LIMIT", retryable: true, recommendedAction: "Retry with backoff." };
  }
  if (normalized.includes("timeout")) {
    return { ...base, category: "TIMEOUT", retryable: true, recommendedAction: "Retry from last committed cursor." };
  }
  if (normalized.includes("auth")) {
    return { ...base, category: "AUTHENTICATION", retryable: false, recommendedAction: "Validate credential reference and adapter auth." };
  }
  if (normalized.includes("malformed") || normalized.includes("invalid")) {
    return { ...base, category: "INVALID_RESPONSE", retryable: false, recommendedAction: "Validate provider payload contract." };
  }

  return { ...base, category: "UNKNOWN", retryable: false, recommendedAction: "Inspect adapter diagnostics." };
}

function buildDeterministicRows(seed: string, fields: Array<{ key: string; min: number; max: number }>): Record<string, number> {
  const result: Record<string, number> = {};
  fields.forEach((field, index) => {
    const basis = Number.parseInt(seed.slice(index * 6, index * 6 + 6) || "0", 16);
    const span = field.max - field.min + 1;
    result[field.key] = field.min + (basis % span);
  });
  return result;
}

function cursorPage(cursor?: Record<string, unknown>): number {
  if (!cursor || typeof cursor.page !== "number" || Number.isNaN(cursor.page)) {
    return 1;
  }
  return Math.max(1, Math.floor(cursor.page));
}

function createFixtureAdapter(input: {
  adapterKey: string;
  sourceType: string;
  requiredOutputs: string[];
  capabilities: string[];
  requiredCredentials: boolean;
  buildObservations: (seed: string, page: number) => GmpAnalyticsCollectionPayload[];
}): GmpAnalyticsSourceAdapter {
  const adapterVersion = "v1";

  return {
    adapterKey: input.adapterKey,
    adapterVersion,
    sourceType: input.sourceType,
    requiredOutputs: input.requiredOutputs,
    async describeSource(source) {
      return {
        adapterKey: input.adapterKey,
        adapterVersion,
        sourceType: source.sourceType,
        displayName: `${source.sourceType} Fixture Adapter`,
        requiredCredentials: input.requiredCredentials,
      };
    },
    async validateConnection(source, credential) {
      const scenario = typeof source.configuration?.scenario === "string" ? source.configuration.scenario : "success";
      if (scenario === "auth_failure") {
        return {
          ok: false,
          blockingIssues: ["Authentication failed."],
          warnings: [],
          providerIdentity: source.providerReference,
          adapterVersion,
          validatedAt: nowIso(),
        };
      }

      if (input.requiredCredentials && !credential) {
        return {
          ok: false,
          blockingIssues: ["Credential is required for this source."],
          warnings: [],
          providerIdentity: source.providerReference,
          adapterVersion,
          validatedAt: nowIso(),
        };
      }

      return {
        ok: true,
        blockingIssues: [],
        warnings: scenario === "partial" ? ["Provider reports degraded completeness."] : [],
        providerIdentity: source.providerReference,
        adapterVersion,
        validatedAt: nowIso(),
      };
    },
    async detectCapabilities() {
      return {
        capabilities: input.capabilities,
        adapterVersion,
        detectedAt: nowIso(),
        warnings: [],
      };
    },
    async checkHealth(source) {
      const scenario = typeof source.configuration?.scenario === "string" ? source.configuration.scenario : "success";
      return {
        status: scenario === "timeout" ? "DEGRADED" : scenario === "auth_failure" ? "OFFLINE" : "HEALTHY",
        latencyMs: scenario === "timeout" ? 1500 : 12,
        checkedAt: nowIso(),
        notes: [`scenario:${scenario}`],
      };
    },
    async collect(inputData) {
      const scenario = typeof inputData.source.configuration?.scenario === "string" ? inputData.source.configuration.scenario : "success";
      const page = cursorPage(inputData.startCursor);

      if (scenario === "rate_limit") {
        throw new Error("rate_limit: fixture throttle");
      }
      if (scenario === "timeout") {
        throw new Error("timeout: fixture request timeout");
      }
      if (scenario === "auth_failure") {
        throw new Error("authentication failed");
      }
      if (scenario === "malformed") {
        throw new Error("malformed payload from fixture provider");
      }

      const seed = stableAnalyticsFingerprint({
        sourceId: inputData.source.analyticsSourceId,
        page,
        windowStart: inputData.windowStart,
        windowEnd: inputData.windowEnd,
        metrics: inputData.metrics,
        dimensions: inputData.dimensions,
        adapter: input.adapterKey,
      });

      const observations = input.buildObservations(seed, page);
      const complete = scenario === "empty" || page >= 2;
      const partial = scenario === "partial";

      return {
        observations: scenario === "empty" ? [] : observations,
        nextCursor: complete ? undefined : { page: page + 1, token: seed.slice(0, 16) },
        complete,
        partial,
        warnings: partial ? ["Provider response flagged as partial."] : [],
        providerRequestId: `req_${seed.slice(0, 12)}`,
        providerBatchId: `batch_${page}_${seed.slice(12, 20)}`,
      };
    },
    normalizeCursor(cursor) {
      const page = cursorPage(cursor);
      return { page };
    },
    classifyError(error) {
      return classifyFixtureError(input.adapterKey, adapterVersion, error);
    },
    redactDiagnostic(value) {
      return summarizeDiagnostic(value);
    },
  };
}

function buildCommonObservation(seed: string, page: number, index: number, key: string, value: number, unit: string, dimensions: Record<string, unknown>): GmpAnalyticsCollectionPayload {
  const sourceTimestamp = new Date(Date.UTC(2026, 0, Math.min(27, page + index), 12, 0, 0)).toISOString();
  return {
    sourceRecordIdentity: `${key}:${page}:${index}:${seed.slice(0, 10)}`,
    observationType: key,
    sourceTimestamp,
    observationPeriodStart: sourceTimestamp,
    observationPeriodEnd: sourceTimestamp,
    dimensions,
    metrics: { [key]: value },
    rawPayload: { dimensions, metrics: { [key]: value }, page, index },
    providerBatchId: `page_${page}`,
    observationKey: key,
    rawValue: value,
    unit,
    confidenceScore: 0.95,
  };
}

export function createCustomFixtureAnalyticsAdapter(): GmpAnalyticsSourceAdapter {
  return createFixtureAdapter({
    adapterKey: "fixture.custom",
    sourceType: "CUSTOM",
    requiredOutputs: ["signal"],
    capabilities: ["TRAFFIC", "INCREMENTAL_COLLECTION"],
    requiredCredentials: false,
    buildObservations(seed, page) {
      const value = Number.parseInt(seed.slice(0, 6), 16) % 1000;
      return [
        buildCommonObservation(seed, page, 1, "signal", value, "count", { source: "fixture", page }),
      ];
    },
  });
}

export function createFixtureSearchConsoleAdapter(): GmpAnalyticsSourceAdapter {
  return createFixtureAdapter({
    adapterKey: "fixture.gsc",
    sourceType: "GOOGLE_SEARCH_CONSOLE",
    requiredOutputs: ["impressions", "clicks", "ctr", "position"],
    capabilities: ["SEARCH_PERFORMANCE", "QUERY_DIMENSION", "COUNTRY_DIMENSION", "DEVICE_DIMENSION", "HISTORICAL_RANGE"],
    requiredCredentials: true,
    buildObservations(seed, page) {
      const rows = buildDeterministicRows(seed, [
        { key: "impressions", min: 100, max: 9000 },
        { key: "clicks", min: 10, max: 1200 },
        { key: "position", min: 1, max: 40 },
      ]);
      const ctr = Number((rows.clicks / rows.impressions).toFixed(4));
      return [
        buildCommonObservation(seed, page, 1, "impressions", rows.impressions, "count", { query: "led display", page: "/products/led", country: "US", device: "desktop", searchType: "web", date: "2026-07-01" }),
        buildCommonObservation(seed, page, 2, "clicks", rows.clicks, "count", { query: "led display", page: "/products/led", country: "US", device: "desktop", searchType: "web", date: "2026-07-01" }),
        buildCommonObservation(seed, page, 3, "ctr", ctr, "ratio", { query: "led display", page: "/products/led", country: "US", device: "desktop", searchType: "web", date: "2026-07-01" }),
        buildCommonObservation(seed, page, 4, "position", rows.position, "position", { query: "led display", page: "/products/led", country: "US", device: "desktop", searchType: "web", date: "2026-07-01" }),
      ];
    },
  });
}

export function createFixtureGa4Adapter(): GmpAnalyticsSourceAdapter {
  return createFixtureAdapter({
    adapterKey: "fixture.ga4",
    sourceType: "GOOGLE_ANALYTICS_4",
    requiredOutputs: ["sessions", "users", "engaged_sessions", "conversions", "revenue"],
    capabilities: ["TRAFFIC", "ENGAGEMENT", "CONVERSIONS", "REVENUE", "INCREMENTAL_COLLECTION"],
    requiredCredentials: true,
    buildObservations(seed, page) {
      const rows = buildDeterministicRows(seed, [
        { key: "sessions", min: 120, max: 5000 },
        { key: "users", min: 90, max: 4200 },
        { key: "engagedSessions", min: 40, max: 3000 },
        { key: "conversions", min: 2, max: 240 },
        { key: "revenue", min: 100, max: 100000 },
      ]);

      const dimensions = {
        date: "2026-07-01",
        pagePath: "/products/led",
        source: "google",
        medium: "organic",
        campaign: "summer-led",
      };

      return [
        buildCommonObservation(seed, page, 1, "sessions", rows.sessions, "count", dimensions),
        buildCommonObservation(seed, page, 2, "users", rows.users, "count", dimensions),
        buildCommonObservation(seed, page, 3, "engaged_sessions", rows.engagedSessions, "count", dimensions),
        buildCommonObservation(seed, page, 4, "conversions", rows.conversions, "count", dimensions),
        buildCommonObservation(seed, page, 5, "revenue", Number((rows.revenue / 100).toFixed(2)), "usd", dimensions),
      ];
    },
  });
}

export function createFixtureWordpressAdapter(): GmpAnalyticsSourceAdapter {
  return createFixtureAdapter({
    adapterKey: "fixture.wordpress",
    sourceType: "WORDPRESS",
    requiredOutputs: ["publication_status"],
    capabilities: ["PAGE_PERFORMANCE", "HISTORICAL_RANGE"],
    requiredCredentials: true,
    buildObservations(seed, page) {
      const statusSeed = Number.parseInt(seed.slice(0, 2), 16);
      const publicationStatus = statusSeed % 2 === 0 ? "publish" : "draft";
      return [
        buildCommonObservation(seed, page, 1, "publication_status", publicationStatus === "publish" ? 1 : 0, "flag", {
          remotePostId: `wp_${seed.slice(0, 8)}`,
          publishedUrl: `https://example.com/posts/${seed.slice(8, 16)}`,
          publicationStatus,
          publicationTimestamp: "2026-07-01T12:00:00.000Z",
          modifiedTimestamp: "2026-07-02T12:00:00.000Z",
          canonicalUrl: `https://example.com/posts/${seed.slice(8, 16)}`,
          contentType: "page",
        }),
      ];
    },
  });
}

export function createDeterministicAnalyticsFixtureAdapter(): GmpAnalyticsSourceAdapter {
  return createCustomFixtureAnalyticsAdapter();
}

export function createAnalyticsAdapterRegistry(initial?: GmpAnalyticsSourceAdapter[]): GmpAnalyticsAdapterRegistry {
  const adapters = new Map<string, GmpAnalyticsSourceAdapter>();

  const register = (adapter: GmpAnalyticsSourceAdapter) => {
    adapters.set(adapter.adapterKey, adapter);
  };

  for (const adapter of initial ?? [
    createCustomFixtureAnalyticsAdapter(),
    createFixtureSearchConsoleAdapter(),
    createFixtureGa4Adapter(),
    createFixtureWordpressAdapter(),
  ]) {
    register(adapter);
  }

  return {
    register,
    resolveBySource(source) {
      if (source.adapterKey && adapters.has(source.adapterKey)) {
        return adapters.get(source.adapterKey) ?? null;
      }

      const byType = [...adapters.values()].find((entry) => entry.sourceType === source.sourceType);
      return byType ?? null;
    },
    resolveByKey(adapterKey) {
      return adapters.get(adapterKey) ?? null;
    },
    list() {
      return [...adapters.values()]
        .sort((left, right) => left.adapterKey.localeCompare(right.adapterKey))
        .map((entry) => ({
          adapterKey: entry.adapterKey,
          adapterVersion: entry.adapterVersion,
          sourceType: entry.sourceType,
          displayName: entry.adapterKey,
          requiredCredentials: entry.sourceType !== "CUSTOM" && entry.sourceType !== "FIXTURE",
        }));
    },
  };
}

export function resolveAnalyticsAdapter(source: GmpAnalyticsSource, registry?: GmpAnalyticsAdapterRegistry, fallback?: GmpAnalyticsSourceAdapter): GmpAnalyticsSourceAdapter {
  if (fallback) {
    return fallback;
  }

  const effectiveRegistry = registry ?? createAnalyticsAdapterRegistry();
  const resolved = effectiveRegistry.resolveBySource(source);
  if (!resolved) {
    throw new Error(`Unsupported analytics adapter for source type ${source.sourceType}`);
  }

  return resolved;
}

export function toObservationEntity(input: {
  source: GmpAnalyticsSource;
  analyticsCollectionId: string;
  collectionExecutionId?: string;
  cursor?: Record<string, unknown>;
  payload: GmpAnalyticsCollectionPayload;
}): Omit<GmpAnalyticsObservation, "analyticsObservationId" | "createdAt"> {
  const checksum = stableAnalyticsFingerprint({
    sourceRecordIdentity: input.payload.sourceRecordIdentity,
    sourceTimestamp: input.payload.sourceTimestamp,
    rawPayload: input.payload.rawPayload,
  });

  return {
    projectId: input.source.projectId,
    analyticsSourceId: input.source.analyticsSourceId,
    analyticsCollectionId: input.analyticsCollectionId,
    sourceRecordIdentity: input.payload.sourceRecordIdentity,
    observationType: input.payload.observationType,
    sourceTimestamp: input.payload.sourceTimestamp,
    observationPeriodStart: input.payload.observationPeriodStart ?? null,
    observationPeriodEnd: input.payload.observationPeriodEnd ?? null,
    dimensions: input.payload.dimensions,
    metrics: input.payload.metrics,
    rawPayloadChecksum: checksum,
    rawPayload: input.payload.rawPayload,
    rawPayloadReference: undefined,
    providerBatchId: input.payload.providerBatchId,
    providerCursor: input.cursor,
    collectionExecutionId: input.collectionExecutionId,
    dataQualityStatus: "VALID",
    diagnosticSummary: undefined,
    ingestedAt: nowIso(),
    supersededByObservationId: undefined,
    correctedFromObservationId: undefined,
    observedAt: input.payload.sourceTimestamp,
    observationKey: input.payload.observationKey,
    dimensionKey: undefined,
    rawValue: input.payload.rawValue,
    unit: input.payload.unit,
    confidenceScore: input.payload.confidenceScore,
    metadata: {
      providerBatchId: input.payload.providerBatchId,
      cursor: input.cursor,
    },
  };
}
