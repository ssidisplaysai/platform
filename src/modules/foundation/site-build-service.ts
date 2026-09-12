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
import { areRequiredPageImagesApproved, summarizeSitePageReview } from "./site-page-image-review";
import { resolveSitePageImageRequirement } from "./site-page-image-resolution";
import { resolveSiteBuildStage, resolveSiteBuildVisualContinuation, type SiteBuildStage } from "./site-build-stage";
import { readSitePageImageCandidateBytes } from "./site-page-image-candidate-repository";
import { attachGenesisWordPressFeaturedImage } from "./wordpress-media-writer";
import { HOME_HERO_MEDIA_TOKEN, refineCommercialStainlessHome, renderCommercialStainlessHome } from "./site-home-visual-assembly";
import { approveAllReadySiteVisualAssemblies, decideSiteVisualAssembly, listSiteVisualAssemblies, saveSiteVisualAssembly } from "./site-visual-assembly-repository";
import { writeExactWordPressDraftYoastSearch } from "./wordpress-yoast-search-writer";
import { PAGE_HERO_MEDIA_TOKEN, renderCommercialStainlessPage } from "./site-page-visual-assembly";
import { advanceSiteNavigationPublicationGate, decideSiteNavigationReview, listSiteNavigationReviews, saveSiteNavigationReview } from "./site-navigation-review-repository";
import { listSitePublicationExecutionPlans } from "./site-publication-execution-repository";

export type { SiteBuildStage } from "./site-build-stage";

export function isSiteBuildSnapshotCurrent(left: GenerationAuthoritySnapshot, right: GenerationAuthoritySnapshot): boolean {
  return left.strategyRevision === right.strategyRevision && left.creativeRevision === right.creativeRevision && left.marketFingerprint === right.marketFingerprint && left.capabilityFingerprint === right.capabilityFingerprint && left.productServiceFingerprint === right.productServiceFingerprint && left.sourcesFingerprint === right.sourcesFingerprint && left.generationPolicyVersion === right.generationPolicyVersion;
}

