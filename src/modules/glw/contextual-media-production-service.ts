import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { listGeneratedContextualMedia } from "@/modules/foundation/generated-contextual-media-repository";
import { runGovernedRenderCapture, signGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { listSitePageMediaAssignments } from "@/modules/foundation/site-page-media-assignment";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { runContextualMediaProductionAdapter, type ContextualVisualPlanItem } from "./contextual-media-production-adapter";
import { createContextualMediaProductionDependencies } from "./contextual-media-production-dependencies";
import { patchContextualPresentationMedia } from "./contextual-media-presentation-patch";
import { resolveContextualMediaProductionAuthority } from "./contextual-media-production-preflight";
import { buildOutdoorSphereGeneratedContextualPrompt, requiresGeneratedContextualMediaForOutdoorSphere } from "./outdoor-sphere-contextual-media-policy";
import { buildProjectorEnclosureGeneratedContextualPlan, requiresGeneratedContextualMediaForProjectorEnclosure } from "./projector-enclosure-contextual-media-policy";
import { applyScopedThemeFeaturedMediaSuppression, applyScopedThemeTitleSuppression } from "./scoped-theme-title-suppression";

const sha256 = (value: string) => createHash("sha256").update(value.trim()).digest("hex");
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function pageFields(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("CONTEXTUAL_MEDIA_DRAFT_READBACK_INVALID");
  const page = body as Record<string, unknown>; const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return { id: String(page.id ?? ""), status: text(page.status), slug: text(page.slug), parentId: Number(page.parent), title: text(object(page.title).raw) || text(object(page.title).rendered), contentHtml: text(object(page.content).raw) || text(object(page.content).rendered), excerpt: text(object(page.excerpt).raw) || text(object(page.excerpt).rendered), meta: object(page.meta), featuredMediaId: Number(page.featured_media ?? 0) };
}

export async function executeContextualMediaProduction(input: { campaignId: string; targetId: string; visualPlan: readonly ContextualVisualPlanItem[]; expectedStoredSha256: string; actor: string }) {
  if (!/^[a-f0-9]{64}$/.test(input.expectedStoredSha256)) throw new Error("CONTEXTUAL_MEDIA_EXPECTED_STORED_SHA_REQUIRED");
  const { readiness, site, product, productAuthority, provider, presentationSlots } = await resolveContextualMediaProductionAuthority(input);
  const identity = { organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, campaignId: readiness.target.campaignId, targetId: readiness.target.targetId, productId: readiness.identity.productId, wordpressObjectId: readiness.identity.wordpressObjectId, pageRevisionId: readiness.authority.candidateArtifactIdentity };
  const jobId = readiness.authority.candidateArtifactIdentity?.split(":")[1] ?? "";
  const job = jobId ? await glwPageExecutionRepository.getById(jobId) : null;
  if (!job || job.organizationId !== identity.organizationId || job.siteId !== identity.siteId || job.productId !== identity.productId) throw new Error("CONTEXTUAL_MEDIA_JOB_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!site.integrations.wordpressApiBaseUrl || !site.domain || !credential) throw new Error("CONTEXTUAL_MEDIA_WORDPRESS_AUTHORITY_REQUIRED");
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const read = async () => { const result = await reader.getJson({ path: `/pages/${identity.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,excerpt,featured_media,meta" }) }); if (!result.ok) throw new Error("CONTEXTUAL_MEDIA_DRAFT_READBACK_FAILED"); return pageFields(result.body); };
  const before = await read();
  if (before.id !== identity.wordpressObjectId || before.status !== "draft" || before.slug !== readiness.identity.canonicalSlug || String(before.parentId) !== readiness.identity.wordpressParentId || sha256(before.contentHtml) !== input.expectedStoredSha256) throw new Error("CONTEXTUAL_MEDIA_DRAFT_IDENTITY_MISMATCH");
  const dependencies = createContextualMediaProductionDependencies({
    site, siteName: site.displayName, productName: product.productName,
    patchPresentation: async ({ replacements }) => {
      const contentHtml = patchContextualPresentationMedia(before.contentHtml, replacements);
      const write = await writeGenesisWordPressDraft({ operation: "UPDATE", site, wordpressObjectId: identity.wordpressObjectId, artifact: { title: before.title, contentHtml, slug: readiness.identity.canonicalPath, excerpt: before.excerpt || null, parentId: before.parentId, seo: null } });
      if (!write.ok) throw new Error(`CONTEXTUAL_MEDIA_DRAFT_PATCH_FAILED:${write.state}`);
      const after = await read();
      if (after.id !== before.id || after.status !== before.status || after.slug !== before.slug || after.parentId !== before.parentId || after.title !== before.title || after.excerpt !== before.excerpt || after.featuredMediaId !== before.featuredMediaId || JSON.stringify(after.meta) !== JSON.stringify(before.meta)) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_SCOPE_VIOLATION");
      return { storedSha256: sha256(after.contentHtml) };
    },
    certify: async ({ storedSha256 }) => {
      const originValue = process.env.GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN?.trim() ?? ""; const origin = new URL(originValue);
      if (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(origin.hostname) || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("CAPTURE_INTERNAL_ORIGIN_NOT_CONFIGURED");
      const pathname = `/api/glw/campaigns/${encodeURIComponent(input.campaignId)}/rich-reference-production/snapshot`; const query = new URLSearchParams({ targetId: identity.targetId, wordpressObjectId: identity.wordpressObjectId, contentSha: storedSha256 }); const signedPath = `${pathname}?${query}`;
      const records = listGeneratedContextualMedia({ organizationId: identity.organizationId, siteId: identity.siteId, targetId: identity.targetId }).filter((record) => record.wordpressMediaId && record.wordpressUrl);
      const capture = await runGovernedRenderCapture({ authority: { identity: { organizationId: identity.organizationId, siteId: identity.siteId, pageId: identity.targetId, pageRevisionIdentity: `contextual-media:${identity.wordpressObjectId}:${storedSha256}`, canonicalPath: readiness.identity.canonicalPath, contentHash: storedSha256, renderedContentHash: null, campaignId: identity.campaignId, targetId: identity.targetId, jobId, externalExecutionId: job.externalExecutionId, wordpressObjectId: identity.wordpressObjectId, wordpressStatus: "draft" }, targetUrl: `${origin.origin}${signedPath}`, allowedOrigins: [origin.origin, new URL(`https://${site.domain.replace(/^www\./, "")}`).origin], internalGenesisOrigin: origin.origin, internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) }, layoutClass: "FULL_WIDTH_MARKETING_PAGE", mediaAssignments: records.map((record) => ({ assignmentId: record.generationId, semanticRole: record.mediaRole, mediaId: String(record.wordpressMediaId), sourceUrl: record.wordpressUrl, contextId: record.role })) }, mode: "FORCE", actor: input.actor });
      if (capture.certification.overallState !== "PASS") throw new Error("CONTEXTUAL_MEDIA_VISUAL_CERTIFICATION_FAILED");
      return { certificationId: capture.certification.certificationId, state: "PASS" as const };
    },
  });
  const result = await runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan: input.visualPlan, productAuthority, providerReady: provider.configured, actor: input.actor, dependencies });
  return { result, presentationSlots, storedShaBefore: input.expectedStoredSha256, storedShaAfter: result.storedSha256, ownerDecision: "PENDING" as const, publicationPerformed: false as const };
}

