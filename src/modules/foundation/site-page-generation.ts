import { createHash } from "node:crypto";

import type { SiteBuildPlanPage, SiteBuildPlanProposal } from "./site-build-plan";
import { isCapabilityReviewComplete, selectDistinctCapabilityOpportunities } from "./site-capability-transition";
import type { CreativeDirectionProposal, SiteIntelligenceWorkspace, SiteStrategyProposal } from "./site-intelligence";
import type { SiteProductServiceAuthority, SiteSource } from "./site-product-authority-repository";
import type { SiteConfiguration } from "./types";

export const SITE_PAGE_GENERATION_POLICY_VERSION = "fresh-site-page-generation-v3";

export type SitePageImageRequirementPurpose =
  | "COMMERCIAL_ENVIRONMENT_VISUAL"
  | "APPLICATION_VISUAL"
  | "PRODUCT_VISUAL"
  | "FABRICATION_VISUAL"
  | "REFERENCE_INSPIRATION_ONLY"
  | "PLACEHOLDER_REQUIRED"
  | "GENERATED_VISUAL"
  | "OWNER_ASSET"
  | "APPROVED_PUBLISHABLE_ASSET";
export type SitePageImageSource = SitePageImageRequirementPurpose;
export type SitePageSection = { sectionId: string; heading: string; level: 2 | 3; body: string[]; presentation: "HERO" | "PROSE" | "GRID" | "STEPS" | "FAQ" | "CTA" };
export type SitePageInternalLink = { linkId: string; href: string; anchorText: string; reason: string; targetPageId: string };
export type SitePageImageRequirement = {
  slotId: string;
  placement: string;
  subject: string;
  source: SitePageImageSource;
  purpose?: SitePageImageRequirementPurpose;
  resolutionPolicy?: "GENERATED_OR_OWNER_ASSET" | "OWNER_ASSET_ONLY";
  publishableAssetId: string | null;
  status: "READY" | "OWNER_ASSET_NEEDED" | "GENERATED_CANDIDATE_NEEDED";
  altTextGuidance: string;
};
export type SitePageQuality = { ready: boolean; blockers: string[]; warnings: string[]; checks: Record<string, boolean> };
export type SiteGeneratedPageRevision = {
  pageRevisionId: string;
  pageId: string;
  revision: number;
  status: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REVISION_REQUESTED";
  requestedChanges: string | null;
  name: string;
  slug: string;
  canonicalPath: string;
  pageRole: SiteBuildPlanPage["pageType"];
  seoTitle: string;
  metaDescription: string;
  openGraphTitle: string;
  openGraphDescription: string;
  h1: string;
  sections: SitePageSection[];
  contentHtml: string;
  internalLinks: SitePageInternalLink[];
  imageRequirements: SitePageImageRequirement[];
  authority: SiteBuildPlanPage["authority"];
  quality: SitePageQuality;
  contentFingerprint: string;
  createdAt: string;
  createdBy: string;
  decidedAt: string | null;
  decidedBy: string | null;
};
export type SiteNavigationItem = { label: string; href: string; children: Array<{ label: string; href: string }> };
export type SiteAssemblyProposal = {
  assemblyId: string;
  buildSessionId: string;
  organizationId: string;
  siteId: string;
  buildPlanRevision: number;
  creativeRevision: number;
  policyVersion: typeof SITE_PAGE_GENERATION_POLICY_VERSION;
  revision: number;
  status: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REVISION_REQUESTED";
  pages: SiteGeneratedPageRevision[];
  navigation: SiteNavigationItem[];
  footerLinks: Array<{ label: string; href: string }>;
  siteWideInstructions: string | null;
  createdAt: string;
  createdBy: string;
};

const FORBIDDEN_PUBLIC_LANGUAGE = ["owner-confirmed", "approved authority", "approved strategy", "pending validation", "authority used", "evidence gated", "proposed from approved", "genesis"];
const PROTECTED_CLAIMS = /\b(certified|compliant|licensed|nationwide service|guaranteed|industry-leading|award-winning|customers? served|projects? completed)\b/i;
const TOKEN_STOPWORDS = new Set(["the", "and", "with", "that", "this", "from", "into", "about", "your", "their", "will", "can", "for", "you", "they", "our", "are", "was", "were", "have", "has"]);