export function getSiteBuildWorkspace(site: SiteConfiguration) {
  const generation = getSiteGenerationReadiness(site);
  const session = generation.buildSession;
  const records = session ? getSiteBuildRecords({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : { plans: [], changeRequests: [], currentPlan: null, draftSet: null, wordpressDrafts: [], assemblies: [], currentAssembly: null, wordpressContentUpdates: [] };
  const imageCandidates = session ? listSitePageImageCandidates({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : [];
  const visualAssemblies = session ? listSiteVisualAssemblies({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : [];
  const navigationReviews = session ? listSiteNavigationReviews({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : [];
  const currentNavigationReview = navigationReviews.at(-1) ?? null;
  const publicationExecutionPlans = session ? listSitePublicationExecutionPlans({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: session.buildSessionId }) : [];
  const currentPublicationExecutionPlan = publicationExecutionPlans.at(-1) ?? null;
  const currentVisualAssemblies = [...new Map(visualAssemblies.map((item) => [item.pageId, item])).values()];
  const currentHomeVisualAssembly = records.currentAssembly ? currentVisualAssemblies.find((item) => item.pageId === records.currentAssembly?.pages.find((page) => page.pageRole === "HOME")?.pageId) ?? null : null;
  const currentVisualAssembly = currentHomeVisualAssembly;
  const pageReview = summarizeSitePageReview(records.currentAssembly, imageCandidates);
  const stale = generation.certification.status !== "CURRENT" || Boolean(records.currentPlan && !isSiteBuildSnapshotCurrent(records.currentPlan.authoritySnapshot, generation.readiness.snapshot)) || Boolean(records.draftSet && !isSiteBuildSnapshotCurrent(records.draftSet.authoritySnapshot, generation.readiness.snapshot));
  const stage: SiteBuildStage = resolveSiteBuildStage({ sessionStarted: Boolean(session), stale, planStatus: records.currentPlan?.status ?? null, draftStatus: records.draftSet?.status ?? null, expectedDraftCount: records.draftSet?.drafts.length ?? 0, wordpressDraftCount: records.wordpressDrafts.length, assemblyPresent: Boolean(records.currentAssembly), pageReviewComplete: pageReview.complete, generatedPageCount: pageReview.generatedPageCount, wordpressContentUpdateCount: records.wordpressContentUpdates.length });
  const next = {
    BUILD_NOT_STARTED: { action: "START_SITE_BUILD", label: "START SITE BUILD", detail: "Start one durable bounded build session." },
    BUILD_PLAN: { action: "GENERATE_BUILD_PLAN", label: "GENERATE BUILD PLAN", detail: "Create a proposal from current approved authority. This does not approve pages or contact WordPress." },
    BUILD_PLAN_REVIEW: { action: "APPROVE_BUILD_PLAN", label: "APPROVE BUILD PLAN", detail: "Approve the proposed site structure before any page drafts are generated." },
    DRAFT_GENERATION: { action: "GENERATE_SITE_DRAFTS", label: "GENERATE SITE DRAFTS", detail: "Generate local review drafts from the approved plan. WordPress is not contacted." },
    DRAFT_REVIEW: { action: "APPROVE_SITE_DRAFTS", label: "APPROVE SITE DRAFTS", detail: "Approve the local drafts before any WordPress draft is created." },
    WORDPRESS_DRAFTS: { action: "CREATE_WORDPRESS_DRAFTS", label: "CREATE WORDPRESS DRAFTS", detail: "Create draft-only WordPress pages after authoritative collision checks. Publication remains disabled." },
    PAGE_GENERATION: { action: "GENERATE_FULL_SITE", label: "GENERATE FULL PAGE CONTENT", detail: "Generate production-quality page proposals, SEO, links, navigation, and image requirements locally. WordPress is not updated." },
    PAGE_REVIEW: { action: "REVIEW_FULL_SITE", label: "REVIEW GENERATED SITE", detail: "Review each generated page, request bounded changes, or approve pages that pass quality checks." },
    WORDPRESS_CONTENT_UPDATE: { action: "UPDATE_WORDPRESS_DRAFT_CONTENT", label: "UPDATE WORDPRESS DRAFT CONTENT", detail: `Update the existing ${records.wordpressDrafts.length} WordPress draft pages with the owner-approved content, SEO, links, and approved images. Nothing will be published.` },
    WORDPRESS_DRAFT_REVIEW: { action: "REVIEW_WORDPRESS_DRAFTS", label: "REVIEW WORDPRESS DRAFTS", detail: `Review the ${records.wordpressDrafts.length} synchronized WordPress drafts, compare them with the approved Genesis versions, and inspect site QA. Publication remains disabled.` },
    HOME_DESIGN_REVIEW: { action: "REVIEW_DESIGNED_HOME", label: "REVIEW DESIGNED HOME", detail: "Review the rendered Home visual assembly before any design is propagated to the remaining pages." },
    SITE_VISUAL_REVIEW: { action: "REVIEW_REMAINING_DESIGNS", label: "REVIEW REMAINING DESIGNS", detail: "Review the page-specific visual assemblies before site QA or publication." },
    SITE_QA: { action: "REVIEW_SITE_QA", label: "REVIEW SITE QA", detail: "Verify the exact draft pages, media, SEO, links, and publication safeguards after design approval." },
    NAVIGATION_REVIEW: { action: "REVIEW_NAVIGATION", label: "REVIEW NAVIGATION", detail: "Review and explicitly decide the approved site architecture's header and footer navigation proposal." },
    WORDPRESS_MENU_SYNC: { action: "SYNC_WORDPRESS_MENU", label: "SYNC WORDPRESS MENU", detail: "Apply the approved navigation to WordPress through a separate explicit mutation and verification gate." },
    PUBLICATION_READINESS: { action: "REVIEW_PUBLICATION_READINESS", label: "REVIEW PUBLICATION READINESS", detail: "Verify the complete site, navigation, and publication safeguards before requesting authorization." },
    PUBLICATION_AUTHORIZATION: { action: "AUTHORIZE_PUBLICATION", label: "REVIEW PUBLICATION AUTHORIZATION", detail: "Explicit owner publication authorization remains required. Nothing is published automatically." },
    PUBLICATION_EXECUTION_REVIEW: { action: "REVIEW_PUBLICATION_EXECUTION", label: "REVIEW PUBLICATION EXECUTION", detail: "Review every exact WordPress and Genesis launch mutation before executing publication." },
    PUBLICATION_EXECUTING: { action: "RESUME_PUBLICATION_EXECUTION", label: "RESUME PUBLICATION EXECUTION", detail: "Resume only incomplete or failed publication operations from durable receipts." },
    PUBLICATION_VERIFICATION: { action: "VERIFY_PUBLICATION", label: "VERIFY PUBLICATION", detail: "Authenticate the complete WordPress and Genesis launch state before marking publication complete." },
    COMPLETE: { action: "REVIEW_WORDPRESS_DRAFTS", label: "REVIEW WORDPRESS DRAFTS", detail: "Review the created drafts in WordPress. Publication remains a separate gate." },
    AUTHORITY_REVIEW_REQUIRED: { action: "REVIEW_GENERATION_READINESS", label: "REVIEW GENERATION READINESS", detail: "Material upstream authority changed. Recertify before continuing this build." },
  }[stage];
  const remainingPageIds = records.currentAssembly?.pages.filter((page) => page.pageRole !== "HOME").map((page) => page.pageId) ?? []; const remainingVisualAssemblies = currentVisualAssemblies.filter((item) => remainingPageIds.includes(item.pageId)); const remainingVisualSummary = { expected: remainingPageIds.length, assembled: remainingVisualAssemblies.length, readyForOwnerReview: remainingVisualAssemblies.filter((item) => item.status === "READY_FOR_OWNER_REVIEW").length, approved: remainingVisualAssemblies.filter((item) => item.status === "APPROVED").length, blocked: remainingPageIds.length - remainingVisualAssemblies.length + remainingVisualAssemblies.filter((item) => item.status === "REVISION_REQUESTED").length };
  const visualContinuation = resolveSiteBuildVisualContinuation({ baseStage: stage, homeStatus: currentHomeVisualAssembly?.status ?? null, remaining: remainingVisualSummary });
  const downstreamStage: SiteBuildStage | null = currentPublicationExecutionPlan ? currentPublicationExecutionPlan.status === "VERIFIED" ? "COMPLETE" : currentPublicationExecutionPlan.status === "VERIFYING" ? "PUBLICATION_VERIFICATION" : currentPublicationExecutionPlan.status === "EXECUTING" || currentPublicationExecutionPlan.status === "PARTIALLY_FAILED" ? "PUBLICATION_EXECUTING" : "PUBLICATION_EXECUTION_REVIEW" : currentNavigationReview ? currentNavigationReview.status === "APPROVED" ? "PUBLICATION_READINESS" : currentNavigationReview.status === "PUBLICATION_READINESS_CONFIRMED" ? "PUBLICATION_AUTHORIZATION" : currentNavigationReview.status === "PUBLICATION_AUTHORIZED" ? "PUBLICATION_EXECUTION_REVIEW" : "NAVIGATION_REVIEW" : null;
  const visualStage: SiteBuildStage = downstreamStage ?? visualContinuation?.stage ?? stage;
  const visualNext = downstreamStage ? nextForStage(downstreamStage) : visualContinuation ? { action: visualContinuation.action, label: visualContinuation.label, detail: visualContinuation.detail } : next;
  const nextRoute = visualStage === "NAVIGATION_REVIEW" ? `/sites/${site.siteId}/build/navigation` : visualStage === "WORDPRESS_MENU_SYNC" ? `/sites/${site.siteId}/build/navigation-sync` : visualStage === "PUBLICATION_READINESS" ? `/sites/${site.siteId}/build/publication-readiness` : visualStage === "PUBLICATION_AUTHORIZATION" ? `/sites/${site.siteId}/build/publication-authorization` : ["PUBLICATION_EXECUTION_REVIEW", "PUBLICATION_EXECUTING", "PUBLICATION_VERIFICATION", "COMPLETE"].includes(visualStage) ? `/sites/${site.siteId}/build/publication-execution` : visualContinuation ? `/sites/${site.siteId}/build/${visualContinuation.path}` : visualStage === "WORDPRESS_DRAFT_REVIEW" ? `/sites/${site.siteId}/build/wordpress-review` : `/sites/${site.siteId}/build`;
  const scopedNextRoute = `${nextRoute}?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`;
  return { site: { organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }, generation, session, ...records, imageCandidates, visualAssemblies, currentVisualAssemblies, currentVisualAssembly, currentHomeVisualAssembly, remainingVisualAssemblies, remainingVisualSummary, navigationReviews, currentNavigationReview, publicationExecutionPlans, currentPublicationExecutionPlan, pageReview, stale, stage: visualStage, next: { ...visualNext, route: scopedNextRoute }, publication: { state: site.publishingStatus, enabled: site.enabled } };
}

function nextForStage(stage: "NAVIGATION_REVIEW" | "WORDPRESS_MENU_SYNC" | "PUBLICATION_READINESS" | "PUBLICATION_AUTHORIZATION" | "PUBLICATION_EXECUTION_REVIEW" | "PUBLICATION_EXECUTING" | "PUBLICATION_VERIFICATION" | "COMPLETE") {
  return stage === "NAVIGATION_REVIEW" ? { action: "REVIEW_NAVIGATION", label: "REVIEW NAVIGATION", detail: "Review and explicitly decide the approved site architecture's header and footer navigation proposal." } : stage === "WORDPRESS_MENU_SYNC" ? { action: "SYNC_WORDPRESS_MENU", label: "SYNC WORDPRESS MENU", detail: "Apply the approved navigation to WordPress through a separate explicit mutation and verification gate." } : stage === "PUBLICATION_READINESS" ? { action: "REVIEW_PUBLICATION_READINESS", label: "REVIEW PUBLICATION READINESS", detail: "Verify the complete site, navigation, and publication safeguards before requesting authorization." } : stage === "PUBLICATION_AUTHORIZATION" ? { action: "AUTHORIZE_PUBLICATION", label: "REVIEW PUBLICATION AUTHORIZATION", detail: "Explicit owner publication authorization remains required. Nothing is published automatically." } : stage === "PUBLICATION_EXECUTION_REVIEW" ? { action: "REVIEW_PUBLICATION_EXECUTION", label: "REVIEW PUBLICATION EXECUTION", detail: "Review every exact WordPress and Genesis launch mutation before executing publication." } : stage === "PUBLICATION_EXECUTING" ? { action: "RESUME_PUBLICATION_EXECUTION", label: "RESUME PUBLICATION EXECUTION", detail: "Resume only incomplete or failed publication operations from durable receipts." } : stage === "PUBLICATION_VERIFICATION" ? { action: "VERIFY_PUBLICATION", label: "VERIFY PUBLICATION", detail: "Authenticate the complete launch state before marking publication complete." } : { action: "REVIEW_COMPLETED_SITE", label: "REVIEW COMPLETED SITE", detail: "Publication execution and authenticated verification are complete." };
}

export function startSiteNavigationReview(site: SiteConfiguration, actor: string, qaPassed: boolean) { const workspace = getSiteBuildWorkspace(site); if (!qaPassed || workspace.stage !== "SITE_QA" || !workspace.session || !workspace.currentAssembly || workspace.currentNavigationReview) throw new Error("SITE_QA_PASS_REQUIRED"); return saveSiteNavigationReview({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, assemblyId: workspace.currentAssembly.assemblyId, status: "READY_FOR_OWNER_REVIEW", items: workspace.currentAssembly.navigation, footerLinks: workspace.currentAssembly.footerLinks, ownerInstructions: null, createdBy: actor }); }
export function decideSiteNavigation(site: SiteConfiguration, actor: string, navigationReviewId: string, decision: "APPROVE" | "REQUEST_CHANGES") { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentNavigationReview || workspace.currentNavigationReview.navigationReviewId !== navigationReviewId) throw new Error("CURRENT_NAVIGATION_REVIEW_REQUIRED"); return decideSiteNavigationReview({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, navigationReviewId, decision, actor }); }
export function reassembleSiteNavigation(site: SiteConfiguration, actor: string, instructions: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentAssembly || !workspace.currentNavigationReview || !instructions.trim()) throw new Error("NAVIGATION_REASSEMBLY_INPUT_REQUIRED"); return saveSiteNavigationReview({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, assemblyId: workspace.currentAssembly.assemblyId, status: "READY_FOR_OWNER_REVIEW", items: workspace.currentAssembly.navigation, footerLinks: workspace.currentAssembly.footerLinks, ownerInstructions: instructions.trim(), createdBy: actor }); }
export function confirmSitePublicationReadiness(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentNavigationReview || workspace.stage !== "PUBLICATION_READINESS") throw new Error("PUBLICATION_READINESS_REVIEW_REQUIRED"); return advanceSiteNavigationPublicationGate({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, navigationReviewId: workspace.currentNavigationReview.navigationReviewId, transition: "CONFIRM_READINESS", actor }); }
export function authorizeSitePublication(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || !workspace.currentNavigationReview || workspace.stage !== "PUBLICATION_AUTHORIZATION") throw new Error("PUBLICATION_AUTHORIZATION_REVIEW_REQUIRED"); return advanceSiteNavigationPublicationGate({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, navigationReviewId: workspace.currentNavigationReview.navigationReviewId, transition: "AUTHORIZE_PUBLICATION", actor }); }

export async function assembleRemainingSiteVisuals(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); const home = workspace.currentAssembly?.pages.find((page) => page.pageRole === "HOME"); const homeVisual = workspace.currentHomeVisualAssembly; if (!workspace.session || !workspace.currentAssembly || !home || homeVisual?.revision !== 2 || homeVisual.status !== "APPROVED" || site.enabled || site.publishingStatus !== "disabled") throw new Error("APPROVED_HOME_VISUAL_V2_REQUIRED"); for (const page of workspace.currentAssembly.pages.filter((item) => item.pageRole !== "HOME")) { const refreshed = getSiteBuildWorkspace(site); if (refreshed.currentVisualAssemblies.some((item) => item.pageId === page.pageId && item.pageRevisionId === page.pageRevisionId)) continue; const candidate = refreshed.imageCandidates.filter((item) => item.pageId === page.pageId && item.pageRevisionId === page.pageRevisionId && item.status === "APPROVED").sort((left, right) => left.revision - right.revision).at(-1); const draft = refreshed.wordpressDrafts.find((item) => item.draftId === `${page.pageId}-draft`); if (!candidate || !draft) throw new Error(`VISUAL_ASSEMBLY_INPUT_MISSING:${page.pageId}`); const stored = readSitePageImageCandidateBytes({ organizationId: site.organizationId, siteId: site.siteId, candidateId: candidate.candidateId }); if (!stored) throw new Error(`VISUAL_IMAGE_BYTES_MISSING:${page.pageId}`); const yoast = await writeExactWordPressDraftYoastSearch({ site, wordpressObjectId: draft.wordpressObjectId, focusKeyphrase: page.h1, seoTitle: page.seoTitle, metaDescription: page.metaDescription }); if (!yoast.ok) throw new Error(`VISUAL_YOAST_SYNC_FAILED:${page.pageId}:${yoast.state}`); const html = renderCommercialStainlessPage({ page, wordpressObjectId: draft.wordpressObjectId }); const media = await attachGenesisWordPressFeaturedImage({ site, wordpressObjectId: draft.wordpressObjectId, canonicalSlug: page.slug || "home", contentHtml: html, mediaUrlToken: PAGE_HERO_MEDIA_TOKEN, image: { bytes: stored.bytes, mimeType: candidate.mimeType, fileExtension: candidate.mimeType === "image/png" ? "png" : candidate.mimeType === "image/webp" ? "webp" : "jpg" }, title: `${page.name} visual`, altText: page.imageRequirements[0]?.altTextGuidance ?? `${page.name} commercial stainless visual`, description: `Approved Genesis ${candidate.sourceType.toLowerCase().replaceAll("_", " ")} for ${page.name}.` }); if (!media.ok) throw new Error(`VISUAL_MEDIA_FAILED:${page.pageId}:${media.state}`); saveSiteVisualAssembly({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, pageId: page.pageId, pageRevisionId: page.pageRevisionId, status: "READY_FOR_OWNER_REVIEW", referenceAssetId: homeVisual.referenceAssetId, referenceClassification: homeVisual.referenceClassification, referencePublished: false, imageCandidateId: candidate.candidateId, imageCandidateRevision: candidate.revision, imageProvenance: candidate.sourceType, imageSha256: candidate.sha256, wordpressObjectId: draft.wordpressObjectId, wordpressMediaId: media.mediaId, wordpressMediaUrl: media.mediaUrl, wordpressStatus: "draft", contentHtml: html.replaceAll(PAGE_HERO_MEDIA_TOKEN, media.mediaUrl), designSystemVersion: homeVisual.designSystemVersion, ownerInstructions: null, createdBy: actor }); } return getSiteBuildWorkspace(site).remainingVisualAssemblies; }

export function decideSiteVisualDesign(site: SiteConfiguration, actor: string, assemblyId: string, decision: "APPROVE" | "REQUEST_CHANGES") { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || assemblyId === workspace.currentHomeVisualAssembly?.assemblyId) throw new Error("REMAINING_VISUAL_ASSEMBLY_REQUIRED"); return decideSiteVisualAssembly({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, assemblyId, decision, actor }); }
export async function reassembleSiteVisualDesign(site: SiteConfiguration, actor: string, assemblyId: string, instructions: string) { const workspace = getSiteBuildWorkspace(site); const current = workspace.remainingVisualAssemblies.find((item) => item.assemblyId === assemblyId); const page = workspace.currentAssembly?.pages.find((item) => item.pageId === current?.pageId); if (!workspace.session || !current || !page || !instructions.trim()) throw new Error("SITE_VISUAL_REASSEMBLY_INPUT_REQUIRED"); const html = renderCommercialStainlessPage({ page, wordpressObjectId: current.wordpressObjectId, mediaUrl: current.wordpressMediaUrl, instructions }); const updated = await writeGenesisWordPressDraft({ operation: "UPDATE", site, wordpressObjectId: current.wordpressObjectId, artifact: { title: page.name, slug: page.slug, excerpt: page.metaDescription, contentHtml: html, seo: { focusKeyphrase: page.h1, seoTitle: page.seoTitle, metaDescription: page.metaDescription } } }); if (!updated.ok || updated.wordpressObjectId !== current.wordpressObjectId || updated.wordpressStatus !== "draft") throw new Error("SITE_VISUAL_REASSEMBLY_FAILED"); return saveSiteVisualAssembly({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, pageId: page.pageId, pageRevisionId: page.pageRevisionId, status: "READY_FOR_OWNER_REVIEW", referenceAssetId: current.referenceAssetId, referenceClassification: current.referenceClassification, referencePublished: false, imageCandidateId: current.imageCandidateId, imageCandidateRevision: current.imageCandidateRevision, imageProvenance: current.imageProvenance, imageSha256: current.imageSha256, wordpressObjectId: current.wordpressObjectId, wordpressMediaId: current.wordpressMediaId, wordpressMediaUrl: current.wordpressMediaUrl, wordpressStatus: "draft", contentHtml: html, designSystemVersion: current.designSystemVersion, ownerInstructions: instructions.trim(), createdBy: actor }); }
export function approveAllReadySiteDesigns(site: SiteConfiguration, actor: string) { const workspace = getSiteBuildWorkspace(site); if (!workspace.session || workspace.remainingVisualSummary.assembled !== workspace.remainingVisualSummary.expected || workspace.remainingVisualSummary.blocked > 0) throw new Error("ALL_SITE_VISUALS_READY_REQUIRED"); return approveAllReadySiteVisualAssemblies({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, pageIds: workspace.currentAssembly!.pages.filter((page) => page.pageRole !== "HOME").map((page) => page.pageId), actor }); }

export async function assembleHomeVisualCanary(site: SiteConfiguration, actor: string, ownerInstructions = "") {
  const workspace = getSiteBuildWorkspace(site); const page = workspace.currentAssembly?.pages.find((item) => item.pageRole === "HOME");
  if (!workspace.session || !workspace.currentAssembly || !page || !workspace.pageReview.complete || site.enabled || site.publishingStatus !== "disabled") throw new Error("HOME_VISUAL_ASSEMBLY_BOUNDARY_NOT_READY");
  const candidate = workspace.imageCandidates.filter((item) => item.pageId === page.pageId && item.pageRevisionId === page.pageRevisionId && item.status === "APPROVED").sort((left, right) => left.revision - right.revision).at(-1); if (!candidate) throw new Error("APPROVED_HOME_IMAGE_REQUIRED");
  const draft = workspace.wordpressDrafts.find((item) => item.draftId === `${page.pageId}-draft`); if (!draft) throw new Error("HOME_WORDPRESS_DRAFT_REQUIRED");
  const yoast = await writeExactWordPressDraftYoastSearch({ site, wordpressObjectId: draft.wordpressObjectId, focusKeyphrase: page.h1, seoTitle: page.seoTitle, metaDescription: page.metaDescription }); if (!yoast.ok) throw new Error(`HOME_YOAST_SYNC_FAILED:${yoast.state}`);
  if (workspace.currentVisualAssembly && workspace.currentVisualAssembly.pageRevisionId === page.pageRevisionId && workspace.currentVisualAssembly.status === "READY_FOR_OWNER_REVIEW" && !ownerInstructions.trim()) return workspace.currentVisualAssembly;
  if (workspace.currentVisualAssembly && ownerInstructions.trim()) {
    const html = refineCommercialStainlessHome(workspace.currentVisualAssembly.contentHtml); const updated = await writeGenesisWordPressDraft({ operation: "UPDATE", site, wordpressObjectId: draft.wordpressObjectId, artifact: { title: page.name, slug: page.slug || "home", excerpt: page.metaDescription, contentHtml: html, seo: { focusKeyphrase: page.h1, seoTitle: page.seoTitle, metaDescription: page.metaDescription } } });
    if (!updated.ok || updated.wordpressObjectId !== workspace.currentVisualAssembly.wordpressObjectId || updated.wordpressStatus !== "draft") throw new Error("HOME_VISUAL_REVISION_UPDATE_FAILED");
    return saveSiteVisualAssembly({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, pageId: page.pageId, pageRevisionId: page.pageRevisionId, status: "READY_FOR_OWNER_REVIEW", referenceAssetId: workspace.currentVisualAssembly.referenceAssetId, referenceClassification: workspace.currentVisualAssembly.referenceClassification, referencePublished: false, imageCandidateId: workspace.currentVisualAssembly.imageCandidateId, imageCandidateRevision: workspace.currentVisualAssembly.imageCandidateRevision, imageProvenance: workspace.currentVisualAssembly.imageProvenance, imageSha256: workspace.currentVisualAssembly.imageSha256, wordpressObjectId: workspace.currentVisualAssembly.wordpressObjectId, wordpressMediaId: workspace.currentVisualAssembly.wordpressMediaId, wordpressMediaUrl: workspace.currentVisualAssembly.wordpressMediaUrl, wordpressStatus: "draft", contentHtml: html, designSystemVersion: "commercial-stainless-visual-v1", ownerInstructions: ownerInstructions.trim(), createdBy: actor });
  }
  const stored = readSitePageImageCandidateBytes({ organizationId: site.organizationId, siteId: site.siteId, candidateId: candidate.candidateId }); if (!stored) throw new Error("APPROVED_HOME_IMAGE_BYTES_REQUIRED");
  const html = renderCommercialStainlessHome({ page, navigation: workspace.currentAssembly.navigation, wordpressObjectId: draft.wordpressObjectId });
  const media = await attachGenesisWordPressFeaturedImage({ site, wordpressObjectId: draft.wordpressObjectId, canonicalSlug: "commercial-stainless-counters-home", contentHtml: html, mediaUrlToken: HOME_HERO_MEDIA_TOKEN, image: { bytes: stored.bytes, mimeType: candidate.mimeType, fileExtension: candidate.mimeType === "image/png" ? "png" : candidate.mimeType === "image/webp" ? "webp" : "jpg" }, title: "Commercial stainless counters and custom fabrication", altText: "Commercial stainless counters and work surfaces in a professional fabrication setting", description: `Approved Genesis ${candidate.sourceType.toLowerCase().replaceAll("_", " ")} for Home hero.` });
  if (!media.ok) throw new Error(`HOME_VISUAL_MEDIA_FAILED:${media.state}`);
  return saveSiteVisualAssembly({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, pageId: page.pageId, pageRevisionId: page.pageRevisionId, status: "READY_FOR_OWNER_REVIEW", referenceAssetId: "site-asset-7cf46d465609b3d574532717952658809eca92e15f930c58af8db884a911be9c", referenceClassification: "OWNER_SUPPLIED_REFERENCE", referencePublished: false, imageCandidateId: candidate.candidateId, imageCandidateRevision: candidate.revision, imageProvenance: candidate.sourceType, imageSha256: candidate.sha256, wordpressObjectId: draft.wordpressObjectId, wordpressMediaId: media.mediaId, wordpressMediaUrl: media.mediaUrl, wordpressStatus: "draft", contentHtml: html.replaceAll(HOME_HERO_MEDIA_TOKEN, media.mediaUrl), designSystemVersion: "commercial-stainless-visual-v1", ownerInstructions: ownerInstructions.trim() || null, createdBy: actor });
}

export function decideHomeVisualAssembly(site: SiteConfiguration, actor: string, assemblyId: string, decision: "APPROVE" | "REQUEST_CHANGES") { const workspace = getSiteBuildWorkspace(site); if (!workspace.session) throw new Error("SITE_BUILD_SESSION_REQUIRED"); return decideSiteVisualAssembly({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, assemblyId, decision, actor }); }

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
  contentUpdateReady: boolean;
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
  if (!credential || !site.integrations.wordpressApiBaseUrl || !drafts.length || workspace.stale) return { ready: false, contentUpdateReady: false, credentialResolved: Boolean(credential), authenticated: false, collisionPreflightAvailable: false, targetCount: drafts.length, absentCount: 0, existingReceiptCount: 0, blockedTargets, publicationMutationPerformed: false, wordpressMutationPerformed: false };
  const authority = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const identity = await authority.getJson({ path: "/users/me", query: new URLSearchParams({ context: "edit", _fields: "id,capabilities" }) });
  if (!identity.ok) return { ready: false, contentUpdateReady: false, credentialResolved: true, authenticated: false, collisionPreflightAvailable: false, targetCount: drafts.length, absentCount: 0, existingReceiptCount: 0, blockedTargets, publicationMutationPerformed: false, wordpressMutationPerformed: false };
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
  return { ready: blockedTargets.length === 0 && absentCount + existingReceiptCount === drafts.length, contentUpdateReady: blockedTargets.length === 0 && absentCount === 0 && existingReceiptCount === drafts.length, credentialResolved: true, authenticated: true, collisionPreflightAvailable: true, targetCount: drafts.length, absentCount, existingReceiptCount, blockedTargets, publicationMutationPerformed: false, wordpressMutationPerformed: false };
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
  if (workspace.stale || !workspace.session || !assembly || !workspace.pageReview.complete) throw new Error("APPROVED_SITE_ASSEMBLY_REQUIRED");
  if (site.publishingStatus !== "disabled" || site.enabled) throw new Error("DRAFT_ONLY_SITE_BOUNDARY_REQUIRED");
  const readiness = await inspectSiteBuildWordPressReadiness(site); if (!readiness.contentUpdateReady) throw new Error("WORDPRESS_CONTENT_UPDATE_IDENTITY_NOT_READY");
  const completed = new Set(workspace.wordpressContentUpdates.map((item) => item.pageRevisionId));
  for (const page of assembly.pages.filter((item) => !completed.has(item.pageRevisionId))) {
    const receipt = workspace.wordpressDrafts.find((item) => item.draftId === `${page.pageId}-draft`); if (!receipt) throw new Error(`WORDPRESS_DRAFT_RECEIPT_REQUIRED:${page.name}`);
    const result = await writer({ operation: "UPDATE", site, wordpressObjectId: receipt.wordpressObjectId, artifact: { title: page.name, slug: page.slug || "home", excerpt: page.metaDescription, contentHtml: page.contentHtml, seo: { focusKeyphrase: page.h1, seoTitle: page.seoTitle, metaDescription: page.metaDescription } } });
    if (!result.ok) throw new Error(`WORDPRESS_CONTENT_UPDATE_FAILED:${page.name}:${result.state}`);
    if (result.wordpressObjectId !== receipt.wordpressObjectId || result.wordpressStatus !== "draft") throw new Error(`WORDPRESS_CONTENT_UPDATE_IDENTITY_MISMATCH:${page.name}`);
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