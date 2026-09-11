import "server-only";

import type { CreativeInput, SiteIntelligenceWorkspace, SiteStrategyProposal } from "./site-intelligence";
import type { IntegrationProfileConfiguration } from "./types";

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
  const verticals = unique(approved.map((opportunity) => opportunity.category));
  const buyers = unique(approved.map((opportunity) => opportunity.buyer));
  const authorityNames = unique(presentAuthority.map((opportunity) => opportunity.name));
  const marketNames = unique(approved.map((opportunity) => opportunity.name));
  const evidenceIds = unique(approved.flatMap((opportunity) => opportunity.evidenceIds));
  const evidenceClaims = workspace.evidence.filter((item) => evidenceIds.includes(item.evidenceId)).map((item) => item.observedClaim);
  const referenceGuidance = workspace.creativeInputs.flatMap((input) => input.notes ? [`${input.sentiment === "LIKE" ? "Favor" : input.sentiment === "DISLIKE" ? "Avoid" : "Reference"}: ${input.notes}`] : []);
  const profileContext = unique([...profileGuidance(context.brandProfile), ...profileGuidance(context.seoProfile), ...profileGuidance(context.promptProfile)]);
  const audience = buyers[0] ?? "Commercial buyers identified in approved intelligence";
  const brandName = context.publicBrandIdentity.trim();
  const marketFocus = verticals.slice(0, 3).join(", ") || "commercial stainless fabrication markets";
  const geographicScopes = unique(approved.map((opportunity) => opportunity.geographicScope).filter((scope) => scope.toLowerCase() !== "unknown"));
  return {
    positioning: `${brandName} will position ${context.domain} as a focused resource for ${audience} evaluating ${marketFocus}.`,
    primaryAudience: audience,
    secondaryAudiences: buyers.slice(1),
    valueProposition: authorityNames.length ? `Connect ${audience} with ${authorityNames.join(", ")} through clear specifications, relevant project proof, and direct quote paths.` : `Help ${audience} compare project approaches, specifications, and fit across ${marketFocus}, with direct paths to discuss requirements.`,
    majorVerticals: verticals,
    productServiceFamilies: authorityNames,
    informationArchitecture: ["Home", "Capabilities", "Markets", "Projects", "About", "Request a Quote"],
    proposedSitemap: unique(["/", "/capabilities", ...verticals.map((vertical) => `/markets/${vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`), "/projects", "/about", "/request-a-quote"]),
    homepageGoals: unique(["Explain the primary market focus", "Present relevant project and fabrication proof", "Help buyers navigate by application and project need", "Drive qualified quote requests", ...referenceGuidance.filter((item) => item.startsWith("Favor:")).map((item) => item.slice(7))]),
    conversionPaths: ["Market or capability page to request-a-quote", "Project proof to contact", "Capability validation content to consultation"],
    ctaHierarchy: ["Request a Quote", "Discuss Your Project", "Review Capabilities"],
    trustProofRequirements: unique(["Relevant completed-project photography", "Material and fabrication specifications", "Customer or project examples", "Clear service-area and fulfillment details", ...referenceGuidance.filter((item) => item.startsWith("Reference:")).map((item) => item.slice(10))]),
    geographicStrategy: geographicScopes.length ? `Prioritize ${geographicScopes.join(", ")} with location-specific proof and clear fulfillment expectations.` : "Lead with the primary service region and expand geographic pages only where project evidence supports buyer relevance.",
    proposedProductAuthority: authorityNames,
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
    },
  };
}