function draftReadyContextualRepairPlan(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  productId: string;
  stateName: string;
  cityName?: string | null;
}): readonly ContextualVisualPlanItem[] {
  if (requiresGeneratedContextualMediaForProjectorEnclosure(input)) {
    return buildProjectorEnclosureGeneratedContextualPlan({
      stateName: input.stateName,
      cityName: input.cityName,
    });
  }

  const location = [input.cityName?.trim() || "", input.stateName.trim()].filter(Boolean).join(", ");
  return [{
    role: "CONTEXTUAL_IN_USE",
    mediaRole: "CONTEXTUAL_IN_USE",
    slot: "HERO_EXPERIENCE",
    prompt: buildOutdoorSphereGeneratedContextualPrompt({ stateName: input.stateName, cityName: input.cityName }),
    altText: location
      ? `Conceptual contextual visualization of an outdoor LED sphere in a ${location} commercial environment; not a real customer installation.`
      : "Conceptual contextual visualization of an outdoor LED sphere in a U.S. commercial environment; not a real customer installation.",
  }];
}

export async function executeDraftReadyGeneratedContextualMediaRepair(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  productId: string;
  stateName: string;
  cityName?: string | null;
  expectedStoredSha256: string;
  actor: string;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.expectedStoredSha256)) throw new Error("CONTEXTUAL_MEDIA_EXPECTED_STORED_SHA_REQUIRED");
  const visualPlan = draftReadyContextualRepairPlan({
    organizationId: input.organizationId,
    siteId: input.siteId,
    campaignId: input.campaignId,
    productId: input.productId,
    stateName: input.stateName,
    cityName: input.cityName,
  });
  const { readiness, site, product, productAuthority, provider, presentationSlots } = await resolveContextualMediaProductionAuthority({ campaignId: input.campaignId, targetId: input.targetId, visualPlan });
  const identity = { organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, campaignId: readiness.target.campaignId, targetId: readiness.target.targetId, productId: readiness.identity.productId, wordpressObjectId: readiness.identity.wordpressObjectId, pageRevisionId: readiness.authority.candidateArtifactIdentity };
  const outdoorSphereScope = requiresGeneratedContextualMediaForOutdoorSphere({ campaignId: identity.campaignId, organizationId: identity.organizationId, siteId: identity.siteId, productId: identity.productId });
  const projectorEnclosureScope = requiresGeneratedContextualMediaForProjectorEnclosure({ organizationId: identity.organizationId, siteId: identity.siteId, productId: identity.productId });
  if (!outdoorSphereScope && !projectorEnclosureScope) throw new Error("CONTEXTUAL_MEDIA_EXACT_TARGET_REQUIRED");
  if (input.organizationId !== identity.organizationId || input.siteId !== identity.siteId || input.productId !== identity.productId) throw new Error("CONTEXTUAL_MEDIA_EXACT_TARGET_REQUIRED");
  const jobId = readiness.authority.candidateArtifactIdentity?.split(":")[1] ?? "";
  const job = jobId ? await glwPageExecutionRepository.getById(jobId) : null;
  if (!job || job.organizationId !== identity.organizationId || job.siteId !== identity.siteId || job.productId !== identity.productId) throw new Error("CONTEXTUAL_MEDIA_JOB_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!site.integrations.wordpressApiBaseUrl || !site.domain || !credential) throw new Error("CONTEXTUAL_MEDIA_WORDPRESS_AUTHORITY_REQUIRED");
  const apiBaseUrl = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const read = async () => { const fetched = await reader.getJson({ path: `/pages/${identity.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,excerpt,featured_media,meta" }) }); if (!fetched.ok) throw new Error("CONTEXTUAL_MEDIA_DRAFT_READBACK_FAILED"); return pageFields(fetched.body); };
  const before = await read();
  if (before.id !== identity.wordpressObjectId || before.status !== "draft" || before.slug !== readiness.identity.canonicalSlug || String(before.parentId) !== readiness.identity.wordpressParentId || sha256(before.contentHtml) !== input.expectedStoredSha256) throw new Error("CONTEXTUAL_MEDIA_DRAFT_IDENTITY_MISMATCH");
  const dependencies = createContextualMediaProductionDependencies({
    site,
    siteName: site.displayName,
    productName: product.productName,
    patchPresentation: async ({ replacements }) => {
      let contentHtml = patchContextualPresentationMedia(before.contentHtml, replacements);
      if (projectorEnclosureScope) {
        contentHtml = applyScopedThemeTitleSuppression({
          contentHtml,
          wordpressObjectId: identity.wordpressObjectId,
        }).contentHtml;
        contentHtml = applyScopedThemeFeaturedMediaSuppression({
          contentHtml,
          wordpressObjectId: identity.wordpressObjectId,
        }).contentHtml;
      }
      const write = await writeGenesisWordPressDraft({ operation: "UPDATE", site, wordpressObjectId: identity.wordpressObjectId, artifact: { title: before.title, contentHtml, slug: readiness.identity.canonicalPath, excerpt: before.excerpt || null, parentId: before.parentId, seo: null } });
      if (!write.ok) throw new Error(`CONTEXTUAL_MEDIA_DRAFT_PATCH_FAILED:${write.state}`);
      const after = await read();
      if (after.id !== before.id || after.status !== before.status || after.slug !== before.slug || after.parentId !== before.parentId || after.title !== before.title || after.excerpt !== before.excerpt || after.featuredMediaId !== before.featuredMediaId || JSON.stringify(after.meta) !== JSON.stringify(before.meta)) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_SCOPE_VIOLATION");
      return { storedSha256: sha256(after.contentHtml) };
    },
    certify: async () => ({ certificationId: "SKIPPED_DRAFT_READY_REPAIR", state: "PASS" as const }),
  });
  const result = await runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan, productAuthority, providerReady: provider.configured, actor: input.actor, dependencies });
  const generatedAssignment = listSitePageMediaAssignments({ organizationId: identity.organizationId, siteId: identity.siteId, buildSessionId: `contextual-media:${identity.targetId}`, pageRevisionId: identity.pageRevisionId }).find((assignment) => assignment.role === "CONTEXTUAL_IN_USE" && assignment.slotId === "HERO_EXPERIENCE" && assignment.asset.type === "GENERATED" && Boolean(assignment.wordpressReceipt?.mediaId) && Boolean(assignment.wordpressReceipt?.url)) ?? null;
  if (!generatedAssignment || !generatedAssignment.wordpressReceipt) throw new Error("CONTEXTUAL_MEDIA_GENERATED_ASSIGNMENT_REQUIRED");
  const generatedReceipt = listGeneratedContextualMedia({ organizationId: identity.organizationId, siteId: identity.siteId, targetId: identity.targetId }).find((record) => record.campaignId === identity.campaignId && record.targetId === identity.targetId && record.productId === identity.productId && record.wordpressObjectId === identity.wordpressObjectId && record.pageRevisionId === identity.pageRevisionId && record.mediaRole === "CONTEXTUAL_IN_USE" && record.status === "SUCCEEDED" && Boolean(record.wordpressMediaId) && String(record.wordpressMediaId) === String(generatedAssignment.wordpressReceipt?.mediaId)) ?? null;
  if (!generatedReceipt || !generatedReceipt.wordpressMediaId || !generatedReceipt.wordpressUrl || generatedReceipt.wordpressUrl !== generatedAssignment.wordpressReceipt.url) throw new Error("CONTEXTUAL_MEDIA_GENERATED_RECEIPT_REQUIRED");

  const afterPatch = await read();
  if (afterPatch.id !== identity.wordpressObjectId || afterPatch.status !== "draft" || afterPatch.slug !== before.slug || afterPatch.parentId !== before.parentId) throw new Error("CONTEXTUAL_MEDIA_DRAFT_IDENTITY_MISMATCH");
  const featuredMediaBefore = afterPatch.featuredMediaId;
  if (afterPatch.featuredMediaId !== generatedReceipt.wordpressMediaId) {
    await setWordPressFeaturedMedia({ apiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, wordpressObjectId: identity.wordpressObjectId, featuredMediaId: generatedReceipt.wordpressMediaId });
  }
  const afterFeatured = await read();
  if (afterFeatured.id !== identity.wordpressObjectId || afterFeatured.status !== "draft" || afterFeatured.slug !== afterPatch.slug || afterFeatured.parentId !== afterPatch.parentId || afterFeatured.title !== afterPatch.title || afterFeatured.excerpt !== afterPatch.excerpt || JSON.stringify(afterFeatured.meta) !== JSON.stringify(afterPatch.meta) || afterFeatured.contentHtml !== afterPatch.contentHtml || afterFeatured.featuredMediaId !== generatedReceipt.wordpressMediaId) throw new Error("CONTEXTUAL_MEDIA_FEATURED_MEDIA_READBACK_MISMATCH");

  return {
    ...result,
    operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA" as const,
    featuredMediaBefore,
    featuredMediaAfter: afterFeatured.featuredMediaId,
    visualCertificationPerformed: false as const,
    publicationPerformed: false as const,
    dispatchPerformed: false as const,
    workflowExecuted: false as const,
    regenerationPerformed: false as const,
  };
}

function createAuthorizationHeader(username: string, applicationPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64")}`;
}

async function setWordPressFeaturedMedia(input: {
  apiBaseUrl: string;
  username: string;
  applicationPassword: string;
  wordpressObjectId: string;
  featuredMediaId: number;
}) {
  const authorization = createAuthorizationHeader(input.username, input.applicationPassword);
  const response = await fetch(`${input.apiBaseUrl}/pages/${encodeURIComponent(input.wordpressObjectId)}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "draft", featured_media: input.featuredMediaId }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("CONTEXTUAL_MEDIA_FEATURED_MEDIA_UPDATE_FAILED");
}