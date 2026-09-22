import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { getGlwState } from "@/modules/glw/page-generation";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  consumeGlwReferenceDraftPersistenceGrant,
  GlwReferenceDraftPersistenceAuthorityError,
  GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION,
  issueGlwReferenceDraftPersistenceGrant,
  issueGlwReferenceDraftPersistencePreflight,
  projectGlwReferenceDraftPersistenceGrant,
  type GlwReferenceDraftPersistenceContext,
} from "@/modules/glw/reference-draft-persistence-authority";
import { evaluateGlwReferenceClaimAuthority, fingerprintGlwAuthority } from "@/modules/glw/reference-claim-authority";
import { createGlwReferenceContentReconciliationReceipt } from "@/modules/glw/reference-content-reconciliation";
import { resolveGlwReferenceGenerationAuthority } from "@/modules/glw/reference-generation-authority";
import { GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT, GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT, GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION, GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT } from "@/modules/glw/reference-generation-claim-contract";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import {
  canonicalizeAndRevalidateGlwZeroAuthorityClaims,
  canonicalizeGlwZeroAuthorityClaims,
  GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
  GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
} from "@/modules/glw/zero-authority-claim-canonicalization";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };
const MINIMUM_WORD_COUNT = 1500;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function pageObjects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

async function resolveCandidate(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  jobId: string;
  stateCode: string;
  rawArtifactSha256: string;
  canonicalizedArtifactSha256: string;
  canonicalizationReceiptId: string;
}) {
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === input.campaignId && candidate.organizationId === input.organizationId && candidate.siteId === input.siteId);
  const site = getSiteById(input.siteId);
  const pack = getGlwCampaignKnowledgePack(input.campaignId);
  const job = await glwPageExecutionRepository.getById(input.jobId);
  if (!campaign || !site || !pack || !job || !job.generatedDraft) throw new Error("DRAFT_PERSISTENCE_SOURCE_NOT_FOUND");
  const state = getGlwState(input.stateCode);
  if (!state || !campaign.stateCodes.includes(state.code) || campaign.status !== "draft" || job.status !== "FAILED" || job.errorCode !== "GENERATED_CONTENT_QA_FAILED" || !job.externalExecutionId || job.state !== state.name || job.wordpressObjectId) throw new Error("DRAFT_PERSISTENCE_SOURCE_INVALID");

  const rawArtifact = job.rawGeneratedDraft ?? job.generatedDraft;
  const rawArtifactSha256 = sha256(rawArtifact.contentHtml);
  if (rawArtifactSha256 !== input.rawArtifactSha256) throw new Error("RAW_ARTIFACT_HASH_MISMATCH");
  const zeroAuthorityContext = { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] };
  const rawClaims = evaluateGlwReferenceClaimAuthority({ artifact: rawArtifact, authority: zeroAuthorityContext });
  const canonicalization = canonicalizeGlwZeroAuthorityClaims({ rawArtifact, authoritativeFactReferenceIds: [], findings: rawClaims.findings });
  if (!canonicalization.ok || !canonicalization.canonicalizedArtifact) throw new Error("ZERO_AUTHORITY_CANONICALIZATION_BLOCKED");
  const recomputedCanonicalizationCertified = canonicalization.receipt.receiptId === input.canonicalizationReceiptId
    && canonicalization.receipt.canonicalizedArtifactSha256 === input.canonicalizedArtifactSha256;
  const persistedCanonicalizedArtifact = job.canonicalizedGeneratedDraft;
  const persistedCanonicalizationReceipt = job.canonicalizationReceipt;
  const persistedCanonicalizedArtifactSha256 = persistedCanonicalizedArtifact
    ? sha256(persistedCanonicalizedArtifact.contentHtml)
    : null;
  const persistedReceiptRawSha256 = persistedCanonicalizationReceipt?.rawArtifactSha256 ?? null;
  const persistedReceiptCanonicalizedSha256 = persistedCanonicalizationReceipt?.canonicalizedArtifactSha256 ?? null;
  const persistedReceiptLegacyCanonicalTuple = Boolean(
    persistedReceiptRawSha256
    && persistedReceiptCanonicalizedSha256
    && persistedReceiptRawSha256 === persistedReceiptCanonicalizedSha256,
  );
  const persistedCanonicalizationCertified = Boolean(
    persistedCanonicalizedArtifact
    && persistedCanonicalizationReceipt
    && persistedCanonicalizationReceipt.receiptId === input.canonicalizationReceiptId
    && (persistedCanonicalizationReceipt.rawArtifactSha256 === rawArtifactSha256 || persistedReceiptLegacyCanonicalTuple)
    && persistedCanonicalizedArtifactSha256
    && persistedCanonicalizationReceipt.canonicalizedArtifactSha256 === persistedCanonicalizedArtifactSha256
    && persistedCanonicalizationReceipt.canonicalizedArtifactSha256 === input.canonicalizedArtifactSha256,
  );
  if (!recomputedCanonicalizationCertified && !persistedCanonicalizationCertified) {
    throw new Error("CANONICALIZED_ARTIFACT_NOT_CERTIFIED");
  }

  const certifiedCanonicalizedArtifact = persistedCanonicalizationCertified
    ? persistedCanonicalizedArtifact!
    : canonicalization.canonicalizedArtifact;
  const certifiedCanonicalizationReceipt = persistedCanonicalizationCertified
    ? persistedCanonicalizationReceipt!
    : canonicalization.receipt;

  const claimsParity = canonicalizeAndRevalidateGlwZeroAuthorityClaims({
    artifact: certifiedCanonicalizedArtifact,
    authority: zeroAuthorityContext,
    fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
  });
  const claims = claimsParity.finalClaimAuthority;
  const qa = evaluateGlwGeneratedContentQa({
    artifact: claimsParity.artifact,
    request: { pageType: "state_service", stateCode: state.code, stateName: state.name, cityName: null, productTopic: job.productTopic, canonicalPath: job.slug } as never,
    siteDomain: site.domain,
    minimumWordCount: MINIMUM_WORD_COUNT,
    requiredCanonicalProductLink: { url: `/${job.slug.split("/").filter(Boolean)[0]}/`, anchorText: job.productTopic },
    authorizedComparisonStateCodes: [],
  });
  if (!claims.ok || !qa.ok) throw new Error("FINAL_PRE_PERSISTENCE_QA_FAILED");

  const credentialReference = site.integrations.wordpressCredentialReference;
  const apiBaseUrl = site.integrations.wordpressApiBaseUrl;
  const credential = resolveWordPressCredentialReference(credentialReference);
  if (!apiBaseUrl || !credentialReference || !credential) throw new Error("WORDPRESS_AUTHORITY_UNAVAILABLE");
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const productSlug = job.slug.split("/").filter(Boolean)[0];
  const targetSlug = job.slug.split("/").filter(Boolean).at(-1)!;
  const productRead = await reader.getJson({ path: "/pages", query: new URLSearchParams({ slug: productSlug, parent: "0", context: "edit", status: "publish,draft,pending,private,future", per_page: "100", _fields: "id,slug,parent,status,title" }) });
  if (!productRead.ok) throw new Error("WORDPRESS_PRODUCT_PARENT_READ_FAILED");
  const productMatches = pageObjects(productRead.body).filter((page) => text(page.slug) === productSlug && Number(page.parent) === 0 && numeric(page.id));
  if (productMatches.length !== 1) throw new Error("WORDPRESS_PRODUCT_PARENT_NOT_UNIQUE");
  const parentId = numeric(productMatches[0].id)!;
  if (parentId !== 20114 || text(productMatches[0].status) !== "draft") throw new Error("WORDPRESS_PRODUCT_PARENT_IDENTITY_CHANGED");
  const targetRead = await reader.getJson({ path: "/pages", query: new URLSearchParams({ slug: targetSlug, parent: String(parentId), context: "edit", status: "publish,draft,pending,private,future", per_page: "100", _fields: "id,slug,parent,status,title" }) });
  if (!targetRead.ok) throw new Error("WORDPRESS_TARGET_READ_FAILED");
  const targetObjects = pageObjects(targetRead.body);
  if (targetObjects.length !== 0) throw new Error("WORDPRESS_TARGET_COLLISION");

  const generationAuthority = resolveGlwReferenceGenerationAuthority({ campaign, pack, stateCode: state.code });
  const wordpressAuthorityText = [site.siteId, credentialReference, credential.username, "READY"].join(":");
  const qaEvidence = { claimPolicyVersion: claims.policyVersion, claimFindings: claims.findings, checks: qa.checks, failureReasons: qa.failureReasons, wordCount: qa.wordCount };
  const liveContext: Omit<GlwReferenceDraftPersistenceContext, "principalId" | "principalSessionId"> = {
    operationType: GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId: campaign.campaignId,
    referenceState: state.code,
    generationJobId: job.jobId,
    n8nExecutionId: job.externalExecutionId,
    rawArtifactSha256,
    canonicalizedArtifactSha256: certifiedCanonicalizationReceipt.canonicalizedArtifactSha256,
    canonicalizationReceiptId: certifiedCanonicalizationReceipt.receiptId,
    canonicalizationPolicyVersion: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
    canonicalizationPolicyFingerprint: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
    generatorContractFingerprint: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
    qaPolicyFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
    qaFingerprint: fingerprintGlwAuthority(qaEvidence),
    localizationPolicyFingerprint: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
    wordpressReadAuthorityFingerprint: fingerprintGlwAuthority(wordpressAuthorityText),
    wordpressInventoryFingerprint: fingerprintGlwAuthority({ parent: productMatches, target: targetObjects }),
    canonicalPath: job.slug,
    parentId: String(parentId),
    parentSlug: productSlug,
    parentStatus: "draft",
    exactRuntime: process.env.GIT_COMMIT?.trim().toLowerCase() ?? "",
  };
  const canonicalizedArtifact = claimsParity.artifact;
  const canonicalizedArtifactSha256 = sha256(canonicalizedArtifact.contentHtml);
  const claimsParityCanonicalizedArtifactSha256 = claimsParity.canonicalizationReceipt?.canonicalizedArtifactSha256;
  if ((claimsParityCanonicalizedArtifactSha256 ?? certifiedCanonicalizationReceipt.canonicalizedArtifactSha256) !== canonicalizedArtifactSha256) {
    throw new Error("CANONICALIZED_ARTIFACT_NOT_CERTIFIED");
  }
  return { campaign, site, state, job, reader, parentId, targetSlug, rawArtifact, canonicalizedArtifact, canonicalizationReceipt: claimsParity.canonicalizationReceipt ?? certifiedCanonicalizationReceipt, claims, qa, qaEvidence, generationAuthority, liveContext };
}

