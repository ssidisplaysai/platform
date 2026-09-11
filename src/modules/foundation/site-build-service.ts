import "server-only";

import { randomUUID } from "node:crypto";
import { synthesizeSiteBuildPlan } from "./site-build-plan";
import { createAuthenticatedWordPressReadAuthority } from "./authenticated-wordpress-read-authority";
import { SITE_PAGE_GENERATION_POLICY_VERSION, synthesizeSiteAssembly } from "./site-page-generation";
import type { GenerationAuthoritySnapshot } from "./site-generation-readiness";
import { getSiteGenerationReadiness } from "./site-generation-readiness-service";
import { approveAllReadySiteAssemblyPages, approveSiteBuildDrafts, decideBuildPlan, decideSiteAssemblyPage, generateSiteBuildDrafts, getSiteBuildRecords, recordSiteBuildWordPressContentUpdate, recordSiteBuildWordPressDraft, replaceSiteAssemblyPageRevision, saveBuildPlanProposal, saveRevisedBuildPlan, saveSiteAssemblyProposal } from "./site-generation-readiness-repository";
import { getSiteIntelligenceWorkspace } from "./site-intelligence-repository";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "./wordpress-draft-writer";
import { decideSitePageImageCandidate, listSitePageImageCandidates, saveSitePageImageCandidate } from "./site-page-image-candidate-repository";
import { generateGenesisFeaturedImage } from "@/modules/glw/generated-image-service";
import { areRequiredPageImagesApproved } from "./site-page-image-review";
import { resolveSitePageImageRequirement } from "./site-page-image-resolution";

export type SiteBuildStage = "BUILD_NOT_STARTED" | "BUILD_PLAN" | "BUILD_PLAN_REVIEW" | "DRAFT_GENERATION" | "DRAFT_REVIEW" | "WORDPRESS_DRAFTS" | "PAGE_GENERATION" | "PAGE_REVIEW" | "WORDPRESS_CONTENT_UPDATE" | "COMPLETE" | "AUTHORITY_REVIEW_REQUIRED";

export function isSiteBuildSnapshotCurrent(left: GenerationAuthoritySnapshot, right: GenerationAuthoritySnapshot): boolean {
  return left.strategyRevision === right.strategyRevision && left.creativeRevision === right.creativeRevision && left.marketFingerprint === right.marketFingerprint && left.capabilityFingerprint === right.capabilityFingerprint && left.productServiceFingerprint === right.productServiceFingerprint && left.sourcesFingerprint === right.sourcesFingerprint && left.generationPolicyVersion === right.generationPolicyVersion;
}

