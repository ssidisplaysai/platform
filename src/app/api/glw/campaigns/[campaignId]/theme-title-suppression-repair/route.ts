import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { applyScopedThemeTitleSuppression } from "@/modules/glw/scoped-theme-title-suppression";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";

const sha256 = (value: string) => createHash("sha256").update(value.trim()).digest("hex");
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const REQUIRED_CANONICAL_PATH = "outdoor-digital-sphere/florida";
const REQUIRED_WORDPRESS_OBJECT_ID = "20163";

type Context = {
  params: Promise<{ campaignId: string }>;
};

type WordPressDraft = {
  id?: number;
  status?: string;
  slug?: string;
  parent?: number;
  link?: string;
  modified_gmt?: string;
  featured_media?: number;
  title?: { raw?: string; rendered?: string };
  excerpt?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function scopedTitleSelector(wordpressObjectId: string): string {
  return `body.page-id-${wordpressObjectId} .page-title.the-title,body.page-id-${wordpressObjectId} .page-header .entry-title,body.page-id-${wordpressObjectId} .entry-header .entry-title{display:none!important}`;
}

async function authorize(request: NextRequest) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) {
    throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_AUTHORIZED_OPERATOR_REQUIRED");
  }
  return { principal: principal.principal, scope };
}

async function authorizeReadOnly(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  const scope = resolveRequestScope(request);
  if (!auth.ok || !hasOrganizationScope(scope) || !scope.siteId) {
    throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_READ_SCOPE_REQUIRED");
  }
  return { scope };
}

function resolveWordPressMutationAuthority(siteId: string) {
  const site = getSiteById(siteId);
  if (!site?.integrations.wordpressApiBaseUrl) {
    throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_WORDPRESS_AUTHORITY_REQUIRED");
  }
  const credential = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!credential) {
    throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_WORDPRESS_CREDENTIAL_REQUIRED");
  }
  return {
    site,
    apiBaseUrl: site.integrations.wordpressApiBaseUrl,
    username: credential.username,
    applicationPassword: credential.applicationPassword,
    authHeader: authorization(credential.username, credential.applicationPassword),
  };
}

async function readWordPressDraft(input: {
  siteId: string;
  wordpressObjectId: string;
}): Promise<WordPressDraft> {
  const authority = resolveWordPressMutationAuthority(input.siteId);
  const reader = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: authority.apiBaseUrl,
      username: authority.username,
      applicationPassword: authority.applicationPassword,
      timeoutMs: 30_000,
    },
  });
  const read = await reader.getJson({
    path: `/pages/${input.wordpressObjectId}`,
    query: new URLSearchParams({
      context: "edit",
      _fields: "id,status,slug,parent,link,modified_gmt,featured_media,title,excerpt,content",
    }),
  });
  if (!read.ok || !read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
    throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_WORDPRESS_READ_FAILED");
  }
  return read.body as WordPressDraft;
}

