import {
  readGlwTargetPreflight,
  type GlwTargetPreflightResult,
} from "../glw/target-preflight";
import type { GlwGenerationRequest } from "../glw/page-generation";
import {
  completeCampaignPreflight,
  type CampaignPlan,
  type CampaignPreflightReasonCode,
  type CampaignTargetPreflightResult,
} from "./campaign-plan";
import type { TargetInventoryRecord } from "./target-inventory";
import {
  applyTargetPreflightBatch,
  getTargetInventoryRepositoryRevision,
} from "./target-inventory-repository";
import type { TargetMatrix } from "./target-matrix";

export const MASS_PREFLIGHT_LIMITS = {
  maximumTargetsPerCampaign: 25_000,
  maximumConcurrency: 5,
  batchSize: 100,
  requestTimeoutMs: 10_000,
  maximumRetryCount: 1,
  retryBackoffMs: 100,
} as const;

export type CampaignTargetPreflightReader = (
  target: TargetInventoryRecord,
) => Promise<GlwTargetPreflightResult>;

export type CampaignPreflightMetrics = {
  targetCount: number;
  completedCount: number;
  batchCount: number;
  observedMaximumInFlight: number;
  maximumObservedAttempts: number;
  inventoryPersistenceReplacementCount: number;
};

export type CampaignPreflightExecution = {
  campaign: CampaignPlan;
  results: readonly CampaignTargetPreflightResult[];
  metrics: CampaignPreflightMetrics;
};

export class CampaignPreflightError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignPreflightError";
    this.code = code;
  }
}

function unknownResult(input: {
  campaign: CampaignPlan;
  target: TargetInventoryRecord;
  attemptCount: number;
  checkedAt: string;
}): CampaignTargetPreflightResult {
  return {
    campaignId: input.campaign.campaignId,
    targetId: input.target.targetId,
    pageBlueprintId: input.target.pageBlueprintId,
    productId: input.target.subject.productId,
    stateCode: input.target.geography.stateCode,
    targetState: "UNKNOWN",
    eligibility: "UNKNOWN_REQUIRES_PREFLIGHT",
    plannedOperation: "REVIEW_REQUIRED",
    wordpressObjectId: null,
    wordpressStatus: null,
    wordpressUrl: null,
    wordpressTitle: null,
    canonicalPath: input.target.canonicalPath,
    applicationPath: input.target.applicationPath,
    canonicalParentId: input.target.parentReferences.canonicalTargetParentId,
    reasonCodes: ["PREFLIGHT_READ_FAILED"],
    attemptCount: input.attemptCount,
    checkedAt: input.checkedAt,
    preflightPolicyVersion: input.campaign.preflightPolicyVersion,
  };
}

export function classifyCampaignTargetPreflight(input: {
  campaign: CampaignPlan;
  target: TargetInventoryRecord;
  preflight: GlwTargetPreflightResult | null;
  attemptCount: number;
  checkedAt: string;
  readFailed?: boolean;
}): CampaignTargetPreflightResult {
  if (input.readFailed || !input.preflight) {
    return unknownResult(input);
  }
  const exactPath = input.preflight.applicationPath === input.target.applicationPath
    && input.preflight.canonicalPath === input.target.canonicalPath;
  if (!exactPath) {
    return {
      ...unknownResult(input),
      targetState: "BLOCKED",
      eligibility: "NOT_ELIGIBLE_COLLISION",
      plannedOperation: "BLOCKED",
      reasonCodes: ["INVALID_TARGET_IDENTITY"],
    };
  }
  let targetState: CampaignTargetPreflightResult["targetState"] = input.preflight.state;
  let eligibility: CampaignTargetPreflightResult["eligibility"] = "UNKNOWN_REQUIRES_PREFLIGHT";
  let plannedOperation: CampaignTargetPreflightResult["plannedOperation"] = "REVIEW_REQUIRED";
  let reasonCodes: CampaignPreflightReasonCode[] = ["PRIVATE_ABSENCE_UNPROVEN"];
  if (input.preflight.state === "ABSENT") {
    eligibility = "ELIGIBLE_CREATE";
    plannedOperation = "CREATE";
    reasonCodes = ["EXACT_ABSENCE_CONFIRMED"];
  } else if (input.preflight.state === "EXISTS_DRAFT") {
    if (input.preflight.wordpressObjectId) {
      eligibility = "ELIGIBLE_UPDATE";
      plannedOperation = "EXACT_UPDATE";
      reasonCodes = ["EXACT_DRAFT_FOUND"];
    } else {
      targetState = "BLOCKED";
      eligibility = "NOT_ELIGIBLE_COLLISION";
      plannedOperation = "BLOCKED";
      reasonCodes = ["EXACT_DRAFT_ID_MISSING"];
    }
  } else if (input.preflight.state === "EXISTS_PUBLISHED") {
    eligibility = "NOT_ELIGIBLE_PUBLISHED";
    plannedOperation = "NO_ACTION";
    reasonCodes = ["PUBLISHED_UPDATE_NOT_AUTHORIZED"];
  }
  return {
    campaignId: input.campaign.campaignId,
    targetId: input.target.targetId,
    pageBlueprintId: input.target.pageBlueprintId,
    productId: input.target.subject.productId,
    stateCode: input.target.geography.stateCode,
    targetState,
    eligibility,
    plannedOperation,
    wordpressObjectId: input.preflight.wordpressObjectId,
    wordpressStatus: input.preflight.wordpressStatus,
    wordpressUrl: input.preflight.wordpressUrl,
    wordpressTitle: input.preflight.wordpressTitle,
    canonicalPath: input.target.canonicalPath,
    applicationPath: input.target.applicationPath,
    canonicalParentId: input.preflight.canonicalParentId,
    reasonCodes,
    attemptCount: input.attemptCount,
    checkedAt: input.checkedAt,
    preflightPolicyVersion: input.campaign.preflightPolicyVersion,
  };
}

