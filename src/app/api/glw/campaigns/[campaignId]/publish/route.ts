import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { load } from "cheerio";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { renderedVisualDecisionCurrency } from "@/modules/foundation/rendered-visual-certification";
import { listRenderedVisualCertifications, listRenderedVisualOwnerDecisions } from "@/modules/foundation/rendered-visual-certification-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { transitionGenesisWordPressPageStatus } from "@/modules/foundation/wordpress-publish-writer";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  type GlwCampaignTarget,
  listGlwCampaignTargets,
  markGlwCampaignTargetPublished,
  summarizeGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";
import {
  consumeExactPublicationRollbackGrant,
  EXACT_WORDPRESS_PUBLICATION,
  issueExactPublicationRollbackGrant,
  issueExactPublicationRollbackPreflight,
  recordExactPublicationRollbackReceipt,
  type ExactPublicationRollbackContext,
} from "@/modules/glw/exact-publication-rollback-authority";
import { listProductMediaAuthority, evaluateProductMediaReadiness } from "@/modules/glw/product-media-authority";
import { reconcileGlwPageExecutionPublished, glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

const RUNTIME_SHA_PATTERN = /^[0-9a-f]{40}$/;

type WordPressDraftSnapshot = {
  wordpressObjectId: string;
  parentObjectId: string;
  slug: string;
  title: string;
  featuredMediaId: number;
  rawPostContent: string;
  status: "draft" | "publish";
};

type GateAssessment = {
  eligible: boolean;
  blockers: readonly string[];
  reason?: string;
  context?: ExactPublicationRollbackContext;
};

function normalizePath(value: string | null | undefined): string {
  const normalized = `/${(value ?? "").trim().replace(/^\/+|\/+$/g, "")}/`;
  return normalized === "//" ? "/" : normalized;
}

function contentSha(rawContent: string): string {
  return createHash("sha256").update(rawContent.trim()).digest("hex");
}

async function readWordPressDraftSnapshot(input: { siteId: string; wordpressObjectId: string }): Promise<WordPressDraftSnapshot> {
  const site = getSiteById(input.siteId);
  if (!site?.integrations.wordpressApiBaseUrl) throw new Error("PUBLICATION_GATE_WORDPRESS_SITE_AUTHORITY_UNAVAILABLE");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("PUBLICATION_GATE_WORDPRESS_CREDENTIAL_REQUIRED");

  const reader = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: site.integrations.wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const response = await reader.getJson({
    path: `/pages/${input.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,featured_media,content" }),
  });

  if (!response.ok || !response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    throw new Error("PUBLICATION_GATE_WORDPRESS_READ_FAILED");
  }

  const page = response.body as Record<string, unknown>;
  const content = page.content && typeof page.content === "object" && !Array.isArray(page.content)
    ? page.content as Record<string, unknown>
    : {};
  const title = page.title && typeof page.title === "object" && !Array.isArray(page.title)
    ? page.title as Record<string, unknown>
    : {};
  const status = typeof page.status === "string" ? page.status.trim() : "";

  if (status !== "draft" && status !== "publish") throw new Error("PUBLICATION_GATE_WORDPRESS_STATUS_INVALID");

  return {
    wordpressObjectId: String(page.id ?? "").trim(),
    parentObjectId: String(page.parent ?? "").trim(),
    slug: typeof page.slug === "string" ? page.slug.trim() : "",
    title: typeof title.raw === "string" ? title.raw.trim() : "",
    featuredMediaId: Number(page.featured_media ?? 0),
    rawPostContent: typeof content.raw === "string" ? content.raw : "",
    status,
  };
}

async function evaluateTargetGate(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  target: GlwCampaignTarget;
  runtimeSha: string;
}): Promise<GateAssessment> {
  const blockers: string[] = [];
  const target = input.target;

  if (target.status !== "draft_ready") blockers.push("TARGET_NOT_DRAFT_READY");
  const wordpressObjectId = (target.wordpressObjectId ?? "").trim();
  if (!/^[1-9]\d*$/.test(wordpressObjectId)) blockers.push("WORDPRESS_OBJECT_ID_REQUIRED");
  const jobId = (target.jobId ?? "").trim();
  if (!jobId) blockers.push("TARGET_JOB_ID_REQUIRED");
  if (!target.targetId.trim()) blockers.push("TARGET_ID_REQUIRED");
  if (target.organizationId !== input.organizationId || target.siteId !== input.siteId || target.productId !== input.productId) {
    blockers.push("TARGET_SCOPE_MISMATCH");
  }
  if (!RUNTIME_SHA_PATTERN.test(input.runtimeSha)) blockers.push("RUNTIME_SHA_REQUIRED");
  if (blockers.length > 0) return { eligible: false, blockers };

  const execution = await glwPageExecutionRepository.getById(jobId);
  if (!execution) return { eligible: false, blockers: ["EXECUTION_NOT_FOUND"] };
  if (execution.organizationId !== input.organizationId || execution.siteId !== input.siteId || execution.productId !== input.productId) {
    blockers.push("EXECUTION_SCOPE_MISMATCH");
  }
  if (execution.status !== "COMPLETE") blockers.push("EXECUTION_NOT_COMPLETE");
  if (execution.wordpressStatus !== "draft") blockers.push("EXECUTION_WORDPRESS_STATUS_NOT_DRAFT");
  if ((execution.wordpressObjectId ?? "") !== wordpressObjectId) blockers.push("EXECUTION_WORDPRESS_IDENTITY_MISMATCH");
  if (!(execution.externalExecutionId ?? "").trim()) blockers.push("EXECUTION_EXTERNAL_ID_REQUIRED");
  if (blockers.length > 0) return { eligible: false, blockers };

  const live = await readWordPressDraftSnapshot({
    siteId: input.siteId,
    wordpressObjectId,
  });
  if (live.wordpressObjectId !== wordpressObjectId) blockers.push("WORDPRESS_IDENTITY_MISMATCH");
  if (!/^[1-9]\d*$/.test(live.parentObjectId)) blockers.push("WORDPRESS_PARENT_OBJECT_ID_INVALID");
  if (live.status !== "draft") blockers.push("WORDPRESS_NOT_DRAFT");
  if (!live.slug) blockers.push("WORDPRESS_SLUG_REQUIRED");
  if (!live.title) blockers.push("WORDPRESS_TITLE_REQUIRED");
  if (!Number.isSafeInteger(live.featuredMediaId) || live.featuredMediaId < 0) blockers.push("WORDPRESS_FEATURED_MEDIA_INVALID");
  if (blockers.length > 0) return { eligible: false, blockers };

  const canonicalPath = normalizePath(target.canonicalPath);
  if (canonicalPath === "/") blockers.push("TARGET_CANONICAL_PATH_REQUIRED");
  const currentContentSha = contentSha(live.rawPostContent);
  const expectedPageRevisionIdentity = `job:${execution.jobId}:${execution.updatedAt}`;
  const visualCandidates = listRenderedVisualCertifications({
    organizationId: input.organizationId,
    siteId: input.siteId,
    pageId: target.targetId,
  }).filter((certification) => certification.overallState === "PASS"
    && certification.identity.campaignId === input.campaignId
    && certification.identity.targetId === target.targetId
    && certification.identity.jobId === execution.jobId
    && certification.identity.externalExecutionId === execution.externalExecutionId
    && certification.identity.wordpressObjectId === wordpressObjectId
    && certification.identity.wordpressStatus === "draft"
    && normalizePath(certification.identity.canonicalPath) === canonicalPath
    && certification.identity.pageRevisionIdentity === expectedPageRevisionIdentity
    && typeof certification.identity.renderedContentHash === "string"
    && certification.identity.renderedContentHash.trim().length > 0
    && certification.identity.renderedContentHash === currentContentSha
    && certification.identity.pageRevisionIdentity.trim().length > 0);

  if (visualCandidates.length < 1) blockers.push("VISUAL_CERTIFICATION_PASS_ABSENT");
  const visual = visualCandidates.at(-1) ?? null;
  if (!visual) return { eligible: false, blockers };

  const ownerDecision = listRenderedVisualOwnerDecisions(visual.certificationId).at(-1) ?? null;
  if (!ownerDecision
    || ownerDecision.decision !== "APPROVED"
    || ownerDecision.pageRevisionIdentity !== visual.identity.pageRevisionIdentity
    || ownerDecision.contentHash !== visual.identity.contentHash
    || renderedVisualDecisionCurrency({
      certification: visual,
      decision: ownerDecision,
      currentIdentity: visual.identity,
    }) !== "CURRENT") {
    blockers.push("OWNER_DECISION_ABSENT");
  }

  try {
    const readiness = evaluateProductMediaReadiness(
      listProductMediaAuthority({
        organizationId: input.organizationId,
        siteId: input.siteId,
        productId: input.productId,
      }),
      { stateCode: target.stateCode },
    );
    if (!readiness.ready) blockers.push(...readiness.blockers.map((blocker) => `PRODUCT_AUTHORITY_${blocker}`));
  } catch {
    blockers.push("PRODUCT_AUTHORITY_UNSATISFIED");
  }

  const $ = load(live.rawPostContent, null, false);
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!h1 || $("h1").length !== 1) blockers.push("WORDPRESS_H1_REQUIRED");
  if (blockers.length > 0) return { eligible: false, blockers };

  return {
    eligible: true,
    blockers: [],
    context: {
      operation: EXACT_WORDPRESS_PUBLICATION,
      organizationId: input.organizationId,
      siteId: input.siteId,
      campaignId: input.campaignId,
      productId: input.productId,
      targetId: target.targetId,
      stateCode: target.stateCode,
      wordpressObjectId,
      parentObjectId: live.parentObjectId,
      slug: live.slug,
      canonicalPath,
      expectedH1: h1,
      expectedTitle: live.title,
      featuredMediaId: live.featuredMediaId,
      storedPostContentSha: currentContentSha,
      visualCertificationId: visual.certificationId,
      runtimeSha: input.runtimeSha,
      expectedCurrentStatus: "draft",
      intendedStatus: "publish",
      sourcePublicationReceiptId: null,
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> },
) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;

  if (!campaign || campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  if (campaign.publicationPolicy === "draft_only") {
    return NextResponse.json({
      campaignId,
      eligibleCount: 0,
      eligible: [],
      policyBlocked: true,
      policyReason: "Campaign publication policy is draft_only.",
      publicationPerformed: false,
    });
  }

  const eligible = listGlwCampaignTargets(campaignId)
    .filter((target) => target.status === "draft_ready" && Boolean(target.wordpressObjectId) && Boolean(target.jobId))
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode))
    .map((target) => ({
      stateCode: target.stateCode,
      citySlug: target.citySlug ?? null,
      wordpressObjectId: target.wordpressObjectId!,
      jobId: target.jobId,
    }));

  return NextResponse.json({
    campaignId,
    eligibleCount: eligible.length,
    eligible,
    publicationPerformed: false,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> },
) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { confirm?: string; stateCodes?: string[]; targetId?: string } | null;
  if (body?.confirm !== "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS") {
    return NextResponse.json({ error: "Explicit publish confirmation is required." }, { status: 400 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;

  if (!campaign || campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  if (campaign.publicationPolicy === "draft_only") {
    return NextResponse.json(
      {
        error: "Campaign publication policy is draft_only.",
        policyBlocked: true,
        publicationPerformed: false,
      },
      { status: 409 },
    );
  }

  const principal = resolveGlwTrustedOperatorPrincipal(request);
  if (!principal.ok) {
    return NextResponse.json({ error: principal.message, publicationPerformed: false }, { status: 401 });
  }

  const runtimeSha = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  if (!RUNTIME_SHA_PATTERN.test(runtimeSha)) {
    return NextResponse.json({ error: "Exact running release identity is required.", publicationPerformed: false }, { status: 503 });
  }

  const site = getSiteById(campaign.siteId);
  if (!site || site.organizationId !== campaign.organizationId) {
    return NextResponse.json({ error: "Configured campaign site was not found." }, { status: 409 });
  }

  const requestedStates = new Set(
    (body.stateCodes ?? [])
      .map((stateCode) => stateCode.trim().toUpperCase())
      .filter(Boolean),
  );
  const requestedTargetId = typeof body.targetId === "string" ? body.targetId.trim() : "";

  const draftReadyTargets = listGlwCampaignTargets(campaignId)
    .filter((target) => target.status === "draft_ready" && Boolean(target.wordpressObjectId) && Boolean(target.jobId));

  const stateFilteredTargets = draftReadyTargets
    .filter((target) => requestedStates.size === 0 || requestedStates.has(target.stateCode));

  if (requestedTargetId) {
    const requestedTarget = stateFilteredTargets.find((target) => target.targetId === requestedTargetId) ?? null;
    if (!requestedTarget) {
      return NextResponse.json(
        {
          error: "Exact target is not draft_ready or is outside the requested state scope.",
          campaignId,
          targetId: requestedTargetId,
          attempted: 0,
          succeeded: 0,
          failed: 0,
          results: [],
          queue: summarizeGlwCampaignTargets(campaignId),
          publicationPerformed: false,
        },
        { status: 409 },
      );
    }
  }

  const eligible = stateFilteredTargets
    .filter((target) => !requestedTargetId || target.targetId === requestedTargetId)
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode));

  const results: Array<Record<string, unknown>> = [];

  for (const target of eligible) {
    const wordpressObjectId = target.wordpressObjectId!;

    try {
      const gate = await evaluateTargetGate({
        campaignId,
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        productId: campaign.productId,
        target,
        runtimeSha,
      });

      if (!gate.eligible || !gate.context) {
        results.push({
          stateCode: target.stateCode,
          citySlug: target.citySlug ?? null,
          wordpressObjectId,
          ok: false,
          error: "Publication gates are not satisfied for the exact current target revision.",
          blockers: gate.blockers,
        });
        continue;
      }

      const preflight = issueExactPublicationRollbackPreflight({
        context: gate.context,
        principal: principal.principal,
        preflightVerified: true,
      });
      const grant = issueExactPublicationRollbackGrant({
        preflightId: preflight.preflightId,
        context: gate.context,
        principal: principal.principal,
      });
      const claim = consumeExactPublicationRollbackGrant({
        preflightId: preflight.preflightId,
        grantId: grant.grantId,
        context: gate.context,
        principal: principal.principal,
      });

      const published = await transitionGenesisWordPressPageStatus({
        site,
        identity: {
          wordpressObjectId: gate.context.wordpressObjectId,
          parentObjectId: gate.context.parentObjectId,
          slug: gate.context.slug,
          expectedTitle: gate.context.expectedTitle,
          featuredMediaId: gate.context.featuredMediaId,
          storedPostContentSha: gate.context.storedPostContentSha,
        },
        expectedStatus: "draft",
        intendedStatus: "publish",
      });

      if (!published.ok) {
        results.push({
          stateCode: target.stateCode,
          citySlug: target.citySlug ?? null,
          wordpressObjectId,
          ok: false,
          error: published.message,
          state: published.state,
        });
        continue;
      }

      const receipt = recordExactPublicationRollbackReceipt({
        context: gate.context,
        principal: principal.principal,
        claimId: claim.claimId,
        beforeStatus: "draft",
        afterStatus: "publish",
        beforeContentSha: gate.context.storedPostContentSha,
        afterContentSha: gate.context.storedPostContentSha,
        publicCanonicalHttpStatus: null,
        publicCertificationId: gate.context.visualCertificationId,
        lifecycleState: "PUBLICATION_MUTATED_AWAITING_CERTIFICATION",
        mutationPerformed: true,
      });

      await reconcileGlwPageExecutionPublished({
        jobId: target.jobId!,
        wordpressObjectId,
        wordpressUrl: published.wordpressUrl,
        publicationVerification: {
          state: "RECEIPT_RECORDED",
          receiptId: receipt.receiptId,
          operation: receipt.operation,
          contextFingerprint: receipt.contextFingerprint,
          visualCertificationId: receipt.visualCertificationId,
          lifecycleState: receipt.lifecycleState,
          recordedAt: receipt.recordedAt,
        },
      });

      const updated = markGlwCampaignTargetPublished({
        campaignId,
        stateCode: target.stateCode,
        citySlug: target.citySlug,
        wordpressObjectId,
      });

      results.push({
        stateCode: target.stateCode,
        citySlug: target.citySlug ?? null,
        wordpressObjectId: updated.wordpressObjectId,
        wordpressUrl: published.wordpressUrl,
        receiptId: receipt.receiptId,
        visualCertificationId: gate.context.visualCertificationId,
        ok: true,
      });
    } catch (error) {
      results.push({
        stateCode: target.stateCode,
        citySlug: target.citySlug ?? null,
        wordpressObjectId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown campaign publication error.",
      });
    }
  }

  const succeeded = results.filter((entry) => entry.ok === true).length;
  const failed = results.length - succeeded;

  return NextResponse.json({
    ok: failed === 0,
    campaignId,
    attempted: results.length,
    succeeded,
    failed,
    results,
    queue: summarizeGlwCampaignTargets(campaignId),
    publicationPerformed: succeeded > 0,
  });
}
