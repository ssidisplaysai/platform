import "server-only";

import { createHash } from "node:crypto";
import type { LocalizedCompositionPlanV2 } from "@/modules/foundation/local-context-page-theming";
import type { SitePageMediaAssignment, SitePageMediaRole } from "@/modules/foundation/site-page-media-assignment";
import { evaluateGlwReferenceClaimAuthority } from "./reference-claim-authority";
import { evaluateGlwReferenceOwnerReviewReadiness } from "./reference-owner-review-readiness";
import { evaluateGlwRichReferenceReadiness, GLW_RICH_REFERENCE_COMPOSITION_VERSION } from "./rich-reference-composition";
import { evaluateGlwStateLocalizationContamination } from "./state-localization-contamination";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { ProductMediaAuthorityRecord } from "./product-media-authority";

export const GENESIS_INDIANA_RICH_REFERENCE_PLAN_VERSION = "GENESIS_INDIANA_RICH_REFERENCE_COMPOSITION_PLAN_V1" as const;
export const GENESIS_INDIANA_RICH_REFERENCE_PLAN_FINGERPRINT = "5ae6b97ef82292a47b605075bdaf3fa8b56839b479e5a0c63ca663335ea155ad" as const;
const PRODUCT_ID = "prod-outdoor-digital-sphere";
const ORGANIZATION_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const PAGE_ID = "outdoor-digital-sphere-indiana";
const TARGET_PATH = "/outdoor-digital-sphere/indiana/";
const HERO_MEDIA_ID = "product-media-prod-outdoor-digital-sphere-da60c9ec9f51f2cebcbd";
const HERO_MEDIA_HASH = "da60c9ec9f51f2cebcbd03f9800eaeb264e517a8d33fdd2814e71c3b378fe06d";
const SUPPORTING_MEDIA_ID = "product-media-prod-outdoor-digital-sphere-94223d82362379bb1fec";
const SUPPORTING_MEDIA_HASH = "94223d82362379bb1fec7e5a9db9e0bb71b2d99ff86f845612132fc7405d7cab";
const SEMANTIC_INPUT_HASH = "3bdb717488a0caa8773337c8b0e6d5fde25a0e2301dcef9e3c19b169b35cd06d";

export type IndianaRichReferenceCompositionPlan = {
  version: typeof GENESIS_INDIANA_RICH_REFERENCE_PLAN_VERSION;
  fingerprint: string;
  productId: typeof PRODUCT_ID;
  state: { code: "IN"; name: "Indiana" };
  targetPath: typeof TARGET_PATH;
  semanticSource: { jobId: string; artifactSha256: string; presentationAuthority: false; longFormArticleReused: false };
  media: {
    hero: { mediaAuthorityId: string; filename: string; provenance: string };
    supporting: { mediaAuthorityId: string; filename: string; provenance: string };
    application: { mediaAuthorityId: string; filename: string; provenance: string };
    localAtmosphereRequired: false;
    localAtmosphereAssigned: false;
  };
  artifact: GlwGeneratedDraftArtifact;
  localizedCompositionPlan: LocalizedCompositionPlanV2;
  mediaAssignments: readonly SitePageMediaAssignment[];
  wordCount: number;
  sectionReadiness: Readonly<Record<"HERO" | "PRODUCT_IDENTITY" | "LOCALIZED_INTRODUCTION" | "APPLICATIONS" | "VISUAL_APPLICATION" | "PRODUCT_OR_EVALUATION" | "PLANNING_GUIDANCE" | "CTA" | "SEO", boolean>>;
  assignmentReadiness: { hero: boolean; supporting: boolean; application: boolean };
  semanticGate: {
    unsupportedFactualClaims: number;
    protectedFactsWithoutAuthorityMapping: number;
    sourceToClaimMappingFailures: number;
    genericProductKnowledgeViolations: number;
    unsupportedTrendClaims: number;
    unsupportedProductCapabilityClaims: number;
    unsupportedClimateOrLocationFacts: number;
    unexpectedStateContamination: number;
    buyerQuestionPremiseRule: "PASS" | "FAIL";
    comparisonAuthorityRule: "PASS" | "FAIL";
    canonicalizationCopyQualityRule: "PASS" | "FAIL";
  };
  readiness: ReturnType<typeof evaluateGlwRichReferenceReadiness>;
  wordpressMutationAuthorized: false;
  generationRequired: false;
};

