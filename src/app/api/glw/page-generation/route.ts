import { createHash } from "node:crypto";
import { load } from "cheerio";
import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { bindGeneratedContextualMediaWordPress, saveSuccessfulGeneratedContextualMedia } from "@/modules/foundation/generated-contextual-media-repository";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { loadProjectorEnclosureSeoAuthority, type ProjectorEnclosureKeywordOwner, type ProjectorEnclosureSeoSelection } from "@/modules/foundation/projectorenclosure-seo-authority";
import { getProductById, listProducts } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { listSitePageMediaAssignments, resolveApprovedProductAuthorityMedia, saveSitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { attachGenesisWordPressExistingFeaturedImage, attachGenesisWordPressFeaturedImage } from "@/modules/foundation/wordpress-media-writer";
import { renderSiteStudioAuthorityLinks, resolveSiteStudioProductAuthority } from "@/modules/foundation/site-studio-product-authority";
import { repairGlwStateContentToMinimum } from "@/modules/glw/content-repair-service";
import { repairGlwCampaignReferenceCityArtifact } from "@/modules/glw/campaign-reference-content-repair";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { resolveFinalizationArtifactSource } from "@/modules/glw/finalization-artifact-source";
import { evaluateGlwReferenceClaimAuthority, type GlwClaimAuthorityFinding, type GlwReferenceClaimClass } from "@/modules/glw/reference-claim-authority";
import {
  canonicalizeAndRevalidateGlwZeroAuthorityClaims,
  canonicalizeGlwZeroAuthorityClaims,
  type GlwZeroAuthorityFallbackPolicy,
} from "@/modules/glw/zero-authority-claim-canonicalization";
import { generationAuthorityBindingsMatch, resolveGlwReferenceGenerationAuthority } from "@/modules/glw/reference-generation-authority";
import { resolveGlwReferenceOwnerLiveContext } from "@/modules/glw/reference-owner-live-context";
import { consumeGlwReferenceOwnerClaimForDispatch, GlwReferenceOwnerAuthorityError, validateGlwReferenceOwnerClaimForFailedDispatchRecovery, validateGlwReferenceOwnerClaimForRecoveredContent } from "@/modules/glw/reference-owner-authority";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { enrichGlwGeneratedContentForSeo } from "@/modules/glw/seo-enrichment";
import { generateGenesisFeaturedImageWithCampaignReferences } from "@/modules/glw/reference-aware-image-service";
import {
  renderGlwAllowedInternalLinks,
  resolveGlwAllowedInternalLinks,
} from "@/modules/glw/site-internal-link-authority";
import { resolveGlwWordPressTargetHierarchy } from "@/modules/glw/wordpress-target-hierarchy";
import {
  createGlwN8nMcpDispatcher,
  createGlwN8nMcpExecutionReader,
} from "@/modules/glw/n8n-mcp-adapter";
import {
  createGlwDraftExecutionService,
  GlwDraftOnlyExecutionError,
  type GlwPageExecutionRecord,
} from "@/modules/glw/page-execution";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import type { ContextualGenerationReceipt } from "@/modules/glw/contextual-media-production-adapter";
import { buildOutdoorSphereGeneratedContextualPrompt, requiresGeneratedContextualMediaForOutdoorSphere } from "@/modules/glw/outdoor-sphere-contextual-media-policy";
import { applyProjectorEnclosureHouseMappingCanary } from "@/modules/glw/projectorenclosure-house-mapping-canary";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,

  type GlwGenerationRequest,
  type GlwGenerationRequestInput,
} from "@/modules/glw/page-generation";
import { readGlwTargetPreflight, resolveGlwTargetMutationAvailability } from "@/modules/glw/target-preflight";
import { listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { resolveExactContinuationCampaignTarget } from "@/modules/glw/campaign-continuation-target-lookup";
import { applyScopedThemeTitleSuppression } from "@/modules/glw/scoped-theme-title-suppression";
import { renderOutdoorSphereRichWordPress } from "@/modules/glw/outdoor-sphere-rich-wordpress-render";
import { resolveOutdoorSphereGovernedCtaUrl } from "@/modules/glw/outdoor-sphere-governed-cta-url";

const service = createGlwDraftExecutionService({
  repository: glwPageExecutionRepository,
  dispatcher: createGlwN8nMcpDispatcher(),
  executionTransport: "N8N_MCP",
});
const executionReader = createGlwN8nMcpExecutionReader();
const GLW_GENERATION_MINIMUM_WORD_COUNT = 1500;
const sha256Text = (value: string) => createHash("sha256").update(value.trim()).digest("hex");
const sha256Bytes = (value: Buffer) => createHash("sha256").update(value).digest("hex");

function isTerminal(status: string): boolean {
  return status === "COMPLETE" || status === "FAILED";
}

const ZERO_AUTHORITY_PROTECTED_CLASSES = new Set<GlwReferenceClaimClass>([
  "LOCATION_FACT",
  "MARKET_ADOPTION",
  "CLIMATE",
  "PRODUCT_CAPABILITY",
  "PRODUCT_SPECIFICATION",
  "DURABILITY",
  "INGRESS_PROTECTION",
  "BRIGHTNESS",
  "INTERACTIVITY",
  "REMOTE_MANAGEMENT",
  "INSTALLATION_SERVICE",
  "TRAINING",
  "WARRANTY",
  "SERVICE_AVAILABILITY",
  "PRICING",
  "INVENTORY",
  "PERFORMANCE",
  "INSTALLATION_CAPABILITY",
  "SERVICE_CAPABILITY",
]);

function normalizeClaimText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function omitUnsupportedProtectedClaims(input: {
  html: string;
  findings: readonly GlwClaimAuthorityFinding[];
}): { html: string; omittedClaims: string[] } {
  const claims = input.findings
    .filter((finding) => finding.authorityStatus === "UNSUPPORTED" && ZERO_AUTHORITY_PROTECTED_CLASSES.has(finding.claimClass))
    .map((finding) => normalizeClaimText(finding.claimText))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  if (claims.length === 0) return { html: input.html, omittedClaims: [] };

  const omitted = new Set<string>();
  const $ = load(input.html, null, false);
  const blocks = "li,p,dd,dt,h1,h2,h3,h4,h5,h6,td,th";

  for (const claim of claims) {
    let removed = false;
    $(blocks).each((_, element) => {
      const elementText = normalizeClaimText($(element).text());
      if (!removed && elementText.includes(claim)) {
        $(element).remove();
        removed = true;
      }
    });
    if (removed) omitted.add(claim);
  }

  let html = $.html();
  for (const claim of claims) {
    if (omitted.has(claim)) continue;
    if (html.includes(claim)) {
      html = html.split(claim).join("");
      omitted.add(claim);
    }
  }

  return { html, omittedClaims: [...omitted] };
}

function parseAbsoluteHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function resolveStrictProductAuthorityMediaUrl(input: {
  authority: {
    asset: {
      type: string;
      wordpressMediaId?: unknown;
      url?: unknown;
    };
    wordpressReceipt?: {
      url?: string | null;
    } | null;
  } | null;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
}): string | null {
  const receiptUrl = parseAbsoluteHttpUrl(input.authority?.wordpressReceipt?.url ?? null);
  if (receiptUrl) {
    return receiptUrl.toString();
  }

  if (!input.authority || input.authority.asset.type !== "APPROVED_EXISTING") {
    return null;
  }

  const mediaId = input.authority.asset.wordpressMediaId;
  if (typeof mediaId !== "number" || !Number.isSafeInteger(mediaId) || mediaId < 1) {
    return null;
  }

  const assetUrlValue = typeof input.authority.asset.url === "string" ? input.authority.asset.url : null;
  const assetUrl = parseAbsoluteHttpUrl(assetUrlValue);
  if (!assetUrl) {
    return null;
  }

  const allowedOrigins = new Set<string>();
  const siteCanonical = parseAbsoluteHttpUrl(input.siteRecord.canonicalUrl);
  if (siteCanonical) allowedOrigins.add(siteCanonical.origin.toLowerCase());
  const siteWordPressApi = parseAbsoluteHttpUrl(input.siteRecord.integrations.wordpressApiBaseUrl);
  if (siteWordPressApi) allowedOrigins.add(siteWordPressApi.origin.toLowerCase());

  if (!allowedOrigins.has(assetUrl.origin.toLowerCase())) {
    return null;
  }

  return assetUrl.toString();
}

async function recoverExecution(job: GlwPageExecutionRecord): Promise<GlwPageExecutionRecord> {
  if (!job.externalExecutionId && (job.status === "DISPATCHED" || job.status === "DISCOVERING_EXECUTION")) {
    return service.discoverExecution(job.jobId, executionReader);
  }
  if (!job.externalExecutionId) return job;
  return service.pollToTerminal(job.jobId, executionReader);
}

function buildGenesisImagePrompt(input: {
  request: GlwGenerationRequest;
  siteName: string;
}): string {
  const location = [input.request.cityName, input.request.stateName]
    .filter(Boolean)
    .join(", ");
  return [
    `Photorealistic commercial installation featuring ${input.request.productTopic}.`,
    location ? `The setting should feel appropriate for a commercial project in ${location}.` : "Use a premium commercial architectural environment.",
    `Create the image for ${input.siteName} as a polished website hero visual.`,
    input.request.imageDirection?.trim() || "",
    "Show the product clearly and realistically with professional lighting, believable materials, correct scale, and useful negative space.",
  ].join(" ");
}

function prepareGeneratedContentForSite(input: {
  artifact: NonNullable<GlwPageExecutionRecord["generatedDraft"]>;
  request: GlwGenerationRequest;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
  keywordOwners: readonly ProjectorEnclosureKeywordOwner[];
}) {
  if (input.siteRecord.domain === "leddisplaywarehouse.com") {
    return {
      ...enrichGlwGeneratedContentForSeo({
      artifact: input.artifact,
      request: input.request,
      }),
      seoAuthority: null,
    };
  }

  const seoAuthority: ProjectorEnclosureSeoSelection | null = input.siteRecord.domain === "projectorenclosure.com"
    && input.request.projectorEnclosureSeoAuthority
    ? loadProjectorEnclosureSeoAuthority().select({
        ...input.request.projectorEnclosureSeoAuthority,
        existingOwners: input.keywordOwners,
        geographyValidated: Boolean(
          input.request.wordpressObjectId
          && input.request.plannedOperation.startsWith("UPDATE_")
          && (input.request.pageType === "city_service" || input.request.pageType === "state_service")
        ),
        verifiedSecondaryKeywords: [],
        verifiedCompatibilityKeywords: [],
        verifiedElectricalKeywords: [],
        canonicalUrl: input.siteRecord.canonicalUrl
          ? new URL(input.request.canonicalPath.replace(/^\/+/, ""), `${input.siteRecord.canonicalUrl.replace(/\/$/, "")}/`).toString()
          : input.request.canonicalPath,
        pageType: input.request.pageType,
        city: input.request.cityName,
        state: input.request.stateName,
      })
    : null;

  return {
    artifact: input.artifact,
    metadata: {
      focusKeyphrase: seoAuthority?.primaryKeyword?.keyword || input.artifact.focusKeyphrase?.trim() || input.request.productTopic,
      seoTitle: input.artifact.seoTitle?.trim() || input.request.seoTitle,
      metaDescription: input.artifact.metaDescription?.trim() || input.request.metaDescription,
    },
    inserted: {
      productAuthorityLink: false,
      relatedProductLinks: 0,
      corporateLink: false,
      outboundAuthorityLink: false,
      localAuthorityLink: false,
      weatherAuthorityLink: false,
    },
    approvedExternalDomains: [] as string[],
    seoAuthority,
  };
}

async function finalizeContentReadyExecution(input: {
  job: GlwPageExecutionRecord;
  request: GlwGenerationRequest;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
  continuationTargetId?: string;
}): Promise<GlwPageExecutionRecord> {
  const recoverableQaFailure =
    input.job.status === "FAILED"
    && (input.job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      || input.job.errorCode === "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED"
      || input.job.errorCode?.startsWith("CONTENT_REPAIR_") === true)
    && Boolean(input.job.generatedDraft);


  const recoverableWordPressFailure =
    input.job.status === "FAILED"
    && Boolean(input.job.generatedDraft)
    && Boolean(
      input.job.errorCode
      && new Set([
        "WORDPRESS_HIERARCHY_READ_FAILED",
        "WORDPRESS_HIERARCHY_WRITE_FAILED",
        "WORDPRESS_READ_FAILED",
        "WORDPRESS_WRITE_FAILED",
      ]).has(input.job.errorCode),
    );

  if (
    input.job.status !== "CONTENT_READY"
    && !recoverableQaFailure
    && !recoverableWordPressFailure
  ) return input.job;
  if (!input.job.generatedDraft) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "GENERATED_DRAFT_MISSING",
      errorMessage: "n8n completed without a generated draft artifact for Genesis WordPress mutation.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const recoverableFailure = recoverableQaFailure || recoverableWordPressFailure;
  const artifactSource = resolveFinalizationArtifactSource({
    job: input.job,
    recoverableFailure,
  });
  const rawGeneratedDraft = artifactSource.rawGeneratedDraft;
  let artifactForPipeline = artifactSource.artifactForPipeline;
  if (input.request.referenceAuthorityBinding
    && input.request.referenceGenerationAuthority
    && input.request.referenceGenerationAuthority.authoritativeFactReferenceIds.length === 0) {
    let zeroAuthorityArtifact = rawGeneratedDraft;
    let rawClaimAuthority = evaluateGlwReferenceClaimAuthority({
      artifact: zeroAuthorityArtifact,
      authority: {
        references: input.request.referenceGenerationAuthority.references,
        authoritativeFactReferenceIds: [],
        supportedClaimMappings: [],
      },
    });
    const omitted = omitUnsupportedProtectedClaims({
      html: zeroAuthorityArtifact.contentHtml,
      findings: rawClaimAuthority.findings,
    });
    if (omitted.omittedClaims.length > 0) {
      zeroAuthorityArtifact = {
        ...zeroAuthorityArtifact,
        contentHtml: omitted.html,
      };
      rawClaimAuthority = evaluateGlwReferenceClaimAuthority({
        artifact: zeroAuthorityArtifact,
        authority: {
          references: input.request.referenceGenerationAuthority.references,
          authoritativeFactReferenceIds: [],
          supportedClaimMappings: [],
        },
      });
    }
    const canonicalization = canonicalizeGlwZeroAuthorityClaims({
      rawArtifact: zeroAuthorityArtifact,
      authoritativeFactReferenceIds: [],
      findings: rawClaimAuthority.findings,
      fallbackPolicy: resolveZeroAuthorityFallbackPolicy(input.request),
      authority: {
        references: input.request.referenceGenerationAuthority.references,
        authoritativeFactReferenceIds: [],
        supportedClaimMappings: [],
      },
    });
    if (!canonicalization.ok || !canonicalization.canonicalizedArtifact) {
      const timestamp = new Date().toISOString();
      return glwPageExecutionRepository.update(input.job.jobId, {
        status: "FAILED",
        rawGeneratedDraft,
        canonicalizedGeneratedDraft: null,
        canonicalizationReceipt: canonicalization.receipt,
        errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
        errorMessage: "A protected factual claim could not be safely canonicalized without authority.",
        qaStatus: "FAILED",
        qaChecks: { zeroAuthorityCanonicalization: canonicalization.receipt },
        qaFailureReasons: Object.fromEntries(canonicalization.receipt.blockedClaims.map((claim, index) => [
          `zeroAuthorityCanonicalization.${index + 1}`,
          claim,
        ])),
        updatedAt: timestamp,
        completedAt: timestamp,
      });
    }
    artifactForPipeline = canonicalization.canonicalizedArtifact;
    await glwPageExecutionRepository.update(input.job.jobId, {
      rawGeneratedDraft,
      canonicalizedGeneratedDraft: canonicalization.canonicalizedArtifact,
      canonicalizationReceipt: canonicalization.receipt,
      updatedAt: new Date().toISOString(),
    });
  }

  const productRecord = getProductById(input.request.productId);
  if (!productRecord) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "PRODUCT_AUTHORITY_MISSING",
      errorMessage: "Genesis could not resolve the canonical product authority for this job.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const productAuthority = await resolveSiteStudioProductAuthority({
    site: input.siteRecord,
    product: productRecord,
    products: listProducts(),
  });
  const keywordOwners: ProjectorEnclosureKeywordOwner[] = input.request.projectorEnclosureSeoAuthority
    ? (await glwPageExecutionRepository.list())
        .filter((record) => record.siteId === input.request.siteId && record.wordpressUrl && record.focusKeyphrase)
        .map((record) => {
          const authorityEvidence = record.qaChecks?.seoAuthority;
          const pageTarget = authorityEvidence && typeof authorityEvidence === "object" && !Array.isArray(authorityEvidence)
            && typeof (authorityEvidence as { pageTarget?: unknown }).pageTarget === "string"
            ? String((authorityEvidence as { pageTarget: string }).pageTarget)
            : "General Projector Enclosures";
          return {
            canonicalUrl: record.wordpressUrl!,
            primaryKeyword: record.focusKeyphrase!,
            pageTarget,
          };
        })
    : [];

  const campaignReferenceRepair =
    repairGlwCampaignReferenceCityArtifact({
      artifact: applyProjectorEnclosureHouseMappingCanary({
        request: input.request,
        artifact: artifactForPipeline,
      }),
      request: input.request,
    });

  let enrichment = prepareGeneratedContentForSite({
    artifact: campaignReferenceRepair.artifact,
    request: input.request,
    siteRecord: input.siteRecord,
    keywordOwners,
  });
  const normalizedCanonicalPath =
    `/${input.request.canonicalPath
      .split("/")
      .filter(Boolean)
      .join("/")}/`;

  const approvedCampaignInternalLinks =
    resolveGlwAllowedInternalLinks({
      organizationId:
        input.request.organizationId,
      siteId:
        input.request.siteId,
      productId:
        input.request.productId,
      stateCode:
        input.request.stateCode ?? "",
      canonicalPath:
        normalizedCanonicalPath,
    });

  const renderedCampaignInternalLinks =
    renderGlwAllowedInternalLinks({
      html: enrichment.artifact.contentHtml,
      links: approvedCampaignInternalLinks,
    });

  enrichment = {
    ...enrichment,
    artifact: {
      ...enrichment.artifact,
      contentHtml:
        renderedCampaignInternalLinks.html,
    },
  };

  if (enrichment.seoAuthority && !enrichment.seoAuthority.eligible) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "SEO_AUTHORITY_INELIGIBLE",
      errorMessage: enrichment.seoAuthority.selectionRationale,
      qaStatus: "FAILED",
      qaChecks: { seoAuthority: enrichment.seoAuthority },
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const renderedAuthority = renderSiteStudioAuthorityLinks({
    html: enrichment.artifact.contentHtml,
    authority: productAuthority,
  });
  enrichment = {
    ...enrichment,
    artifact: {
      ...enrichment.artifact,
      contentHtml: renderedAuthority.html,
    },
  };

  let qa = evaluateGlwGeneratedContentQa({
    artifact: enrichment.artifact,
    request: input.request,
    siteDomain: input.siteRecord.domain,
    minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
    additionalAllowedDomains: enrichment.approvedExternalDomains,
    requiredCanonicalProductLink: productAuthority.canonicalProduct
      ? { url: productAuthority.canonicalProduct.url, anchorText: productAuthority.canonicalProduct.anchorText }
      : null,
    authorizedComparisonStateCodes: input.request.referenceGenerationAuthority?.localizationPolicy.authorizedComparisonStateCodes,
  });

  const eligibleForBoundedRepair =
    !qa.ok
    && recoverableQaFailure
    && input.request.pageType === "state_service"
    && qa.wordCount < GLW_GENERATION_MINIMUM_WORD_COUNT;

  if (eligibleForBoundedRepair) {
    const repair = await repairGlwStateContentToMinimum({
      artifact: enrichment.artifact,
      request: input.request,
      minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
      currentWordCount: qa.wordCount,
    });

    if (!repair.ok) {
      const timestamp = new Date().toISOString();
      return glwPageExecutionRepository.update(input.job.jobId, {
        status: "FAILED",
        generatedDraft: enrichment.artifact,
        errorCode: `CONTENT_REPAIR_${repair.state.toUpperCase()}`,
        errorMessage: repair.message,
        qaStatus: "FAILED",
        qaChecks: qa.checks,
        qaFailureReasons: qa.failureReasons,
        wordCount: qa.wordCount,
        updatedAt: timestamp,
        completedAt: timestamp,
      });
    }

    enrichment = prepareGeneratedContentForSite({
      artifact: repair.artifact,
      request: input.request,
      siteRecord: input.siteRecord,
      keywordOwners,
    });

    qa = evaluateGlwGeneratedContentQa({
      artifact: enrichment.artifact,
      request: input.request,
      siteDomain: input.siteRecord.domain,
      minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
      additionalAllowedDomains: enrichment.approvedExternalDomains,
      requiredCanonicalProductLink: productAuthority.canonicalProduct
        ? { url: productAuthority.canonicalProduct.url, anchorText: productAuthority.canonicalProduct.anchorText }
        : null,
      authorizedComparisonStateCodes: input.request.referenceGenerationAuthority?.localizationPolicy.authorizedComparisonStateCodes,
    });
  }

  const claimAuthorityContext = input.request.referenceGenerationAuthority
    ? {
        references: input.request.referenceGenerationAuthority.references,
        authoritativeFactReferenceIds: input.request.referenceGenerationAuthority.authoritativeFactReferenceIds,
        supportedClaimMappings: input.request.referenceGenerationAuthority.supportedClaimMappings,
      }
    : null;
  const claimParity = input.request.referenceAuthorityBinding && claimAuthorityContext
    ? canonicalizeAndRevalidateGlwZeroAuthorityClaims({
        artifact: enrichment.artifact,
        authority: claimAuthorityContext,
        fallbackPolicy: resolveZeroAuthorityFallbackPolicy(input.request),
      })
    : null;
  if (claimParity && claimParity.canonicalizationSucceeded) {
    enrichment = {
      ...enrichment,
      artifact: claimParity.artifact,
    };
    qa = evaluateGlwGeneratedContentQa({
      artifact: enrichment.artifact,
      request: input.request,
      siteDomain: input.siteRecord.domain,
      minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
      additionalAllowedDomains: enrichment.approvedExternalDomains,
      requiredCanonicalProductLink: productAuthority.canonicalProduct
        ? { url: productAuthority.canonicalProduct.url, anchorText: productAuthority.canonicalProduct.anchorText }
        : null,
      authorizedComparisonStateCodes: input.request.referenceGenerationAuthority?.localizationPolicy.authorizedComparisonStateCodes,
    });
  }
  const claimAuthority = claimParity
    ? claimParity.finalClaimAuthority
    : (input.request.referenceAuthorityBinding
      ? evaluateGlwReferenceClaimAuthority({
          artifact: enrichment.artifact,
          authority: claimAuthorityContext,
        })
      : null);
  const productAuthorityFailures = Object.fromEntries(
    ["stateProductAuthorityLink", "canonicalProductReference"]
      .filter((key) => qa.checks[key]?.ok === false)
      .map((key) => [key, qa.checks[key].message]),
  );
  if (Object.keys(productAuthorityFailures).length > 0) {
    const timestamp = new Date().toISOString();
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      errorMessage: "Required product-authority link QA failed.",
      qaStatus: "FAILED",
      qaChecks: qa.checks,
      qaFailureReasons: productAuthorityFailures,
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }
  if (claimAuthority && !claimAuthority.ok) {
    const timestamp = new Date().toISOString();
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      errorMessage: `Unsupported factual claims detected under ${claimAuthority.policyVersion}.`,
      qaStatus: "FAILED",
      qaChecks: {
        ...qa.checks,
        claimAuthority: { policyVersion: claimAuthority.policyVersion, findings: claimAuthority.findings },
        ...(claimParity?.canonicalizationReceipt
          ? { zeroAuthorityCanonicalizationRevalidation: claimParity.canonicalizationReceipt }
          : {}),
      },
      qaFailureReasons: { ...qa.failureReasons, ...claimAuthority.failureReasons },
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  const localizationFailures = Object.fromEntries(
    ["expectedState", "stateLocalizationContamination"]
      .filter((key) => qa.checks[key]?.ok === false)
      .map((key) => [key, qa.checks[key].message]),
  );
  if (Object.keys(localizationFailures).length > 0) {
    const timestamp = new Date().toISOString();
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      errorMessage: "State localization QA failed.",
      qaStatus: "FAILED",
      qaChecks: { ...qa.checks, claimAuthority: claimAuthority ? { policyVersion: claimAuthority.policyVersion, findings: claimAuthority.findings } : null },
      qaFailureReasons: localizationFailures,
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  if (!qa.ok) {
    const timestamp = new Date().toISOString();
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      errorMessage: Object.values(qa.failureReasons).join(" ") || "Generated content failed Genesis QA.",
      qaStatus: "FAILED",
      qaChecks: qa.checks,
      qaFailureReasons: qa.failureReasons,
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  const targetHierarchy = await resolveGlwWordPressTargetHierarchy({
    request: input.request,
    site: input.siteRecord,
  });

  if (!targetHierarchy.ok) {
    const timestamp = new Date().toISOString();

    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: targetHierarchy.errorCode,
      errorMessage: targetHierarchy.errorMessage,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  const persistedDraftId = input.job.wordpressStatus === "draft"
    ? input.job.wordpressObjectId
    : null;

  const hierarchyObjectId =
    input.request.pageType === "state_service"
      ? targetHierarchy.wordpressObjectId
      : null;

  const requestedOperation = input.request.plannedOperation.startsWith("CREATE_")
    ? "CREATE"
    : "UPDATE";

  const operation =
    persistedDraftId || hierarchyObjectId
      ? "UPDATE"
      : requestedOperation;

  const updateObjectId =
    persistedDraftId
    ?? hierarchyObjectId
    ?? input.request.wordpressObjectId;

  if (operation === "UPDATE" && !updateObjectId) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "UPDATE_AUTHORITY_REQUIRED",
      errorMessage: "Genesis requires an exact WordPress object ID before a draft update.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const parentId = targetHierarchy.parentId;
  const strictGeneratedContextualRequired = requiresGeneratedContextualMediaForOutdoorSphere({
    campaignId: input.request.campaignId,
    organizationId: input.request.organizationId,
    siteId: input.request.siteId,
    productId: input.request.productId,
  });
  const suppressionEligible = strictGeneratedContextualRequired
    && input.siteRecord.domain === "leddisplaywarehouse.com";
  const preWriteSuppression = suppressionEligible && operation === "UPDATE" && updateObjectId
    ? applyScopedThemeTitleSuppression({
        contentHtml: enrichment.artifact.contentHtml,
        wordpressObjectId: updateObjectId,
      })
    : null;

  const artifact = {
    title: enrichment.artifact.title,
    contentHtml: preWriteSuppression?.contentHtml ?? enrichment.artifact.contentHtml,
    slug: enrichment.artifact.slug,
    excerpt: enrichment.artifact.excerpt,
    parentId,
    seo: input.siteRecord.domain === "leddisplaywarehouse.com"
      ? enrichment.metadata
      : null,
  };
  const result = operation === "CREATE"
    ? await writeGenesisWordPressDraft({ operation: "CREATE", site: input.siteRecord, artifact })
    : await writeGenesisWordPressDraft({ operation: "UPDATE", site: input.siteRecord, wordpressObjectId: updateObjectId!, artifact });

  const timestamp = new Date().toISOString();
  if (!result.ok) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: `WORDPRESS_${result.state.toUpperCase()}`,
      errorMessage: result.message,
      qaStatus: "PASSED",
      qaChecks: qa.checks,
      qaFailureReasons: {},
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  let finalizedArtifact = {
    ...enrichment.artifact,
    contentHtml: artifact.contentHtml,
  };

  if (suppressionEligible) {
    const postWriteSuppression = applyScopedThemeTitleSuppression({
      contentHtml: finalizedArtifact.contentHtml,
      wordpressObjectId: result.wordpressObjectId,
    });
    if (postWriteSuppression.mutated) {
      const suppressionWrite = await writeGenesisWordPressDraft({
        operation: "UPDATE",
        site: input.siteRecord,
        wordpressObjectId: result.wordpressObjectId,
        artifact: {
          ...artifact,
          contentHtml: postWriteSuppression.contentHtml,
        },
      });
      if (!suppressionWrite.ok) {
        return glwPageExecutionRepository.update(input.job.jobId, {
          status: "FAILED",
          generatedDraft: enrichment.artifact,
          errorCode: `WORDPRESS_${suppressionWrite.state.toUpperCase()}`,
          errorMessage: suppressionWrite.message,
          qaStatus: "PASSED",
          qaChecks: qa.checks,
          qaFailureReasons: {},
          wordCount: qa.wordCount,
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      }
      finalizedArtifact = {
        ...finalizedArtifact,
        contentHtml: postWriteSuppression.contentHtml,
      };
    }
  }

  const draftJob = await glwPageExecutionRepository.update(input.job.jobId, {
    status: "CONTENT_READY",
    generatedDraft: finalizedArtifact,
    wordpressObjectId: result.wordpressObjectId,
    wordpressUrl: result.wordpressUrl,
    wordpressStatus: result.wordpressStatus,
    disposition: result.operation === "CREATE" ? "CREATED" : "UPDATED",
    qaStatus: "PASSED",
    qaChecks: {
      ...qa.checks,
      productAuthority: {
        lookupResult: productAuthority.lookupResult,
        productId: productAuthority.productId,
        canonicalProductReference: productAuthority.canonicalProduct?.url ?? null,
        exactProductMatch: true,
      },
      internalLinks: {
        candidatesSupplied: productAuthority.internalLinkCandidates.length,
        linksSelected: productAuthority.selectedInternalLinks.length,
        linksRendered: renderedAuthority.rendered.length,
        destinations: renderedAuthority.rendered.map((link) => ({ url: link.url, anchorText: link.anchorText, destinationValid: link.destinationValid })),
      },
      externalReferences: {
        candidatesSupplied: productAuthority.externalReferenceCandidates.length,
        linksSelected: productAuthority.selectedExternalReferences.length,
        linksRendered: 0,
        domainAuthorityPassed: true,
      },
      mediaAuthority: {
        candidatesSupplied: productAuthority.mediaCandidates.length,
        selectedMediaId: productAuthority.selectedMedia?.wordpressMediaId ?? null,
        selectedProvenance: productAuthority.selectedMedia?.provenance ?? "GENERATED_MEDIA",
        generatedMediaReason: productAuthority.generatedMediaReason,
      },
      seoAuthority: enrichment.seoAuthority
        ? {
            eligible: enrichment.seoAuthority.eligible,
            primaryKeyword: enrichment.seoAuthority.primaryKeyword?.keyword ?? null,
            secondaryKeywords: enrichment.seoAuthority.secondaryKeywords.map((keyword) => keyword.keyword),
            cluster: "cluster" in (enrichment.seoAuthority.primaryKeyword ?? {})
              ? (enrichment.seoAuthority.primaryKeyword as { cluster: string }).cluster
              : null,
            intent: enrichment.seoAuthority.intent,
            buyerStage: enrichment.seoAuthority.buyerStage,
            pageTarget: enrichment.seoAuthority.pageTarget,
            recommendedRole: enrichment.seoAuthority.recommendedRole,
            geographicVariant: enrichment.seoAuthority.geographicVariant?.keyword ?? null,
            relatedPageTargets: enrichment.seoAuthority.relatedPageTargets,
            selectionRationale: enrichment.seoAuthority.selectionRationale,
            cannibalization: enrichment.seoAuthority.cannibalization,
            provenance: enrichment.seoAuthority.provenance,
          }
        : null,
    },
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    featuredImagePresent: false,
    errorCode: null,
    errorMessage: null,
    updatedAt: timestamp,
    completedAt: null,
  });

  const location = [input.request.cityName, input.request.stateName]
    .filter(Boolean)
    .join(", ");
  const strictApprovedProductAuthority = strictGeneratedContextualRequired
    ? (() => {
        const strictProductRecord = getProductById(input.request.productId);
        return strictProductRecord?.media.primaryImageReference
          ? resolveApprovedProductAuthorityMedia({
              organizationId: input.request.organizationId,
              siteId: input.request.siteId,
              productId: input.request.productId,
              authorityReference: strictProductRecord.media.primaryImageReference,
            })
          : null;
      })()
    : null;
  const strictApprovedProductAuthorityMediaUrl = strictGeneratedContextualRequired
    ? resolveStrictProductAuthorityMediaUrl({
        authority: strictApprovedProductAuthority,
        siteRecord: input.siteRecord,
      })
    : null;
  if (strictGeneratedContextualRequired && !strictApprovedProductAuthorityMediaUrl) {
    return glwPageExecutionRepository.update(draftJob.jobId, {
      status: "CONTENT_READY",
      errorCode: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      errorMessage: "Outdoor Sphere rich composition requires approved product authority media with a WordPress URL.",
      featuredImagePresent: true,
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });
  }
  let mediaResult;
  let generatedImageBytes: Buffer | null = null;
  let generatedImageMimeType: "image/jpeg" | "image/png" | "image/webp" | null = null;
  let generatedImageProvider: string | null = null;
  let generatedImageModel: string | null = null;
  if (productAuthority.selectedMedia && !strictGeneratedContextualRequired) {
    mediaResult = await attachGenesisWordPressExistingFeaturedImage({
      site: input.siteRecord,
      wordpressObjectId: result.wordpressObjectId,
      contentHtml: finalizedArtifact.contentHtml,
      wordpressMediaId: productAuthority.selectedMedia.wordpressMediaId,
      expectedMediaUrl: productAuthority.selectedMedia.url,
      altText: productAuthority.selectedMedia.altText,
    });
  } else {
    const strictPrompt = strictGeneratedContextualRequired
      ? buildOutdoorSphereGeneratedContextualPrompt({ stateName: input.request.stateName, cityName: input.request.cityName })
      : null;
    const imageResult = await generateGenesisFeaturedImageWithCampaignReferences({
      prompt: strictPrompt ?? buildGenesisImagePrompt({ request: input.request, siteName: input.siteRecord.displayName }),
      siteName: input.siteRecord.displayName,
      productTopic: input.request.productTopic,
      campaignId: input.request.campaignId ?? null,
    });
    if (!imageResult.ok) {
      return glwPageExecutionRepository.update(draftJob.jobId, {
        status: "CONTENT_READY",
        errorCode: `IMAGE_${imageResult.state.toUpperCase()}`,
        errorMessage: imageResult.message,
        featuredImagePresent: false,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    }
    generatedImageBytes = imageResult.image.bytes;
    generatedImageMimeType = imageResult.image.mimeType;
    generatedImageProvider = imageResult.image.provider;
    generatedImageModel = imageResult.image.model;
    mediaResult = await attachGenesisWordPressFeaturedImage({
      site: input.siteRecord,
      wordpressObjectId: result.wordpressObjectId,
      canonicalSlug: input.request.canonicalPath,
      contentHtml: finalizedArtifact.contentHtml,
      image: imageResult.image,
      title: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
      altText: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
      description: `Commercial hero image for ${input.request.productTopic}${location ? ` in ${location}` : ""} on ${input.siteRecord.displayName}.`,
    });
  }

  if (!mediaResult.ok) {
    return glwPageExecutionRepository.update(draftJob.jobId, {
      status: "CONTENT_READY",
      errorCode: `WORDPRESS_MEDIA_${mediaResult.state.toUpperCase()}`,
      errorMessage: mediaResult.message,
      featuredImagePresent: false,
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });
  }

  const completedAt = new Date().toISOString();
  let finalizedWordPressObjectId = result.wordpressObjectId;
  let finalizedWordPressUrl = result.wordpressUrl;
  let finalizedWordPressStatus = result.wordpressStatus;
  let finalizedPresentationArtifact = finalizedArtifact;

  if (strictGeneratedContextualRequired) {
    if (!strictApprovedProductAuthority || !strictApprovedProductAuthorityMediaUrl) {
      return glwPageExecutionRepository.update(draftJob.jobId, {
        status: "CONTENT_READY",
        errorCode: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
        errorMessage: "Outdoor Sphere rich composition requires approved product authority media with a WordPress URL.",
        featuredImagePresent: true,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    const governedCtaUrl = resolveOutdoorSphereGovernedCtaUrl({
      strictGeneratedContextualRequired,
      siteId: input.request.siteId,
      siteDomain: input.siteRecord.domain,
      approvedCampaignInternalLinks,
    });

    const richRender = renderOutdoorSphereRichWordPress({
      title: enrichment.artifact.title,
      stateName: input.request.stateName,
      productTopic: input.request.productTopic,
      semanticSourceHtml: enrichment.artifact.contentHtml,
      excerpt: enrichment.artifact.excerpt,
      contextualMediaUrl: mediaResult.mediaUrl,
      productAuthorityMediaUrl: strictApprovedProductAuthorityMediaUrl,
      productAuthorityAltText: strictApprovedProductAuthority.metadata.altText,
      canonicalProductUrl: productAuthority.canonicalProduct?.url ?? null,
      governedCtaUrl,
    });

    if (!richRender.ok) {
      return glwPageExecutionRepository.update(draftJob.jobId, {
        status: "CONTENT_READY",
        errorCode: richRender.code,
        errorMessage: richRender.message,
        featuredImagePresent: true,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    const richSuppression = suppressionEligible
      ? applyScopedThemeTitleSuppression({
          contentHtml: richRender.html,
          wordpressObjectId: result.wordpressObjectId,
        })
      : null;
    const richHtml = richSuppression?.contentHtml ?? richRender.html;
    const richWrite = await writeGenesisWordPressDraft({
      operation: "UPDATE",
      site: input.siteRecord,
      wordpressObjectId: result.wordpressObjectId,
      artifact: {
        ...artifact,
        contentHtml: richHtml,
      },
    });

    if (!richWrite.ok) {
      return glwPageExecutionRepository.update(draftJob.jobId, {
        status: "CONTENT_READY",
        errorCode: "OUTDOOR_SPHERE_RICH_WORDPRESS_WRITE_FAILED",
        errorMessage: richWrite.message,
        featuredImagePresent: true,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    finalizedWordPressObjectId = richWrite.wordpressObjectId;
    finalizedWordPressUrl = richWrite.wordpressUrl;
    finalizedWordPressStatus = richWrite.wordpressStatus;
    finalizedPresentationArtifact = {
      ...finalizedArtifact,
      contentHtml: richHtml,
    };
  }

  let contextualReceipt: ContextualGenerationReceipt | null = null;
  if (strictGeneratedContextualRequired) {
    try {
      if (!input.request.campaignId) {
        throw new Error("CONTEXTUAL_MEDIA_EXACT_TARGET_REQUIRED");
      }
      const strictTargetId = input.continuationTargetId ?? (() => {
        const targetLookup = resolveExactContinuationCampaignTarget({
          targets: listGlwCampaignTargets(input.request.campaignId!),
          campaignId: input.request.campaignId!,
          organizationId: input.request.organizationId,
          siteId: input.request.siteId,
          productId: input.request.productId,
          expectedStateCode: input.request.stateCode,
          expectedCitySlug: input.request.citySlug,
          expectedJobId: draftJob.jobId,
          expectedExecutionId: draftJob.externalExecutionId,
          actualExecutionId: draftJob.externalExecutionId,
        });
        return targetLookup.ok ? targetLookup.target.targetId : null;
      })();
      if (!strictTargetId) {
        throw new Error("CONTEXTUAL_MEDIA_EXACT_TARGET_REQUIRED");
      }
      if (!generatedImageBytes || !generatedImageMimeType || !generatedImageProvider || !generatedImageModel) {
        throw new Error("CONTEXTUAL_MEDIA_GENERATED_IMAGE_REQUIRED");
      }
      if (!strictApprovedProductAuthority || strictApprovedProductAuthority.asset.type !== "APPROVED_EXISTING") {
        throw new Error("CONTEXTUAL_MEDIA_PRODUCT_TRUTH_REQUIRED");
      }

      const mediaId = Number(mediaResult.mediaId);
      if (!Number.isSafeInteger(mediaId) || mediaId < 1 || !mediaResult.mediaUrl.trim()) {
        throw new Error("CONTEXTUAL_MEDIA_WORDPRESS_BINDING_REQUIRED");
      }

      const pageRevisionId = `job:${draftJob.jobId}:${completedAt}`;
      const prompt = buildOutdoorSphereGeneratedContextualPrompt({
        stateName: input.request.stateName,
        cityName: input.request.cityName,
      });
      const promptFingerprint = sha256Text(prompt);
      const generationId = `contextual-generation-${createHash("sha256").update(JSON.stringify({
        siteId: input.request.siteId,
        productId: input.request.productId,
        targetId: strictTargetId,
        role: "OUTDOOR_SPHERE_HERO_CONTEXTUAL",
        promptFingerprint,
        pageRevisionId,
      })).digest("hex")}`;

      const receipt: ContextualGenerationReceipt = {
        authority: "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1",
        generationId,
        organizationId: input.request.organizationId,
        siteId: input.request.siteId,
        campaignId: input.request.campaignId,
        targetId: strictTargetId,
        productId: input.request.productId,
        wordpressObjectId: finalizedWordPressObjectId,
        pageRevisionId,
        role: "OUTDOOR_SPHERE_HERO_CONTEXTUAL",
        mediaRole: "CONTEXTUAL_IN_USE",
        slot: "HERO_EXPERIENCE",
        promptFingerprint,
        provider: generatedImageProvider,
        model: generatedImageModel,
        outputDimensions: { width: 1536, height: 1024 },
        generationCount: 1,
        selectedOutputCount: 1,
        latencyMs: 0,
        reportedCost: "UNKNOWN",
        assetSha256: sha256Bytes(generatedImageBytes),
        mimeType: generatedImageMimeType,
        documentaryEvidence: false,
        actualInstallationEvidence: false,
        productSpecificationAuthority: false,
        customerEvidence: false,
        status: "SUCCEEDED",
        createdAt: new Date().toISOString(),
      };

      const saved = saveSuccessfulGeneratedContextualMedia({ receipt, bytes: generatedImageBytes });
      const bound = bindGeneratedContextualMediaWordPress({
        generationId: saved.receipt.generationId,
        mediaId,
        url: mediaResult.mediaUrl,
      });

      const buildSessionId = `contextual-media:${strictTargetId}`;
      const existingAssignment = listSitePageMediaAssignments({
        organizationId: input.request.organizationId,
        siteId: input.request.siteId,
        buildSessionId,
        pageRevisionId,
      }).find((assignment) => assignment.role === "CONTEXTUAL_IN_USE" && assignment.slotId === "HERO_EXPERIENCE");

      if (existingAssignment) {
        if (existingAssignment.asset.type !== "GENERATED"
          || existingAssignment.asset.generationJobId !== bound.receipt.generationId
          || !existingAssignment.wordpressReceipt
          || existingAssignment.wordpressReceipt.attachedToObjectId !== finalizedWordPressObjectId
          || existingAssignment.wordpressReceipt.mediaId !== mediaId) {
          throw new Error("CONTEXTUAL_MEDIA_ASSIGNMENT_COLLISION");
        }
      } else {
        saveSitePageMediaAssignment({
          organizationId: input.request.organizationId,
          siteId: input.request.siteId,
          buildSessionId,
          pageId: strictTargetId,
          pageRevisionId,
          slotId: "HERO_EXPERIENCE",
          role: "CONTEXTUAL_IN_USE",
          asset: {
            type: "GENERATED",
            provider: bound.receipt.provider,
            model: bound.receipt.model,
            generationJobId: bound.receipt.generationId,
            effectivePrompt: prompt,
            referenceInputs: [{
              referenceId: strictApprovedProductAuthority.assignmentId,
              role: "PRODUCT_TRUTH",
              sha256: strictApprovedProductAuthority.asset.sha256,
            }],
            outputSha256: bound.receipt.assetSha256,
          },
          metadata: {
            altText: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
            caption: "Conceptual generated visualization; not documentary evidence.",
            title: "Outdoor Sphere Contextual Hero",
            description: "Generated contextual in-use hero for governed draft presentation.",
          },
          approval: {
            candidateId: bound.receipt.generationId,
            approvedBy: "continuation-governed-contextual-media",
            approvedAt: new Date().toISOString(),
          },
          wordpressReceipt: {
            mediaId,
            url: mediaResult.mediaUrl,
            attachedToObjectId: finalizedWordPressObjectId,
            altTextVerified: true,
            placementVerified: true,
            verifiedAt: new Date().toISOString(),
          },
        });
      }

      contextualReceipt = bound.receipt;
    } catch (error) {
      const message = error instanceof Error ? error.message : "CONTEXTUAL_MEDIA_AUTHORITY_FAILED";
      return glwPageExecutionRepository.update(draftJob.jobId, {
        status: "CONTENT_READY",
        errorCode: message,
        errorMessage: "Generated contextual media receipt is required for Outdoor LED Sphere continuation.",
        featuredImagePresent: false,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    }
  }
  const existingChecks = draftJob.qaChecks && typeof draftJob.qaChecks === "object" && !Array.isArray(draftJob.qaChecks)
    ? draftJob.qaChecks
    : {};
  return glwPageExecutionRepository.update(draftJob.jobId, {
    status: "COMPLETE",
    generatedDraft: finalizedPresentationArtifact,
    wordpressObjectId: finalizedWordPressObjectId,
    wordpressUrl: finalizedWordPressUrl,
    wordpressStatus: finalizedWordPressStatus,
    disposition: result.operation === "CREATE" ? "CREATED" : "UPDATED",
    qaStatus: "COMPLETE",
    qaChecks: {
      ...existingChecks,
      contextualMediaAuthority: strictGeneratedContextualRequired
        ? {
            required: true,
            legacyFeaturedAccepted: false,
            generatedReceiptId: contextualReceipt?.generationId ?? null,
            role: contextualReceipt?.role ?? null,
            mediaRole: contextualReceipt?.mediaRole ?? null,
            wordpressMediaId: mediaResult.mediaId,
          }
        : null,
    },
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    featuredImagePresent: true,
    errorCode: null,
    errorMessage: null,
    updatedAt: completedAt,
    completedAt,
  });
}

async function resolveAuthorizedPreview(form: GlwGenerationRequestInput, organizationId: string) {
  const siteRecord = getSiteById(form.siteId);
  const productRecord = getProductById(form.productId);
  if (!siteRecord || !productRecord) return { error: "Configured site and product are required.", status: 400 } as const;
  if (siteRecord.organizationId !== organizationId) return { error: "Forbidden", status: 403 } as const;

  const profileCount = listIntegrationProfiles({ organizationId: siteRecord.organizationId })
    .filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;
  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const preview = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
  if (!preview.validation.valid || !preview.request) return { issues: preview.validation.issues, status: 400 } as const;
  if (preview.request.publicationIntent !== "draft") return { error: "Public publish is blocked. Select draft intent." , status: 403 } as const;
  return { siteRecord, request: preview.request } as const;
}

async function verifyMutationAuthority(request: GlwGenerationRequest, siteRecord: NonNullable<ReturnType<typeof getSiteById>>) {
  const apiBaseUrl = siteRecord.integrations.wordpressApiBaseUrl?.trim() ?? "";
  const credentialReference = siteRecord.integrations.wordpressCredentialReference?.trim() ?? "";
  const credential = resolveWordPressCredentialReference(credentialReference);

  if (!apiBaseUrl || !credential) {
    return {
      error: "Authenticated WordPress read authority is required before generation or continuation.",
      code: "WORDPRESS_READ_AUTHORITY_REQUIRED",
      status: 503,
    } as const;
  }

  let wordpressReadAuthority;
  try {
    wordpressReadAuthority = createAuthenticatedWordPressReadAuthority({
      configuration: {
        apiBaseUrl,
        username: credential.username,
        applicationPassword: credential.applicationPassword,
        timeoutMs: 30_000,
      },
    });
  } catch {
    return {
      error: "Authenticated WordPress read authority could not be initialized.",
      code: "WORDPRESS_READ_AUTHORITY_INVALID",
      status: 503,
    } as const;
  }

  const targetPreflight = await readGlwTargetPreflight({
    request,
    wordpressReadAuthority,
    localExecutions: await glwPageExecutionRepository.list(),
  });

  const mutationAvailability = resolveGlwTargetMutationAvailability(
    targetPreflight,
    request.pageType,
  );
  const createRequested = request.plannedOperation.startsWith("CREATE_");
  const exactUpdateId = request.wordpressObjectId
    && mutationAvailability.wordpressObjectId === request.wordpressObjectId;
  const allowed = createRequested
    ? mutationAvailability.createAvailable
    : mutationAvailability.updateAvailable && exactUpdateId;

  if (!allowed || mutationAvailability.plannedOperation !== request.plannedOperation) {
    return {
      error: mutationAvailability.message,
      code: "WORDPRESS_MUTATION_NOT_AUTHORIZED",
      status: 409,
    } as const;
  }

  return { targetPreflight, mutationAvailability } as const;
}

function matchesExactContinuationTarget(input: {
  job: GlwPageExecutionRecord;
  request: GlwGenerationRequest;
}): boolean {
  return input.job.siteId === input.request.siteId
    && input.job.productId === input.request.productId
    && input.job.slug === input.request.canonicalPath.replace(/^\//, "").replace(/\/$/, "")
    && input.job.publicationIntent === "draft";
}

function resolveZeroAuthorityFallbackPolicy(request: GlwGenerationRequest): GlwZeroAuthorityFallbackPolicy {
  if (
    request.organizationId === "led-display-warehouse"
    && request.siteId === "site-led-display-warehouse-production"
    && request.productId === "prod-outdoor-digital-sphere"
    && request.pageType === "state_service"
  ) {
    return "OUTDOOR_SPHERE_STATE_SERVICE";
  }
  return "STRICT";
}

function isExactRecoverableContentFailure(job: GlwPageExecutionRecord): boolean {
  return job.status === "FAILED"
    && (job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      || job.errorCode === "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED"
      || job.errorCode?.startsWith("CONTENT_REPAIR_") === true)
    && Boolean(job.generatedDraft);
}

function isExactRecoverableOutdoorSphereRichCompositionFailure(job: GlwPageExecutionRecord): boolean {
  return job.status === "CONTENT_READY"
    && job.errorCode === "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED"
    && job.wordpressStatus === "draft"
    && Boolean(job.wordpressObjectId)
    && Boolean(job.generatedDraft)
    && job.wordpressStatus !== "publish";
}

function isExactRecoverableWordPressFailure(
  job: GlwPageExecutionRecord,
): boolean {
  return job.status === "FAILED"
    && Boolean(job.generatedDraft)
    && Boolean(
      job.errorCode
      && new Set([
        "WORDPRESS_HIERARCHY_READ_FAILED",
        "WORDPRESS_HIERARCHY_WRITE_FAILED",
        "WORDPRESS_READ_FAILED",
        "WORDPRESS_WRITE_FAILED",
      ]).has(job.errorCode),
    );
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  const organizationId = scope.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    form?: GlwGenerationRequestInput;
    action?: string;
    jobId?: string;
    targetId?: string;
    executionId?: string;
  } | null;

  if (!body?.form) {
    return NextResponse.json({ error: "Generation form is required." }, { status: 400 });
  }

  const preview = await resolveAuthorizedPreview(body.form, organizationId);
  if ("error" in preview || "issues" in preview) {
    return NextResponse.json(preview, { status: preview.status });
  }

  const action = body.action?.trim() ?? "generate";
  const matchingDraftCampaigns = listGlwCampaigns().filter((candidate) =>
    candidate.status === "draft"
    && candidate.organizationId === preview.request.organizationId
    && candidate.siteId === preview.request.siteId
    && candidate.productId === preview.request.productId
    && candidate.stateCodes.includes(preview.request.stateCode),
  );
  const identityBoundReferenceCampaign = matchingDraftCampaigns.length === 1
    ? matchingDraftCampaigns[0]
    : null;
  const isCampaignReferenceRequest = Boolean(
    preview.request.additionalInstructions?.startsWith("CAMPAIGN REFERENCE PAGE")
    || (identityBoundReferenceCampaign && preview.request.campaignId === identityBoundReferenceCampaign.campaignId),
  );
  if (isCampaignReferenceRequest) {
    const campaign = identityBoundReferenceCampaign ?? listGlwCampaigns().find((candidate) =>
      candidate.campaignId === preview.request.campaignId
      && candidate.organizationId === preview.request.organizationId
      && candidate.siteId === preview.request.siteId,
    );
    const pack = campaign ? getGlwCampaignKnowledgePack(campaign.campaignId) : null;
    if (!campaign || !pack) {
      return NextResponse.json({ error: "Current campaign generation authority is unavailable.", code: "REFERENCE_AUTHORITY_UNAVAILABLE", generationJobCreated: false }, { status: 409 });
    }
    const currentAuthority = resolveGlwReferenceGenerationAuthority({ campaign, pack, stateCode: preview.request.stateCode });
    if (!generationAuthorityBindingsMatch(currentAuthority, preview.request.referenceAuthorityBinding)) {
      return NextResponse.json({ error: "Campaign generation authority fingerprints are stale.", code: "REFERENCE_AUTHORITY_BINDING_STALE", generationJobCreated: false }, { status: 409 });
    }
    if (!preview.request.referenceOwnerAuthorityClaimId || !preview.request.referenceOwnerOperationType) {
      return NextResponse.json({ error: "A consumed single-use reference owner claim is required.", code: "REFERENCE_OWNER_CLAIM_REQUIRED", generationJobCreated: false, downstreamSideEffectsPerformed: false }, { status: 409 });
    }
    try {
      const liveOwnerContext = await resolveGlwReferenceOwnerLiveContext({
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        campaignId: campaign.campaignId,
        referenceState: preview.request.stateCode,
        operationType: preview.request.referenceOwnerOperationType,
        failedJobId: preview.request.referenceOwnerFailedJobId,
        failedArtifactSha256: preview.request.referenceOwnerFailedArtifactSha256,
      });
      if (action === "recover_failed_dispatch" || action === "finalize_recovered_dispatch") {
        const recoveryJobId = body.jobId?.trim() ?? "";
        const recoveryJob = recoveryJobId ? await glwPageExecutionRepository.getById(recoveryJobId) : null;
        if (!recoveryJob) return NextResponse.json({ error: "Exact failed job is required for recovery.", code: "RECOVERY_JOB_REQUIRED", generationJobCreated: false }, { status: 409 });
        const { exactRuntime: _currentRuntime, ...recoveryContext } = liveOwnerContext;
        if (action === "recover_failed_dispatch") {
          validateGlwReferenceOwnerClaimForFailedDispatchRecovery({ claimId: preview.request.referenceOwnerAuthorityClaimId, job: recoveryJob, liveContext: recoveryContext });
        } else {
          validateGlwReferenceOwnerClaimForRecoveredContent({ claimId: preview.request.referenceOwnerAuthorityClaimId, job: recoveryJob, liveContext: recoveryContext });
        }
      } else {
        consumeGlwReferenceOwnerClaimForDispatch({
          claimId: preview.request.referenceOwnerAuthorityClaimId,
          liveContext: liveOwnerContext,
        });
      }
    } catch (error) {
      return NextResponse.json({ error: "Reference owner claim failed closed at the dispatch boundary.", code: error instanceof GlwReferenceOwnerAuthorityError ? error.code : "REFERENCE_OWNER_CLAIM_INVALID", generationJobCreated: false, downstreamSideEffectsPerformed: false }, { status: 409 });
    }
  }

  if (action === "recover_failed_dispatch") {
    const jobId = body.jobId?.trim() ?? "";
    if (!jobId) return NextResponse.json({ error: "Exact failed job is required for recovery." }, { status: 400 });
    const job = await service.recoverFailedDispatch(jobId, preview.request);
    return NextResponse.json({ ok: job.status !== "FAILED", job, sameJobRecovered: true, generationJobCreated: false, publicationPerformed: false });
  }

  if (action === "finalize_recovered_dispatch") {
    const jobId = body.jobId?.trim() ?? "";
    const currentJob = jobId ? await glwPageExecutionRepository.getById(jobId) : null;
    if (!currentJob) return NextResponse.json({ error: "Exact recovered job is required for finalization." }, { status: 400 });
    const job = await finalizeContentReadyExecution({ job: currentJob, request: preview.request, siteRecord: preview.siteRecord });
    return NextResponse.json({ ok: job.status === "COMPLETE", job, sameJobRecovered: true, generationJobCreated: false, publicationPerformed: false });
  }

  if (action === "continue") {
    const jobId = body.jobId?.trim() ?? "";
    if (!jobId) return NextResponse.json({ error: "Exact GLW jobId is required for continuation." }, { status: 400 });
    const expectedTargetId = body.targetId?.trim() ?? "";
    const expectedExecutionId = body.executionId?.trim() ?? "";

    const currentJob = await glwPageExecutionRepository.getById(jobId);
    if (!currentJob) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
    if (currentJob.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (currentJob.wordpressStatus === "publish") {
      return NextResponse.json({ error: "Published targets cannot continue through draft continuation." }, { status: 409 });
    }
    if (!matchesExactContinuationTarget({ job: currentJob, request: preview.request })) {
      return NextResponse.json({ error: "Continuation request does not match the exact persisted GLW target." }, { status: 409 });
    }

    if (preview.request.campaignId) {
      const targets = listGlwCampaignTargets(preview.request.campaignId);
      const targetLookup = resolveExactContinuationCampaignTarget({
        targets,
        campaignId: preview.request.campaignId,
        organizationId: preview.request.organizationId,
        siteId: preview.request.siteId,
        productId: preview.request.productId,
        expectedStateCode: preview.request.stateCode,
        expectedCitySlug: preview.request.citySlug,
        expectedTargetId,
        expectedJobId: currentJob.jobId,
        expectedExecutionId,
        actualExecutionId: currentJob.externalExecutionId,
      });

      if (!targetLookup.ok) {
        return NextResponse.json({ error: targetLookup.error }, { status: targetLookup.status });
      }

      const target = targetLookup.target;
      if (target.status === "published") {
        return NextResponse.json({ error: "Published targets cannot continue through draft continuation." }, { status: 409 });
      }
    }

    const exactRecoverableContentFailure =
      isExactRecoverableContentFailure(currentJob);

    const exactRecoverableWordPressFailure =
      isExactRecoverableWordPressFailure(currentJob);

    const exactRecoverableOutdoorSphereRichCompositionFailure =
      isExactRecoverableOutdoorSphereRichCompositionFailure(currentJob);

    if (
      !exactRecoverableContentFailure
      && !exactRecoverableWordPressFailure
      && !exactRecoverableOutdoorSphereRichCompositionFailure
    ) {
      const authority = await verifyMutationAuthority(
        preview.request,
        preview.siteRecord,
      );
      if ("error" in authority) {
        return NextResponse.json(authority, { status: authority.status });
      }
    }

    let refreshed = currentJob;
    if (!isTerminal(currentJob.status) && currentJob.status !== "CONTENT_READY") {
      refreshed = await recoverExecution(currentJob);
    }

    let finalized;
    try {
      finalized = await finalizeContentReadyExecution({
        job: refreshed,
        request: preview.request,
        siteRecord: preview.siteRecord,
        continuationTargetId: expectedTargetId || undefined,
      });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Content finalization failed.",
        code: "CONTENT_FINALIZATION_EXCEPTION",
        publicationPerformed: false,
      }, { status: 500 });
    }

    const durableDraftPersisted =
      finalized.status === "COMPLETE"
      && finalized.wordpressStatus === "draft"
      && Boolean(finalized.wordpressObjectId);

    const claimAuthorityFailureReasons = Object.entries(finalized.qaFailureReasons ?? {})
      .filter(([key]) => key.startsWith("unsupportedClaim."))
      .reduce<Record<string, string>>((accumulator, [key, value]) => {
        accumulator[key] = value;
        return accumulator;
      }, {});
    const claimAuthorityRevalidationFailed =
      finalized.status === "FAILED"
      && finalized.errorCode === "GENERATED_CONTENT_QA_FAILED"
      && Object.keys(claimAuthorityFailureReasons).length > 0;

    if (claimAuthorityRevalidationFailed) {
      return NextResponse.json({
        ok: false,
        error: "Claim authority revalidation failed before WordPress draft persistence.",
        code: "CLAIM_AUTHORITY_REVALIDATION_FAILED",
        claimFailureReasons: claimAuthorityFailureReasons,
        job: finalized,
        publicationPerformed: false,
      }, { status: 409 });
    }

    if (!durableDraftPersisted) {
      return NextResponse.json({
        ok: false,
        error: "Continuation did not durably persist a WordPress draft.",
        code: "CONTINUATION_DURABLE_DRAFT_REQUIRED",
        job: finalized,
        publicationPerformed: false,
      }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      job: finalized,
      publicationPerformed: false,
    });
  }

  if (action !== "generate") {
    return NextResponse.json({ error: "Unsupported generation action." }, { status: 400 });
  }

  const authority = await verifyMutationAuthority(preview.request, preview.siteRecord);
  if ("error" in authority) {
    return NextResponse.json(authority, { status: authority.status });
  }

  try {
    const job = await service.execute(preview.request);
    return NextResponse.json({
      ok: true,
      job,
      publicationPerformed: false,
    });
  } catch (error) {
    if (error instanceof GlwDraftOnlyExecutionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "DRAFT_ONLY_EXECUTION_REJECTED",
          publicationPerformed: false,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GLW generation dispatch failed.",
        publicationPerformed: false,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() ?? "";
  if (!jobId) return NextResponse.json({ error: "Exact GLW jobId is required." }, { status: 400 });

  const currentJob = await glwPageExecutionRepository.getById(jobId);
  if (!currentJob) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  if (currentJob.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const job = refresh && !isTerminal(currentJob.status)
    ? await recoverExecution(currentJob)
    : currentJob;

  return NextResponse.json({ job });
}
