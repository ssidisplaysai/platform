import type { SiteConfiguration } from "./types";
import type { SiteIntelligenceWorkspace } from "./site-intelligence";
import type { SiteProductServiceAuthority } from "./site-product-authority-repository";
import { isCapabilityReviewComplete, selectDistinctCapabilityOpportunities } from "./site-capability-transition";

export type WorkflowStageStatus = "COMPLETE" | "APPROVED" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "NOT_STARTED" | "BLOCKED" | "DISABLED";
export type SiteWorkflowStage = { key: "connection" | "intelligence" | "capability" | "strategy" | "creative" | "product_authority" | "generation_readiness" | "site_build" | "publication"; label: string; status: WorkflowStageStatus; detail: string };
export type SiteResumeAction = { key: "CONTINUE_SITE_ONBOARDING" | "CONTINUE_SITE_INTELLIGENCE" | "CONTINUE_CAPABILITY_REVIEW" | "REVIEW_STRATEGY" | "CONTINUE_CREATIVE_DIRECTION" | "CONTINUE_PRODUCT_SERVICE_AUTHORITY" | "CONTINUE_GENERATION_READINESS" | "CONTINUE_SITE_BUILD" | "SHOW_PUBLICATION_BLOCKERS"; title: string; description: string; label: string; href: string };
export type ProductAuthorityProgress = { proposed: number; approved: number; remaining: number; protectedBlockers: string[]; candidates: Array<Pick<SiteProductServiceAuthority, "decision" | "displayName" | "protectedClaimBlockers" | "authorityBasis">> };
export type SiteWorkflowResume = { stages: SiteWorkflowStage[]; primaryAction: SiteResumeAction; blockers: string[]; productAuthority: ProductAuthorityProgress };