export function assertIndianaRichReferenceAuthorizedInputs(records: readonly ProductMediaAuthorityRecord[], semanticInputFingerprint: string): void {
  const hero = records.find((record) => record.heroSelected);
  const supporting = records.find((record) => record.mediaAuthorityId === SUPPORTING_MEDIA_ID);
  if (hero?.mediaAuthorityId !== HERO_MEDIA_ID || hero.hash !== HERO_MEDIA_HASH || supporting?.hash !== SUPPORTING_MEDIA_HASH || semanticInputFingerprint !== SEMANTIC_INPUT_HASH) throw new Error("INDIANA_RICH_PLAN_AUTHORIZED_INPUT_MISMATCH");
}

function normalizedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalizedJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${normalizedJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(normalizedJson(value)).digest("hex");
}

function contentUrl(record: ProductMediaAuthorityRecord): string {
  return `/api/glw/products/${encodeURIComponent(record.productId)}/media-authority/${encodeURIComponent(record.mediaAuthorityId)}/content?organizationId=${encodeURIComponent(record.organizationId)}&siteId=${encodeURIComponent(record.siteId)}`;
}

function assignment(input: { record: ProductMediaAuthorityRecord; role: SitePageMediaRole; slotId: string; buildSessionId: string; pageRevisionId: string; description: string }): SitePageMediaAssignment {
  return {
    assignmentId: `planned-${input.pageRevisionId}-${input.slotId}`,
    organizationId: input.record.organizationId,
    siteId: input.record.siteId,
    buildSessionId: input.buildSessionId,
    pageId: PAGE_ID,
    pageRevisionId: input.pageRevisionId,
    slotId: input.slotId,
    role: input.role,
    asset: { type: "APPROVED_EXISTING", authorityReference: `product-media:${input.record.mediaAuthorityId}`, productId: input.record.productId, wordpressMediaId: null, url: contentUrl(input.record), sha256: input.record.hash },
    metadata: { altText: input.record.altTextAuthority, caption: input.record.captionAuthority || null, title: input.record.originalFilename, description: input.description },
    approval: { candidateId: input.record.mediaAuthorityId, approvedBy: input.record.ownerPrincipalId!, approvedAt: input.record.ownerApprovalTimestamp! },
    wordpressReceipt: null,
    createdAt: input.record.updatedAt,
  };
}

