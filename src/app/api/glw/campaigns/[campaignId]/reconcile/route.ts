import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, forwardOperatorMutationContext, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetFailed,
  markGlwFailedCampaignTargetDraftReady,
  reconcileGlwCampaignTargetContentReady,
  reconcileGlwReferenceTargetContentReadyForContinuation,
  releaseExpiredGlwCampaignTargetLeases,
  requeueGlwCampaignTargetAfterPreExecutionFailure,
  reconcileGlwContentReadyTargetDraft,
} from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  resolveGlwCampaignJobReconciliationDecision,
} from "@/modules/glw/campaign-target-reconciliation";
import {
  buildGlwCampaignProductionGenerationForm,
} from "@/modules/glw/campaign-production-generation";
import type { GlwGenerationRequest, GlwLocalPlannedOperation } from "@/modules/glw/page-generation";
import { isOutdoorSphereCampaignScope } from "@/modules/glw/outdoor-sphere-contextual-media-policy";
import { canonicalizeAndRevalidateGlwZeroAuthorityClaims } from "@/modules/glw/zero-authority-claim-canonicalization";
import { evaluateGlwReferenceClaimAuthority } from "@/modules/glw/reference-claim-authority";
import { readGlwTargetPreflight, resolveGlwTargetMutationAvailability } from "@/modules/glw/target-preflight";

function internalHeaders(
  request: NextRequest,
  organizationId: string,
  siteId: string,
): Headers {
  return forwardOperatorMutationContext(request, {
    "content-type": "application/json",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": siteId,
  });
}

function targetIdentity(target: {
  stateCode: string;
  citySlug?: string | null;
  cityName?: string | null;
}) {
  return {
    stateCode: target.stateCode,
    citySlug: target.citySlug ?? null,
    cityName: target.cityName ?? null,
  };
}

function asTrimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCanonicalPath(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeHtmlForIdentityComparison(value: string): string {
  return value.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStoredWordPressContent(page: Record<string, unknown>): string {
  const content = page.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }

  const contentRecord = content as Record<string, unknown>;
  return text(contentRecord.raw) || text(contentRecord.rendered);
}

function readWordPressPageTitle(page: Record<string, unknown>): string {
  const title = page.title;
  if (!title || typeof title !== "object" || Array.isArray(title)) {
    return "";
  }

  const titleRecord = title as Record<string, unknown>;
  return text(titleRecord.raw) || text(titleRecord.rendered);
}

async function readWordPressDraftIdentity(input: {
  siteId: string;
  wordpressObjectId: string;
}) {
  const site = getSiteById(input.siteId);
  const apiBaseUrl = site?.integrations.wordpressApiBaseUrl?.trim() ?? "";
  const credential = resolveWordPressCredentialReference(site?.integrations.wordpressCredentialReference ?? null);
  if (!site || !apiBaseUrl || !credential) {
    throw new Error("DRAFT_READY_WORDPRESS_READ_AUTHORITY_REQUIRED");
  }

  const reader = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const read = await reader.getJson({
    path: `/pages/${input.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,link" }),
  });

  if (!read.ok || !read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
    throw new Error("DRAFT_READY_WORDPRESS_READBACK_FAILED");
  }

  const page = read.body as Record<string, unknown>;
  const wordpressObjectId = String(page.id ?? "").trim();
  const wordpressStatus = typeof page.status === "string" ? page.status.trim() : "";
  const slug = typeof page.slug === "string" ? page.slug.trim() : "";
  const parentId = String(page.parent ?? "").trim();
  const title = readWordPressPageTitle(page);
  const storedContent = readStoredWordPressContent(page);
  const link = text(page.link);

  if (wordpressObjectId !== input.wordpressObjectId || wordpressStatus !== "draft") {
    throw new Error("DRAFT_READY_WORDPRESS_IDENTITY_MISMATCH");
  }
  if (!slug || !/^[1-9]\d*$/.test(parentId)) {
    throw new Error("DRAFT_READY_WORDPRESS_PARENT_REQUIRED");
  }

  return {
    wordpressObjectId,
    wordpressStatus,
    title,
    slug,
    parentId,
    storedContent,
    link,
    reader,
  };
}

async function validateSameTargetUnprojectedWordPressIdentity(input: {
  campaign: {
    campaignId: string;
    organizationId: string;
    siteId: string;
    productId: string;
  };
  target: {
    targetId: string;
    stateCode: string;
    citySlug?: string | null;
    status: string;
    wordpressObjectId?: string | null;
  };
  job: {
    jobId: string;
    externalExecutionId?: string | null;
    status: string;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
    generatedDraft?: {
      title: string;
      contentHtml: string;
      slug: string;
      excerpt?: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyphrase?: string;
    } | null;
  };
  expectedExecutionId: string;
}): Promise<{
  ok: true;
  wordpressObjectId: string;
  canonicalIdentity: {
    canonicalPath: string;
    applicationPath: string;
    canonicalParentId: string;
  };
} | {
  ok: false;
  code: string;
  error: string;
}> {
  const sharedIdentityValidation = await validateExactWordPressDraftCanonicalIdentity({
    campaign: input.campaign,
    target: input.target,
    job: input.job,
    expectedExecutionId: input.expectedExecutionId,
    pathName: "UNPROJECTED",
  });

  if (!sharedIdentityValidation.ok) {
    return sharedIdentityValidation;
  }

  const expectedTitle = text(input.job.generatedDraft.title);
  if (expectedTitle && sharedIdentityValidation.readback.title !== expectedTitle) {
    return {
      ok: false,
      code: "SAME_TARGET_UNPROJECTED_WORDPRESS_TITLE_MISMATCH",
      error: "Same-target WordPress draft title no longer matches the exact selected job artifact.",
    };
  }
  const storedContentSha = sha256Text(sharedIdentityValidation.readback.storedContent);
  const expectedDraft = input.job.generatedDraft;
  const expectedContentSha = sha256Text(expectedDraft.contentHtml);
  const storedNormalizedSha = sha256Text(normalizeHtmlForIdentityComparison(sharedIdentityValidation.readback.storedContent));
  const expectedNormalizedSha = sha256Text(normalizeHtmlForIdentityComparison(expectedDraft.contentHtml));

  if (storedContentSha !== expectedContentSha && storedNormalizedSha !== expectedNormalizedSha) {
    return {
      ok: false,
      code: "SAME_TARGET_UNPROJECTED_CONTENT_HASH_MISMATCH",
      error: "Selected WordPress draft content no longer matches the exact selected job artifact.",
    };
  }

  const zeroAuthority = { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] };
  const wordpressClaims = evaluateGlwReferenceClaimAuthority({
    artifact: {
      ...expectedDraft,
      contentHtml: sharedIdentityValidation.readback.storedContent,
    },
    authority: zeroAuthority,
  });
  const unsupportedWordPressClaims = wordpressClaims.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
  if (!wordpressClaims.ok || unsupportedWordPressClaims.length > 0) {
    return {
      ok: false,
      code: "SAME_TARGET_UNPROJECTED_CLAIM_AUTHORITY_FAILED",
      error: "Selected WordPress draft content failed claim authority revalidation.",
    };
  }

  const currentArtifactClaims = canonicalizeAndRevalidateGlwZeroAuthorityClaims({
    artifact: expectedDraft,
    authority: zeroAuthority,
    fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
  });
  const unsupportedCurrentClaims = currentArtifactClaims.finalClaimAuthority.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
  if (!currentArtifactClaims.finalClaimAuthority.ok || unsupportedCurrentClaims.length > 0) {
    return {
      ok: false,
      code: "SAME_TARGET_UNPROJECTED_CURRENT_ARTIFACT_CLAIM_AUTHORITY_FAILED",
      error: "Current selected job artifact failed claim authority revalidation.",
    };
  }

  return {
    ok: true,
    wordpressObjectId: sharedIdentityValidation.wordpressObjectId,
    canonicalIdentity: sharedIdentityValidation.canonicalIdentity,
  };
}

async function validateExactWordPressDraftCanonicalIdentity(input: {
  campaign: {
    campaignId: string;
    organizationId: string;
    siteId: string;
    productId: string;
  };
  target: {
    targetId: string;
    stateCode: string;
    citySlug?: string | null;
    status: string;
    wordpressObjectId?: string | null;
  };
  job: {
    jobId: string;
    organizationId?: string;
    siteId?: string;
    productId?: string;
    externalExecutionId?: string | null;
    status: string;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
    generatedDraft?: {
      title: string;
      contentHtml: string;
      slug: string;
      excerpt?: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyphrase?: string;
    } | null;
  };
  expectedExecutionId: string;
  pathName: "UNPROJECTED" | "PREBOUND" | "JOB_BOUND_PREWRITE";
}): Promise<{
  ok: true;
  wordpressObjectId: string;
  canonicalIdentity: {
    canonicalPath: string;
    applicationPath: string;
    canonicalParentId: string;
  };
  readback: Awaited<ReturnType<typeof readWordPressDraftIdentity>>;
} | {
  ok: false;
  code: string;
  error: string;
}> {
  const codePrefix = `SAME_TARGET_${input.pathName}`;

  if (input.target.status !== "content_ready") {
    return {
      ok: false,
      code: `${codePrefix}_TARGET_STATUS_INVALID`,
      error: "Selected target is not in content-ready state for same-target draft identity continuation.",
    };
  }

  const jobWordPressObjectId = input.job.wordpressObjectId == null
    ? ""
    : String(input.job.wordpressObjectId).trim();

  if (!jobWordPressObjectId) {
    return {
      ok: false,
      code: `${codePrefix}_JOB_WORDPRESS_ID_REQUIRED`,
      error: "Selected job does not expose a WordPress draft identity for exact same-target continuation.",
    };
  }

  const normalizedJobWordPressStatus = text(input.job.wordpressStatus).toLowerCase();
  const localWordPressDraftStatusEligible = input.pathName === "UNPROJECTED"
    ? normalizedJobWordPressStatus === "draft"
    : normalizedJobWordPressStatus === "" || normalizedJobWordPressStatus === "draft";

  if (input.job.status !== "CONTENT_READY" || !localWordPressDraftStatusEligible || !input.job.generatedDraft) {
    return {
      ok: false,
      code: `${codePrefix}_JOB_STATE_INVALID`,
      error: "Selected job is not an eligible content-ready draft identity candidate.",
    };
  }

  if ((input.job.externalExecutionId ?? "") !== input.expectedExecutionId) {
    return {
      ok: false,
      code: `${codePrefix}_EXECUTION_MISMATCH`,
      error: "Selected target execution identity does not match the exact existing execution.",
    };
  }

  const { form } = buildGlwCampaignProductionGenerationForm({
    campaign: input.campaign,
    stateCode: input.target.stateCode,
    citySlug: input.target.citySlug,
  });
  const canonicalPath = normalizeCanonicalPath(form.slug ?? "");
  if (!canonicalPath) {
    return {
      ok: false,
      code: `${codePrefix}_CANONICAL_PATH_REQUIRED`,
      error: "Canonical path is required before exact same-target WordPress identity continuation.",
    };
  }

  let readback: Awaited<ReturnType<typeof readWordPressDraftIdentity>>;
  try {
    readback = await readWordPressDraftIdentity({
      siteId: input.campaign.siteId,
      wordpressObjectId: jobWordPressObjectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DRAFT_READY_WORDPRESS_READBACK_FAILED";
    if (message === "DRAFT_READY_WORDPRESS_IDENTITY_MISMATCH") {
      return {
        ok: false,
        code: `${codePrefix}_WORDPRESS_STATUS_INVALID`,
        error: "Same-target WordPress identity must remain a draft.",
      };
    }
    if (message === "DRAFT_READY_WORDPRESS_PARENT_REQUIRED") {
      return {
        ok: false,
        code: `${codePrefix}_WORDPRESS_PARENT_REQUIRED`,
        error: "Same-target WordPress draft parent identity is required.",
      };
    }
    return {
      ok: false,
      code: `${codePrefix}_WORDPRESS_READ_FAILED`,
      error: "Unable to verify same-target WordPress draft identity.",
    };
  }

  const expectedSlug = canonicalPath.split("/").filter(Boolean).at(-1) ?? "";
  if (!expectedSlug || readback.slug !== expectedSlug) {
    return {
      ok: false,
      code: `${codePrefix}_WORDPRESS_SLUG_MISMATCH`,
      error: "Same-target WordPress draft slug does not match the canonical target path.",
    };
  }

  const uniquenessRead = await readback.reader.getJson({
    path: "/pages",
    query: new URLSearchParams({
      slug: readback.slug,
      parent: readback.parentId,
      context: "edit",
      status: "publish,draft,pending,private,future",
      per_page: "100",
      _fields: "id,slug,parent,status",
    }),
  });

  if (!uniquenessRead.ok || !Array.isArray(uniquenessRead.body)) {
    return {
      ok: false,
      code: `${codePrefix}_WORDPRESS_UNIQUENESS_READ_FAILED`,
      error: "Unable to verify uniqueness for the selected WordPress draft identity.",
    };
  }

  const matching = uniquenessRead.body
    .filter((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return false;
      }

      const value = candidate as Record<string, unknown>;
      return String(value.id ?? "").trim() === jobWordPressObjectId
        && text(value.slug) === readback.slug
        && String(value.parent ?? "").trim() === readback.parentId;
    });

  if (matching.length !== 1 || uniquenessRead.body.length !== 1) {
    return {
      ok: false,
      code: `${codePrefix}_WORDPRESS_UNIQUENESS_CONFLICT`,
      error: "Multiple WordPress identities match the canonical target draft identity.",
    };
  }

  return {
    ok: true,
    wordpressObjectId: jobWordPressObjectId,
    canonicalIdentity: {
      canonicalPath,
      applicationPath: canonicalPath,
      canonicalParentId: readback.parentId,
    },
    readback,
  };
}

async function validateSameTargetPreboundWordPressIdentity(input: {
  campaign: {
    campaignId: string;
    organizationId: string;
    siteId: string;
    productId: string;
  };
  target: {
    targetId: string;
    stateCode: string;
    citySlug?: string | null;
    status: string;
    wordpressObjectId?: string | null;
  };
  job: {
    jobId: string;
    organizationId?: string;
    siteId?: string;
    productId?: string;
    externalExecutionId?: string | null;
    status: string;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
    generatedDraft?: {
      title: string;
      contentHtml: string;
      slug: string;
      excerpt?: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyphrase?: string;
    } | null;
  };
  expectedExecutionId: string;
}): Promise<{
  ok: true;
  wordpressObjectId: string;
  canonicalIdentity: {
    canonicalPath: string;
    applicationPath: string;
    canonicalParentId: string;
  };
} | {
  ok: false;
  code: string;
  error: string;
}> {
  const targetWordPressObjectId = text(input.target.wordpressObjectId);
  const jobWordPressObjectId = input.job.wordpressObjectId == null
    ? ""
    : String(input.job.wordpressObjectId).trim();

  if (!targetWordPressObjectId || !jobWordPressObjectId || targetWordPressObjectId !== jobWordPressObjectId) {
    return {
      ok: false,
      code: "SAME_TARGET_PREBOUND_WORDPRESS_IDENTITY_MISMATCH",
      error: "Selected target WordPress identity does not match the exact existing job WordPress identity.",
    };
  }

  const validation = await validateExactWordPressDraftCanonicalIdentity({
    campaign: input.campaign,
    target: input.target,
    job: input.job,
    expectedExecutionId: input.expectedExecutionId,
    pathName: "PREBOUND",
  });

  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    wordpressObjectId: validation.wordpressObjectId,
    canonicalIdentity: validation.canonicalIdentity,
  };
}

async function validateSameTargetJobBoundPrewriteWordPressIdentity(input: {
  campaign: {
    campaignId: string;
    organizationId: string;
    siteId: string;
    productId: string;
  };
  target: {
    targetId: string;
    stateCode: string;
    citySlug?: string | null;
    status: string;
    wordpressObjectId?: string | null;
  };
  job: {
    jobId: string;
    organizationId?: string;
    siteId?: string;
    productId?: string;
    externalExecutionId?: string | null;
    status: string;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
    generatedDraft?: {
      title: string;
      contentHtml: string;
      slug: string;
      excerpt?: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyphrase?: string;
    } | null;
  };
  expectedExecutionId: string;
}): Promise<{
  ok: true;
  wordpressObjectId: string;
  canonicalIdentity: {
    canonicalPath: string;
    applicationPath: string;
    canonicalParentId: string;
  };
} | {
  ok: false;
  code: string;
  error: string;
}> {
  if (text(input.target.wordpressObjectId)) {
    return {
      ok: false,
      code: "SAME_TARGET_JOB_BOUND_PREWRITE_TARGET_ALREADY_BOUND",
      error: "Selected target already has a canonical WordPress identity.",
    };
  }

  const jobWordPressObjectId = input.job.wordpressObjectId == null
    ? ""
    : String(input.job.wordpressObjectId).trim();
  if (!jobWordPressObjectId) {
    return {
      ok: false,
      code: "SAME_TARGET_JOB_BOUND_PREWRITE_JOB_WORDPRESS_ID_REQUIRED",
      error: "Selected job does not expose a WordPress draft identity for exact continuation.",
    };
  }

  if (
    text(input.job.organizationId) !== input.campaign.organizationId
    || text(input.job.siteId) !== input.campaign.siteId
    || text(input.job.productId) !== input.campaign.productId
  ) {
    return {
      ok: false,
      code: "SAME_TARGET_JOB_BOUND_PREWRITE_CAMPAIGN_IDENTITY_MISMATCH",
      error: "Selected job identity does not match the exact campaign scope.",
    };
  }

  const validation = await validateExactWordPressDraftCanonicalIdentity({
    campaign: input.campaign,
    target: input.target,
    job: input.job,
    expectedExecutionId: input.expectedExecutionId,
    pathName: "JOB_BOUND_PREWRITE",
  });

  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    wordpressObjectId: validation.wordpressObjectId,
    canonicalIdentity: validation.canonicalIdentity,
  };
}

function resolveUpdateOperationFromPageType(pageType: string): GlwLocalPlannedOperation | null {
  if (pageType === "state_service") return "UPDATE_STATE";
  if (pageType === "city_service") return "UPDATE_CITY";
  if (pageType === "general_service") return "UPDATE_GENERAL";
  return null;
}

function isOutdoorSphereTargetScope(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
}): boolean {
  return isOutdoorSphereCampaignScope({
    campaignId: input.campaignId,
    organizationId: input.organizationId,
    siteId: input.siteId,
  }) && input.productId === "prod-outdoor-digital-sphere";
}

function isExactRecoverableZeroAuthorityFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
  wordpressObjectId?: string | number | null;
  wordpressStatus?: string | null;
}): boolean {
  return job.status === "FAILED"
    && job.errorCode === "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED"
    && Boolean(job.generatedDraft)
    && !job.wordpressObjectId
    && job.wordpressStatus !== "publish";
}

function isExactRecoverableOutdoorSphereRichCompositionFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
  wordpressObjectId?: string | number | null;
  wordpressStatus?: string | null;
}): boolean {
  return job.status === "CONTENT_READY"
    && job.errorCode === "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED"
    && Boolean(job.generatedDraft)
    && Boolean(job.wordpressObjectId)
    && job.wordpressStatus === "draft"
    && job.wordpressStatus !== "publish";
}

function isExactRecoverableCanonicalIdentityFailure(input: {
  target: {
    status: string;
    lastError?: string | null;
    wordpressObjectId?: string | number | null;
  };
  job: {
    status: string;
    externalExecutionId?: string | null;
    generatedDraft?: unknown;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
  };
}): boolean {
  const targetWordPressObjectId = input.target.wordpressObjectId == null
    ? null
    : String(input.target.wordpressObjectId).trim();
  const jobWordPressObjectId = input.job.wordpressObjectId == null
    ? null
    : String(input.job.wordpressObjectId).trim();
  const matchingWordPressIdentity = Boolean(
    !targetWordPressObjectId
    || (jobWordPressObjectId && targetWordPressObjectId === jobWordPressObjectId),
  );

  return input.target.status === "failed"
    && input.target.lastError === "DRAFT_READY_CANONICAL_PATH_REQUIRED"
    && input.job.status === "COMPLETE"
    && Boolean(input.job.generatedDraft)
    && Boolean(jobWordPressObjectId)
    && matchingWordPressIdentity
    && input.job.wordpressStatus === "draft"
    && input.job.wordpressStatus !== "publish";
}

function isExactRecoverableGeneratedContentFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
  wordpressObjectId?: string | number | null;
  wordpressStatus?: string | null;
}): boolean {
  return job.status === "FAILED"
    && Boolean(job.generatedDraft)
    && !job.wordpressObjectId
    && job.wordpressStatus !== "publish"
    && (
      job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      || job.errorCode?.startsWith("CONTENT_REPAIR_") === true
    );
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      campaignId: string;
    }>;
  },
) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const { campaignId } = await context.params;

  const body = await request.json().catch(() => null) as {
    confirm?: string;
    targetId?: string;
    jobId?: string;
    executionId?: string;
  } | null;

  if (body?.confirm !== "RECONCILE_EXISTING_DRAFT_BATCH") {
    return NextResponse.json(
      {
        error:
          "Explicit reconciliation confirmation is required.",
      },
      {
        status: 400,
      },
    );
  }

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId,
  );

  if (!campaign) {
    return NextResponse.json(
      {
        error: "Campaign was not found.",
      },
      {
        status: 404,
      },
    );
  }
  if (campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releasedExpiredLeaseCount = releaseExpiredGlwCampaignTargetLeases(campaignId);

  const expectedTargetId = asTrimmed(body?.targetId);
  const expectedJobId = asTrimmed(body?.jobId);
  const expectedExecutionId = asTrimmed(body?.executionId);

  if (expectedTargetId && (!expectedJobId || !expectedExecutionId)) {
    return NextResponse.json({
      error: "Exact target continuation requires targetId, jobId, and executionId.",
    }, { status: 400 });
  }

  const allTargets = listGlwCampaignTargets(campaignId);
  let exactTargetPreflightResult:
    | {
        action: "draft_ready";
        target: {
          stateCode: string;
          citySlug?: string | null;
          cityName?: string | null;
        };
        jobId: string;
        wordpressObjectId: string;
        canonicalIdentity: {
          canonicalPath: string;
          applicationPath: string;
          canonicalParentId: string;
        };
        executionIdAfter: string | null;
      }
    | null = null;
  let reconcilableTargets =
    allTargets.filter(
      (target) =>
        (
          target.status === "running"
          || target.status === "content_ready"
          || target.status === "failed"
        )
        && Boolean(target.jobId),
    );

  if (expectedTargetId) {
    const selected = allTargets.find((target) => target.targetId === expectedTargetId) ?? null;
    if (!selected || selected.campaignId !== campaignId) {
      return NextResponse.json({ error: "Selected target does not belong to the exact campaign." }, { status: 409 });
    }
    if (!selected.jobId || selected.jobId !== expectedJobId) {
      return NextResponse.json({ error: "Selected target does not match the exact existing job." }, { status: 409 });
    }
    const selectedJob = await glwPageExecutionRepository.getById(selected.jobId);
    if (!selectedJob) {
      return NextResponse.json({ error: "Selected target job was not found." }, { status: 409 });
    }
    const selectedTargetWordPressObjectId = selected.wordpressObjectId == null
      ? null
      : String(selected.wordpressObjectId).trim();
    const selectedJobWordPressObjectId = selectedJob.wordpressObjectId == null
      ? null
      : String(selectedJob.wordpressObjectId).trim();
    if (selectedTargetWordPressObjectId && selectedJobWordPressObjectId && selectedTargetWordPressObjectId !== selectedJobWordPressObjectId) {
      return NextResponse.json({ error: "Selected target WordPress identity does not match the exact existing job WordPress identity." }, { status: 409 });
    }
    if (selectedTargetWordPressObjectId && !selectedJobWordPressObjectId) {
      return NextResponse.json({ error: "Selected target WordPress identity does not match the exact existing job WordPress identity." }, { status: 409 });
    }
    if ((selectedJob.externalExecutionId ?? "") !== expectedExecutionId) {
      return NextResponse.json({ error: "Selected target execution identity does not match the exact existing execution." }, { status: 409 });
    }

    if (selected.status === "draft_ready") {
      if (!selectedTargetWordPressObjectId || !selectedJobWordPressObjectId || selectedTargetWordPressObjectId !== selectedJobWordPressObjectId) {
        return NextResponse.json({ error: "Selected draft-ready target WordPress identity does not match the exact existing job WordPress identity." }, { status: 409 });
      }
      if (selectedJob.wordpressStatus !== "draft") {
        return NextResponse.json({ error: "Selected draft-ready target no longer maps to a draft WordPress object." }, { status: 409 });
      }

      return NextResponse.json({
        campaignId,
        reconciledTargetCount: 1,
        releasedExpiredLeaseCount,
        results: [
          {
            ...targetIdentity(selected),
            jobId: selected.jobId,
            action: "draft_ready",
            wordpressObjectId: selectedTargetWordPressObjectId,
            canonicalPath: selected.canonicalPath ?? null,
            applicationPath: selected.applicationPath ?? null,
            canonicalParentId: selected.canonicalParentId ?? null,
            executionIdAfter: selectedJob.externalExecutionId ?? null,
            reconciliationReason: "IDEMPOTENT_DRAFT_READY",
          },
        ],
        publicationIntent: "draft",
        publicationPerformed: false,
      });
    }

    const selectedJobWordPressStatus = text(selectedJob.wordpressStatus).toLowerCase();
    const selectedIsRecoverablePartialDraftTarget = (selected.status === "failed" || selected.status === "content_ready")
      && isExactRecoverableOutdoorSphereRichCompositionFailure(selectedJob);
    const selectedIsRecoverableFailedTarget = (selected.status === "failed" || selected.status === "content_ready" || selected.status === "running")
      && isExactRecoverableZeroAuthorityFailure(selectedJob);
    const selectedIsRecoverableContentFailure = selected.status === "content_ready"
      && isExactRecoverableGeneratedContentFailure(selectedJob);
    const selectedIsRecoverableReferenceCompleteTarget = selected.status === "reference_complete"
      && !selectedTargetWordPressObjectId
      && selected.jobId === expectedJobId
      && (selectedJob.externalExecutionId ?? "") === expectedExecutionId
      && (
        selectedJob.status === "CONTENT_READY"
        || isExactRecoverableGeneratedContentFailure(selectedJob)
        || isExactRecoverableZeroAuthorityFailure(selectedJob)
      );
    const selectedIsRecoverableCanonicalIdentityFailedTarget = isExactRecoverableCanonicalIdentityFailure({
      target: selected,
      job: selectedJob,
    });

    const selectedSameTargetUnprojectedIdentityCandidate = Boolean(
      !selectedTargetWordPressObjectId
      && selectedJobWordPressObjectId
      && !selectedIsRecoverablePartialDraftTarget
      && !selectedIsRecoverableCanonicalIdentityFailedTarget
      && selected.status === "content_ready"
      && selectedJob.status === "CONTENT_READY"
      && selectedJobWordPressStatus === "draft"
      && selectedJob.generatedDraft,
    );

    let selectedSameTargetUnprojectedIdentityResult: Awaited<ReturnType<typeof validateSameTargetUnprojectedWordPressIdentity>> | null = null;
    if (selectedSameTargetUnprojectedIdentityCandidate) {
      selectedSameTargetUnprojectedIdentityResult = await validateSameTargetUnprojectedWordPressIdentity({
        campaign,
        target: selected,
        job: selectedJob,
        expectedExecutionId,
      });

      if (!selectedSameTargetUnprojectedIdentityResult.ok) {
        return NextResponse.json({
          error: selectedSameTargetUnprojectedIdentityResult.error,
          code: selectedSameTargetUnprojectedIdentityResult.code,
        }, { status: 409 });
      }
    }

    const selectedSameTargetPreboundIdentityCandidate = Boolean(
      selectedTargetWordPressObjectId
      && selectedJobWordPressObjectId
      && selectedTargetWordPressObjectId === selectedJobWordPressObjectId
      && !selectedIsRecoverablePartialDraftTarget
      && !selectedIsRecoverableCanonicalIdentityFailedTarget
      && selected.status === "content_ready"
      && selectedJob.status === "CONTENT_READY"
      && (selectedJobWordPressStatus === "" || selectedJobWordPressStatus === "draft")
      && selectedJob.generatedDraft,
    );

    let selectedSameTargetPreboundIdentityResult: Awaited<ReturnType<typeof validateSameTargetPreboundWordPressIdentity>> | null = null;
    if (selectedSameTargetPreboundIdentityCandidate) {
      selectedSameTargetPreboundIdentityResult = await validateSameTargetPreboundWordPressIdentity({
        campaign,
        target: selected,
        job: selectedJob,
        expectedExecutionId,
      });

      if (!selectedSameTargetPreboundIdentityResult.ok) {
        return NextResponse.json({
          error: selectedSameTargetPreboundIdentityResult.error,
          code: selectedSameTargetPreboundIdentityResult.code,
        }, { status: 409 });
      }
    }

    const selectedSameTargetJobBoundPrewriteCandidate = Boolean(
      !selectedTargetWordPressObjectId
      && selectedJobWordPressObjectId
      && !selectedSameTargetUnprojectedIdentityCandidate
      && !selectedIsRecoverablePartialDraftTarget
      && !selectedIsRecoverableCanonicalIdentityFailedTarget
      && selected.status === "content_ready"
      && selectedJob.status === "CONTENT_READY"
      && (selectedJobWordPressStatus === "" || selectedJobWordPressStatus === "draft")
      && selectedJob.generatedDraft,
    );

    let selectedSameTargetJobBoundPrewriteIdentityResult: Awaited<ReturnType<typeof validateSameTargetJobBoundPrewriteWordPressIdentity>> | null = null;
    if (selectedSameTargetJobBoundPrewriteCandidate) {
      selectedSameTargetJobBoundPrewriteIdentityResult = await validateSameTargetJobBoundPrewriteWordPressIdentity({
        campaign,
        target: selected,
        job: selectedJob,
        expectedExecutionId,
      });

      if (!selectedSameTargetJobBoundPrewriteIdentityResult.ok) {
        return NextResponse.json({
          error: selectedSameTargetJobBoundPrewriteIdentityResult.error,
          code: selectedSameTargetJobBoundPrewriteIdentityResult.code,
        }, { status: 409 });
      }
    }

    if (selected.status === "failed" && !selectedIsRecoverableFailedTarget && !selectedIsRecoverablePartialDraftTarget && !selectedIsRecoverableCanonicalIdentityFailedTarget) {
      return NextResponse.json({ error: "Selected failed target is not recoverable for exact continuation." }, { status: 409 });
    }
    if (selected.status === "content_ready" && selectedJob.status === "FAILED" && !selectedIsRecoverableFailedTarget && !selectedIsRecoverablePartialDraftTarget && !selectedIsRecoverableContentFailure) {
      return NextResponse.json({ error: "Selected content-ready target has a failed job that is not recoverable for exact continuation." }, { status: 409 });
    }
    if (selected.status === "running" && selectedJob.status === "FAILED" && !selectedIsRecoverableFailedTarget) {
      return NextResponse.json({ error: "Selected running target has a failed job that is not recoverable for exact continuation." }, { status: 409 });
    }
    if (
      selected.status !== "failed"
      && selected.status !== "content_ready"
      && selected.status !== "running"
      && !selectedIsRecoverableReferenceCompleteTarget
    ) {
      return NextResponse.json({ error: "Selected target is not in a continuable content-ready state." }, { status: 409 });
    }
    if (selectedJob.wordpressStatus === "publish") {
      return NextResponse.json({ error: "Published targets cannot continue through draft continuation." }, { status: 409 });
    }
    if (selectedJob.wordpressObjectId
      && !selectedIsRecoverablePartialDraftTarget
      && !selectedIsRecoverableCanonicalIdentityFailedTarget
      && !selectedSameTargetUnprojectedIdentityResult
      && !selectedSameTargetPreboundIdentityResult
      && !selectedSameTargetJobBoundPrewriteIdentityResult) {
      return NextResponse.json({ error: "Conflicting existing WordPress identity detected on the selected job." }, { status: 409 });
    }

    if (selectedSameTargetUnprojectedIdentityResult?.ok) {
      const updated = reconcileGlwContentReadyTargetDraft({
        campaignId,
        targetId: selected.targetId,
        stateCode: selected.stateCode,
        citySlug: selected.citySlug,
        jobId: selected.jobId,
        wordpressObjectId: selectedSameTargetUnprojectedIdentityResult.wordpressObjectId,
        canonicalIdentity: selectedSameTargetUnprojectedIdentityResult.canonicalIdentity,
      });

      exactTargetPreflightResult = {
        action: "draft_ready",
        target: selected,
        jobId: selected.jobId,
        wordpressObjectId: updated.wordpressObjectId ?? selectedSameTargetUnprojectedIdentityResult.wordpressObjectId,
        canonicalIdentity: {
          canonicalPath: updated.canonicalPath ?? selectedSameTargetUnprojectedIdentityResult.canonicalIdentity.canonicalPath,
          applicationPath: updated.applicationPath ?? selectedSameTargetUnprojectedIdentityResult.canonicalIdentity.applicationPath,
          canonicalParentId: updated.canonicalParentId ?? selectedSameTargetUnprojectedIdentityResult.canonicalIdentity.canonicalParentId,
        },
        executionIdAfter: selectedJob.externalExecutionId ?? null,
      };
    }

    let selectedReconcilableTarget = selected;

    if (selectedIsRecoverableReferenceCompleteTarget) {
      try {
        selectedReconcilableTarget = reconcileGlwReferenceTargetContentReadyForContinuation({
          campaignId,
          stateCode: selected.stateCode,
          citySlug: selected.citySlug,
          expectedJobId: selected.jobId,
        });
      } catch {
        return NextResponse.json({ error: "Selected reference-complete target could not be reconciled for exact continuation." }, { status: 409 });
      }
    }

    if (selected.status === "running" && selectedJob.status === "CONTENT_READY") {
      try {
        const updated = reconcileGlwCampaignTargetContentReady({
          campaignId,
          targetId: selected.targetId,
          stateCode: selected.stateCode,
          citySlug: selected.citySlug,
          jobId: selected.jobId,
          leaseId: selected.leaseId ?? null,
          externalExecutionId: selectedJob.externalExecutionId ?? "",
        });
        selectedReconcilableTarget = updated.target;
      } catch {
        return NextResponse.json({
          campaignId,
          reconciledTargetCount: 1,
          releasedExpiredLeaseCount,
          results: [
            {
              ...targetIdentity(selected),
              jobId: selected.jobId,
              action: "wait",
              generationStatus: selectedJob.status,
              waitReason: "ACTIVE_LEASE",
              leaseExpiresAt: selected.leaseExpiresAt ?? null,
            },
          ],
          publicationIntent: "draft",
          publicationPerformed: false,
        });
      }
    }

    reconcilableTargets = [selectedReconcilableTarget];
  }

  const origin = request.nextUrl.origin;

  const results: Array<Record<string, unknown>> = [];

  if (expectedTargetId && exactTargetPreflightResult) {
    results.push({
      ...targetIdentity(exactTargetPreflightResult.target),
      jobId: exactTargetPreflightResult.jobId,
      action: "draft_ready",
      wordpressObjectId: exactTargetPreflightResult.wordpressObjectId,
      canonicalPath: exactTargetPreflightResult.canonicalIdentity.canonicalPath,
      applicationPath: exactTargetPreflightResult.canonicalIdentity.applicationPath,
      canonicalParentId: exactTargetPreflightResult.canonicalIdentity.canonicalParentId,
      executionIdAfter: exactTargetPreflightResult.executionIdAfter,
      reconciliationReason: "SAME_TARGET_UNPROJECTED_WORDPRESS_IDENTITY",
    });

    return NextResponse.json({
      campaignId,
      reconciledTargetCount: 1,
      releasedExpiredLeaseCount,
      results,
      publicationIntent: "draft",
      publicationPerformed: false,
    });
  }

  for (const target of reconcilableTargets) {
    const jobId = target.jobId!;

    try {
      const refreshUrl = new URL(
        "/api/glw/page-generation",
        origin,
      );

      refreshUrl.searchParams.set(
        "jobId",
        jobId,
      );

      refreshUrl.searchParams.set(
        "refresh",
        "true",
      );

      const refreshResponse = await fetch(
        refreshUrl,
        {
          method: "GET",
          headers: internalHeaders(
            request,
            target.organizationId,
            target.siteId,
          ),
          cache: "no-store",
        },
      );

      const refreshPayload =
        await refreshResponse.json();

      let job = refreshPayload.job;

      if (!job) {
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "error",
          error:
            refreshPayload.error
            ?? "Recovery returned no generation job.",
        });

        continue;
      }

      let decision =
        resolveGlwCampaignJobReconciliationDecision(
          job,
        );

      const exactRecoverableFailedContinuation = Boolean(
        expectedTargetId
        && (target.status === "failed" || target.status === "content_ready" || target.status === "running")
        && target.jobId === expectedJobId
        && (job.externalExecutionId ?? "") === expectedExecutionId
        && !target.wordpressObjectId
        && isExactRecoverableZeroAuthorityFailure(job),
      );
      const exactRecoverablePartialDraftContinuation = Boolean(
        expectedTargetId
        && (target.status === "failed" || target.status === "content_ready")
        && target.jobId === expectedJobId
        && (job.externalExecutionId ?? "") === expectedExecutionId
        && isExactRecoverableOutdoorSphereRichCompositionFailure(job),
      );

      let effectiveTarget = target;

      if (decision.action === "continue" && target.status === "running" && job.status === "CONTENT_READY" && job.externalExecutionId) {
        if (expectedTargetId && (target.targetId !== expectedTargetId || target.jobId !== expectedJobId || job.externalExecutionId !== expectedExecutionId)) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "error",
            error: "Selected target execution identity does not match the exact existing execution.",
          });
          continue;
        }

        let updated;
        try {
          updated = reconcileGlwCampaignTargetContentReady({
            campaignId,
            targetId: target.targetId,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
            jobId,
            leaseId: target.leaseId ?? null,
            externalExecutionId: job.externalExecutionId,
          });
        } catch {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "wait",
            generationStatus: job.status,
            waitReason: "ACTIVE_LEASE",
            leaseExpiresAt: target.leaseExpiresAt ?? null,
          });
          continue;
        }

        effectiveTarget = updated.target;

        if (!expectedTargetId) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "content_ready",
            targetStatus: updated.target.status,
            attemptCount: updated.target.attemptCount,
            leaseHistory: updated.leaseHistory,
          });
          continue;
        }
      }

      if (decision.action === "continue" || exactRecoverableFailedContinuation || exactRecoverablePartialDraftContinuation) {
        const { form } =
          buildGlwCampaignProductionGenerationForm({
            campaign,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
          });

        if (form.publicationIntent !== "draft") {
          throw new Error(
            "Campaign reconciliation rejected non-draft generation authority.",
          );
        }

        let continuationForm = form;
        const continuationJobWordPressObjectId = text(job.wordpressObjectId);
        const continuationJobWordPressStatus = text(job.wordpressStatus).toLowerCase();
        const exactJobBoundPrewriteContinuationCandidate = Boolean(
          expectedTargetId
          && !exactRecoverablePartialDraftContinuation
          && !exactRecoverableFailedContinuation
          && target.targetId === expectedTargetId
          && target.jobId === expectedJobId
          && target.status === "content_ready"
          && !target.wordpressObjectId
          && continuationJobWordPressObjectId
          && job.status === "CONTENT_READY"
          && (continuationJobWordPressStatus === "" || continuationJobWordPressStatus === "draft")
          && job.generatedDraft
          && (job.externalExecutionId ?? "") === expectedExecutionId,
        );

        if (exactJobBoundPrewriteContinuationCandidate) {
          const expectedUpdateOperation = resolveUpdateOperationFromPageType(form.pageType);
          if (!expectedUpdateOperation) {
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "continue_error",
              httpStatus: 409,
              error: "Exact content-ready continuation lacks a supported page type for authoritative update continuation.",
            });
            continue;
          }

          const preflightRequest: GlwGenerationRequest = {
            siteId: form.siteId,
            productId: form.productId,
            pageType: form.pageType,
            stateCode: form.stateCode,
            citySlug: form.citySlug,
            slug: form.slug,
            title: form.title,
            seoTitle: form.seoTitle,
            metaDescription: form.metaDescription,
            publicationIntent: "draft",
            plannedOperation: form.plannedOperation ?? expectedUpdateOperation,
            wordpressObjectId: form.wordpressObjectId ?? null,
            additionalInstructions: form.additionalInstructions,
            imageDirection: form.imageDirection,
            campaignId: form.campaignId,
            organizationId: campaign.organizationId,
            siteName: campaign.siteId,
            siteDomain: null,
            siteCanonicalUrl: null,
            wordpressApiBaseUrl: null,
            productTopic: form.productTopic,
            stateName: null,
            cityName: null,
            canonicalPath: form.slug,
            externalExecutionAllowed: false,
          };

          const site = getSiteById(campaign.siteId);
          const apiBaseUrl = site?.integrations.wordpressApiBaseUrl?.trim() ?? "";
          const credential = resolveWordPressCredentialReference(site?.integrations.wordpressCredentialReference ?? null);
          if (!site || !apiBaseUrl || !credential) {
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "continue_error",
              httpStatus: 409,
              error: "Exact content-ready continuation requires authenticated WordPress authority.",
            });
            continue;
          }

          const wordpressReadAuthority = createAuthenticatedWordPressReadAuthority({
            configuration: {
              apiBaseUrl,
              username: credential.username,
              applicationPassword: credential.applicationPassword,
              timeoutMs: 30_000,
            },
          });

          const targetPreflight = await readGlwTargetPreflight({
            request: preflightRequest,
            wordpressReadAuthority,
            localExecutions: await glwPageExecutionRepository.list(),
          });
          const mutationAvailability = resolveGlwTargetMutationAvailability(targetPreflight, preflightRequest.pageType);
          const authoritativeWordPressObjectId = text(mutationAvailability.wordpressObjectId);

          if (
            mutationAvailability.plannedOperation !== expectedUpdateOperation
            || !authoritativeWordPressObjectId
            || authoritativeWordPressObjectId !== continuationJobWordPressObjectId
          ) {
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "continue_error",
              httpStatus: 409,
              error: "Exact content-ready continuation requires authoritative exact update identity before persistence.",
            });
            continue;
          }

          continuationForm = {
            ...form,
            plannedOperation: expectedUpdateOperation,
            wordpressObjectId: authoritativeWordPressObjectId,
            publicationIntent: "draft",
          };
        }

        const continueResponse = await fetch(
          new URL(
            "/api/glw/page-generation",
            origin,
          ),
          {
            method: "POST",
            headers: internalHeaders(
              request,
              target.organizationId,
              target.siteId,
            ),
            body: JSON.stringify({
              form: continuationForm,
              action: "continue",
              jobId,
              targetId: effectiveTarget.targetId,
              executionId: expectedTargetId ? expectedExecutionId : (job.externalExecutionId ?? null),
            }),
            cache: "no-store",
          },
        );

        const continuePayload =
          await continueResponse.json();

        if (!continueResponse.ok || continuePayload?.ok !== true) {
          const continuationPendingJob = continuePayload?.job as {
            status?: string;
            externalExecutionId?: string | null;
            wordpressObjectId?: string | number | null;
            wordpressStatus?: string | null;
          } | undefined;
          const continuationPending = Boolean(
            expectedTargetId
            && continuationPendingJob
            && continuationPendingJob.status === "CONTENT_READY"
            && (continuationPendingJob.externalExecutionId ?? "") === expectedExecutionId
            && !continuationPendingJob.wordpressObjectId
            && continuationPendingJob.wordpressStatus !== "publish",
          );
          if (continuationPending) {
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "wait",
              generationStatus: continuationPendingJob?.status ?? "CONTENT_READY",
              waitReason: "DRAFT_PERSISTENCE_PENDING",
            });
            continue;
          }

          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: continueResponse.status,
            error:
              continuePayload.error
              ?? continuePayload.issues
              ?? "Exact job continuation did not reach durable WordPress draft persistence.",
          });

          continue;
        }

        job = continuePayload.job;

        decision =
          resolveGlwCampaignJobReconciliationDecision(
            job,
          );

        if (expectedTargetId && decision.action !== "draft_ready") {
          if (decision.action === "wait" || decision.action === "continue") {
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "wait",
              generationStatus: job.status,
              waitReason: "DRAFT_PERSISTENCE_PENDING",
            });
            continue;
          }

          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: 409,
            error: "Exact content-ready continuation did not produce a durable draft-ready result.",
          });
          continue;
        }
      }

      if (decision.action === "draft_ready") {
        const canonicalIdentityRequired = isOutdoorSphereTargetScope({
          campaignId,
          organizationId: campaign.organizationId,
          siteId: campaign.siteId,
          productId: campaign.productId,
        });

        let canonicalIdentity: {
          canonicalPath: string;
          applicationPath: string;
          canonicalParentId: string;
        } | undefined;

        if (canonicalIdentityRequired) {
          const { form } =
            buildGlwCampaignProductionGenerationForm({
              campaign,
              stateCode: target.stateCode,
              citySlug: target.citySlug,
            });

          const canonicalPathFromForm = normalizeCanonicalPath(form.slug ?? "");
          const canonicalPathFromJob = normalizeCanonicalPath(job.slug ?? "");
          if (!canonicalPathFromForm) {
            const updatedFailed =
              markGlwCampaignTargetFailed({
                campaignId,
                stateCode: target.stateCode,
                citySlug: target.citySlug,
                jobId,
                error: "DRAFT_READY_CANONICAL_PATH_REQUIRED",
              });
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "failed",
              error: updatedFailed.lastError,
            });
            continue;
          }

          const readback = await readWordPressDraftIdentity({
            siteId: campaign.siteId,
            wordpressObjectId: decision.wordpressObjectId,
          });
          const expectedSlug = canonicalPathFromForm.split("/").filter(Boolean).at(-1) ?? "";
          if (!expectedSlug || readback.slug !== expectedSlug) {
            const updatedFailed =
              markGlwCampaignTargetFailed({
                campaignId,
                stateCode: target.stateCode,
                citySlug: target.citySlug,
                jobId,
                error: "DRAFT_READY_WORDPRESS_SLUG_MISMATCH",
              });
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "failed",
              error: updatedFailed.lastError,
            });
            continue;
          }

          if (canonicalPathFromJob && canonicalPathFromJob !== canonicalPathFromForm) {
            const updatedFailed =
              markGlwCampaignTargetFailed({
                campaignId,
                stateCode: target.stateCode,
                citySlug: target.citySlug,
                jobId,
                error: "DRAFT_READY_CANONICAL_PATH_REQUIRED",
              });
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "failed",
              error: updatedFailed.lastError,
            });
            continue;
          }

          canonicalIdentity = {
            canonicalPath: canonicalPathFromForm,
            applicationPath: canonicalPathFromForm,
            canonicalParentId: readback.parentId,
          };
        }

        const updateInput = {
          campaignId,
          stateCode: effectiveTarget.stateCode,
          citySlug: effectiveTarget.citySlug,
          jobId,
          wordpressObjectId:
            decision.wordpressObjectId,
          canonicalIdentity,
        };

        const updated =
          effectiveTarget.status === "content_ready"
            ? reconcileGlwContentReadyTargetDraft({
                ...updateInput,
                targetId: effectiveTarget.targetId,
              })
            : effectiveTarget.status === "failed"
            ? markGlwFailedCampaignTargetDraftReady(updateInput)
            : markGlwCampaignTargetDraftReady(updateInput);

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "draft_ready",
          wordpressObjectId:
            updated.wordpressObjectId,
          canonicalPath: updated.canonicalPath ?? null,
          applicationPath: updated.applicationPath ?? null,
          canonicalParentId: updated.canonicalParentId ?? null,
          executionIdAfter: job.externalExecutionId ?? null,
        });

        continue;
      }

      if (decision.action === "failed") {
        const updated =
          markGlwCampaignTargetFailed({
            campaignId,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
            jobId,
            error: decision.error,
          });

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "failed",
          error: updated.lastError,
        });

        continue;
      }

      if (decision.action === "requeue") {
        const updated = requeueGlwCampaignTargetAfterPreExecutionFailure({
          campaignId,
          stateCode: target.stateCode,
          citySlug: target.citySlug,
          jobId,
          error: decision.error,
        });
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "requeued",
          error: updated.lastError,
        });
        continue;
      }

      results.push({
        ...targetIdentity(target),
        jobId,
        action: "wait",
        generationStatus: job.status,
      });
    }
    catch (error) {
      results.push({
        ...targetIdentity(target),
        jobId,
        action: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown reconciliation error.",
      });
    }
  }

  if (expectedTargetId) {
    const selectedResult = results[0] ?? null;
    if (!selectedResult) {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
        error: "Exact content-ready continuation failed before durable WordPress draft persistence.",
      }, { status: 409 });
    }

    if (selectedResult.action === "wait") {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
      });
    }

    if (selectedResult.action !== "draft_ready") {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
        error: selectedResult?.error ?? "Exact content-ready continuation failed before durable WordPress draft persistence.",
      }, { status: 409 });
    }
  }

  return NextResponse.json({
    campaignId,
    reconciledTargetCount:
      reconcilableTargets.length,
    releasedExpiredLeaseCount,
    results,
    publicationIntent: "draft",
    publicationPerformed: false,
  });
}
