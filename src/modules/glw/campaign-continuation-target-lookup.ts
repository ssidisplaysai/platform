import type { GlwCampaignTarget, GlwCampaignTargetStatus } from "@/modules/glw/campaign-target-repository";

type LookupError = {
  ok: false;
  status: number;
  error: string;
};

type LookupSuccess = {
  ok: true;
  target: GlwCampaignTarget;
};

export type GlwExactContinuationLookupResult = LookupError | LookupSuccess;

type AllowedContinuationStatus = Exclude<GlwCampaignTargetStatus, "prepared" | "reference_complete" | "queued" | "draft_ready" | "published" | "skipped">;

function normalizeStateCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
  return normalized || null;
}

function fail(error: string, status = 409): LookupError {
  return { ok: false, status, error };
}

function findByStateIdentity(input: {
  targets: readonly GlwCampaignTarget[];
  expectedStateCode: string;
  expectedCitySlug?: string | null;
}): GlwCampaignTarget | null {
  const expectedStateCode = normalizeStateCode(input.expectedStateCode);
  const expectedCitySlug = normalizeCitySlug(input.expectedCitySlug);

  const matches = input.targets.filter((candidate) =>
    normalizeStateCode(candidate.stateCode) === expectedStateCode
    && normalizeCitySlug(candidate.citySlug) === expectedCitySlug,
  );

  if (matches.length !== 1) {
    return null;
  }

  return matches[0] ?? null;
}

export function resolveExactContinuationCampaignTarget(input: {
  targets: readonly GlwCampaignTarget[];
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  expectedStateCode: string;
  expectedCitySlug?: string | null;
  expectedTargetId?: string | null;
  expectedJobId: string;
  expectedExecutionId?: string | null;
  actualExecutionId?: string | null;
  allowedStatuses?: readonly AllowedContinuationStatus[];
}): GlwExactContinuationLookupResult {
  const expectedTargetId = input.expectedTargetId?.trim() ?? "";
  const expectedJobId = input.expectedJobId.trim();
  const expectedExecutionId = input.expectedExecutionId?.trim() ?? "";
  const actualExecutionId = input.actualExecutionId?.trim() ?? "";
  const expectedStateCode = normalizeStateCode(input.expectedStateCode);
  const expectedCitySlug = normalizeCitySlug(input.expectedCitySlug);
  const allowedStatuses = new Set<AllowedContinuationStatus>(input.allowedStatuses ?? ["content_ready", "running", "failed"]);

  const target = expectedTargetId
    ? input.targets.find((candidate) => candidate.targetId === expectedTargetId) ?? null
    : findByStateIdentity({
        targets: input.targets,
        expectedStateCode,
        expectedCitySlug,
      });

  if (!target) {
    return fail("Exact campaign target was not found for continuation.");
  }

  if (target.campaignId !== input.campaignId) {
    return fail("Selected target does not belong to the exact campaign.");
  }
  if (target.organizationId !== input.organizationId || target.siteId !== input.siteId || target.productId !== input.productId) {
    return fail("Selected target does not match the exact campaign scope.");
  }
  if (normalizeStateCode(target.stateCode) !== expectedStateCode || normalizeCitySlug(target.citySlug) !== expectedCitySlug) {
    return fail("Continuation request does not match the exact campaign target identity.");
  }
  if (expectedTargetId && target.targetId !== expectedTargetId) {
    return fail("Continuation request targetId does not match the exact campaign target.");
  }
  if (!allowedStatuses.has(target.status as AllowedContinuationStatus)) {
    return fail("Campaign target is not in a continuable state.");
  }
  if (target.wordpressObjectId) {
    return fail("Conflicting WordPress identity exists for this campaign target.");
  }
  if (target.jobId !== expectedJobId) {
    return fail("Campaign target does not match the exact existing job.");
  }
  if (expectedExecutionId && actualExecutionId !== expectedExecutionId) {
    return fail("Continuation request executionId does not match the exact existing execution.");
  }

  return { ok: true, target };
}