export function getSiteBuildWorkspace(site: SiteConfiguration) {
  const generation = getSiteGenerationReadiness(site);
  const session = generation.buildSession;
  const records = session ? getSiteBuildRecords({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : { plans: [], changeRequests: [], currentPlan: null, draftSet: null, wordpressDrafts: [], assemblies: [], currentAssembly: null, wordpressContentUpdates: [] };
  const imageCandidates = session ? listSitePageImageCandidates({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : [];
  const stale = generation.certification.status !== "CURRENT" || Boolean(records.currentPlan && !isSiteBuildSnapshotCurrent(records.currentPlan.authoritySnapshot, generation.readiness.snapshot)) || Boolean(records.draftSet && !isSiteBuildSnapshotCurrent(records.draftSet.authoritySnapshot, generation.readiness.snapshot));
  let stage: SiteBuildStage;
  if (!session) stage = "BUILD_NOT_STARTED";
  else if (stale) stage = "AUTHORITY_REVIEW_REQUIRED";
  else if (!records.currentPlan || records.currentPlan.status === "REJECTED") stage = "BUILD_PLAN";
  else if (records.currentPlan.status === "PROPOSED") stage = "BUILD_PLAN_REVIEW";
  else if (records.currentPlan.status !== "APPROVED" || !records.draftSet) stage = "DRAFT_GENERATION";
  else if (records.draftSet.status === "GENERATED") stage = "DRAFT_REVIEW";
  else if (records.wordpressDrafts.length < records.draftSet.drafts.length) stage = "WORDPRESS_DRAFTS";
  else if (!records.currentAssembly) stage = "PAGE_GENERATION";
  else if (records.currentAssembly.status !== "APPROVED") stage = "PAGE_REVIEW";
  else if (records.wordpressContentUpdates.length < records.currentAssembly.pages.length) stage = "WORDPRESS_CONTENT_UPDATE";
  else stage = "COMPLETE";
  const next = {
    BUILD_NOT_STARTED: { action: "START_SITE_BUILD", label: "START SITE BUILD", detail: "Start one durable bounded build session." },
    BUILD_PLAN: { action: "GENERATE_BUILD_PLAN", label: "GENERATE BUILD PLAN", detail: "Create a proposal from current approved authority. This does not approve pages or contact WordPress." },
    BUILD_PLAN_REVIEW: { action: "APPROVE_BUILD_PLAN", label: "APPROVE BUILD PLAN", detail: "Approve the proposed site structure before any page drafts are generated." },
    DRAFT_GENERATION: { action: "GENERATE_SITE_DRAFTS", label: "GENERATE SITE DRAFTS", detail: "Generate local review drafts from the approved plan. WordPress is not contacted." },
    DRAFT_REVIEW: { action: "APPROVE_SITE_DRAFTS", label: "APPROVE SITE DRAFTS", detail: "Approve the local drafts before any WordPress draft is created." },
    WORDPRESS_DRAFTS: { action: "CREATE_WORDPRESS_DRAFTS", label: "CREATE WORDPRESS DRAFTS", detail: "Create draft-only WordPress pages after authoritative collision checks. Publication remains disabled." },
    PAGE_GENERATION: { action: "GENERATE_FULL_SITE", label: "GENERATE FULL PAGE CONTENT", detail: "Generate production-quality page proposals, SEO, links, navigation, and image requirements locally. WordPress is not updated." },
    PAGE_REVIEW: { action: "REVIEW_FULL_SITE", label: "REVIEW GENERATED SITE", detail: "Review each generated page, request bounded changes, or approve pages that pass quality checks." },
    WORDPRESS_CONTENT_UPDATE: { action: "UPDATE_WORDPRESS_DRAFT_CONTENT", label: "UPDATE WORDPRESS DRAFT CONTENT", detail: "Update the exact existing WordPress drafts only after all generated pages are owner approved." },
    COMPLETE: { action: "REVIEW_WORDPRESS_DRAFTS", label: "REVIEW WORDPRESS DRAFTS", detail: "Review the created drafts in WordPress. Publication remains a separate gate." },
    AUTHORITY_REVIEW_REQUIRED: { action: "REVIEW_GENERATION_READINESS", label: "REVIEW GENERATION READINESS", detail: "Material upstream authority changed. Recertify before continuing this build." },
  }[stage];
  return { site: { organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }, generation, session, ...records, imageCandidates, stale, stage, next, publication: { state: site.publishingStatus, enabled: site.enabled } };
}

function planningContext(site: SiteConfiguration) {
  const workspace = getSiteBuildWorkspace(site);
  if (!workspace.session || workspace.stale) throw new Error("CURRENT_BUILD_AUTHORITY_REQUIRED");
  const intelligence = getSiteIntelligenceWorkspace(site.siteId);
  const strategy = intelligence?.strategyRevisions.at(-1);
  const creative = intelligence?.creativeRevisions.at(-1);
  if (!intelligence || !strategy || !creative) throw new Error("APPROVED_BUILD_DIRECTION_REQUIRED");
  return { workspace, intelligence, strategy, creative };
}

export function generateBuildPlan(site: SiteConfiguration, actor: string) {
  const context = planningContext(site);
  if (context.workspace.currentPlan?.status === "PROPOSED") return context.workspace.currentPlan;
  const proposal = synthesizeSiteBuildPlan({ buildSessionId: context.workspace.session.buildSessionId, site, intelligence: context.intelligence, strategy: context.strategy, creative: context.creative, candidates: context.workspace.generation.authority.candidates, sources: context.workspace.generation.authority.sources, authoritySnapshot: context.workspace.generation.readiness.snapshot, revision: (context.workspace.currentPlan?.revision ?? 0) + 1, actor });
  return saveBuildPlanProposal(proposal);
}

export function reviseBuildPlan(site: SiteConfiguration, actor: string, instructions: string) {
  const context = planningContext(site); const current = context.workspace.currentPlan;
  if (!current || current.status !== "PROPOSED") throw new Error("BUILD_PLAN_NOT_PROPOSED");
  const requestedAt = new Date().toISOString();
  const changeRequest = { changeRequestId: `build-plan-change-${randomUUID()}`, buildSessionId: context.workspace.session.buildSessionId, organizationId: site.organizationId, siteId: site.siteId, fromRevision: current.revision, requestedBy: actor, requestedAt, instructions: instructions.trim(), authoritySnapshot: context.workspace.generation.readiness.snapshot };
  const proposal = synthesizeSiteBuildPlan({ buildSessionId: context.workspace.session.buildSessionId, site, intelligence: context.intelligence, strategy: context.strategy, creative: context.creative, candidates: context.workspace.generation.authority.candidates, sources: context.workspace.generation.authority.sources, authoritySnapshot: context.workspace.generation.readiness.snapshot, revision: current.revision + 1, ownerInstructions: instructions, priorPlan: current, changeRequest, actor, now: requestedAt });
  return saveRevisedBuildPlan({ currentRevision: current.revision, proposal, changeRequest, actor });
}

export function approveBuildPlan(site: SiteConfiguration, actor: string, reason: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || workspace.stale || !workspace.currentPlan) throw new Error("CURRENT_BUILD_PLAN_REQUIRED"); return decideBuildPlan({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, revision: workspace.currentPlan.revision, decision: "APPROVE", actor, reason }); }
export function rejectBuildPlan(site: SiteConfiguration, actor: string, reason: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentPlan) throw new Error("CURRENT_BUILD_PLAN_REQUIRED"); return decideBuildPlan({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, revision: workspace.currentPlan.revision, decision: "REJECT", actor, reason }); }
export function generateBuildDrafts(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); if (workspace.stale || !workspace.currentPlan) throw new Error("CURRENT_APPROVED_BUILD_PLAN_REQUIRED"); return generateSiteBuildDrafts({ plan: workspace.currentPlan, actor }); }
export function approveBuildDrafts(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); if (workspace.stale || !workspace.session || !workspace.draftSet) throw new Error("CURRENT_BUILD_DRAFTS_REQUIRED"); return approveSiteBuildDrafts({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, draftSetId: workspace.draftSet.draftSetId, actor }); }