async function updateWordPressPostContent(input: {
  siteId: string;
  wordpressObjectId: string;
  contentHtml: string;
  status: string;
}) {
  const authority = resolveWordPressMutationAuthority(input.siteId);
  const response = await fetch(`${authority.apiBaseUrl}/pages/${input.wordpressObjectId}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: authority.authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.contentHtml,
      status: input.status,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`THEME_TITLE_SUPPRESSION_REPAIR_WRITE_FAILED:${response.status}`);
  }
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { scope } = await authorizeReadOnly(request);
    const { campaignId } = await context.params;

    const campaign = listGlwCampaigns().find((candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId
      && candidate.siteId === scope.siteId,
    );
    if (!campaign) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_CAMPAIGN_NOT_FOUND");
    }

    const target = listGlwCampaignTargets(campaignId).find((candidate) =>
      candidate.stateCode === "FL"
      && candidate.citySlug === null
      && candidate.pageType === "state_service"
      && candidate.canonicalPath === REQUIRED_CANONICAL_PATH
      && candidate.wordpressObjectId === REQUIRED_WORDPRESS_OBJECT_ID,
    );
    if (!target) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_TARGET_SCOPE_MISMATCH");
    }

    const job = target.jobId
      ? await glwPageExecutionRepository.getById(target.jobId)
      : null;
    if (!job || job.wordpressObjectId !== REQUIRED_WORDPRESS_OBJECT_ID) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_EXECUTION_NOT_FOUND");
    }

    const draft = await readWordPressDraft({
      siteId: campaign.siteId,
      wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
    });
    const contentHtml = text(draft.content?.raw ?? draft.content?.rendered);
    const currentSha256 = sha256(contentHtml);
    const headingCount = (contentHtml.match(/<h1\b/gi) ?? []).length;

    return NextResponse.json({
      campaignId,
      targetId: target.targetId,
      jobId: job.jobId,
      executionId: job.externalExecutionId,
      wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
      wordpressStatus: text(draft.status),
      canonicalPath: REQUIRED_CANONICAL_PATH,
      currentStoredSha256: currentSha256,
      generatedH1Count: headingCount,
      scopedSelector: scopedTitleSelector(REQUIRED_WORDPRESS_OBJECT_ID),
      publicationPerformed: false,
      wordpressMutationPerformed: false,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message.split(":")[0] : "THEME_TITLE_SUPPRESSION_REPAIR_PREFLIGHT_FAILED",
      publicationPerformed: false,
      wordpressMutationPerformed: false,
    }, { status: 409 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { principal, scope } = await authorize(request);
    const { campaignId } = await context.params;
    const body = await request.json().catch(() => null) as {
      confirm?: string;
      targetId?: string;
      stateCode?: string;
      jobId?: string;
      executionId?: string;
      wordpressObjectId?: string;
      expectedStoredSha256?: string;
    } | null;

    if (
      body?.confirm !== "REPAIR_THEME_TITLE_SUPPRESSION"
      || !body.targetId
      || !body.stateCode
      || !body.jobId
      || !body.executionId
      || !body.wordpressObjectId
      || !body.expectedStoredSha256
      || Object.keys(body).some((key) => ![
        "confirm",
        "targetId",
        "stateCode",
        "jobId",
        "executionId",
        "wordpressObjectId",
        "expectedStoredSha256",
      ].includes(key))
    ) {
      return NextResponse.json({
        error: "Exact theme title suppression repair payload is required.",
        mutationPerformed: false,
        publicationPerformed: false,
        wordpressMutationPerformed: false,
      }, { status: 400 });
    }

    const campaign = listGlwCampaigns().find((candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId
      && candidate.siteId === scope.siteId,
    );
    if (!campaign) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_CAMPAIGN_NOT_FOUND");
    }

    const target = listGlwCampaignTargets(campaignId).find((candidate) =>
      candidate.targetId === body.targetId!.trim(),
    );
    const expectedStateCode = body.stateCode.trim().toUpperCase();
    if (
      !target
      || target.stateCode !== expectedStateCode
      || target.stateCode !== "FL"
      || target.citySlug !== null
      || target.pageType !== "state_service"
      || target.canonicalPath !== REQUIRED_CANONICAL_PATH
      || target.wordpressObjectId !== REQUIRED_WORDPRESS_OBJECT_ID
      || body.wordpressObjectId.trim() !== REQUIRED_WORDPRESS_OBJECT_ID
    ) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_TARGET_SCOPE_MISMATCH");
    }

    const job = await glwPageExecutionRepository.getById(body.jobId.trim());
    if (!job) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_EXECUTION_NOT_FOUND");
    }
    if (
      job.organizationId !== campaign.organizationId
      || job.siteId !== campaign.siteId
      || job.productId !== campaign.productId
      || job.jobId !== body.jobId.trim()
      || job.externalExecutionId !== body.executionId.trim()
      || job.wordpressObjectId !== REQUIRED_WORDPRESS_OBJECT_ID
    ) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_EXECUTION_SCOPE_MISMATCH");
    }

    const before = await readWordPressDraft({
      siteId: campaign.siteId,
      wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
    });

    const beforeContent = text(before.content?.raw ?? before.content?.rendered);
    const beforeH1Matches = [...beforeContent.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    const beforeH1 = beforeH1Matches.length === 1
      ? text(beforeH1Matches[0][1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : "";
    const beforeHash = sha256(beforeContent);

    if (
      String(before.id ?? "") !== REQUIRED_WORDPRESS_OBJECT_ID
      || !["draft", "publish"].includes(text(before.status))
      || text(before.slug) !== "florida"
      || !Number.isSafeInteger(Number(before.parent ?? 0))
      || beforeH1Matches.length !== 1
      || !beforeH1
      || beforeHash !== body.expectedStoredSha256.trim()
    ) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_PREFLIGHT_FAILED");
    }

    const patched = applyScopedThemeTitleSuppression({
      contentHtml: beforeContent,
      wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
    });

    if (patched.mutated) {
      await updateWordPressPostContent({
        siteId: campaign.siteId,
        wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
        contentHtml: patched.contentHtml,
        status: text(before.status),
      });
    }

    const after = await readWordPressDraft({
      siteId: campaign.siteId,
      wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
    });
    const afterContent = text(after.content?.raw ?? after.content?.rendered);
    const afterHash = sha256(afterContent);
    const afterH1Matches = [...afterContent.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    const afterH1 = afterH1Matches.length === 1
      ? text(afterH1Matches[0][1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : "";
    const titleSelector = scopedTitleSelector(REQUIRED_WORDPRESS_OBJECT_ID);

    if (
      String(after.id ?? "") !== REQUIRED_WORDPRESS_OBJECT_ID
      || text(after.status) !== text(before.status)
      || text(after.slug) !== text(before.slug)
      || Number(after.parent) !== Number(before.parent)
      || Number(after.featured_media ?? -1) !== Number(before.featured_media ?? -1)
      || text(after.title?.raw ?? after.title?.rendered) !== text(before.title?.raw ?? before.title?.rendered)
      || afterH1Matches.length !== 1
      || afterH1 !== beforeH1
      || !afterContent.includes(titleSelector)
      || afterContent.includes(`body.page-id-${REQUIRED_WORDPRESS_OBJECT_ID} .post-media.single-image{display:none!important}`)
    ) {
      throw new Error("THEME_TITLE_SUPPRESSION_REPAIR_READBACK_FAILED");
    }

    return NextResponse.json({
      ok: true,
      repairReceiptId: `theme-title-suppression-repair-${randomUUID()}`,
      campaignId,
      targetId: target.targetId,
      wordpressObjectId: REQUIRED_WORDPRESS_OBJECT_ID,
      mutationPerformed: patched.mutated,
      wordpressMutationPerformed: patched.mutated,
      publicationPerformed: false,
      dispatchPerformed: false,
      workflowExecuted: false,
      regenerationPerformed: false,
      identityPreserved: {
        status: text(after.status),
        slug: text(after.slug),
        parentId: Number(after.parent),
        title: text(after.title?.raw ?? after.title?.rendered),
        featuredMediaId: Number(after.featured_media ?? 0),
      },
      generatedH1: {
        before: beforeH1,
        after: afterH1,
      },
      suppression: {
        selector: patched.scopedRule,
        scopedOnly: true,
        featuredMediaSuppressed: false,
      },
      storedSha256Before: beforeHash,
      storedSha256After: afterHash,
      visualCertificationExpectedState: "STALE",
      repairedBy: principal.principalId,
      repairedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message.split(":")[0] : "THEME_TITLE_SUPPRESSION_REPAIR_FAILED",
      mutationPerformed: false,
      wordpressMutationPerformed: false,
      publicationPerformed: false,
    }, { status: 422 });
  }
}
