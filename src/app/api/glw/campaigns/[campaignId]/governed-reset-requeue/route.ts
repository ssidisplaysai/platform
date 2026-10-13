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
import {
  abandonGlwUnfinishedTargetAndRequeue,
  listGlwCampaignTargets,
  type GlwCampaignTarget,
} from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ campaignId: string }>;
};

type ResetTargetInput = {
  targetId: string;
  stateCode: string;
  citySlug?: string | null;
  expectedLifecycle: "FAILED" | "CONTENT_READY" | "DRAFT_READY";
  expectedJobId: string;
  expectedExecutionId: string;
  expectedWordpressObjectId?: string | null;
};

type ExactWordPressDraftIdentity = {
  wordpressObjectId: string;
  expectedStatus: "draft";
  expectedSlug: string;
  expectedParentObjectId: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalPathLeaf(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().replace(/^\/+|\/+$/g, "");
  return normalized.split("/").filter(Boolean).at(-1)?.trim().toLowerCase() ?? "";
}

function normalizeCitySlug(value: string | null | undefined): string | null {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}

function ensureTargetInCampaign(
  targets: readonly GlwCampaignTarget[],
  input: ResetTargetInput,
): GlwCampaignTarget {
  const citySlug = normalizeCitySlug(input.citySlug);
  const target = targets.find((candidate) =>
    candidate.targetId === input.targetId
    && candidate.stateCode === input.stateCode.trim().toUpperCase()
    && (normalizeCitySlug(candidate.citySlug) ?? null) === citySlug,
  ) ?? null;

  if (!target) {
    throw new Error(`TARGET_NOT_FOUND:${input.targetId}`);
  }

  return target;
}

function expectedLifecycleToRepositoryStatus(value: ResetTargetInput["expectedLifecycle"]): "failed" | "content_ready" | "draft_ready" {
  if (value === "FAILED") return "failed";
  if (value === "CONTENT_READY") return "content_ready";
  return "draft_ready";
}

async function readExactWordPressDraft(input: {
  siteId: string;
  identity: ExactWordPressDraftIdentity;
}) {
  const site = getSiteById(input.siteId);
  const apiBaseUrl = site?.integrations.wordpressApiBaseUrl?.trim() ?? "";
  const credential = resolveWordPressCredentialReference(site?.integrations.wordpressCredentialReference ?? null);
  if (!site || !apiBaseUrl || !credential) {
    throw new Error("RESET_REQUEUE_WORDPRESS_AUTHORITY_REQUIRED");
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
    path: `/pages/${input.identity.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent" }),
  });

  if (!read.ok || !read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
    throw new Error("RESET_REQUEUE_WORDPRESS_READ_FAILED");
  }

  const page = read.body as Record<string, unknown>;
  const wordpressObjectId = String(page.id ?? "").trim();
  const status = text(page.status).toLowerCase();
  const slug = text(page.slug).toLowerCase();
  const parent = String(page.parent ?? "").trim();

  if (
    wordpressObjectId !== input.identity.wordpressObjectId
    || status !== input.identity.expectedStatus
    || slug !== input.identity.expectedSlug
    || parent !== input.identity.expectedParentObjectId
  ) {
    throw new Error("RESET_REQUEUE_WORDPRESS_IDENTITY_MISMATCH");
  }

  const uniqueness = await reader.getJson({
    path: "/pages",
    query: new URLSearchParams({
      slug: input.identity.expectedSlug,
      parent: input.identity.expectedParentObjectId,
      context: "edit",
      status: "publish,draft,pending,private,future",
      per_page: "100",
      _fields: "id,slug,parent,status",
    }),
  });

  if (!uniqueness.ok || !Array.isArray(uniqueness.body)) {
    throw new Error("RESET_REQUEUE_WORDPRESS_UNIQUENESS_READ_FAILED");
  }

  const matches = uniqueness.body.filter((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const row = candidate as Record<string, unknown>;
    return String(row.id ?? "").trim() === input.identity.wordpressObjectId
      && text(row.slug).toLowerCase() === input.identity.expectedSlug
      && String(row.parent ?? "").trim() === input.identity.expectedParentObjectId;
  });

  if (matches.length !== 1 || uniqueness.body.length !== 1) {
    throw new Error("RESET_REQUEUE_WORDPRESS_UNIQUENESS_CONFLICT");
  }

  return {
    site,
    apiBaseUrl,
    credential,
  };
}

async function moveWordPressDraftToTrash(input: {
  siteId: string;
  identity: ExactWordPressDraftIdentity;
}): Promise<{ succeeded: true; statusAfter: "trash" } | { succeeded: false }> {
  const authority = await readExactWordPressDraft(input);

  const auth = `Basic ${Buffer.from(`${authority.credential.username}:${authority.credential.applicationPassword}`, "utf8").toString("base64")}`;
  const write = await fetch(`${authority.apiBaseUrl}/pages/${encodeURIComponent(input.identity.wordpressObjectId)}`, {
    method: "DELETE",
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!write.ok) {
    return { succeeded: false };
  }

  const reader = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: authority.apiBaseUrl,
      username: authority.credential.username,
      applicationPassword: authority.credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const readback = await reader.getJson({
    path: `/pages/${input.identity.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent" }),
  });

  if (!readback.ok || !readback.body || typeof readback.body !== "object" || Array.isArray(readback.body)) {
    return { succeeded: false };
  }

  const page = readback.body as Record<string, unknown>;
  const status = text(page.status).toLowerCase();
  const slug = text(page.slug).toLowerCase();
  const parent = String(page.parent ?? "").trim();

  if (
    String(page.id ?? "").trim() !== input.identity.wordpressObjectId
    || status !== "trash"
    || slug !== input.identity.expectedSlug
    || parent !== input.identity.expectedParentObjectId
  ) {
    return { succeeded: false };
  }

  return { succeeded: true, statusAfter: "trash" };
}

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null) as {
    confirm?: string;
    operation?: string;
    targets?: ResetTargetInput[];
  } | null;

  if (body?.confirm !== "ABANDON_UNFINISHED_TARGETS_AND_REQUEUE" || body?.operation !== "ABANDON_UNFINISHED_TARGET_AND_REQUEUE" || !Array.isArray(body.targets) || body.targets.length < 1) {
    return NextResponse.json({ error: "Explicit governed reset confirmation and target list are required." }, { status: 400 });
  }

  const campaign = listGlwCampaigns().find((candidate) =>
    candidate.campaignId === campaignId
    && candidate.organizationId === scope.organizationId
    && candidate.siteId === scope.siteId,
  ) ?? null;

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const targets = listGlwCampaignTargets(campaignId);
  const prepared = [] as Array<{
    request: ResetTargetInput;
    target: GlwCampaignTarget;
    job: NonNullable<Awaited<ReturnType<typeof glwPageExecutionRepository.getById>>>;
    expectedWordpressObjectId: string | null;
    wordpressIdentity: ExactWordPressDraftIdentity | null;
  }>;

  for (const reset of body.targets) {
    const target = ensureTargetInCampaign(targets, reset);
    const expectedStatus = expectedLifecycleToRepositoryStatus(reset.expectedLifecycle);
    const expectedWordpressObjectId = text(reset.expectedWordpressObjectId) || null;

    if (target.status === "published") {
      return NextResponse.json({ error: `PUBLISHED_TARGET_FORBIDDEN:${target.targetId}` }, { status: 409 });
    }

    if (target.status !== expectedStatus) {
      return NextResponse.json({ error: `TARGET_STATUS_MISMATCH:${target.targetId}` }, { status: 409 });
    }

    if (target.jobId !== reset.expectedJobId) {
      return NextResponse.json({ error: `TARGET_JOB_MISMATCH:${target.targetId}` }, { status: 409 });
    }

    if ((target.wordpressObjectId ?? null) !== expectedWordpressObjectId) {
      return NextResponse.json({ error: `TARGET_WORDPRESS_IDENTITY_MISMATCH:${target.targetId}` }, { status: 409 });
    }

    if (target.leaseId) {
      return NextResponse.json({ error: `TARGET_ACTIVE_LEASE_FORBIDDEN:${target.targetId}` }, { status: 409 });
    }

    const job = await glwPageExecutionRepository.getById(reset.expectedJobId);
    if (!job) {
      return NextResponse.json({ error: `EXECUTION_NOT_FOUND:${target.targetId}` }, { status: 409 });
    }

    if (
      job.organizationId !== campaign.organizationId
      || job.siteId !== campaign.siteId
      || job.productId !== campaign.productId
      || (job.externalExecutionId ?? "") !== reset.expectedExecutionId
    ) {
      return NextResponse.json({ error: `EXECUTION_IDENTITY_MISMATCH:${target.targetId}` }, { status: 409 });
    }

    if (expectedWordpressObjectId && String(job.wordpressObjectId ?? "").trim() !== expectedWordpressObjectId) {
      return NextResponse.json({ error: `JOB_WORDPRESS_IDENTITY_MISMATCH:${target.targetId}` }, { status: 409 });
    }

    let wordpressIdentity: ExactWordPressDraftIdentity | null = null;
    if (expectedWordpressObjectId) {
      const expectedSlug = canonicalPathLeaf(target.canonicalPath ?? job.slug);
      const expectedParentObjectId = text(target.canonicalParentId);
      if (!expectedSlug || !/^[1-9]\d*$/.test(expectedParentObjectId)) {
        return NextResponse.json({ error: `WORDPRESS_CANONICAL_IDENTITY_REQUIRED:${target.targetId}` }, { status: 409 });
      }
      wordpressIdentity = {
        wordpressObjectId: expectedWordpressObjectId,
        expectedStatus: "draft",
        expectedSlug,
        expectedParentObjectId,
      };
    }

    prepared.push({
      request: reset,
      target,
      job,
      expectedWordpressObjectId,
      wordpressIdentity,
    });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const entry of prepared) {
    let wordpressRetirementAction: "none" | "trash" = "none";
    let wordpressRetirementSucceeded = false;

    if (entry.wordpressIdentity) {
      const retired = await moveWordPressDraftToTrash({
        siteId: campaign.siteId,
        identity: entry.wordpressIdentity,
      });

      if (!retired.succeeded) {
        return NextResponse.json({
          error: `WORDPRESS_RETIREMENT_FAILED:${entry.target.targetId}`,
          targetId: entry.target.targetId,
          wordpressObjectId: entry.wordpressIdentity.wordpressObjectId,
        }, { status: 409 });
      }

      wordpressRetirementAction = "trash";
      wordpressRetirementSucceeded = true;
    }

    const updated = abandonGlwUnfinishedTargetAndRequeue({
      campaignId,
      targetId: entry.target.targetId,
      stateCode: entry.target.stateCode,
      citySlug: entry.target.citySlug,
      expectedStatus: expectedLifecycleToRepositoryStatus(entry.request.expectedLifecycle),
      expectedJobId: entry.request.expectedJobId,
      expectedWordpressObjectId: entry.expectedWordpressObjectId,
    });

    results.push({
      targetId: entry.target.targetId,
      stateCode: entry.target.stateCode,
      citySlug: entry.target.citySlug ?? null,
      previousLifecycle: entry.target.status,
      previousJobId: entry.target.jobId,
      previousExecutionId: entry.request.expectedExecutionId,
      previousWordpressObjectId: entry.expectedWordpressObjectId,
      wordpressRetirementAction,
      wordpressRetirementSucceeded,
      currentLifecycle: updated.status,
      currentJobId: updated.jobId,
      currentWordpressObjectId: updated.wordpressObjectId,
    });
  }

  return NextResponse.json({
    operation: "ABANDON_UNFINISHED_TARGET_AND_REQUEUE",
    campaignId,
    principalId: principal.principal.principalId,
    resetCount: results.length,
    results,
    dispatchPerformed: false,
    generationAttempted: false,
    publicationPerformed: false,
    wordPressMutationPerformed: results.some((result) => result.wordpressRetirementAction === "trash"),
  });
}
