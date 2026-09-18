import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { listGeneratedContextualMedia } from "@/modules/foundation/generated-contextual-media-repository";
import { runGovernedRenderCapture, signGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { runContextualMediaProductionAdapter, type ContextualVisualPlanItem } from "./contextual-media-production-adapter";
import { createContextualMediaProductionDependencies } from "./contextual-media-production-dependencies";
import { patchContextualPresentationMedia } from "./contextual-media-presentation-patch";
import { resolveContextualMediaProductionAuthority } from "./contextual-media-production-preflight";
import { buildOutdoorSphereGeneratedContextualPrompt } from "./outdoor-sphere-contextual-media-policy";

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

function draftReadyContextualRepairPlan(input: { stateName: string; cityName?: string | null }): readonly ContextualVisualPlanItem[] {
  const location = [input.cityName?.trim() || "", input.stateName.trim()].filter(Boolean).join(", ");
  return [{
    role: "CONTEXTUAL_IN_USE",
    mediaRole: "CONTEXTUAL_IN_USE",
    slot: "POST_HERO_CONTEXTUAL",
    prompt: buildOutdoorSphereGeneratedContextualPrompt({ stateName: input.stateName, cityName: input.cityName }),
    altText: location
      ? `Conceptual contextual visualization of an outdoor LED sphere in a ${location} commercial environment; not a real customer installation.`
      : "Conceptual contextual visualization of an outdoor LED sphere in a U.S. commercial environment; not a real customer installation.",
  }];
}

export async function executeDraftReadyGeneratedContextualMediaRepair(input: {
  campaignId: string;
  targetId: string;
  stateName: string;
  cityName?: string | null;
  expectedStoredSha256: string;
  actor: string;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.expectedStoredSha256)) throw new Error("CONTEXTUAL_MEDIA_EXPECTED_STORED_SHA_REQUIRED");
  const visualPlan = draftReadyContextualRepairPlan({ stateName: input.stateName, cityName: input.cityName });
  const { readiness, site, product, productAuthority, provider, presentationSlots } = await resolveContextualMediaProductionAuthority({ campaignId: input.campaignId, targetId: input.targetId, visualPlan });
  const identity = { organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, campaignId: readiness.target.campaignId, targetId: readiness.target.targetId, productId: readiness.identity.productId, wordpressObjectId: readiness.identity.wordpressObjectId, pageRevisionId: readiness.authority.candidateArtifactIdentity };
  const jobId = readiness.authority.candidateArtifactIdentity?.split(":")[1] ?? "";
  const job = jobId ? await glwPageExecutionRepository.getById(jobId) : null;
  if (!job || job.organizationId !== identity.organizationId || job.siteId !== identity.siteId || job.productId !== identity.productId) throw new Error("CONTEXTUAL_MEDIA_JOB_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!site.integrations.wordpressApiBaseUrl || !site.domain || !credential) throw new Error("CONTEXTUAL_MEDIA_WORDPRESS_AUTHORITY_REQUIRED");
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const read = async () => { const fetched = await reader.getJson({ path: `/pages/${identity.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,excerpt,featured_media,meta" }) }); if (!fetched.ok) throw new Error("CONTEXTUAL_MEDIA_DRAFT_READBACK_FAILED"); return pageFields(fetched.body); };
  const before = await read();
  if (before.id !== identity.wordpressObjectId || before.status !== "draft" || before.slug !== readiness.identity.canonicalSlug || String(before.parentId) !== readiness.identity.wordpressParentId || sha256(before.contentHtml) !== input.expectedStoredSha256) throw new Error("CONTEXTUAL_MEDIA_DRAFT_IDENTITY_MISMATCH");
  const dependencies = createContextualMediaProductionDependencies({
    site,
    siteName: site.displayName,
    productName: product.productName,
    patchPresentation: async ({ replacements }) => {
      const contentHtml = patchContextualPresentationMedia(before.contentHtml, replacements);
      const write = await writeGenesisWordPressDraft({ operation: "UPDATE", site, wordpressObjectId: identity.wordpressObjectId, artifact: { title: before.title, contentHtml, slug: readiness.identity.canonicalPath, excerpt: before.excerpt || null, parentId: before.parentId, seo: null } });
      if (!write.ok) throw new Error(`CONTEXTUAL_MEDIA_DRAFT_PATCH_FAILED:${write.state}`);
      const after = await read();
      if (after.id !== before.id || after.status !== before.status || after.slug !== before.slug || after.parentId !== before.parentId || after.title !== before.title || after.excerpt !== before.excerpt || after.featuredMediaId !== before.featuredMediaId || JSON.stringify(after.meta) !== JSON.stringify(before.meta)) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_SCOPE_VIOLATION");
      return { storedSha256: sha256(after.contentHtml) };
    },
    certify: async () => ({ certificationId: "SKIPPED_DRAFT_READY_REPAIR", state: "PASS" as const }),
  });
  const result = await runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan, productAuthority, providerReady: provider.configured, actor: input.actor, dependencies });
  return {
    ...result,
    operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA" as const,
    visualCertificationPerformed: false as const,
    publicationPerformed: false as const,
    dispatchPerformed: false as const,
    workflowExecuted: false as const,
    regenerationPerformed: false as const,
  };
}