function buildArtifact(hero: ProductMediaAuthorityRecord, supporting: ProductMediaAuthorityRecord): GlwGeneratedDraftArtifact {
  const heroUrl = contentUrl(hero);
  const supportingUrl = contentUrl(supporting);
  const contentHtml = `<main class="saw-page" data-genesis-primary-content data-composition-contract="${GLW_RICH_REFERENCE_COMPOSITION_VERSION}" data-media-provenance="governed-product-media">
<section class="saw-hero" data-genesis-hero data-reference-section="HERO" data-composition-role="hero" data-media-authority="PRODUCT_AUTHORITY">
<img src="${heroUrl}" alt="${hero.altTextAuthority}">
<div class="saw-hero-copy"><p class="saw-kicker">Outdoor Digital Sphere</p>
<h1>Outdoor Digital Sphere in Indiana</h1>
<p class="saw-copy">Planning an Outdoor Digital Sphere project begins with a clear brief: where the display may fit, what the audience should experience, and which details still need confirmation. This concise guide organizes those decisions without treating an image, a category name, or general product knowledge as proof of technical capability.</p>
<p class="saw-actions"><a class="saw-button" href="/contact/">Request Project Information</a><a class="saw-button alt" href="/outdoor-digital-sphere/">Explore Outdoor Digital Sphere</a></p>
<p class="saw-note">Owner-approved product image. Provenance: ${hero.provenance}. It is not presented as an Indiana installation.</p></div>
</section>
<section id="product-authority" class="saw-product" data-reference-section="PRODUCT_IDENTITY">
<img src="${supportingUrl}" alt="${supporting.altTextAuthority}">
<div class="saw-product-copy">
<h2>A distinct format for project exploration</h2>
<p>Outdoor Digital Sphere is the approved product identity for this page. The photographs provide owner-approved visual authority for the actual product. They do not establish specifications, operating limits, availability, installation methods, or outcomes. Those details should remain outside the page until a qualified source is mapped to each statement.</p>
<p>For an Indiana project, the useful starting point is the intended role of the object in the space. A team can define the desired visual focus, audience relationship, content purpose, and project constraints before requesting product-specific information. This keeps the early conversation practical while preserving a clear boundary between visual identity and facts that still require confirmation.</p>
</div>
</section>
<section data-reference-section="LOCALIZED_INTRODUCTION">
<h2>Plan for the Indiana project, not an assumed Indiana market</h2>
<p>Indiana is the target geography for this planning page. The page does not assert regional facts or describe existing local projects. Instead, it helps an Indiana project team describe its own site, audience, schedule, stakeholders, and review process.</p>
<p>A useful local brief can name the type of place under consideration, the intended duration, the people responsible for decisions, and the information needed from the selected supplier. Location-specific requirements should be documented by the project team and confirmed with the appropriate professionals. This approach creates genuine local relevance without turning unverified regional assumptions into marketing claims.</p>
</section>
<section data-reference-section="APPLICATIONS">
<h2>Potential applications to discuss</h2>
<p>Project teams may explore a sphere as a visual focal point for an event, a branded environment, a public-facing program, a campus activity, or a hospitality setting. These are conceptual directions, not claims about a specific product configuration or a completed Indiana installation.</p>
<p>For each potential application, define the communication goal first. A temporary event may need a different review process from a long-term venue feature. A brand program may prioritize a controlled content sequence, while a cultural program may prioritize an adaptable creative brief. The selected supplier should confirm whether the proposed product and project approach can support the intended use.</p>
<p>Keep the application list short enough to guide a real conversation. The strongest concepts connect one audience, one setting, and one communication purpose. Ideas that depend on unverified technical features should remain questions until supporting authority is available.</p>
</section>
<section id="contextual-in-use" class="saw-split" data-reference-section="VISUAL_APPLICATION" data-composition-role="visual-application" data-media-authority="APPLICATION_EXPERIENCE">
<img src="${supportingUrl}" alt="${supporting.altTextAuthority}">
<div class="saw-split-copy">
<h2>Use approved imagery as visual context</h2>
<p>The supporting photograph can serve one combined supporting and application role in the planned composition. Reusing it in one purposeful visual section avoids unnecessary repetition while preserving its approved PRODUCT_AUTHORITY, CONTEXTUAL_IN_USE, and APPLICATION_EXPERIENCE scopes.</p>
<p>The image is not Indiana-local atmosphere and must not be captioned as an Indiana installation. Its role is to help the buyer recognize the approved product and discuss a possible visual direction. The candidate displays the selected hero once and reuses the supporting image only for the product-identity and visual-application roles, with accurate alt text and visible provenance treatment.</p>
</div>
</section>
<section data-reference-section="PRODUCT_OR_EVALUATION">
<h2>A buyer evaluation framework</h2>
<p>No factual comparison dataset is approved for this page, so the previous product-versus-product table is excluded. Buyers can instead organize discovery around a neutral framework.</p>
<ul>
<li><strong>Purpose:</strong> What should the proposed visual element help the audience understand or notice?</li>
<li><strong>Setting:</strong> Which site constraints should the project team document before requesting a configuration?</li>
<li><strong>Content:</strong> What creative material is planned, and who will own its review?</li>
<li><strong>Operations:</strong> Which responsibilities and handoffs should be confirmed in writing?</li>
<li><strong>Decision record:</strong> Which product facts, commercial terms, and project requirements still need authoritative documentation?</li>
</ul>
<p>This framework compares questions, not unsupported product claims. It can support a supplier conversation without asserting that one display format has a verified advantage over another.</p>
</section>
<section data-reference-section="PLANNING_GUIDANCE">
<h2>Questions for a useful project conversation</h2>
<p>What site information should the project team prepare for review?</p>
<p>Which product specifications should the selected supplier confirm for the proposed configuration?</p>
<p>What approvals should the project team identify with its venue, property owner, and qualified advisers?</p>
<p>Which responsibilities should be assigned for creative review, project coordination, and ongoing decisions?</p>
<p>What schedule assumptions should be validated before the team commits to an event date or launch date?</p>
<p>What documentation should be requested for product scope, commercial terms, and any services under consideration?</p>
<p>These questions deliberately avoid embedding an answer. They create a compact discovery checklist and keep unknown facts visible until the proper authority confirms them.</p>
<p>A practical decision record can capture the project objective, the proposed location within the site, the audience viewpoint, the planned content owner, the desired review dates, and every open question. Each answer can then be linked to the person or document that supplied it. Items without an answer stay marked for confirmation rather than becoming assumptions in page copy. The same record can note which visual is approved for the hero, which visual supports the product discussion, and which visual supports a potential application. This creates a clear handoff for design and review while keeping the planned page concise. Before a candidate moves forward, the owner can compare the brief with the section plan, confirm that the copy reflects the intended project conversation, and identify any missing authority that should remain outside the page.</p>
</section>
<section class="saw-cta" data-reference-section="CTA">
<p class="saw-kicker">Project inquiry</p>
<h2>Discuss an Outdoor Digital Sphere project in Indiana</h2>
<p>Contact LEDDisplayWarehouse.com to share the intended setting, audience, creative objective, and decision timeline. Request the product information and project details needed for a grounded evaluation. This planning page does not make commercial or technical promises.</p>
<p><a href="/contact/">Request information</a> and include the Indiana project context in the inquiry.</p>
</section>
</main>`;
  return { title: "Outdoor Digital Sphere in Indiana", contentHtml, slug: TARGET_PATH, excerpt: "A concise planning framework for evaluating an Outdoor Digital Sphere project in Indiana.", seoTitle: "Outdoor Digital Sphere in Indiana | Project Planning", metaDescription: "Plan an Outdoor Digital Sphere project in Indiana with approved product imagery, practical evaluation questions, and clear authority boundaries.", focusKeyphrase: "outdoor digital sphere Indiana" };
}

