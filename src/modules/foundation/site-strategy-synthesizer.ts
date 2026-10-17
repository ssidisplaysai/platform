import "server-only";

import { hasVerifiedCapability, type CreativeInput, type SiteIntelligenceWorkspace, type SiteStrategyProposal } from "./site-intelligence";
import type { IntegrationProfileConfiguration } from "./types";
import { classifyOpportunitySemantics } from "./opportunity-semantic-classifier";

export type SiteStrategySynthesisContext = {
  domain: string;
  publicBrandIdentity: string;
  brandProfile: IntegrationProfileConfiguration;
  seoProfile: IntegrationProfileConfiguration;
  promptProfile: IntegrationProfileConfiguration;
};

type StrategyDraft = Omit<SiteStrategyProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt">;
type SiteStrategySynthesisOptions = {
  revisionInstructions?: string;
};
type StrategySynthesisData = {
  approved: SiteIntelligenceWorkspace["opportunities"];
  presentAuthority: SiteIntelligenceWorkspace["opportunities"];
  unverified: SiteIntelligenceWorkspace["opportunities"];
  future: SiteIntelligenceWorkspace["opportunities"];
  classifications: ReturnType<typeof classifyOpportunitySemantics>[];
  verticals: string[];
  buyers: string[];
  authorityNames: string[];
  requiredProductAuthority: string[];
  salesChannels: string[];
  researchedGeographies: string[];
  expansionGeographies: string[];
  locationSeoOpportunities: string[];
  proofRequirements: string[];
  marketNames: string[];
  evidenceIds: string[];
  evidenceClaims: string[];
  referenceGuidance: string[];
  profileContext: string[];
  opportunityPrioritization: string[];
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function preferenceSummary(inputs: CreativeInput[]): string {
  const likes = inputs.filter((input) => input.sentiment === "LIKE").length;
  const dislikes = inputs.filter((input) => input.sentiment === "DISLIKE").length;
  const referenceOnly = inputs.length - likes - dislikes;
  return `${inputs.length} owner references considered (${likes} likes, ${dislikes} dislikes, ${referenceOnly} reference only).`;
}

function profileGuidance(profile: IntegrationProfileConfiguration): string[] {
  return unique([profile.profileName, profile.description ?? "", profile.notes ?? "", ...Object.entries(profile.references).flatMap(([key, value]) => value ? [`${key}: ${value}`] : [])]);
}

function collectSynthesisData(workspace: SiteIntelligenceWorkspace, context: SiteStrategySynthesisContext): StrategySynthesisData {
  const approved = workspace.opportunities.filter((opportunity) => opportunity.ownerDecision === "APPROVED");
  const presentAuthority = approved.filter(hasVerifiedCapability);
  const unverified = approved.filter((opportunity) => !hasVerifiedCapability(opportunity) && opportunity.capabilityState !== "FUTURE_CAPABILITY" && opportunity.capabilityState !== "REJECTED");
  const future = approved.filter((opportunity) => opportunity.capabilityState === "FUTURE_CAPABILITY");
  const classifications = approved.map(classifyOpportunitySemantics);
  const verticals = unique(classifications.flatMap((item) => item.marketVerticals));
  const buyers = unique(classifications.flatMap((item) => item.audiences));
  const authorityNames = unique(classifications.filter((item) => item.capabilityAuthority === "CURRENT" && item.roles.includes("PRODUCT_SERVICE")).flatMap((item) => item.productServiceCandidates));
  const requiredProductAuthority = unique(classifications.filter((item) => item.capabilityAuthority === "UNVALIDATED" && item.roles.includes("PRODUCT_SERVICE")).flatMap((item) => item.productServiceCandidates));
  const salesChannels = unique(classifications.flatMap((item) => item.salesChannels));
  const researchedGeographies = unique(classifications.flatMap((item) => item.researchedGeographies));
  const expansionGeographies = researchedGeographies.filter((scope) => !/^(national|nationwide(?: united states| us)?|united states)$/i.test(scope));
  const locationSeoOpportunities = unique(classifications.filter((item) => item.roles.includes("GEOGRAPHY")).flatMap((item) => item.seoOpportunities));
  const proofRequirements = unique([...classifications.flatMap((item) => item.proofRequirements), "Relevant completed-project photography", "Technical specifications and performance details", "Customer or project examples"]);
  const marketNames = unique(approved.map((opportunity) => opportunity.name));
  const evidenceIds = unique(approved.flatMap((opportunity) => opportunity.evidenceIds));
  const evidenceClaims = workspace.evidence.filter((item) => evidenceIds.includes(item.evidenceId)).map((item) => item.observedClaim);
  const referenceGuidance = workspace.creativeInputs.flatMap((input) => input.notes ? [`${input.sentiment === "LIKE" ? "Favor" : input.sentiment === "DISLIKE" ? "Avoid" : "Reference"}: ${input.notes}`] : []);
  const profileContext = unique([...profileGuidance(context.brandProfile), ...profileGuidance(context.seoProfile), ...profileGuidance(context.promptProfile)]);
  const opportunityPrioritization = [...approved].sort((left, right) => {
    const value = { HIGH: 3, MODERATE: 2, LOW: 1, UNKNOWN: 0 };
    return value[right.commercialValue] - value[left.commercialValue] || right.confidence - left.confidence;
  }).map((opportunity) => opportunity.name);
  return {
    approved,
    presentAuthority,
    unverified,
    future,
    classifications,
    verticals,
    buyers,
    authorityNames,
    requiredProductAuthority,
    salesChannels,
    researchedGeographies,
    expansionGeographies,
    locationSeoOpportunities,
    proofRequirements,
    marketNames,
    evidenceIds,
    evidenceClaims,
    referenceGuidance,
    profileContext,
    opportunityPrioritization,
  };
}

function buildBaselineDraft(workspace: SiteIntelligenceWorkspace, context: SiteStrategySynthesisContext, data: StrategySynthesisData): StrategyDraft {
  const audience = data.buyers[0] ?? "Commercial project buyers";
  const brandName = context.publicBrandIdentity.trim();
  const marketFocus = data.verticals.slice(0, 3).join(", ") || "commercial and institutional project environments";
  const authorityFocusTerms = data.authorityNames.length ? data.authorityNames : data.marketNames;
  const brandFocus = authorityFocusTerms.slice(0, 3).join(", ").toLowerCase() || "approved capabilities and project requirements";
  const approvedCapabilitySummary = data.authorityNames.length ? `, with approved capabilities such as ${data.authorityNames.slice(0, 3).join(", ").toLowerCase()}` : "";
  return {
    positioning: `${brandName} is a commercial project resource for ${audience.toLowerCase()} planning complex projects across ${marketFocus.toLowerCase()}${approvedCapabilitySummary}.`,
    primaryAudience: audience,
    secondaryAudiences: data.buyers.slice(1),
    valueProposition: `Help ${audience.toLowerCase()} turn project requirements into clear specifications, relevant proof, and a quote-ready conversation for ${brandFocus}.`,
    majorVerticals: data.verticals,
    productServiceFamilies: data.authorityNames,
    informationArchitecture: ["Home", "Capabilities", "Markets", "Projects", "About", "Request a Quote"],
    proposedSitemap: unique(["/", "/capabilities", "/markets", ...data.verticals.map((vertical) => `/markets/${vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`), "/projects", "/about", "/request-a-quote"]),
    homepageGoals: unique(["Explain the primary market focus", "Present relevant project and capability proof", "Help buyers navigate by application and project need", "Drive qualified quote requests", ...data.referenceGuidance.filter((item) => item.startsWith("Favor:")).map((item) => item.slice(7))]),
    conversionPaths: unique(["Market and application content to request-a-quote", "Project proof to project consultation", ...data.salesChannels.map((channel) => `${channel} resources to specification and quote intake`)]),
    ctaHierarchy: ["Request a Quote", "Discuss Your Project", data.salesChannels.length ? "Submit Specifications" : "Review Project Requirements"],
    trustProofRequirements: unique([...data.proofRequirements, "Clear fulfillment and service-area details", ...data.referenceGuidance.filter((item) => item.startsWith("Reference:")).map((item) => item.slice(10))]),
    geographicStrategy: `Build nationwide United States demand capture and quote-intake coverage. Treat ${data.expansionGeographies.length ? data.expansionGeographies.join(", ") : "specific researched regions"} as research-led expansion or location-SEO opportunities until service scope is explicitly established.`,
    proposedProductAuthority: data.requiredProductAuthority,
    reason: `Synthesized from ${data.approved.length} approved opportunities, ${workspace.evidence.length} evidence records, and ${preferenceSummary(workspace.creativeInputs)} Market priorities: ${data.marketNames.join("; ")}.`,
    synthesisContext: {
      approvedOpportunityIds: data.approved.map((opportunity) => opportunity.opportunityId),
      capabilityAuthorityOpportunityIds: data.presentAuthority.map((opportunity) => opportunity.opportunityId),
      pendingCapabilityOpportunityIds: data.unverified.map((opportunity) => opportunity.opportunityId),
      futureCapabilityOpportunityIds: data.future.map((opportunity) => opportunity.opportunityId),
      excludedOpportunityIds: workspace.opportunities.filter((opportunity) => opportunity.ownerDecision !== "APPROVED").map((opportunity) => opportunity.opportunityId),
      evidenceIds: data.evidenceIds,
      referenceInputIds: workspace.creativeInputs.map((input) => input.inputId),
      profileIds: [context.brandProfile.profileId, context.seoProfile.profileId, context.promptProfile.profileId],
      evidenceClaims: data.evidenceClaims,
      referenceGuidance: data.referenceGuidance,
      profileGuidance: data.profileContext,
      semanticClassifications: data.classifications,
      opportunityPrioritization: data.opportunityPrioritization,
      salesChannels: data.salesChannels,
      currentServiceGeographies: unique(data.classifications.filter((item) => item.capabilityAuthority === "CURRENT" && item.roles.includes("CAPABILITY")).flatMap((item) => item.researchedGeographies)),
      targetExpansionGeographies: data.expansionGeographies,
      researchedDemandGeographies: data.researchedGeographies,
      locationSeoOpportunities: data.locationSeoOpportunities,
    },
  };
}

function normalizeRevisionTerms(input: string): string[] {
  return unique(input.toLowerCase().split(/[^a-z0-9]+/g));
}

function materializeRevisedDraft(base: StrategyDraft, data: StrategySynthesisData, brandName: string, revisionInstructions: string): StrategyDraft {
  const instructions = revisionInstructions.toLowerCase();
  const tokens = normalizeRevisionTerms(instructions);
  const webGrowthIntent = includesAny(instructions, [/\bwebsite\b/, /\bseo\b/, /\bsearch\b/, /\bgrowth\b/, /\bcontent\b/, /\bvisibility\b/, /\bintent\b/]);
  const multiLocationIntent = includesAny(instructions, [/\bmulti-location\b/, /\bmultilocation\b/, /\bservice area\b/, /\bservice territory\b/, /\bterritor/]);
  const consultationIntent = includesAny(instructions, [/\bconsultation\b/, /\bget started\b/, /\bcontact\b/, /\bdiscovery\b/]);
  const removeProjectConsultancy = includesAny(instructions, [/\bnot\b.*\bconsultanc/, /\bremove\b.*\bconsultanc/, /\bdo not\b.*\bproject\b/, /\bcommercial construction consultancy\b/, /\bindustrial quotation\b/]);
  const rejectQuoteCentric = includesAny(instructions, [/\bnot\b.*\bquote\b/, /\bremove\b.*\bquote\b/, /\bconsultation-oriented\b/]);
  const nationwidePlatform = includesAny(instructions, [/\bnationwide platform\b/, /\bserve customers throughout the united states\b/, /\bnationwide\b/]);
  const geographyLimited = includesAny(instructions, [/\blocal business\b/, /\bgeographically limited\b/, /\bactual service territor/]);
  if (!webGrowthIntent && removeProjectConsultancy) throw new Error("STRATEGY_REVISION_INCOMPLETE_INTENT:Revision removes prior positioning but does not provide replacement business model guidance.");

  const audiences = unique([
    webGrowthIntent ? "Small and medium-sized businesses seeking website and search growth" : "",
    multiLocationIntent ? "Regional franchises and multi-location operators" : "",
    ...base.secondaryAudiences,
  ]).slice(0, 4);
  const primaryAudience = audiences[0] ?? base.primaryAudience;
  const serviceFamilies = data.authorityNames;
  const verticals = webGrowthIntent
    ? unique([
        "Website development",
        "Local search growth",
        "Service and location coverage expansion",
        ...base.majorVerticals,
      ])
    : base.majorVerticals;
  const ia = webGrowthIntent
    ? ["Home", "Solutions", "How It Works", "Industries", "About", "Contact"]
    : base.informationArchitecture;
  const sitemap = webGrowthIntent
    ? ["/", "/solutions", "/how-it-works", "/industries", "/about", "/contact"]
    : base.proposedSitemap;
  const ctaHierarchy = consultationIntent || webGrowthIntent || rejectQuoteCentric
    ? unique(["Get Started", "Book a Consultation", "Request SEO Growth Plan"])
    : base.ctaHierarchy;

  const positioning = webGrowthIntent
    ? `${brandName} is a website development and search-growth platform for ${primaryAudience.toLowerCase()}, focused on service/location coverage, search intent alignment, and measurable consultation outcomes.`
    : base.positioning;
  const valueProposition = webGrowthIntent
    ? `Help ${primaryAudience.toLowerCase()} map real service territories, publish high-quality service/location pages, strengthen technical and content SEO, and improve visibility through consultation-led growth priorities.`
    : base.valueProposition;
  const conversionPaths = webGrowthIntent
    ? unique([
        "Service and location pages to consultation booking",
        "SEO diagnostics and opportunity maps to growth-plan intake",
        "Industry solution briefs to get-started conversion",
      ])
    : base.conversionPaths;
  const homepageGoals = webGrowthIntent
    ? unique([
        "Lead with a website-development and search-growth business model",
        "Explain service/location coverage and search-intent strategy",
        "Show consultation-led conversion journey with clear next steps",
        "Present capability boundaries and proof requirements without overclaiming",
      ])
    : base.homepageGoals;
  const geographicStrategy = nationwidePlatform
    ? "Support customers across the United States while enforcing per-customer service-territory constraints. Never imply a customer's coverage exceeds its confirmed service geography."
    : multiLocationIntent || geographyLimited || webGrowthIntent
      ? "Build geographically accurate demand capture from each customer's confirmed service territories, city clusters, and adjacent expansion zones without asserting unsupported nationwide coverage."
      : base.geographicStrategy;

  const revised: StrategyDraft = {
    ...base,
    positioning,
    primaryAudience,
    secondaryAudiences: audiences.slice(1),
    valueProposition,
    majorVerticals: verticals,
    productServiceFamilies: serviceFamilies,
    informationArchitecture: ia,
    proposedSitemap: sitemap,
    homepageGoals,
    conversionPaths,
    ctaHierarchy,
    geographicStrategy,
    trustProofRequirements: unique([
      ...base.trustProofRequirements,
      webGrowthIntent ? "Search-performance baselines and improvement reporting" : "",
      webGrowthIntent ? "Service-territory validation and location coverage evidence" : "",
    ]),
    reason: `${base.reason} Revision instructions materially applied through structured strategy regeneration.`,
    synthesisContext: {
      ...base.synthesisContext,
      revisionInstructions,
    },
  };

  const staleTerms = [
    /\bcommercial project resource\b/i,
    /\bproject requirements\b/i,
    /\bquote-ready conversation\b/i,
    /\brequest a quote\b/i,
    /\bsubmit specifications\b/i,
    /\binstitutional procurement\b/i,
  ];
  if (removeProjectConsultancy || webGrowthIntent || rejectQuoteCentric) {
    const staleCorpus = [
      revised.positioning,
      revised.valueProposition,
      revised.geographicStrategy,
      ...revised.homepageGoals,
      ...revised.conversionPaths,
      ...revised.ctaHierarchy,
      ...revised.informationArchitecture,
      ...revised.proposedSitemap,
    ].join(" ");
    if (includesAny(staleCorpus.toLowerCase(), staleTerms)) {
      throw new Error("STRATEGY_REVISION_STALE_LANGUAGE_RETAINED:Legacy project-consultancy language remains after material revision instructions.");
    }
  }

  if (tokens.includes("retail") && tokens.includes("professional") && tokens.includes("service")) {
    revised.positioning = `${brandName} is a professional services growth partner for ${primaryAudience.toLowerCase()}, centered on consultative website and search performance outcomes.`;
    revised.valueProposition = `Shift from retail-style promotion to expert services delivery by guiding ${primaryAudience.toLowerCase()} through diagnosis, implementation, and ongoing optimization.`;
    revised.informationArchitecture = ["Home", "Services", "Process", "Industries", "About", "Contact"];
    revised.proposedSitemap = ["/", "/services", "/process", "/industries", "/about", "/contact"];
  }

  if (tokens.includes("minor") && tokens.includes("copy")) {
    revised.positioning = base.positioning;
    revised.valueProposition = base.valueProposition;
    revised.informationArchitecture = base.informationArchitecture;
    revised.proposedSitemap = base.proposedSitemap;
    revised.conversionPaths = base.conversionPaths;
    revised.ctaHierarchy = base.ctaHierarchy;
    revised.homepageGoals = base.homepageGoals;
    revised.geographicStrategy = base.geographicStrategy;
    revised.reason = `${base.reason} Revision instructions classified as minor copy refinement.`;
  }
  return revised;
}

function validateSynthesisOutput(input: { draft: StrategyDraft; data: StrategySynthesisData; context: SiteStrategySynthesisContext; revisionInstructions: string }) {
  const requiredNonEmptyListFields: Array<keyof StrategyDraft> = ["informationArchitecture", "proposedSitemap", "homepageGoals", "conversionPaths", "ctaHierarchy", "trustProofRequirements"];
  const requiredListFields: Array<keyof StrategyDraft> = ["secondaryAudiences", "majorVerticals", "proposedProductAuthority", "productServiceFamilies"];
  const requiredTextFields: Array<keyof StrategyDraft> = ["positioning", "primaryAudience", "valueProposition", "geographicStrategy", "reason"];
  for (const field of requiredTextFields) {
    const value = input.draft[field];
    if (typeof value !== "string" || !value.trim()) throw new Error(`STRATEGY_SYNTHESIS_INVALID:${String(field)}_required`);
  }
  for (const field of requiredNonEmptyListFields) {
    const value = input.draft[field];
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error(`STRATEGY_SYNTHESIS_INVALID:${String(field)}_required`);
    }
  }
  for (const field of requiredListFields) {
    const value = input.draft[field];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error(`STRATEGY_SYNTHESIS_INVALID:${String(field)}_required`);
    }
  }

  const iaToSlug: Record<string, string> = {
    Home: "/",
    Solutions: "/solutions",
    Services: "/services",
    Capabilities: "/capabilities",
    Markets: "/markets",
    Projects: "/projects",
    "How It Works": "/how-it-works",
    Process: "/process",
    Industries: "/industries",
    About: "/about",
    Contact: "/contact",
    "Request a Quote": "/request-a-quote",
  };
  for (const iaItem of input.draft.informationArchitecture) {
    const expected = iaToSlug[iaItem];
    if (!expected) continue;
    if (expected === "/") continue;
    if (!input.draft.proposedSitemap.some((path) => path === expected || path.startsWith(`${expected}/`))) {
      throw new Error(`STRATEGY_SYNTHESIS_INCONSISTENT:missing_sitemap_for_${iaItem.replace(/\s+/g, "_").toLowerCase()}`);
    }
  }

  const authoritySet = new Set(input.data.authorityNames);
  if (input.draft.productServiceFamilies.some((family) => !authoritySet.has(family))) {
    throw new Error("STRATEGY_SYNTHESIS_AUTHORITY_VIOLATION:product_service_outside_verified_authority");
  }
  const proposedSet = new Set(input.data.requiredProductAuthority);
  if (input.draft.proposedProductAuthority.some((family) => !proposedSet.has(family))) {
    throw new Error("STRATEGY_SYNTHESIS_AUTHORITY_VIOLATION:proposed_authority_scope_mismatch");
  }

  const instructions = input.revisionInstructions.toLowerCase();
  if (instructions) {
    const webGrowthIntent = includesAny(instructions, [/\bwebsite\b/, /\bsearch\b/, /\bseo\b/, /\bgrowth\b/]);
    const removeConsultancy = includesAny(instructions, [/\bnot\b.*\bconsultanc/, /\bremove\b.*\bconsultanc/, /\bdo not\b.*\bproject\b/, /\bquote\b/]);
    if (webGrowthIntent) {
      const coherenceCorpus = [input.draft.positioning, input.draft.valueProposition, ...input.draft.homepageGoals, ...input.draft.ctaHierarchy, ...input.draft.informationArchitecture].join(" ").toLowerCase();
      if (!includesAny(coherenceCorpus, [/\bwebsite\b/, /\bsearch\b/, /\bseo\b/, /\bgrowth\b/])) throw new Error("STRATEGY_SYNTHESIS_INCOMPLETE:web_growth_intent_not_reflected");
    }
    if (removeConsultancy) {
      const staleCorpus = [input.draft.positioning, input.draft.valueProposition, ...input.draft.homepageGoals, ...input.draft.ctaHierarchy, ...input.draft.conversionPaths].join(" ").toLowerCase();
      if (includesAny(staleCorpus, [/\brequest a quote\b/, /\bquote-ready\b/, /\bcommercial project resource\b/, /\bproject requirements\b/])) {
        throw new Error("STRATEGY_SYNTHESIS_STALE_LANGUAGE:legacy_project_terminology_present");
      }
    }
  }

  if (input.context.publicBrandIdentity.trim().length === 0) throw new Error("STRATEGY_SYNTHESIS_IDENTITY_INVALID:public_brand_identity_required");
}