export function generateFullSiteAssembly(site: SiteConfiguration, actor: string, instructions = "") {
  const context = planningContext(site); const { workspace } = context;
  if (!workspace.currentPlan || workspace.currentPlan.status !== "APPROVED" || !workspace.draftSet || workspace.wordpressDrafts.length !== workspace.draftSet.drafts.length) throw new Error("COMPLETED_WORDPRESS_DRAFT_STAGE_REQUIRED");
  if (workspace.currentAssembly?.status === "READY_FOR_OWNER_REVIEW" && workspace.currentAssembly.policyVersion === SITE_PAGE_GENERATION_POLICY_VERSION && !instructions.trim()) return workspace.currentAssembly;
  return saveSiteAssemblyProposal(synthesizeSiteAssembly({ site, buildSessionId: workspace.session.buildSessionId, plan: workspace.currentPlan, intelligence: context.intelligence, strategy: context.strategy, creative: context.creative, candidates: workspace.generation.authority.candidates, sources: workspace.generation.authority.sources, revision: (workspace.currentAssembly?.revision ?? 0) + 1, actor, instructions }));
}

function pageImagesApproved(workspace: ReturnType<typeof getSiteBuildWorkspace>, pageId: string): boolean { const page = workspace.currentAssembly?.pages.find((item) => item.pageId === pageId); return page ? areRequiredPageImagesApproved(page, workspace.imageCandidates) : false; }