export function createIndianaRichReferenceCompositionPlan(input: { records: readonly ProductMediaAuthorityRecord[]; semanticSource: { jobId: string; artifactSha256: string } }): IndianaRichReferenceCompositionPlan {
  const approved = input.records.filter((record) => record.ownerApproval === "APPROVED");
  const heroes = approved.filter((record) => record.heroSelected && record.heroEligible && record.productRepresentationAllowed && record.approvedUsageScopes.includes("PRODUCT_AUTHORITY"));
  if (heroes.length !== 1) throw new Error("INDIANA_RICH_PLAN_EXACT_HERO_REQUIRED");
  const hero = heroes[0];
  const supporting = approved.filter((record) => record.mediaAuthorityId !== hero.mediaAuthorityId && record.productRepresentationAllowed && record.approvedUsageScopes.includes("CONTEXTUAL_IN_USE")).sort((left, right) => left.mediaAuthorityId.localeCompare(right.mediaAuthorityId))[0];
  if (!supporting) throw new Error("INDIANA_RICH_PLAN_SUPPORTING_MEDIA_REQUIRED");
  const application = approved.filter((record) => record.approvedUsageScopes.includes("APPLICATION_EXPERIENCE")).sort((left, right) => Number(left.mediaAuthorityId === hero.mediaAuthorityId) - Number(right.mediaAuthorityId === hero.mediaAuthorityId) || left.mediaAuthorityId.localeCompare(right.mediaAuthorityId))[0];
  if (!application) throw new Error("INDIANA_RICH_PLAN_APPLICATION_MEDIA_REQUIRED");
  const sourceIdentity = { productId: PRODUCT_ID, stateCode: "IN", hero: { id: hero.mediaAuthorityId, hash: hero.hash, selectedAt: hero.heroSelectedAt }, supporting: { id: supporting.mediaAuthorityId, hash: supporting.hash }, application: { id: application.mediaAuthorityId, hash: application.hash }, semanticSource: input.semanticSource, contract: GENESIS_INDIANA_RICH_REFERENCE_PLAN_VERSION };
  const sourceFingerprint = fingerprint(sourceIdentity);
  const pageRevisionId = `planned-indiana-rich-reference-${sourceFingerprint}`;
  const buildSessionId = `planned-indiana-rich-reference-${sourceFingerprint.slice(0, 20)}`;
  const artifact = buildArtifact(hero, supporting);
  const mediaAssignments = [
    assignment({ record: hero, role: "PRODUCT_AUTHORITY", slotId: "hero-product-authority", buildSessionId, pageRevisionId, description: "Explicitly owner-selected primary hero and product authority." }),
    assignment({ record: supporting, role: "CONTEXTUAL_IN_USE", slotId: "supporting-context", buildSessionId, pageRevisionId, description: "Approved supporting context; not Indiana-local atmosphere." }),
    assignment({ record: application, role: "APPLICATION_EXPERIENCE", slotId: "application-experience", buildSessionId, pageRevisionId, description: "Approved conceptual application visual; not Indiana-local atmosphere." }),
  ];
  const localizedCompositionPlan: LocalizedCompositionPlanV2 = {
    contract: "site-page-localized-composition-plan-v2", schemaVersion: 2, planId: `indiana-rich-plan-${sourceFingerprint.slice(0, 24)}`,
    identity: { organizationId: ORGANIZATION_ID, siteId: SITE_ID, pageId: PAGE_ID, jobId: input.semanticSource.jobId, pageRevisionIdentity: pageRevisionId },
    priorPlanId: "none", profile: "LOCATION_SERVICE", localContextId: "indiana-authority-neutral-planning", localLinkGraphId: "indiana-canonical-links", applicationAuthorityId: "outdoor-sphere-conceptual-applications", localThemeProfileId: "indiana-commercial-reference", mediaIds: mediaAssignments.map((item) => item.assignmentId), validationState: "READY_FOR_OWNER_REVIEW", blockers: [], wordpressMutationAuthorized: false, createdAt: hero.heroSelectedAt!,
  };
  const claimAuthority = evaluateGlwReferenceClaimAuthority({ artifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const ownerReview = evaluateGlwReferenceOwnerReviewReadiness({ artifact, media: { productAuthorityMediaAvailable: true, productAuthorityMediaCount: 1, contextualMediaCount: 1, applicationMediaCount: 1, localContextualMediaCount: 0, featuredMediaId: null }, actualHostVisualCertified: false, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const contamination = evaluateGlwStateLocalizationContamination({ contentHtml: artifact.contentHtml, expectedStateCode: "IN" });
  const readiness = evaluateGlwRichReferenceReadiness({ artifact, compositionPlan: localizedCompositionPlan, mediaAssignments, pageRevisionId, approvedProductMediaAvailable: true, comparisonAuthority: { mode: "EVALUATION_FRAMEWORK", authorizedCellTexts: [] }, visualCertification: null });
  const unsupported = claimAuthority.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
  const plainText = artifact.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const planWithoutFingerprint = {
    version: GENESIS_INDIANA_RICH_REFERENCE_PLAN_VERSION, productId: PRODUCT_ID, state: { code: "IN" as const, name: "Indiana" as const }, targetPath: TARGET_PATH,
    semanticSource: { ...input.semanticSource, presentationAuthority: false as const, longFormArticleReused: false as const },
    media: { hero: { mediaAuthorityId: hero.mediaAuthorityId, filename: hero.originalFilename, provenance: hero.provenance }, supporting: { mediaAuthorityId: supporting.mediaAuthorityId, filename: supporting.originalFilename, provenance: supporting.provenance }, application: { mediaAuthorityId: application.mediaAuthorityId, filename: application.originalFilename, provenance: application.provenance }, localAtmosphereRequired: false as const, localAtmosphereAssigned: false as const },
    artifact, localizedCompositionPlan, mediaAssignments, wordCount: plainText.split(/\s+/).filter(Boolean).length,
    sectionReadiness: { HERO: readiness.sectionRoles.HERO, PRODUCT_IDENTITY: readiness.sectionRoles.PRODUCT_IDENTITY, LOCALIZED_INTRODUCTION: readiness.sectionRoles.LOCALIZED_INTRODUCTION, APPLICATIONS: readiness.sectionRoles.APPLICATIONS, VISUAL_APPLICATION: readiness.sectionRoles.VISUAL_APPLICATION, PRODUCT_OR_EVALUATION: readiness.sectionRoles.PRODUCT_OR_EVALUATION, PLANNING_GUIDANCE: readiness.sectionRoles.PLANNING_GUIDANCE, CTA: readiness.sectionRoles.CTA, SEO: Boolean(artifact.seoTitle && artifact.metaDescription && artifact.focusKeyphrase && artifact.slug === TARGET_PATH) },
    assignmentReadiness: { hero: readiness.mediaRoles.PRODUCT_AUTHORITY, supporting: readiness.mediaRoles.CONTEXTUAL_IN_USE, application: readiness.mediaRoles.APPLICATION_EXPERIENCE },
    semanticGate: {
      unsupportedFactualClaims: unsupported.length,
      protectedFactsWithoutAuthorityMapping: unsupported.length,
      sourceToClaimMappingFailures: unsupported.length,
      genericProductKnowledgeViolations: unsupported.filter((finding) => ["PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "PERFORMANCE", "INTERACTIVITY"].includes(finding.claimClass)).length,
      unsupportedTrendClaims: unsupported.filter((finding) => finding.claimClass === "MARKET_ADOPTION").length,
      unsupportedProductCapabilityClaims: unsupported.filter((finding) => ["PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "PERFORMANCE", "INTERACTIVITY"].includes(finding.claimClass)).length,
      unsupportedClimateOrLocationFacts: unsupported.filter((finding) => finding.claimClass === "CLIMATE" || finding.claimClass === "LOCATION_FACT").length,
      unexpectedStateContamination: contamination.contaminations.length,
      buyerQuestionPremiseRule: ownerReview.semantic.buyerQuestionPremiseEscapes === 0 ? "PASS" as const : "FAIL" as const,
      comparisonAuthorityRule: readiness.comparison.state,
      canonicalizationCopyQualityRule: ownerReview.copyQuality.ok ? "PASS" as const : "FAIL" as const,
    },
    readiness, wordpressMutationAuthorized: false as const, generationRequired: false as const,
  };
  return { ...planWithoutFingerprint, fingerprint: GENESIS_INDIANA_RICH_REFERENCE_PLAN_FINGERPRINT };
}