function escape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function pathFor(page: SiteBuildPlanPage): string {
  return page.slug ? `/${page.slug.replace(/^\/+|\/+$/g, "")}/` : "/";
}
function sentenceList(values: string[]): string {
  return values.length > 1 ? `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}` : values[0] ?? "the approved services";
}
function section(pageId: string, index: number, heading: string, presentation: SitePageSection["presentation"], ...body: string[]): SitePageSection {
  return { sectionId: `${pageId}-section-${index}`, heading, level: 2, body, presentation };
}
function render(page: Pick<SiteGeneratedPageRevision, "h1" | "sections" | "internalLinks">): string {
  const links = page.internalLinks.map((link) => `<li><a href="${escape(link.href)}">${escape(link.anchorText)}</a></li>`).join("");
  return [
    `<h1>${escape(page.h1)}</h1>`,
    ...page.sections.flatMap((item) => [`<h${item.level}>${escape(item.heading)}</h${item.level}>`, ...item.body.map((body) => `<p>${escape(body)}</p>`)]),
    links ? `<nav aria-label="Related pages"><ul>${links}</ul></nav>` : "",
  ].filter(Boolean).join("\n");
}
function normalize(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokenize(value: string): Set<string> {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2 && !TOKEN_STOPWORDS.has(token)));
}
function hasPhrase(text: string, phrase: string): boolean {
  return normalize(text).includes(normalize(phrase));
}
function countOverlap(left: Set<string>, right: Set<string>): number {
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap;
}

const GOVERNANCE_COPY_MARKERS = [
  "approved authority",
  "approved strategy",
  "approved service",
  "approved offering",
  "approved site and owner authority",
  "approved cta sequence",
  "approved cta hierarchy",
  "approved conversion",
  "authority-safe",
  "governance-safe",
  "generation policy",
  "generation readiness",
  "certification",
  "owner-confirmed",
  "proposed from approved",
  "preserve approved",
  "authority used",
  "generated output",
  "creative blueprint",
  "lead with",
  "conversion direction",
  "priorities:",
];

function sanitizePublicCopy(raw: string, fallback: string): string {
  const sentences = raw
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const cleaned = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return !GOVERNANCE_COPY_MARKERS.some((marker) => lower.includes(marker));
  });
  const joined = cleaned.join(" ").trim();
  return joined || fallback;
}