export function decideGeneratedPage(site: SiteConfiguration, actor: string, pageId: string, decision: "APPROVE" | "REQUEST_CHANGES", instructions = "") { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentAssembly || workspace.stale) throw new Error("CURRENT_SITE_ASSEMBLY_REQUIRED"); if (decision === "APPROVE" && !pageImagesApproved(workspace, pageId)) throw new Error("REQUIRED_IMAGE_REVIEW_INCOMPLETE"); return decideSiteAssemblyPage({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, assemblyId: workspace.currentAssembly.assemblyId, pageId, decision, instructions, actor }); }
export function approveAllGeneratedPages(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentAssembly || workspace.stale) throw new Error("CURRENT_SITE_ASSEMBLY_REQUIRED"); if (!workspace.currentAssembly.pages.every((page) => pageImagesApproved(workspace, page.pageId))) throw new Error("REQUIRED_IMAGE_REVIEW_INCOMPLETE"); return approveAllReadySiteAssemblyPages({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, assemblyId: workspace.currentAssembly.assemblyId, actor }); }

export function regenerateGeneratedPage(site: SiteConfiguration, actor: string, pageId: string, instructions: string) {
  const context = planningContext(site); const current = context.workspace.currentAssembly; if (!current || !instructions.trim()) throw new Error("PAGE_REGENERATION_INSTRUCTIONS_REQUIRED");
  const regenerated = synthesizeSiteAssembly({ site, buildSessionId: context.workspace.session.buildSessionId, plan: context.workspace.currentPlan!, intelligence: context.intelligence, strategy: context.strategy, creative: context.creative, candidates: context.workspace.generation.authority.candidates, sources: context.workspace.generation.authority.sources, revision: current.revision + 1, actor, instructions }); const page = regenerated.pages.find((item) => item.pageId === pageId); if (!page) throw new Error("SITE_ASSEMBLY_PAGE_NOT_FOUND");
  return replaceSiteAssemblyPageRevision({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: context.workspace.session.buildSessionId, priorAssemblyId: current.assemblyId, page, actor });
}

export type SiteBuildWordPressReadiness = {
  ready: boolean;
  credentialResolved: boolean;
  authenticated: boolean;
  collisionPreflightAvailable: boolean;
  targetCount: number;
  absentCount: number;
  existingReceiptCount: number;
  blockedTargets: Array<{ draftId: string; title: string; reason: "COLLISION" | "READ_FAILED" }>;
  publicationMutationPerformed: false;
  wordpressMutationPerformed: false;
};

function leafSlug(value: string): string { return value.trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).at(-1)?.toLowerCase() ?? ""; }

export async function inspectSiteBuildWordPressReadiness(site: SiteConfiguration): Promise<SiteBuildWordPressReadiness> {
  const workspace = getSiteBuildWorkspace(site);
  const drafts = workspace.draftSet?.status === "APPROVED" ? workspace.draftSet.drafts : [];
  const blockedTargets: SiteBuildWordPressReadiness["blockedTargets"] = [];
  let credential = null;
  try { credential = site.integrations.wordpressCredentialReference ? resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference) : null; } catch { credential = null; }
  if (!credential || !site.integrations.wordpressApiBaseUrl || !drafts.length || workspace.stale) return { ready: false, credentialResolved: Boolean(credential), authenticated: false, collisionPreflightAvailable: false, targetCount: drafts.length, absentCount: 0, existingReceiptCount: 0, blockedTargets, publicationMutationPerformed: false, wordpressMutationPerformed: false };
  const authority = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const identity = await authority.getJson({ path: "/users/me", query: new URLSearchParams({ context: "edit", _fields: "id,capabilities" }) });
  if (!identity.ok) return { ready: false, credentialResolved: true, authenticated: false, collisionPreflightAvailable: false, targetCount: drafts.length, absentCount: 0, existingReceiptCount: 0, blockedTargets, publicationMutationPerformed: false, wordpressMutationPerformed: false };
  const receipts = new Map(workspace.wordpressDrafts.map((item) => [item.draftId, item]));
  let absentCount = 0; let existingReceiptCount = 0;
  for (const draft of drafts) {
    const read = await authority.getJson({ path: "/pages", query: new URLSearchParams({ slug: leafSlug(draft.slug), context: "edit", status: "publish,draft,pending,private,future", per_page: "100", _fields: "id,slug,parent,status,link" }) });
    if (!read.ok || !Array.isArray(read.body)) { blockedTargets.push({ draftId: draft.draftId, title: draft.title, reason: "READ_FAILED" }); continue; }
    const exact = read.body.filter((item) => item && typeof item === "object" && leafSlug(String((item as { slug?: unknown }).slug ?? "")) === leafSlug(draft.slug));
    const receipt = receipts.get(draft.draftId);
    if (exact.length === 0) absentCount += 1;
    else if (exact.length === 1 && receipt && String((exact[0] as { id?: unknown }).id ?? "") === receipt.wordpressObjectId && (exact[0] as { status?: unknown }).status === "draft") existingReceiptCount += 1;
    else blockedTargets.push({ draftId: draft.draftId, title: draft.title, reason: "COLLISION" });
  }
  return { ready: blockedTargets.length === 0 && absentCount + existingReceiptCount === drafts.length, credentialResolved: true, authenticated: true, collisionPreflightAvailable: true, targetCount: drafts.length, absentCount, existingReceiptCount, blockedTargets, publicationMutationPerformed: false, wordpressMutationPerformed: false };
}

