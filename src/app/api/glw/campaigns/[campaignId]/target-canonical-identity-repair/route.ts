import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  repairGlwCampaignTargetCanonicalIdentity,
} from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ campaignId: string }>;
};

type WordPressPageRecord = {
  id?: number | string;
  slug?: string;
  parent?: number | string;
  status?: string;
};

function normalizePath(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}

function field(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function idField(value: unknown): string {
  return String(value ?? "").trim();
}

async function authorize(request: NextRequest) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);

  if (
    !principal.ok
    || !auth.ok
    || !auth.roles.includes("platform_admin")
    || !hasOrganizationScope(scope)
    || !scope.siteId
  ) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_AUTHORIZED_PLATFORM_ADMIN_REQUIRED");
  }

  return {
    principal: principal.principal,
    scope,
  };
}

async function readWordPressPage(input: {
  siteId: string;
  wordpressObjectId: string;
}): Promise<WordPressPageRecord> {
  const site = getSiteById(input.siteId);
  if (!site?.integrations.wordpressApiBaseUrl) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_AUTHORITY_UNAVAILABLE");
  }

  const credential = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!credential) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_CREDENTIAL_UNAVAILABLE");
  }

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
    query: new URLSearchParams({
      context: "edit",
      _fields: "id,slug,parent,status",
    }),
  });

  if (!response.ok || !response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_READ_FAILED");
  }

  return response.body as WordPressPageRecord;
}

