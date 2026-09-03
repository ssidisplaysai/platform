import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  reconcileGlwCampaignTargetPublished,
} from "@/modules/glw/campaign-target-repository";
import {
  glwPageExecutionRepository,
  reconcileGlwPageExecutionPublished,
} from "@/modules/glw/page-execution-repository";
import {
  classifyGlwPublicationRead,
  type WordPressPublicationPage,
} from "@/modules/glw/publication-state-reconciliation";

type Result = {
  stateCode: string;
  wordpressObjectId: string | null;
  classification:
    | "RECONCILED_PUBLISHED"
    | "HIERARCHY_MISMATCH"
    | "NOT_PUBLISHED"
    | "UNRESOLVED_ERROR"
    | "UNTOUCHED_OTHER";
  message?: string;
};

function isPage(value: unknown): value is WordPressPublicationPage {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

  const body = await request.json().catch(() => null) as {
    confirm?: string;
    stateCodes?: string[];
  } | null;
  if (body?.confirm !== "RECONCILE_AUTHORITATIVE_WORDPRESS_PUBLICATION_STATE") {
    return NextResponse.json({ error: "Explicit publication reconciliation confirmation is required." }, { status: 400 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;
  if (!campaign || campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const site = getSiteById(campaign.siteId);
  const credential = resolveWordPressCredentialReference(site?.integrations.wordpressCredentialReference ?? null);
  const apiBaseUrl = site?.integrations.wordpressApiBaseUrl?.trim();
  if (!site || !credential || !apiBaseUrl) {
    return NextResponse.json({ error: "Authenticated WordPress read authority is unavailable." }, { status: 409 });
  }

  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const targets = listGlwCampaignTargets(campaignId);
  const executions = await glwPageExecutionRepository.list();
  const requestedStates = new Set((body.stateCodes ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean));
  const selected = targets.filter((target) => requestedStates.size === 0 || requestedStates.has(target.stateCode));
  const candidateExecutions = selected
    .map((target) => executions.find((record) => record.jobId === target.jobId) ?? null)
    .filter((record) => record?.slug)[0];
  const productSlug = candidateExecutions?.slug.split("/").filter(Boolean)[0] ?? "";

  const parentRead = productSlug
    ? await authority.getJson({
        path: "/pages",
        query: new URLSearchParams({ slug: productSlug, parent: "0", status: "any", context: "edit", _fields: "id,slug,parent,status" }),
      })
    : null;
  const parentPages = parentRead?.ok && Array.isArray(parentRead.body)
    ? (parentRead.body as WordPressPublicationPage[]).filter((page) => page.slug === productSlug && page.parent === 0)
    : [];
  if (parentPages.length !== 1 || !parentPages[0].id) {
    return NextResponse.json({ error: "Canonical WordPress product parent could not be uniquely verified by authenticated GET." }, { status: 409 });
  }
  const expectedParentId = String(parentPages[0].id);

  const results: Result[] = [];
  for (const target of selected) {
    const execution = executions.find((record) => record.jobId === target.jobId) ?? null;
    const state = GLW_CAMPAIGN_US_STATES.find((entry) => entry.code === target.stateCode);
    if (target.status !== "draft_ready" || !target.jobId || !target.wordpressObjectId || !execution || !state) {
      results.push({ stateCode: target.stateCode, wordpressObjectId: target.wordpressObjectId, classification: "UNTOUCHED_OTHER" });
      continue;
    }

    const read = await authority.getJson({
      path: `/pages/${target.wordpressObjectId}`,
      query: new URLSearchParams({ context: "edit", _fields: "id,slug,parent,status,link" }),
    });
    if (!read.ok || !isPage(read.body)) {
      results.push({ stateCode: target.stateCode, wordpressObjectId: target.wordpressObjectId, classification: "UNRESOLVED_ERROR", message: "Authoritative WordPress GET failed." });
      continue;
    }

    const classification = classifyGlwPublicationRead({
      page: read.body,
      expectedWordpressObjectId: target.wordpressObjectId,
      expectedSlug: state.slug,
      expectedParentId,
    });
    if (classification !== "RECONCILED_PUBLISHED") {
      results.push({
        stateCode: target.stateCode,
        wordpressObjectId: target.wordpressObjectId,
        classification,
        message: classification === "HIERARCHY_MISMATCH" ? "Manual remediation required." : undefined,
      });
      continue;
    }

    await reconcileGlwPageExecutionPublished({
      jobId: target.jobId,
      wordpressObjectId: target.wordpressObjectId,
      wordpressUrl: typeof read.body.link === "string" ? read.body.link : execution.wordpressUrl,
    });
    reconcileGlwCampaignTargetPublished({
      campaignId,
      stateCode: target.stateCode,
      jobId: target.jobId,
      wordpressObjectId: target.wordpressObjectId,
    });
    results.push({ stateCode: target.stateCode, wordpressObjectId: target.wordpressObjectId, classification });
  }

  const count = (classification: Result["classification"]) => results.filter((result) => result.classification === classification).length;
  return NextResponse.json({
    campaignId,
    expectedParentId,
    wordpressMethodsUsed: ["GET"],
    counts: {
      reconciledPublished: count("RECONCILED_PUBLISHED"),
      hierarchyMismatch: count("HIERARCHY_MISMATCH"),
      notPublished: count("NOT_PUBLISHED"),
      unresolvedError: count("UNRESOLVED_ERROR"),
      untouchedOther: count("UNTOUCHED_OTHER"),
    },
    results,
  });
}