export async function createBuildWordPressDrafts(site: SiteConfiguration, writer = writeGenesisWordPressDraft) {
  const workspace = getSiteBuildWorkspace(site);
  if (workspace.stale || !workspace.session || workspace.draftSet?.status !== "APPROVED") throw new Error("APPROVED_CURRENT_BUILD_DRAFTS_REQUIRED");
  if (site.publishingStatus !== "disabled" || site.enabled) throw new Error("DRAFT_ONLY_SITE_BOUNDARY_REQUIRED");
  const existing = new Set(workspace.wordpressDrafts.map((item) => item.draftId));
  for (const draft of workspace.draftSet.drafts.filter((item) => !existing.has(item.draftId))) {
    const result = await writer({ operation: "CREATE", site, artifact: { title: draft.title, slug: draft.slug, excerpt: draft.excerpt, contentHtml: draft.contentHtml } });
    if (!result.ok) throw new Error(`WORDPRESS_DRAFT_FAILED:${draft.title}:${result.state}`);
    recordSiteBuildWordPressDraft({ buildSessionId: workspace.session.buildSessionId, draftId: draft.draftId, wordpressObjectId: result.wordpressObjectId, wordpressUrl: result.wordpressUrl, wordpressStatus: "draft", createdAt: new Date().toISOString() });
  }
  return getSiteBuildWorkspace(site).wordpressDrafts;
}

export async function updateBuildWordPressDraftContent(site: SiteConfiguration, writer = writeGenesisWordPressDraft) {
  const workspace = getSiteBuildWorkspace(site); const assembly = workspace.currentAssembly;
  if (workspace.stale || !workspace.session || assembly?.status !== "APPROVED" || !assembly.pages.every((item) => item.status === "APPROVED" && item.quality.ready)) throw new Error("APPROVED_SITE_ASSEMBLY_REQUIRED");
  if (site.publishingStatus !== "disabled" || site.enabled) throw new Error("DRAFT_ONLY_SITE_BOUNDARY_REQUIRED");
  const completed = new Set(workspace.wordpressContentUpdates.map((item) => item.pageRevisionId));
  for (const page of assembly.pages.filter((item) => !completed.has(item.pageRevisionId))) {
    const receipt = workspace.wordpressDrafts.find((item) => item.draftId === `${page.pageId}-draft`); if (!receipt) throw new Error(`WORDPRESS_DRAFT_RECEIPT_REQUIRED:${page.name}`);
    const result = await writer({ operation: "UPDATE", site, wordpressObjectId: receipt.wordpressObjectId, artifact: { title: page.name, slug: page.slug || "home", excerpt: page.metaDescription, contentHtml: page.contentHtml, seo: { focusKeyphrase: page.h1, seoTitle: page.seoTitle, metaDescription: page.metaDescription } } });
    if (!result.ok) throw new Error(`WORDPRESS_CONTENT_UPDATE_FAILED:${page.name}:${result.state}`);
    recordSiteBuildWordPressContentUpdate({ buildSessionId: workspace.session.buildSessionId, pageRevisionId: page.pageRevisionId, wordpressObjectId: result.wordpressObjectId, wordpressUrl: result.wordpressUrl, wordpressStatus: "draft", updatedAt: new Date().toISOString() });
  }
  return getSiteBuildWorkspace(site).wordpressContentUpdates;
}