function blockedTargetResult(
  campaign: CampaignPlan,
  target: TargetInventoryRecord,
  checkedAt: string,
): CampaignTargetPreflightResult {
  return {
    ...unknownResult({ campaign, target, attemptCount: 0, checkedAt }),
    targetState: "BLOCKED",
    eligibility: target.eligibility === "NOT_ELIGIBLE_POLICY" ? target.eligibility : "NOT_ELIGIBLE_COLLISION",
    plannedOperation: "BLOCKED",
    reasonCodes: ["TARGET_POLICY_BLOCK"],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new CampaignPreflightError("PREFLIGHT_TIMEOUT", "Target preflight timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readTarget(input: {
  campaign: CampaignPlan;
  target: TargetInventoryRecord;
  reader: CampaignTargetPreflightReader;
  timeoutMs: number;
  maximumRetryCount: number;
  retryBackoffMs: number;
  checkedAt: () => string;
}): Promise<CampaignTargetPreflightResult> {
  if (input.target.targetState === "BLOCKED") {
    return blockedTargetResult(input.campaign, input.target, input.checkedAt());
  }
  let attemptCount = 0;
  while (attemptCount <= input.maximumRetryCount) {
    attemptCount += 1;
    try {
      const preflight = await withTimeout(input.reader(input.target), input.timeoutMs);
      return classifyCampaignTargetPreflight({
        campaign: input.campaign,
        target: input.target,
        preflight,
        attemptCount,
        checkedAt: input.checkedAt(),
      });
    } catch {
      if (attemptCount > input.maximumRetryCount) {
        return unknownResult({
          campaign: input.campaign,
          target: input.target,
          attemptCount,
          checkedAt: input.checkedAt(),
        });
      }
      await new Promise((resolve) => setTimeout(resolve, input.retryBackoffMs));
    }
  }
  return unknownResult({ campaign: input.campaign, target: input.target, attemptCount, checkedAt: input.checkedAt() });
}

async function processBatch(input: {
  campaign: CampaignPlan;
  targets: readonly TargetInventoryRecord[];
  reader: CampaignTargetPreflightReader;
  concurrency: number;
  timeoutMs: number;
  maximumRetryCount: number;
  retryBackoffMs: number;
  checkedAt: () => string;
  observeInFlight: (delta: number) => void;
}): Promise<readonly CampaignTargetPreflightResult[]> {
  const results: CampaignTargetPreflightResult[] = [];
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < input.targets.length) {
      const target = input.targets[nextIndex];
      nextIndex += 1;
      input.observeInFlight(1);
      try {
        results.push(await readTarget({ ...input, target }));
      } finally {
        input.observeInFlight(-1);
      }
    }
  };
  const workerCount = Math.min(input.concurrency, input.targets.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function preflightCampaign(input: {
  campaign: CampaignPlan;
  matrix: TargetMatrix;
  reader: CampaignTargetPreflightReader;
  concurrency?: number;
  batchSize?: number;
  timeoutMs?: number;
  maximumRetryCount?: number;
  retryBackoffMs?: number;
  checkedAt?: () => string;
  persistInventory?: boolean;
}): Promise<CampaignPreflightExecution> {
  if (input.campaign.matrixId !== input.matrix.matrixId
    || input.campaign.matrixFingerprint !== input.matrix.fingerprint) {
    throw new CampaignPreflightError("MATRIX_SCOPE_MISMATCH", "Campaign does not match the certified matrix.");
  }
  if (input.matrix.targets.length > MASS_PREFLIGHT_LIMITS.maximumTargetsPerCampaign) {
    throw new CampaignPreflightError("CAMPAIGN_TARGET_LIMIT_EXCEEDED", "Campaign target count exceeds the preflight limit.");
  }
  if (input.campaign.status !== "DRAFT") {
    throw new CampaignPreflightError("CAMPAIGN_SCOPE_FROZEN", "Only a draft campaign may begin preflight.");
  }
  const concurrency = input.concurrency ?? MASS_PREFLIGHT_LIMITS.maximumConcurrency;
  const batchSize = input.batchSize ?? MASS_PREFLIGHT_LIMITS.batchSize;
  const timeoutMs = input.timeoutMs ?? MASS_PREFLIGHT_LIMITS.requestTimeoutMs;
  const maximumRetryCount = input.maximumRetryCount ?? MASS_PREFLIGHT_LIMITS.maximumRetryCount;
  const retryBackoffMs = input.retryBackoffMs ?? MASS_PREFLIGHT_LIMITS.retryBackoffMs;
  if (concurrency < 1 || concurrency > MASS_PREFLIGHT_LIMITS.maximumConcurrency) {
    throw new CampaignPreflightError("INVALID_CONCURRENCY", "Preflight concurrency exceeds the configured limit.");
  }
  if (batchSize < 1 || batchSize > MASS_PREFLIGHT_LIMITS.batchSize) {
    throw new CampaignPreflightError("INVALID_BATCH_SIZE", "Preflight batch size exceeds the configured limit.");
  }
  if (maximumRetryCount < 0 || maximumRetryCount > MASS_PREFLIGHT_LIMITS.maximumRetryCount) {
    throw new CampaignPreflightError("INVALID_RETRY_POLICY", "Preflight retry count exceeds the configured limit.");
  }
  const checkedAt = input.checkedAt ?? (() => new Date().toISOString());
  const results: CampaignTargetPreflightResult[] = [];
  let inFlight = 0;
  let observedMaximumInFlight = 0;
  const observeInFlight = (delta: number): void => {
    inFlight += delta;
    observedMaximumInFlight = Math.max(observedMaximumInFlight, inFlight);
  };
  const targets = [...input.matrix.targets].sort((left, right) => left.targetId.localeCompare(right.targetId));
  for (let offset = 0; offset < targets.length; offset += batchSize) {
    results.push(...await processBatch({
      campaign: input.campaign,
      targets: targets.slice(offset, offset + batchSize),
      reader: input.reader,
      concurrency,
      timeoutMs,
      maximumRetryCount,
      retryBackoffMs,
      checkedAt,
      observeInFlight,
    }));
  }
  const completedCampaign = completeCampaignPreflight({ campaign: input.campaign, matrix: input.matrix, results });
  let inventoryPersistenceReplacementCount = 0;
  if (input.persistInventory !== false) {
    applyTargetPreflightBatch({
      targets: input.matrix.targets,
      expectedRepositoryRevision: getTargetInventoryRepositoryRevision(),
      updates: completedCampaign.preflightResults.map((result) => {
        const target = input.matrix.targets.find((candidate) => candidate.targetId === result.targetId)!;
        return {
          targetId: result.targetId,
          patch: {
            targetState: result.targetState,
            eligibility: result.eligibility,
            wordpressObjectId: result.wordpressObjectId,
            wordpressStatus: result.wordpressStatus,
            wordpressUrl: result.wordpressUrl,
            lastPreflightAt: result.checkedAt,
            preflightPolicyVersion: result.preflightPolicyVersion,
            parentReferences: {
              ...target.parentReferences,
              canonicalTargetParentId: result.canonicalParentId,
            },
            updatedAt: result.checkedAt,
          },
        };
      }),
    });
    if (completedCampaign.preflightResults.length > 0) inventoryPersistenceReplacementCount = 1;
  }
  return {
    campaign: completedCampaign,
    results: completedCampaign.preflightResults,
    metrics: {
      targetCount: targets.length,
      completedCount: completedCampaign.preflightResults.length,
      batchCount: Math.ceil(targets.length / batchSize),
      observedMaximumInFlight,
      maximumObservedAttempts: Math.max(0, ...completedCampaign.preflightResults.map((result) => result.attemptCount)),
      inventoryPersistenceReplacementCount,
    },
  };
}

export function createGlwExactTargetPreflightReader(input: {
  wordpressApiBaseUrl: string | null;
  fetcher?: Parameters<typeof readGlwTargetPreflight>[0]["fetcher"];
}): CampaignTargetPreflightReader {
  return async (target) => {
    const pageType: GlwGenerationRequest["pageType"] = target.geography.cityKey
      ? "city_service"
      : target.geography.stateCode
        ? "state_service"
        : "general_service";
    const request: GlwGenerationRequest = {
      siteId: target.siteId,
      productId: target.subject.productId ?? "",
      pageType,
      stateCode: target.geography.stateCode ?? "",
      citySlug: target.canonicalSlug,
      slug: target.applicationPath,
      title: target.geography.cityName ?? target.subject.productId ?? target.targetId,
      seoTitle: target.geography.cityName ?? target.subject.productId ?? target.targetId,
      metaDescription: "Read-only exact target preflight.",
      publicationIntent: "draft",
      organizationId: target.organizationId,
      siteName: target.siteId,
      productTopic: target.subject.productId ?? target.targetId,
      stateName: target.geography.stateCode,
      cityName: target.geography.cityName,
      canonicalPath: target.applicationPath,
      plannedOperation: pageType === "city_service" ? "CREATE_CITY" : pageType === "state_service" ? "CREATE_STATE" : "CREATE_GENERAL",
      wordpressObjectId: null,
      externalExecutionAllowed: false,
    };
    return readGlwTargetPreflight({
      request,
      wordpressApiBaseUrl: input.wordpressApiBaseUrl,
      localExecutions: [],
      fetcher: input.fetcher,
    });
  };
}