export async function GET(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Unauthorized", callerSuppliedRoleHeadersAuthorize: false }, { status: 401 });
  try {
    const { campaignId } = await context.params;
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() ?? "";
    const resolved = await resolveCandidate({ campaignId, organizationId: scope.organizationId, siteId: scope.siteId, jobId, stateCode: request.nextUrl.searchParams.get("stateCode") ?? "", rawArtifactSha256: request.nextUrl.searchParams.get("rawArtifactSha256") ?? "", canonicalizedArtifactSha256: request.nextUrl.searchParams.get("canonicalizedArtifactSha256") ?? "", canonicalizationReceiptId: request.nextUrl.searchParams.get("canonicalizationReceiptId") ?? "" });
    return NextResponse.json({ operation: GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION, candidate: { jobId, rawArtifactSha256: resolved.liveContext.rawArtifactSha256, canonicalizedArtifactSha256: resolved.liveContext.canonicalizedArtifactSha256, canonicalizationReceiptId: resolved.liveContext.canonicalizationReceiptId, canonicalizationPolicyVersion: resolved.liveContext.canonicalizationPolicyVersion, canonicalizationPolicyFingerprint: resolved.liveContext.canonicalizationPolicyFingerprint, generatorContractVersion: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION, generatorContractFingerprint: resolved.liveContext.generatorContractFingerprint, qaPolicyFingerprint: resolved.liveContext.qaPolicyFingerprint, qaFingerprint: resolved.liveContext.qaFingerprint, localizationPolicyFingerprint: resolved.liveContext.localizationPolicyFingerprint, wordpressInventoryFingerprint: resolved.liveContext.wordpressInventoryFingerprint, parentId: resolved.parentId, parentSlug: resolved.liveContext.parentSlug, parentStatus: resolved.liveContext.parentStatus, canonicalPath: resolved.liveContext.canonicalPath, wordCount: resolved.qa.wordCount, qaPassed: true }, grant: projectGlwReferenceDraftPersistenceGrant({ principal: principal.principal, liveContext: resolved.liveContext }), callerSuppliedRoleHeadersAuthorize: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "DRAFT_PERSISTENCE_PREFLIGHT_FAILED", callerSuppliedRoleHeadersAuthorize: false }, { status: 409 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Unauthorized", callerSuppliedRoleHeadersAuthorize: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: "RUN_PREFLIGHT" | "AUTHORIZE" | "PERSIST"; jobId?: string; stateCode?: string; rawArtifactSha256?: string; canonicalizedArtifactSha256?: string; canonicalizationReceiptId?: string; preflightId?: string; grantId?: string } | null;
  if (!body?.action || !body.jobId || !body.stateCode || !body.rawArtifactSha256 || !body.canonicalizedArtifactSha256 || !body.canonicalizationReceiptId) return NextResponse.json({ error: "Exact draft persistence request is required." }, { status: 400 });
  try {
    const { campaignId } = await context.params;
    const resolved = await resolveCandidate({ campaignId, organizationId: scope.organizationId, siteId: scope.siteId, jobId: body.jobId, stateCode: body.stateCode, rawArtifactSha256: body.rawArtifactSha256, canonicalizedArtifactSha256: body.canonicalizedArtifactSha256, canonicalizationReceiptId: body.canonicalizationReceiptId });
    if (body.action === "RUN_PREFLIGHT") {
      const preflight = issueGlwReferenceDraftPersistencePreflight({ principal: principal.principal, context: resolved.liveContext });
      return NextResponse.json({ preflight, qaPassed: true, wordpressMutation: false });
    }
    if (!body.preflightId) return NextResponse.json({ error: "Draft persistence preflight is required." }, { status: 400 });
    if (body.action === "AUTHORIZE") {
      const grant = issueGlwReferenceDraftPersistenceGrant({ principal: principal.principal, preflightId: body.preflightId, liveContext: resolved.liveContext });
      return NextResponse.json({ grant, wordpressMutation: false });
    }
    if (!body.grantId) return NextResponse.json({ error: "Draft persistence grant is required." }, { status: 400 });
    const claim = consumeGlwReferenceDraftPersistenceGrant({ principal: principal.principal, preflightId: body.preflightId, grantId: body.grantId, liveContext: resolved.liveContext });
    const write = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: resolved.site,
      artifact: {
        title: resolved.canonicalizedArtifact.title,
        contentHtml: resolved.canonicalizedArtifact.contentHtml,
        slug: resolved.targetSlug,
        excerpt: resolved.canonicalizedArtifact.excerpt,
        parentId: resolved.parentId,
        seo: resolved.canonicalizedArtifact.focusKeyphrase && resolved.canonicalizedArtifact.seoTitle && resolved.canonicalizedArtifact.metaDescription
          ? { focusKeyphrase: resolved.canonicalizedArtifact.focusKeyphrase, seoTitle: resolved.canonicalizedArtifact.seoTitle, metaDescription: resolved.canonicalizedArtifact.metaDescription }
          : null,
      },
    });
    if (!write.ok) return NextResponse.json({ error: write.message, code: `WORDPRESS_${write.state.toUpperCase()}`, grantConsumed: true, wordpressMutation: false }, { status: 409 });

    const readback = await resolved.reader.getJson({ path: `/pages/${write.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,featured_media,link" }) });
    if (!readback.ok || !readback.body || typeof readback.body !== "object" || Array.isArray(readback.body)) throw new Error("WORDPRESS_DRAFT_READBACK_FAILED");
    const page = readback.body as Record<string, unknown>;
    const content = page.content && typeof page.content === "object" && !Array.isArray(page.content) ? page.content as Record<string, unknown> : {};
    const title = page.title && typeof page.title === "object" && !Array.isArray(page.title) ? page.title as Record<string, unknown> : {};
    const storedContent = text(content.raw) || text(content.rendered);
    const storedContentSha256 = sha256(storedContent);
    if (String(page.id) !== write.wordpressObjectId || text(page.status) !== "draft" || text(page.slug) !== resolved.targetSlug || numeric(page.parent) !== resolved.parentId) throw new Error("WORDPRESS_DRAFT_IDENTITY_MISMATCH");
    const reconciliation = createGlwReferenceContentReconciliationReceipt({ organizationId: resolved.campaign.organizationId, siteId: resolved.site.siteId, campaignId: resolved.campaign.campaignId, stateCode: resolved.state.code, jobId: resolved.job.jobId, wordpressObjectId: write.wordpressObjectId, artifactHtml: resolved.canonicalizedArtifact.contentHtml, storedContentHtml: storedContent, expectedArtifactSha256: resolved.liveContext.canonicalizedArtifactSha256, expectedStoredContentSha256: storedContentSha256, mediaAuthority: "UNGOVERNED", hostCertification: "PENDING", qaPolicyVersion: resolved.claims.policyVersion });
    const postClaims = evaluateGlwReferenceClaimAuthority({ artifact: { ...resolved.canonicalizedArtifact, contentHtml: storedContent }, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    const postQa = evaluateGlwGeneratedContentQa({ artifact: { ...resolved.canonicalizedArtifact, contentHtml: storedContent }, request: { pageType: "state_service", stateCode: resolved.state.code, stateName: resolved.state.name, cityName: null, productTopic: resolved.job.productTopic, canonicalPath: resolved.job.slug } as never, siteDomain: resolved.site.domain, minimumWordCount: MINIMUM_WORD_COUNT, requiredCanonicalProductLink: { url: `/${resolved.job.slug.split("/").filter(Boolean)[0]}/`, anchorText: resolved.job.productTopic }, authorizedComparisonStateCodes: [] });
    if (!postClaims.ok || !postQa.ok) throw new Error("WORDPRESS_STORED_CONTENT_QA_FAILED");

    const updated = await glwPageExecutionRepository.update(resolved.job.jobId, {
      status: "COMPLETE",
      rawGeneratedDraft: resolved.rawArtifact,
      canonicalizedGeneratedDraft: resolved.canonicalizedArtifact,
      canonicalizationReceipt: resolved.canonicalizationReceipt,
      generatedDraft: resolved.canonicalizedArtifact,
      wordpressObjectId: write.wordpressObjectId,
      wordpressUrl: write.wordpressUrl,
      wordpressStatus: "draft",
      disposition: "CREATED",
      qaStatus: "PASSED",
      qaChecks: { ...resolved.qa.checks, claimAuthority: { policyVersion: resolved.claims.policyVersion, findings: resolved.claims.findings }, zeroAuthorityCanonicalization: resolved.canonicalizationReceipt, draftPersistenceAuthority: { authorityVersion: "GLW_REFERENCE_DRAFT_PERSISTENCE_AUTHORITY_V1", claimId: claim.claimId, grantId: claim.grantId, qaFingerprint: resolved.liveContext.qaFingerprint }, wordpressReadback: { wordpressObjectId: write.wordpressObjectId, status: page.status, slug: page.slug, parentId: page.parent, title: text(title.raw) || text(title.rendered), featuredImageId: numeric(page.featured_media), storedContentSha256, reconciliation } },
      qaFailureReasons: {},
      wordCount: postQa.wordCount,
      featuredImagePresent: numeric(page.featured_media) !== null,
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    return NextResponse.json({ operation: GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION, claimId: claim.claimId, job: updated, canonicalizedArtifactSha256: resolved.liveContext.canonicalizedArtifactSha256, storedContentSha256, reconciliation, wordpressReadback: { id: write.wordpressObjectId, status: page.status, slug: page.slug, parentId: page.parent, title: text(title.raw) || text(title.rendered), featuredImageId: numeric(page.featured_media), url: write.wordpressUrl }, postPersistenceQa: { ok: true, claims: postClaims, content: postQa }, wordpressMutation: true, publicationMutation: false });
  } catch (error) {
    const code = error instanceof GlwReferenceDraftPersistenceAuthorityError ? error.code : error instanceof Error ? error.message : "DRAFT_PERSISTENCE_FAILED";
    return NextResponse.json({ error: "Reference draft persistence failed closed.", code, wordpressMutation: false, publicationMutation: false }, { status: 409 });
  }
}