export async function generatePageImageCandidate(site: SiteConfiguration, actor: string, pageId: string, slotId: string, ownerInstructions = "") {
  const context = planningContext(site); const assembly = context.workspace.currentAssembly; const page = assembly?.pages.find((item) => item.pageId === pageId); const slot = page?.imageRequirements.find((item) => item.slotId === slotId);
  if (!assembly || !page || !slot || !resolveSitePageImageRequirement(slot).generatedVisualAllowed || context.workspace.stale) throw new Error("GENERATED_IMAGE_SLOT_NOT_AVAILABLE");
  const requirement = resolveSitePageImageRequirement(slot);
  const authorityLabels = page.authority.filter((item) => item.kind === "PRODUCT_SERVICE" || item.kind === "CAPABILITY" || item.kind === "MARKET").map((item) => item.label);
  const visualBrief = `${slot.subject}. ${slot.altTextGuidance}`;
  const generationPrompt = [context.creative.overallDirection, context.creative.photographyStyle, context.creative.generatedImageStyle, context.creative.heroTreatment, `Page: ${page.h1}. Slot: ${slot.placement}. Requirement purpose: ${requirement.purpose}.`, authorityLabels.length ? `Current business context: ${authorityLabels.join("; ")}.` : "Use a generic commercial stainless fabrication context.", visualBrief, "Create an editorial or illustrative commercial website visual, not documentary evidence of a real facility, customer, workforce, fabrication process, or completed project. Communicate professional commercial stainless work, counters, work surfaces, and components where appropriate without asserting that the depicted scene belongs to the site owner.", "Show no logos, readable text, certifications, identifiable customers, unsupported machinery, unsupported facility scale, unsupported workforce, unsupported fabrication processes, client branding, or geographic markers.", ownerInstructions.trim() ? `Owner visual direction: ${ownerInstructions.trim()}` : ""].filter(Boolean).join("\n\n");
  const generated = await generateGenesisFeaturedImage({ prompt: generationPrompt, siteName: site.displayName, productTopic: page.h1 }); if (!generated.ok) throw new Error(`IMAGE_CANDIDATE_GENERATION_FAILED:${generated.state}`);
  return saveSitePageImageCandidate({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: context.workspace.session.buildSessionId, pageId, pageRevisionId: page.pageRevisionId, slotId, sourceType: "GENERATED_VISUAL", mimeType: generated.image.mimeType, bytes: generated.image.bytes, generationPrompt, visualBrief, creativeRevision: context.creative.revision, authorityReferences: page.authority.map((item) => `${item.kind}:${item.referenceId}`), ownerInstructions, actor });
}

export function decidePageImageCandidate(site: SiteConfiguration, actor: string, candidateId: string, decision: "APPROVE" | "REJECT") { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || workspace.stale) throw new Error("CURRENT_SITE_ASSEMBLY_REQUIRED"); return decideSitePageImageCandidate({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, candidateId, decision, actor }); }

export function replacePageImageWithOwnerAsset(site: SiteConfiguration, actor: string, input: { pageId: string; slotId: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer; instructions: string }) {
  const context = planningContext(site); const page = context.workspace.currentAssembly?.pages.find((item) => item.pageId === input.pageId); const slot = page?.imageRequirements.find((item) => item.slotId === input.slotId); if (!page || !slot) throw new Error("IMAGE_SLOT_NOT_FOUND");
  return saveSitePageImageCandidate({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: context.workspace.session.buildSessionId, pageId: page.pageId, pageRevisionId: page.pageRevisionId, slotId: slot.slotId, sourceType: "OWNER_ASSET", mimeType: input.mimeType, bytes: input.bytes, visualBrief: slot.subject, creativeRevision: context.creative.revision, authorityReferences: page.authority.map((item) => `${item.kind}:${item.referenceId}`), ownerInstructions: input.instructions, actor });
}