function scoped(path: string, site: SiteConfiguration): string {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`;
}

export function resolveSiteWorkflowResume(input: { site: SiteConfiguration; intelligence: SiteIntelligenceWorkspace | null; productAuthority: ProductAuthorityProgress; generationReadiness: { ready: boolean; blockers: string[] } }): SiteWorkflowResume {
  const { site, intelligence, productAuthority, generationReadiness } = input;
  const connectionComplete = site.onboarding?.status === "connected" || site.onboarding?.status === "certified";
  const intelligenceComplete = intelligence?.intelligenceState === "INTELLIGENCE_APPROVED";
  const distinctCapabilities = intelligence ? selectDistinctCapabilityOpportunities(intelligence.opportunities) : [];
  const capabilityComplete = distinctCapabilities.length > 0 && distinctCapabilities.every(isCapabilityReviewComplete);
  const strategy = intelligence?.strategyRevisions.at(-1) ?? null;
  const strategyApproved = intelligence?.strategyState === "STRATEGY_APPROVED" && strategy?.status === "APPROVED";
  const strategyReady = strategy?.status === "PROPOSED" || intelligence?.strategyState === "STRATEGY_READY_FOR_REVIEW";
  const creative = intelligence?.creativeRevisions.at(-1) ?? null;
  const creativeApproved = intelligence?.creativeState === "CREATIVE_APPROVED" && creative?.status === "APPROVED";
  const creativeReady = creative?.status === "PROPOSED" || intelligence?.creativeState === "CREATIVE_READY_FOR_REVIEW";
  const productComplete = productAuthority.proposed > 0 && productAuthority.approved > 0 && productAuthority.remaining === 0 && productAuthority.protectedBlockers.length === 0;
  const publicationDisabled = !site.enabled || site.publishingStatus === "disabled";
  const generationBlockers = generationReadiness.ready ? [] : generationReadiness.blockers.length ? generationReadiness.blockers : ["Generation readiness requirements are not complete."];

  const stages: SiteWorkflowStage[] = [
    { key: "connection", label: "Connection", status: connectionComplete ? "COMPLETE" : "IN_PROGRESS", detail: connectionComplete ? "Site connection and onboarding are established." : "Complete the bounded site connection workflow." },
    { key: "intelligence", label: "Site Intelligence", status: intelligenceComplete ? "COMPLETE" : intelligence ? "IN_PROGRESS" : "NOT_STARTED", detail: intelligenceComplete ? "Research and market review are approved." : "Complete Site Intelligence review." },
    { key: "capability", label: "Capability Authority", status: capabilityComplete ? "COMPLETE" : distinctCapabilities.length ? "IN_PROGRESS" : "NOT_STARTED", detail: capabilityComplete ? `${distinctCapabilities.length} distinct capability decisions are complete.` : `${Math.max(0, distinctCapabilities.length - distinctCapabilities.filter(isCapabilityReviewComplete).length)} capability decisions remain.` },
    { key: "strategy", label: "Strategy", status: strategyApproved ? "APPROVED" : strategyReady ? "READY_FOR_REVIEW" : strategy ? "IN_PROGRESS" : "NOT_STARTED", detail: strategyApproved ? `Revision ${strategy!.revision} is approved.` : strategyReady ? `Revision ${strategy?.revision ?? "current"} awaits owner review.` : "Strategy has not been approved." },
    { key: "creative", label: "Creative Direction", status: creativeApproved ? "APPROVED" : creativeReady ? "READY_FOR_REVIEW" : creative ? "IN_PROGRESS" : "NOT_STARTED", detail: creativeApproved ? `Revision ${creative!.revision} is approved.` : creativeReady ? `Revision ${creative?.revision ?? "current"} awaits owner review.` : "Creative Direction is not approved." },
    { key: "product_authority", label: "Product / Service Authority", status: productComplete ? "COMPLETE" : productAuthority.proposed ? "IN_PROGRESS" : "NOT_STARTED", detail: `${productAuthority.proposed} proposed · ${productAuthority.approved} approved · ${productAuthority.remaining} awaiting decision.` },
    { key: "generation_readiness", label: "Generation Readiness", status: productComplete ? generationReadiness.ready ? "COMPLETE" : "NOT_STARTED" : "BLOCKED", detail: productComplete ? generationReadiness.ready ? "Canonical generation prerequisites are complete." : "Product/service authority is complete; review generation prerequisites next." : "Complete Product / Service Authority first." },
    { key: "site_build", label: "Site Build", status: "NOT_STARTED", detail: "No site build has been started from this workflow." },
    { key: "publication", label: "Publication", status: publicationDisabled ? "DISABLED" : site.publishingStatus === "ready" ? "NOT_STARTED" : "BLOCKED", detail: publicationDisabled ? "Publication is disabled." : `Publication status is ${site.publishingStatus.replaceAll("_", " ")}.` },
  ];

  let primaryAction: SiteResumeAction;
  if (!connectionComplete) primaryAction = { key: "CONTINUE_SITE_ONBOARDING", title: "Site Onboarding", description: "Complete the site connection and onboarding requirements.", label: "CONTINUE SITE ONBOARDING", href: scoped(`/sites/${site.siteId}/onboarding`, site) };
  else if (!intelligenceComplete) primaryAction = { key: "CONTINUE_SITE_INTELLIGENCE", title: "Site Intelligence", description: "Complete research and market opportunity review.", label: "CONTINUE SITE INTELLIGENCE", href: scoped(`/sites/${site.siteId}/intelligence`, site) };
  else if (!capabilityComplete) primaryAction = { key: "CONTINUE_CAPABILITY_REVIEW", title: "Capability Authority", description: "Finish the remaining capability authority decisions.", label: "CONTINUE CAPABILITY REVIEW", href: `${scoped(`/sites/${site.siteId}/intelligence`, site)}#capability-review` };
  else if (!strategyApproved) primaryAction = { key: "REVIEW_STRATEGY", title: "Strategy Review", description: strategyReady ? "Review and explicitly decide the current strategy revision." : "Generate the strategy proposal from finalized authority.", label: strategyReady ? "REVIEW STRATEGY" : "CONTINUE SITE STRATEGY", href: `${scoped(`/sites/${site.siteId}/intelligence`, site)}#strategy-review` };
  else if (!creativeApproved) primaryAction = { key: "CONTINUE_CREATIVE_DIRECTION", title: "Creative Direction", description: creativeReady ? "Review and explicitly decide the current Creative Direction revision." : "Generate Creative Direction from approved strategy and references.", label: creativeReady ? "REVIEW CREATIVE DIRECTION" : "CONTINUE CREATIVE DIRECTION", href: `${scoped(`/sites/${site.siteId}/intelligence`, site)}#creative-direction` };
  else if (!productComplete) primaryAction = { key: "CONTINUE_PRODUCT_SERVICE_AUTHORITY", title: "Product / Service Authority", description: productAuthority.remaining ? `Confirm ${productAuthority.remaining} remaining offerings and establish the sources Genesis may trust.` : productAuthority.approved === 0 ? "Approve at least one offering before Genesis can prepare generation grounding." : "Resolve protected fact requirements before generation.", label: "CONTINUE PRODUCT / SERVICE AUTHORITY", href: scoped(`/products/new?source=manual`, site) };
  else if (!generationReadiness.ready) primaryAction = { key: "CONTINUE_GENERATION_READINESS", title: "Generation Readiness", description: "Review the remaining technical and publication prerequisites before starting a site build.", label: "CONTINUE TO GENERATION READINESS", href: "#generation-readiness" };
  else primaryAction = { key: "CONTINUE_SITE_BUILD", title: "Site Build", description: "Authority and technical prerequisites are ready for the next bounded build stage.", label: "CONTINUE SITE BUILD", href: "#site-build" };

  const blockers = [...productAuthority.protectedBlockers, ...(productComplete ? generationBlockers : productAuthority.remaining ? [`${productAuthority.remaining} product/service decisions still required.`] : productAuthority.approved === 0 ? ["At least one product or service must be approved for this site."] : [])];
  return { stages, primaryAction, blockers, productAuthority };
}