export function synthesizeRevisedSiteStrategy(workspace: SiteIntelligenceWorkspace, context: SiteStrategySynthesisContext, options: { revisionInstructions: string }): StrategyDraft {
  const revisionInstructions = options.revisionInstructions.trim();
  if (!revisionInstructions) throw new Error("STRATEGY_REVISION_INSTRUCTIONS_REQUIRED");
  const data = collectSynthesisData(workspace, context);
  if (!data.approved.length) throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
  const base = buildBaselineDraft(workspace, context, data);
  const revised = materializeRevisedDraft(base, data, context.publicBrandIdentity.trim(), revisionInstructions);
  validateSynthesisOutput({ draft: revised, data, context, revisionInstructions });
  return revised;
}

export function synthesizeInitialSiteStrategy(workspace: SiteIntelligenceWorkspace, context: SiteStrategySynthesisContext, options: SiteStrategySynthesisOptions = {}): StrategyDraft {
  if (workspace.intelligenceState !== "INTELLIGENCE_APPROVED") throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
  const data = collectSynthesisData(workspace, context);
  if (!data.approved.length) throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
  const revisionInstructions = options.revisionInstructions?.trim() ?? "";
  const draft = buildBaselineDraft(workspace, context, data);
  if (!revisionInstructions) return draft;
  return synthesizeRevisedSiteStrategy(workspace, context, { revisionInstructions });
}