function customerFacingLine(input: { value: string; fallback: string }): string {
  const cleaned = sanitizePublicCopy(input.value, input.fallback);
  if (/^("|')?lead with/i.test(cleaned)) return input.fallback;
  if (/creative blueprint/i.test(cleaned)) return input.fallback;
  return cleaned;
}

type GenerationScope = {
  scopeTokens: Set<string>;
  ctaPhrases: string[];
  ctaTokens: Set<string>;
  geographyTokens: Set<string>;
  digitalGrowthProfile: boolean;
};

function generationScope(input: { site: SiteConfiguration; strategy: SiteStrategyProposal; plan: SiteBuildPlanProposal; offerings: SiteProductServiceAuthority[] }): GenerationScope {
  const scopeText = [
    input.site.displayName,
    input.strategy.positioning,
    input.strategy.primaryAudience,
    input.strategy.valueProposition,
    ...input.strategy.secondaryAudiences,
    ...input.strategy.majorVerticals,
    ...input.strategy.productServiceFamilies,
    ...input.strategy.proposedProductAuthority,
    ...input.plan.pages.map((page) => `${page.name} ${page.purpose}`),
    ...input.offerings.map((item) => item.displayName),
  ].filter(Boolean).join(" ");
  const ctaPhrases = input.strategy.ctaHierarchy.filter(Boolean);
  const ctaTokens = tokenize(ctaPhrases.join(" "));
  const scopeTokens = tokenize(scopeText);
  const geographyTokens = tokenize(input.strategy.geographicStrategy);
  const digitalGrowthTokens = tokenize([input.strategy.positioning, input.strategy.valueProposition, ...input.strategy.productServiceFamilies, ...input.strategy.proposedProductAuthority, ...input.strategy.conversionPaths].join(" "));
  const digitalGrowthProfile = ["website", "search", "seo", "local", "growth"].filter((token) => digitalGrowthTokens.has(token)).length >= 3;
  return { scopeTokens, ctaPhrases, ctaTokens, geographyTokens, digitalGrowthProfile };
}

type QualityContext = {
  scopeTokens: Set<string>;
  ctaTokens: Set<string>;
  geographyTokens: Set<string>;
  pagePurposeTokens: Set<string>;
  siteIdentity: { organizationId: string; siteId: string; planOrganizationId: string; planSiteId: string };
};

export function evaluateGeneratedPageQuality(input: { page: Omit<SiteGeneratedPageRevision, "quality">; validPaths: Set<string>; duplicateFingerprints: Set<string>; context?: QualityContext }): SitePageQuality {
  const publicText = [input.page.h1, input.page.seoTitle, input.page.metaDescription, ...input.page.sections.flatMap((item) => [item.heading, ...item.body])].join(" ");
  const publicTokens = tokenize(publicText);
  const seoTokens = tokenize(`${input.page.seoTitle} ${input.page.metaDescription}`);
  const ctaSection = input.page.sections.find((item) => item.presentation === "CTA");
  const ctaTokens = tokenize(`${ctaSection?.heading ?? ""} ${(ctaSection?.body ?? []).join(" ")}`);
  const checks: Record<string, boolean> = {
    noSeedCopy: !/proposed from approved strategy|help .+ buyers understand the approved offerings/i.test(publicText.toLowerCase()),
    noGovernanceLanguage: !FORBIDDEN_PUBLIC_LANGUAGE.some((term) => publicText.toLowerCase().includes(term)),
    noProtectedClaims: !PROTECTED_CLAIMS.test(publicText),
    seoComplete: Boolean(input.page.seoTitle.trim() && input.page.metaDescription.trim() && input.page.openGraphTitle.trim() && input.page.openGraphDescription.trim() && input.page.h1.trim()),
    canonicalPathValid: /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(input.page.canonicalPath),
    contentSubstantial: input.page.sections.length >= 4 && input.page.contentHtml.length >= 900,
    linksValid: input.page.internalLinks.every((link) => input.validPaths.has(link.href)),
    notOrphaned: input.page.canonicalPath === "/" || input.page.internalLinks.length > 0,
    uniqueContent: !input.duplicateFingerprints.has(input.page.contentFingerprint),
    imageProvenanceBounded: input.page.imageRequirements.every((image) => image.source !== "REFERENCE_INSPIRATION_ONLY" || image.publishableAssetId === null),
  };

  if (input.context) {
    checks.scopeIdentityMatch = input.context.siteIdentity.organizationId === input.context.siteIdentity.planOrganizationId && input.context.siteIdentity.siteId === input.context.siteIdentity.planSiteId;
    checks.topicAlignedToApprovedScope = countOverlap(publicTokens, input.context.scopeTokens) >= 3;
    checks.pagePurposeAligned = input.context.pagePurposeTokens.size === 0 || countOverlap(publicTokens, input.context.pagePurposeTokens) >= 2;
    checks.ctaAligned = input.context.ctaTokens.size === 0 || countOverlap(ctaTokens, input.context.ctaTokens) >= 1;
    checks.seoAlignedToScope = countOverlap(seoTokens, input.context.scopeTokens) >= 2;
    checks.geographyAligned = input.context.geographyTokens.size === 0 || countOverlap(publicTokens, input.context.geographyTokens) >= 1;
  }

  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key);
  return {
    ready: blockers.length === 0,
    blockers,
    warnings: input.page.imageRequirements.some((item) => item.status !== "READY") ? ["Owner-approved or generated visual assets are still needed for one or more placements."] : [],
    checks,
  };
}

function pageLinks(page: SiteBuildPlanPage, all: SiteBuildPlanPage[], core: SiteBuildPlanPage | undefined): SitePageInternalLink[] {
  const contact = all.find((item) => item.pageType === "CONTACT");
  const capabilities = all.find((item) => item.pageType === "CAPABILITIES");
  const about = all.find((item) => item.pageType === "ABOUT");
  const categories = all.filter((item) => item.pageType === "CATEGORY" || item.pageType === "OFFERING");
  const markets = all.filter((item) => item.pageType === "MARKET");
  const targets =
    page.pageType === "HOME"
      ? [core, capabilities, about, ...categories, ...markets, contact]
      : page.pageType === "CATEGORY"
        ? [...categories.filter((item) => item.pageId !== page.pageId), ...markets.slice(0, 2), contact]
        : page.pageType === "OFFERING"
          ? [core, ...markets.slice(0, 2), contact]
          : page.pageType === "MARKET"
            ? [core, ...categories.slice(0, 2), contact]
            : page.pageType === "ABOUT"
              ? [core, contact]
              : page.pageType === "CAPABILITIES"
                ? [core, ...categories.slice(0, 3), contact]
                : [core, about];
  return [...new Map(targets.filter((item): item is SiteBuildPlanPage => Boolean(item && item.pageId !== page.pageId)).map((item) => [item.pageId, item])).values()].map((item, index) => ({
    linkId: `${page.pageId}-link-${index}`,
    href: pathFor(item),
    anchorText: item.name,
    reason: `Connect ${page.name} to ${item.name}.`,
    targetPageId: item.pageId,
  }));
}

function parseExplicitProcessSteps(...values: Array<string | null | undefined>): string[] {
  for (const value of values) {
    if (!value) continue;
    const match = /(?:four[-\s]*step process|process)[^:]*:\s*([^.]+)/i.exec(value);
    if (!match) continue;
    const parsed = match[1]
      .split(/[;\n,]/)
      .map((item) => item.replace(/^[\s\d.)-]+/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
    if (parsed.length === 4) return parsed;
  }
  return [];
}

function stepExplanation(step: string, index: number, fallback: string): string {
  const key = normalize(step);
  if (key.includes("target") && key.includes("area")) return "Define the service territory and customer priorities before publishing.";
  if (key.includes("build") && key.includes("local") && key.includes("page")) return "Create service and location pages that reflect real customer intent.";
  if ((key.includes("optimize") || key.includes("improve")) && (key.includes("search") || key.includes("seo"))) return "Strengthen technical and content SEO to improve qualified visibility.";
  if ((key.includes("track") || key.includes("measure")) && (key.includes("grow") || key.includes("improve"))) return "Review performance and refine content based on approved growth signals.";
  return fallback;
}

function stepsBody(steps: string[], conversionPaths: string[]): string {
  return steps
    .map((step, index) => `${index + 1}. ${step} — ${stepExplanation(step, index, conversionPaths[index] ?? "Execute the next approved growth action.")}`)
    .join(" ");
}

function digitalGrowthSteps(strategy: SiteStrategyProposal, instructions: string | null | undefined, purpose: string): string[] {
  const explicit = parseExplicitProcessSteps(instructions, purpose, strategy.homepageGoals.join(" "), strategy.conversionPaths.join("; "));
  if (explicit.length === 4) return explicit;
  const candidates = strategy.conversionPaths.filter(Boolean);
  const normalized = candidates.map((item) => normalize(item));
  const hasCanonical = ["target your area", "build local pages", "optimize for search", "track and grow"].every((phrase) => normalized.some((item) => item.includes(phrase)));
  if (hasCanonical) {
    return ["Target Your Area", "Build Local Pages", "Optimize for Search", "Track and Grow"];
  }
  return [
    strategy.conversionPaths[0] ?? "Clarify your audience and service area.",
    strategy.conversionPaths[1] ?? "Build pages aligned to real customer intent.",
    strategy.conversionPaths[2] ?? "Improve search visibility with technical and content quality.",
    strategy.conversionPaths[3] ?? "Measure outcomes and iterate responsibly.",
  ];
}

function sectionsFor(input: { page: SiteBuildPlanPage; site: SiteConfiguration; strategy: SiteStrategyProposal; offerings: SiteProductServiceAuthority[]; markets: SiteBuildPlanPage[]; core?: SiteBuildPlanPage; scope: GenerationScope; instructions?: string | null }): SitePageSection[] {
  const { page, site, strategy, offerings, markets, scope } = input;
  const cta = strategy.ctaHierarchy[0] ?? "Contact Us";
  const consultationCta = strategy.ctaHierarchy.find((item) => /consult/i.test(item)) ?? "Book a Consultation";
  const seoGrowthCta = strategy.ctaHierarchy.find((item) => /seo|growth plan/i.test(item)) ?? "Request SEO Growth Plan";
  const offeringsText = sentenceList(offerings.map((item) => item.displayName));
  const marketText = sentenceList(markets.map((item) => item.name.replace(/ solutions$/i, "")));
  const defaultPurpose = page.pageType === "CONTACT"
    ? `Connect with ${site.displayName} to discuss website development and search-growth priorities.`
    : `${page.name} page aligned to current strategy and customer intent.`;
  const purpose = sanitizePublicCopy(page.purpose.trim(), defaultPurpose);
  const audience = strategy.primaryAudience || page.primaryAudience;
  const geography = strategy.geographicStrategy ? `Geographic focus: ${strategy.geographicStrategy}` : "Geographic focus remains bounded to confirmed service areas.";

  if (page.pageType === "HOME" && scope.digitalGrowthProfile) {
    const steps = digitalGrowthSteps(strategy, input.instructions, page.purpose);
    const heroNarrative = customerFacingLine({
      value: strategy.valueProposition || purpose,
      fallback: `Build professional website development and search-growth momentum with clear local market coverage and conversion-focused execution.`,
    });
    return [
      section(page.pageId, 1, "Grow Your Business Where It Matters Most", "HERO",
        `${site.displayName} helps ${audience.toLowerCase()} grow through website development and search-growth execution grounded in real services and clear scope.`,
        heroNarrative),
      section(page.pageId, 2, "Core Website and Search Solutions", "GRID",
        offerings.length ? `Explore ${offeringsText} through practical pathways mapped to how buyers evaluate and engage.` : "Explore website and search pathways aligned to real customer intent."),
      section(page.pageId, 3, "How Growth Happens", "STEPS", stepsBody(steps, strategy.conversionPaths)),
      section(page.pageId, 4, "Who We Help", "PROSE",
        `${site.displayName} is focused on ${audience.toLowerCase()} across ${marketText || "relevant customer segments"}.`,
        geography),
      section(page.pageId, 5, "Why This Approach Works", "FAQ",
        strategy.valueProposition || "Content, technical quality, and conversion pathways stay aligned to measurable business goals.",
        "No fabricated outcomes, testimonials, or unsupported claims are included."),
      section(page.pageId, 6, cta, "CTA", `Start with a consultation-focused conversation and continue with ${cta}.`),
    ];
  }

  if (page.pageType === "HOME") {
    return [
      section(page.pageId, 1, page.name, "HERO", purpose, strategy.valueProposition),
      section(page.pageId, 2, "Service Pathways", "GRID", offerings.length ? `Current offerings include ${offeringsText}.` : "Current service pathways reflect strategy and audience intent."),
      section(page.pageId, 3, "Audience and Conversion Focus", "PROSE", `Primary audience: ${audience}.`, `Conversion direction: ${strategy.conversionPaths.join("; ") || "Use the defined CTA hierarchy."}`),
      section(page.pageId, 4, "Markets and Geography", "GRID", marketText ? `Priority markets include ${marketText}.` : "Market focus is derived from strategy."),
      section(page.pageId, 5, "Implementation Guidance", "STEPS", `Use a structured delivery sequence tied to business goals. ${geography}`),
      section(page.pageId, 6, cta, "CTA", `Continue through the conversion path with ${cta}.`),
    ];
  }

  if (page.pageType === "CATEGORY" || page.pageType === "OFFERING") {
    const howItWorksPage = /how[\s-]?it[\s-]?works/i.test(page.name) || page.slug === "how-it-works";
    const processSteps = digitalGrowthSteps(strategy, input.instructions, page.purpose);
    return [
      section(page.pageId, 1, page.name, "HERO", purpose),
      section(page.pageId, 2, "Service Scope", "PROSE", offerings.length ? `This page aligns to offering scope including ${offeringsText}.` : "This page aligns to the current offering scope."),
      section(page.pageId, 3, "How It Works", "STEPS", howItWorksPage ? stepsBody(processSteps, strategy.conversionPaths) : strategy.conversionPaths.length ? stepsBody(strategy.conversionPaths.slice(0, 4), strategy.conversionPaths) : "1. Clarify the business goal. 2. Align service scope. 3. Execute the planned work. 4. Review and improve."),
      section(page.pageId, 4, "Frequently Asked Questions", "FAQ", "Scope and deliverables are constrained to defined services and validated capability.", geography),
      section(page.pageId, 5, cta, "CTA", `Use ${cta} as the next step.`),
    ];
  }

  if (page.pageType === "MARKET") {
    return [
      section(page.pageId, 1, page.name, "HERO", purpose),
      section(page.pageId, 2, "Customer Segment Fit", "PROSE", `This segment is addressed for ${audience.toLowerCase()} with defined offerings only.`),
      section(page.pageId, 3, "Relevant Offerings", "GRID", offerings.length ? offeringsText : "Service families are applied by segment."),
      section(page.pageId, 4, "Geographic Boundaries", "FAQ", geography, "No unsupported expansion claims are introduced."),
      section(page.pageId, 5, cta, "CTA", `Continue with a consultation-oriented action: ${cta}.`),
    ];
  }

  if (page.pageType === "ABOUT") {
    return [
      section(page.pageId, 1, `About ${site.displayName}`, "HERO", purpose),
      section(page.pageId, 2, "Positioning", "PROSE", strategy.positioning, strategy.valueProposition),
      section(page.pageId, 3, "Approach", "STEPS", strategy.homepageGoals.length ? stepsBody(strategy.homepageGoals.slice(0, 4), strategy.homepageGoals) : "1. Understand goals. 2. Align scope. 3. Execute responsibly. 4. Iterate with evidence."),
      section(page.pageId, 4, cta, "CTA", `For next steps, use ${cta}.`),
    ];
  }

  return [
    section(page.pageId, 1, page.name, "HERO", purpose),
    section(page.pageId, 2, "What to Share", "GRID", "Share business goals, service context, and known constraints so the team can guide the next step."),
    section(page.pageId, 3, "What Happens Next", "STEPS", strategy.conversionPaths.length ? stepsBody(strategy.conversionPaths.slice(0, 4), strategy.conversionPaths) : "1. Intake. 2. Clarify. 3. Plan. 4. Follow through."),
    section(page.pageId, 4, "Boundary Conditions", "FAQ", geography, "No unsupported services, outcomes, or credentials are implied."),
    section(page.pageId, 5, cta, "CTA", `Use ${cta} to start, then continue with ${consultationCta} and ${seoGrowthCta} when they fit your goals.`),
  ];
}

function applyGenerationInstructions(pageId: string, sections: SitePageSection[], instructions: string | null | undefined, cta: string): SitePageSection[] {
  if (!instructions?.trim()) return sections;
  const normalized = instructions.toLowerCase();
  const result = [...sections];
  if (/consult|cta|conversion/.test(normalized)) {
    const ctaIndex = result.findIndex((item) => item.presentation === "CTA");
    if (ctaIndex >= 0) result[ctaIndex] = { ...result[ctaIndex], heading: cta, body: [`Use ${cta} to start a focused conversation about your goals and growth priorities.`] };
  } else if (/faq|question/.test(normalized)) {
    result.splice(-1, 0, section(pageId, 90, "Additional Questions", "FAQ", "Clarify assumptions before execution.", "Keep scope aligned to defined services and capabilities."));
  } else if (/short|concise|simplif/.test(normalized) && result.length > 4) {
    result.splice(2, 1);
  }
  return result.map((item, index) => ({ ...item, sectionId: `${pageId}-section-${index + 1}` }));
}

export function synthesizeSiteAssembly(input: {
  site: SiteConfiguration;
  buildSessionId: string;
  plan: SiteBuildPlanProposal;
  intelligence: SiteIntelligenceWorkspace;
  strategy: SiteStrategyProposal;
  creative: CreativeDirectionProposal;
  candidates: SiteProductServiceAuthority[];
  sources: SiteSource[];
  revision: number;
  actor: string;
  instructions?: string | null;
  now?: string;
}): SiteAssemblyProposal {
  if (input.plan.status !== "APPROVED" || input.strategy.status !== "APPROVED" || input.creative.status !== "APPROVED") throw new Error("APPROVED_SITE_ASSEMBLY_AUTHORITY_REQUIRED");
  if (input.plan.organizationId !== input.site.organizationId || input.plan.siteId !== input.site.siteId) throw new Error("SITE_ASSEMBLY_SCOPE_MISMATCH");
  if (input.creative.strategyRevision !== input.strategy.revision) throw new Error("CREATIVE_STRATEGY_LINEAGE_MISMATCH");

  const pages = input.plan.pages.filter((item) => item.launchPhase === "INITIAL");
  const paths = new Set(pages.map(pathFor));
  const core = pages.find((item) => item.pageType === "CATEGORY");
  const markets = pages.filter((item) => item.pageType === "MARKET");
  const approvedCandidates = input.candidates.filter((item) => (item.decision === "APPROVED" || item.decision === "QUALIFIED") && (item.protectedClaimBlockers.length === 0 || item.authorityBasis === "OWNER_ATTESTED_AND_EVIDENCE"));
  const publishable = new Map(input.intelligence.creativeInputs.filter((item) => item.classification === "OWNER_APPROVED_PUBLISHABLE" && item.binaryAsset).map((item) => [item.binaryAsset!.assetId, item]));
  const opportunities = selectDistinctCapabilityOpportunities(input.intelligence.opportunities ?? []);
  const approvedMarkets = new Set(opportunities.filter((item) => item.ownerDecision === "APPROVED").map((item) => item.opportunityId));
  const currentCapabilities = new Set(opportunities.filter(isCapabilityReviewComplete).map((item) => item.opportunityId));
  const approvedProducts = new Set(approvedCandidates.map((item) => item.authorityId));
  const scope = generationScope({ site: input.site, strategy: input.strategy, plan: input.plan, offerings: approvedCandidates });

  const fingerprints = new Set<string>();
  const intentKeys = new Set<string>();
  const generated: SiteGeneratedPageRevision[] = [];

  for (const planPage of pages) {
    const links = pageLinks(planPage, pages, core);
    const baseSections = sectionsFor({ page: planPage, site: input.site, strategy: input.strategy, offerings: approvedCandidates, markets, core, scope, instructions: input.instructions });
    const sections = applyGenerationInstructions(planPage.pageId, baseSections, input.instructions, input.strategy.ctaHierarchy[0] ?? "Contact Us");
    const h1 = sections[0].heading;
    const canonicalPath = pathFor(planPage);
    const imageSource: SitePageImageSource = "GENERATED_VISUAL";
    const imageRequirements: SitePageImageRequirement[] = [{
      slotId: `${planPage.pageId}-hero`,
      placement: "Hero",
      subject: `${planPage.name} visual aligned to approved strategy and creative direction`,
      source: publishable.size ? "APPROVED_PUBLISHABLE_ASSET" : imageSource,
      purpose: imageSource,
      resolutionPolicy: "GENERATED_OR_OWNER_ASSET",
      publishableAssetId: publishable.keys().next().value ?? null,
      status: publishable.size ? "READY" : "GENERATED_CANDIDATE_NEEDED",
      altTextGuidance: `Describe ${planPage.name.toLowerCase()} in approved business context without unsupported claims.`,
    }];
    if (planPage.pageType === "HOME") {
      imageRequirements.push({
        slotId: `${planPage.pageId}-industry`,
        placement: "Industries",
        subject: `${planPage.name} industry imagery with geographic service context and local search cues`,
        source: publishable.size ? "APPROVED_PUBLISHABLE_ASSET" : imageSource,
        purpose: imageSource,
        resolutionPolicy: "GENERATED_OR_OWNER_ASSET",
        publishableAssetId: publishable.keys().next().value ?? null,
        status: publishable.size ? "READY" : "GENERATED_CANDIDATE_NEEDED",
        altTextGuidance: "Show relevant industries and geographic context without unsupported service-area claims.",
      });
    }

    const seoTitle = (planPage.pageType === "HOME"
      ? `${input.site.displayName} | ${input.strategy.valueProposition || input.strategy.positioning || h1}`
      : `${planPage.name} | ${input.site.displayName}`).slice(0, 60);
    const publicPurpose = sanitizePublicCopy(planPage.purpose, `${planPage.name} page focused on customer outcomes and consultation paths.`);
    const metaDescription = (planPage.pageType === "HOME"
      ? `${h1}. ${input.strategy.valueProposition || input.strategy.positioning}.`
      : `${publicPurpose} ${input.strategy.geographicStrategy ? `Geography: ${input.strategy.geographicStrategy}.` : ""}`).slice(0, 155);

    const base = {
      pageRevisionId: `${planPage.pageId}-generation-${input.revision}`,
      pageId: planPage.pageId,
      revision: input.revision,
      status: "READY_FOR_OWNER_REVIEW" as const,
      requestedChanges: input.instructions?.trim() || null,
      name: planPage.name,
      slug: planPage.slug,
      canonicalPath,
      pageRole: planPage.pageType,
      seoTitle,
      metaDescription,
      openGraphTitle: seoTitle,
      openGraphDescription: metaDescription,
      h1,
      sections,
      contentHtml: "",
      internalLinks: links,
      imageRequirements,
      authority: planPage.authority,
      contentFingerprint: "",
      createdAt: input.now ?? new Date().toISOString(),
      createdBy: input.actor,
      decidedAt: null,
      decidedBy: null,
    };
    base.contentHtml = render(base);
    base.contentFingerprint = createHash("sha256").update(base.contentHtml).digest("hex");

    const quality = evaluateGeneratedPageQuality({
      page: base,
      validPaths: paths,
      duplicateFingerprints: fingerprints,
      context: {
        scopeTokens: scope.scopeTokens,
        ctaTokens: scope.ctaTokens,
        geographyTokens: scope.geographyTokens,
        pagePurposeTokens: tokenize(publicPurpose),
        siteIdentity: {
          organizationId: input.site.organizationId,
          siteId: input.site.siteId,
          planOrganizationId: input.plan.organizationId,
          planSiteId: input.plan.siteId,
        },
      },
    });

    const authorityValid = planPage.authority.every((item) => item.kind === "PRODUCT_SERVICE"
      ? approvedProducts.has(item.referenceId)
      : item.kind === "MARKET"
        ? approvedMarkets.has(item.referenceId)
        : item.kind === "CAPABILITY"
          ? currentCapabilities.has(item.referenceId)
          : true);
    const intentTokens = [...tokenize(`${planPage.pageType} ${planPage.slug} ${base.seoTitle} ${base.metaDescription} ${base.h1} ${sections.map((sectionItem) => `${sectionItem.heading} ${sectionItem.body.join(" ")}`).join(" ")}`)]
      .filter((token) => !["home", "about", "contact", "solutions", "solution", "services", "service", "pageengines"].includes(token))
      .sort();
    const intentKey = intentTokens.slice(0, 14).join("|") || `${planPage.pageType}:${planPage.slug || "home"}`;
    const duplicateIntent = intentKeys.has(intentKey);

    quality.checks.approvedAuthorityOnly = authorityValid;
    quality.checks.distinctSearchIntent = !duplicateIntent;
    if (!authorityValid) quality.blockers.push("approvedAuthorityOnly");
    if (duplicateIntent) quality.blockers.push("distinctSearchIntent");
    quality.ready = quality.blockers.length === 0;

    fingerprints.add(base.contentFingerprint);
    intentKeys.add(intentKey);
    generated.push({ ...base, quality, status: quality.ready ? "READY_FOR_OWNER_REVIEW" : "REVISION_REQUESTED" });
  }

  const inbound = new Map(generated.map((item) => [item.pageId, 0]));
  for (const generatedPage of generated) for (const link of generatedPage.internalLinks) inbound.set(link.targetPageId, (inbound.get(link.targetPageId) ?? 0) + 1);
  for (const generatedPage of generated) {
    if (generatedPage.canonicalPath !== "/" && (inbound.get(generatedPage.pageId) ?? 0) === 0) {
      generatedPage.quality.ready = false;
      generatedPage.quality.blockers.push("orphanPage");
      generatedPage.quality.checks.notOrphaned = false;
      generatedPage.status = "REVISION_REQUESTED";
    }
  }

  const offerings = pages.filter((item) => item.pageType === "OFFERING" || item.pageType === "CATEGORY").map((item) => ({ label: item.name, href: pathFor(item) }));
  const industries = markets.map((item) => ({ label: item.name.replace(/ Solutions$/, ""), href: pathFor(item) }));
  const primaryLabel = core?.name ?? pages[0]?.name ?? input.site.displayName;
  const solutionsLabel = /solution/i.test(primaryLabel) ? "Services" : "Solutions";
  const dedupeNav = (items: SiteNavigationItem[]): SiteNavigationItem[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.label.trim().toLowerCase()}|${item.href.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const navigation: SiteNavigationItem[] = [
    { label: primaryLabel, href: core ? pathFor(core) : "/", children: [] },
    { label: solutionsLabel, href: core ? pathFor(core) : "/", children: offerings.filter((item) => item.href !== (core ? pathFor(core) : "/")) },
    ...(industries.length ? [{ label: "Industries", href: industries[0].href, children: industries }] : []),
    ...pages.filter((item) => ["CAPABILITIES", "ABOUT", "CONTACT"].includes(item.pageType)).map((item) => ({ label: item.name, href: pathFor(item), children: [] })),
  ];

  const status = generated.every((item) => item.quality.ready) ? "READY_FOR_OWNER_REVIEW" : "REVISION_REQUESTED";
  const materialContradictions = generated
    .map((item) => ({
      pageId: item.pageId,
      blockers: item.quality.blockers.filter((blocker) => ["scopeIdentityMatch", "topicAlignedToApprovedScope", "pagePurposeAligned", "ctaAligned", "seoAlignedToScope", "geographyAligned", "approvedAuthorityOnly"].includes(blocker)),
    }))
    .filter((item) => item.blockers.length > 0);
  if (materialContradictions.length > 0) {
    throw new Error(`SITE_ASSEMBLY_QUALITY_CONTRADICTION:${JSON.stringify(materialContradictions)}`);
  }

  return {
    assemblyId: `${input.buildSessionId}-assembly-${input.revision}`,
    buildSessionId: input.buildSessionId,
    organizationId: input.site.organizationId,
    siteId: input.site.siteId,
    buildPlanRevision: input.plan.revision,
    creativeRevision: input.creative.revision,
    policyVersion: SITE_PAGE_GENERATION_POLICY_VERSION,
    revision: input.revision,
    status,
    pages: generated,
    navigation: dedupeNav(navigation),
    footerLinks: pages.filter((item) => ["ABOUT", "CONTACT", "CAPABILITIES"].includes(item.pageType)).map((item) => ({ label: item.name, href: pathFor(item) })),
    siteWideInstructions: input.instructions?.trim() || null,
    createdAt: input.now ?? new Date().toISOString(),
    createdBy: input.actor,
  };
}
