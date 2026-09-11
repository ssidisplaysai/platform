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
  const proofRequirements = unique([
    ...unverified.map((opportunity) => `Owner capability evidence required before claiming: ${opportunity.name}`),
    ...future.map((opportunity) => `Future capability only; do not present as currently offered: ${opportunity.name}`),
    ...approved.flatMap((opportunity) => opportunity.evidenceIds.map((evidenceId) => `Retain provenance for ${opportunity.name}: ${evidenceId}`)),
  ]);
  const serviceFamilies = authorityNames.length ? authorityNames : ["Capabilities pending owner verification"];
  const audience = buyers[0] ?? "Commercial buyers identified in approved intelligence";
  const brandName = context.publicBrandIdentity.trim();
  return {
    positioning: `${brandName} will organize ${context.domain} around approved market priorities while limiting present-tense capability claims to owner-verified or qualified authority.`,
    primaryAudience: audience,
    secondaryAudiences: buyers.slice(1),
    valueProposition: authorityNames.length ? `Connect ${audience} with ${authorityNames.join(", ")} supported by explicit proof and clear request-for-quote paths.` : `Help ${audience} evaluate approved market priorities while capability claims remain pending owner validation.`,
    majorVerticals: verticals,
    productServiceFamilies: serviceFamilies,
    informationArchitecture: ["Home", "Capabilities", "Markets", "Projects", "About", "Request a Quote"],
    proposedSitemap: unique(["/", "/capabilities", ...verticals.map((vertical) => `/markets/${vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`), "/projects", "/about", "/request-a-quote"]),
    homepageGoals: ["Explain the approved market focus", "Separate verified capabilities from market opportunities", "Present evidence-backed trust signals", "Drive qualified quote requests"],
    conversionPaths: ["Market or capability page to request-a-quote", "Project proof to contact", "Capability validation content to consultation"],
    ctaHierarchy: ["Request a Quote", "Discuss Your Project", "Review Capabilities"],
    trustProofRequirements: proofRequirements.length ? proofRequirements : ["Owner-approved capability evidence required before capability publication"],
    geographicStrategy: `Use approved geographic scope from opportunity evidence; do not imply coverage beyond validated authority. Primary domain: ${context.domain}.`,
    proposedProductAuthority: authorityNames,
    reason: `Synthesized from ${approved.length} approved opportunities, ${workspace.evidence.length} evidence records, ${preferenceSummary(workspace.creativeInputs)} Profiles: ${context.brandProfile.profileId}, ${context.seoProfile.profileId}, ${context.promptProfile.profileId}. Market priorities: ${marketNames.join("; ")}.`,
  };
}