async function resolveRepairContext(input: {
  campaignId: string;
  scope: { organizationId: string; siteId: string };
  stateCode: string;
  citySlug?: string | null;
  targetId: string;
  jobId: string;
  executionId: string;
  wordpressObjectId: string;
  canonicalParentObjectId: string;
  canonicalPath: string;
}) {
  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === input.campaignId
      && candidate.organizationId === input.scope.organizationId
      && candidate.siteId === input.scope.siteId,
  );
  if (!campaign) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_CAMPAIGN_NOT_FOUND");
  }

  const target = listGlwCampaignTargets(campaign.campaignId).find(
    (candidate) =>
      candidate.targetId === input.targetId
      && candidate.stateCode === input.stateCode
      && (candidate.citySlug ?? null) === (input.citySlug ?? null),
  );
  if (!target) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_TARGET_NOT_FOUND");
  }

  const execution = await glwPageExecutionRepository.getById(input.jobId);
  if (!execution) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_EXECUTION_NOT_FOUND");
  }

  if (
    execution.organizationId !== campaign.organizationId
    || execution.siteId !== campaign.siteId
    || execution.productId !== campaign.productId
    || execution.jobId !== input.jobId
    || execution.externalExecutionId !== input.executionId
    || execution.wordpressObjectId !== input.wordpressObjectId
  ) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_EXECUTION_IDENTITY_MISMATCH");
  }

  const child = await readWordPressPage({
    siteId: campaign.siteId,
    wordpressObjectId: input.wordpressObjectId,
  });

  if (idField(child.id) !== input.wordpressObjectId || field(child.status).toLowerCase() !== "draft") {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_CHILD_IDENTITY_MISMATCH");
  }

  const parentObjectId = idField(child.parent);
  if (!parentObjectId || parentObjectId !== input.canonicalParentObjectId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_PARENT_MISMATCH");
  }

  const parent = await readWordPressPage({
    siteId: campaign.siteId,
    wordpressObjectId: parentObjectId,
  });

  if (idField(parent.id) !== parentObjectId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_PARENT_READBACK_MISMATCH");
  }

  const wordpressParentSlug = normalizePath(field(parent.slug));
  const wordpressChildSlug = normalizePath(field(child.slug));
  if (!wordpressParentSlug || !wordpressChildSlug) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_CANONICAL_COMPONENTS_REQUIRED");
  }

  const proposedCanonicalPath = normalizePath(`${wordpressParentSlug}/${wordpressChildSlug}`);
  const expectedCanonicalPath = normalizePath(input.canonicalPath);
  if (!expectedCanonicalPath || expectedCanonicalPath !== proposedCanonicalPath) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_PROPOSED_CANONICAL_PATH_MISMATCH");
  }

  const jobSlug = normalizePath(execution.slug);
  if (!jobSlug || jobSlug !== proposedCanonicalPath) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_JOB_SLUG_MISMATCH");
  }

  const product = getProductById(campaign.productId);
  if (!product || normalizePath(product.slug) !== wordpressParentSlug) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_PRODUCT_CANONICAL_PARENT_MISMATCH");
  }

  if (target.stateCode !== input.stateCode || target.jobId !== input.jobId || target.wordpressObjectId !== input.wordpressObjectId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_TARGET_BINDING_MISMATCH");
  }

  if (target.pageType === "state_service") {
    const state = GLW_CAMPAIGN_US_STATES.find((candidate) => candidate.code === target.stateCode);
    if (!state || state.slug !== wordpressChildSlug) {
      throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_STATE_CANONICAL_SLUG_MISMATCH");
    }
  }

  if (target.pageType === "city_service" && target.citySlug && normalizeCitySlug(target.citySlug) !== wordpressChildSlug) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_CITY_CANONICAL_SLUG_MISMATCH");
  }

  return {
    campaign,
    target,
    execution,
    canonicalPath: proposedCanonicalPath,
    applicationPath: jobSlug,
    canonicalParentId: parentObjectId,
    wordpressParentSlug,
    wordpressChildSlug,
  };
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { principal, scope } = await authorize(request);
    const { campaignId } = await context.params;
    const body = await request.json().catch(() => null) as {
      confirm?: string;
      targetId?: string;
      stateCode?: string;
      citySlug?: string | null;
      jobId?: string;
      executionId?: string;
      wordpressObjectId?: string;
      canonicalParentObjectId?: string;
      canonicalPath?: string;
    } | null;

    if (
      body?.confirm !== "REPAIR_TARGET_CANONICAL_IDENTITY"
      || !body.targetId
      || !body.stateCode
      || !body.jobId
      || !body.executionId
      || !body.wordpressObjectId
      || !body.canonicalParentObjectId
      || !body.canonicalPath
    ) {
      return NextResponse.json(
        {
          error: "Exact canonical identity repair request is required.",
          mutationPerformed: false,
          publicationPerformed: false,
          wordpressMutationPerformed: false,
        },
        { status: 400 },
      );
    }

    const resolved = await resolveRepairContext({
      campaignId,
      scope: {
        organizationId: scope.organizationId,
        siteId: scope.siteId,
      },
      targetId: body.targetId.trim(),
      stateCode: body.stateCode.trim().toUpperCase(),
      citySlug: normalizeCitySlug(body.citySlug),
      jobId: body.jobId.trim(),
      executionId: body.executionId.trim(),
      wordpressObjectId: body.wordpressObjectId.trim(),
      canonicalParentObjectId: body.canonicalParentObjectId.trim(),
      canonicalPath: body.canonicalPath,
    });

    const repaired = repairGlwCampaignTargetCanonicalIdentity({
      campaignId: resolved.campaign.campaignId,
      stateCode: resolved.target.stateCode,
      citySlug: resolved.target.citySlug,
      targetId: resolved.target.targetId,
      jobId: resolved.execution.jobId,
      externalExecutionId: resolved.execution.externalExecutionId ?? "",
      wordpressObjectId: resolved.target.wordpressObjectId ?? "",
      canonicalPath: resolved.canonicalPath,
      applicationPath: resolved.applicationPath,
      canonicalParentId: resolved.canonicalParentId,
      wordpressParentSlug: resolved.wordpressParentSlug,
      wordpressChildSlug: resolved.wordpressChildSlug,
      repairedBy: principal.principalId,
    });

    return NextResponse.json({
      ok: true,
      campaignId: resolved.campaign.campaignId,
      target: repaired.target,
      receipt: repaired.receipt,
      mutationPerformed: repaired.receipt.mutationApplied,
      publicationPerformed: false,
      publicationGrantConsumed: false,
      publicationReceiptCreated: false,
      wordpressMutationPerformed: false,
      certificationRun: false,
      dispatchPerformed: false,
      ownerDecisionMutationPerformed: false,
      productAuthorityMutationPerformed: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "TARGET_CANONICAL_IDENTITY_REPAIR_FAILED",
        mutationPerformed: false,
        publicationPerformed: false,
        wordpressMutationPerformed: false,
      },
      { status: 409 },
    );
  }
}
