import "server-only";

import { getCapabilityAuthorityAssurance, isPublishableSiteAsset, type CreativeDirectionProposal, type SiteIntelligenceWorkspace } from "./site-intelligence";
import { selectDistinctCapabilityOpportunities } from "./site-capability-transition";

type CreativeDraft = Omit<CreativeDirectionProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt">;

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function synthesizeCreativeDirection(workspace: SiteIntelligenceWorkspace, ownerInstruction = ""): CreativeDraft {
  const strategy = workspace.strategyRevisions.at(-1);
  if (!strategy || strategy.status !== "APPROVED" || workspace.strategyState !== "STRATEGY_APPROVED") throw new Error("APPROVED_STRATEGY_REQUIRED");
  const opportunities = selectDistinctCapabilityOpportunities(workspace.opportunities);
  const currentNames = opportunities.filter((item) => ["OWNER_ATTESTED", "EVIDENCE_VERIFIED"].includes(getCapabilityAuthorityAssurance(item))).map((item) => item.name);
  const excludedNames = opportunities.filter((item) => item.capabilityState === "FUTURE_CAPABILITY" || item.capabilityState === "REJECTED").map((item) => item.name);
  const references = workspace.creativeInputs.filter((input) => input.classification !== "REJECTED");
  const ownerReferences = references.filter((input) => input.classification === "OWNER_SUPPLIED_REFERENCE" || input.classification === "OWNER_APPROVED_PUBLISHABLE");
  const externalReferences = references.filter((input) => input.classification === "EXTERNAL_INSPIRATION_ONLY" || input.classification === "COMPETITOR_REFERENCE_ONLY");
  const preferenceNotes = ownerReferences.filter((input) => input.notes).map((input) => `${input.sentiment}: ${input.notes}`);
  const publishableReferences = references.filter((input) => isPublishableSiteAsset(input.classification));
  const brand = workspace.publicBrandIdentity;
  const markets = strategy.majorVerticals.slice(0, 4);
  const families = strategy.productServiceFamilies.slice(0, 6);
  const instruction = ownerInstruction.trim();

  return {
    strategyRevision: strategy.revision,
    overallDirection: `A precise, premium industrial presentation for ${brand}, organized around commercial project confidence, clear fabrication authority, and efficient quote intake.`,
    brandInterpretation: `Use ${brand} as the visible public identity. Treat all visual references as inspiration for hierarchy and tone, never as factual or brand authority.`,
    colorDirection: "Use a restrained neutral foundation with stainless-steel grays, high-contrast typography, and one controlled action accent. This is a recommendation, not a claim about established brand colors.",
    typographyDirection: "Use a durable commercial sans-serif system with compact headings, highly legible specification copy, and clear numeric/detail hierarchy. This is a recommended system unless authoritative brand typography is supplied.",
    spacingLayoutDirection: "Use a disciplined responsive grid, generous separation between proof and sales content, scannable product and market navigation, and repeated quote-intake paths without decorative clutter.",
    photographyStyle: "Prioritize owner-approved imagery of fabrication, stainless materials, details, scale, completed work, and real commercial applications. Reference-only imagery may guide composition but must never be published.",
    generatedImageStyle: "Any generated candidates should depict generic commercial stainless environments without client logos, named projects, certifications, or unsupported service claims, and remain unpublishable until owner approval.",
    heroTreatment: `Lead with ${brand}, the approved positioning, a clear commercial stainless application image, and the primary quote CTA.`,
    ctaTreatment: strategy.ctaHierarchy.join(" -> ") || "Request a Quote -> Discuss Your Project",
    trustProofPresentation: "Separate verified owner authority from proof still needed. Use specifications, fabrication examples, and project evidence only when their provenance and publishability permit it.",
    productPresentation: families.length ? `Present approved families as concise navigational groups: ${families.join("; ")}.` : "Hold product/service family presentation until canonical product authority is established.",
    verticalPresentation: markets.length ? `Present approved markets as buyer-oriented pathways: ${markets.join("; ")}. Do not turn market interest into unsupported current capability claims.` : "Use application-led navigation only where approved market priorities exist.",
    mobileConsiderations: "Keep category navigation, proof, and quote actions thumb-accessible; preserve image context; avoid dense specification tables above the primary CTA.",
    visualDos: unique([`Use ${brand} identity consistently`, "Use approved strategy hierarchy and CTA priorities", "Show fabrication detail and commercial credibility", ...preferenceNotes.map((note) => `Honor owner preference: ${note}`), instruction ? `Consider owner instruction as internal creative guidance, subject to authority: ${instruction}` : ""]),
    visualDonts: unique(["Do not copy competitor wording, branding, layouts, logos, clients, or projects", "Do not publish reference-only or competitor assets", "Do not imply a partner network, certification, geography, or capability beyond current authority", "Do not present future or rejected capabilities as current", ...excludedNames.map((name) => `Do not present as current capability: ${name}`)]),
    homepageBlueprint: unique(["Hero: approved positioning and primary quote action", families.length ? "Core product and service categories" : "Approved capability overview", markets.length ? "Markets served within approved authority" : "Commercial applications", `Why ${brand}: fabrication authority and proof`, "Featured capabilities and solutions", "Custom fabrication process", "Commercial project and application imagery", "Approved geographic and service positioning", "Quote and project intake", "Supporting trust and proof", "Footer"]),
    imagePlan: [
      { requirementId: "creative-homepage-hero", pageSection: "Hero", desiredSubject: "Commercial stainless fabrication or completed application with clear material detail", aspectOrientation: "landscape", purpose: "Establish industrial credibility and support the approved positioning", preferredSource: "Owner-approved first-party photography", approvedAssetAvailable: publishableReferences.length > 0, ownerUploadRecommended: publishableReferences.length === 0, generationCandidate: true, status: publishableReferences.length > 0 ? "APPROVED" : "OWNER_UPLOAD_OR_GENERATE_FOR_APPROVAL" },
      { requirementId: "creative-fabrication-proof", pageSection: "Fabrication authority", desiredSubject: currentNames.slice(0, 4).join(", ") || "Current fabrication capabilities", aspectOrientation: "mixed", purpose: "Support current capability presentation with attributable proof", preferredSource: "Owner-approved project, process, and detail photography", approvedAssetAvailable: publishableReferences.length > 0, ownerUploadRecommended: true, generationCandidate: false, status: publishableReferences.length > 0 ? "APPROVED" : "NEEDED" },
    ],
    reason: `Synthesized from approved strategy revision ${strategy.revision}, ${opportunities.length} distinct capability decisions, ${ownerReferences.length} owner creative references, and ${externalReferences.length} external inspiration references. References informed creative direction only; ${publishableReferences.length} were independently publishable.${instruction ? ` Owner instruction: ${instruction}` : ""}`,
  };
}