import "server-only";

import type { CreativeInput, SiteIntelligenceWorkspace, SiteStrategyProposal } from "./site-intelligence";
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

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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

export function synthesizeInitialSiteStrategy(workspace: SiteIntelligenceWorkspace, context: SiteStrategySynthesisContext): StrategyDraft {
  if (workspace.intelligenceState !== "INTELLIGENCE_APPROVED") throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
  const approved = workspace.opportunities.filter((opportunity) => opportunity.ownerDecision === "APPROVED");
  if (!approved.length) throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
  const presentAuthority = approved.filter((opportunity) => opportunity.capabilityState === "VERIFIED" || opportunity.capabilityState === "QUALIFIED");
  const unverified = approved.filter((opportunity) => opportunity.capabilityState === "OWNER_VALIDATION_REQUIRED" || opportunity.capabilityState === "INSUFFICIENT");
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
  const proofRequirements = unique([...classifications.flatMap((item) => item.proofRequirements), "Relevant completed-project photography", "Material and fabrication specifications", "Customer or project examples"]);
  const marketNames = unique(approved.map((opportunity) => opportunity.name));
  const evidenceIds = unique(approved.flatMap((opportunity) => opportunity.evidenceIds));
  const evidenceClaims = workspace.evidence.filter((item) => evidenceIds.includes(item.evidenceId)).map((item) => item.observedClaim);
  const referenceGuidance = workspace.creativeInputs.flatMap((input) => input.notes ? [`${input.sentiment === "LIKE" ? "Favor" : input.sentiment === "DISLIKE" ? "Avoid" : "Reference"}: ${input.notes}`] : []);
  const profileContext = unique([...profileGuidance(context.brandProfile), ...profileGuidance(context.seoProfile), ...profileGuidance(context.promptProfile)]);
  const audience = buyers[0] ?? "Commercial project buyers";
  const brandName = context.publicBrandIdentity.trim();
  const marketFocus = verticals.slice(0, 3).join(", ") || "commercial and institutional project environments";
  const brandDescription = context.brandProfile.description?.split(/\s+for\s+/i).at(-1)?.replace(/\.$/, "") ?? "";
  const brandFocus = unique(brandDescription.split(/,|\band related\b/i).filter((value) => /stainless|counter|fabrication/i.test(value))).slice(0, 3).join(", ") || "commercial stainless projects";
  const opportunityPrioritization = [...approved].sort((left, right) => {
    const value = { HIGH: 3, MODERATE: 2, LOW: 1, UNKNOWN: 0 };
    return value[right.commercialValue] - value[left.commercialValue] || right.confidence - left.confidence;
  }).map((opportunity) => opportunity.name);
  return {
    positioning: `${brandName} is a commercial project resource for ${audience.toLowerCase()} planning stainless solutions across ${marketFocus.toLowerCase()}.`,
    primaryAudience: audience,
    secondaryAudiences: buyers.slice(1),
    valueProposition: `Help ${audience.toLowerCase()} turn project requirements into clear specifications, relevant proof, and a quote-ready conversation for ${brandFocus}.`,
    majorVerticals: verticals,
    productServiceFamilies: authorityNames,
    informationArchitecture: ["Home", "Capabilities", "Markets", "Projects", "About", "Request a Quote"],
    proposedSitemap: unique(["/", "/capabilities", ...verticals.map((vertical) => `/markets/${vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`), "/projects", "/about", "/request-a-quote"]),
    homepageGoals: unique(["Explain the primary market focus", "Present relevant project and fabrication proof", "Help buyers navigate by application and project need", "Drive qualified quote requests", ...referenceGuidance.filter((item) => item.startsWith("Favor:")).map((item) => item.slice(7))]),
    conversionPaths: unique(["Market and application content to request-a-quote", "Project proof to project consultation", ...salesChannels.map((channel) => `${channel} resources to specification and quote intake`)]),
    ctaHierarchy: ["Request a Quote", "Discuss Your Project", salesChannels.length ? "Submit Specifications" : "Review Project Requirements"],
    trustProofRequirements: unique([...proofRequirements, "Clear fulfillment and service-area details", ...referenceGuidance.filter((item) => item.startsWith("Reference:")).map((item) => item.slice(10))]),
    geographicStrategy: `Build nationwide United States demand capture and quote-intake coverage. Treat ${expansionGeographies.length ? expansionGeographies.join(", ") : "specific researched regions"} as research-led expansion or location-SEO opportunities until service scope is explicitly established.`,
    proposedProductAuthority: requiredProductAuthority,
    reason: `Synthesized from ${approved.length} approved opportunities, ${workspace.evidence.length} evidence records, and ${preferenceSummary(workspace.creativeInputs)} Market priorities: ${marketNames.join("; ")}.`,
    synthesisContext: {
      approvedOpportunityIds: approved.map((opportunity) => opportunity.opportunityId),
      capabilityAuthorityOpportunityIds: presentAuthority.map((opportunity) => opportunity.opportunityId),
      pendingCapabilityOpportunityIds: unverified.map((opportunity) => opportunity.opportunityId),
      futureCapabilityOpportunityIds: future.map((opportunity) => opportunity.opportunityId),
      excludedOpportunityIds: workspace.opportunities.filter((opportunity) => opportunity.ownerDecision !== "APPROVED").map((opportunity) => opportunity.opportunityId),
      evidenceIds,
      referenceInputIds: workspace.creativeInputs.map((input) => input.inputId),
      profileIds: [context.brandProfile.profileId, context.seoProfile.profileId, context.promptProfile.profileId],
      evidenceClaims,
      referenceGuidance,
      profileGuidance: profileContext,
      semanticClassifications: classifications,
      opportunityPrioritization,
      salesChannels,
      currentServiceGeographies: unique(classifications.filter((item) => item.capabilityAuthority === "CURRENT" && item.roles.includes("CAPABILITY")).flatMap((item) => item.researchedGeographies)),
      targetExpansionGeographies: expansionGeographies,
      researchedDemandGeographies: researchedGeographies,
      locationSeoOpportunities,
    },
  };
}
