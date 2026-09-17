import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSiteById } from "./site-repository";
import { getSiteBuildRecords, getSiteBuildSession } from "./site-generation-readiness-repository";
import { listSiteVisualAssemblies } from "./site-visual-assembly-repository";
import { captureGovernedRenderedPage, type CaptureMediaAssignment, type GovernedBrowserCaptureInput, type GovernedBrowserCaptureResult } from "./governed-render-capture-browser";
import { governedCaptureFailureCode, GOVERNED_RENDER_CAPTURE_LIMITS, type GovernedCaptureMode, withGovernedCaptureLock } from "./governed-render-capture-security";
import { appendRenderedVisualCaptureAudit, getRenderedVisualCertificationState, listRenderedVisualCertifications, saveRenderedVisualCertification, storeRenderedVisualCaptureArtifact } from "./rendered-visual-certification-repository";
import { deriveRenderedVisualFindings, hashRenderedVisualContent, renderedVisualOverallState, type RenderedVisualCertification, type RenderedVisualLayoutClass, type RenderedVisualPageIdentity } from "./rendered-visual-certification";
import { buildGeneratedPageReviewModel } from "../glw/generated-page-review-read-model";

type BrowserAdapter = (input: GovernedBrowserCaptureInput) => Promise<GovernedBrowserCaptureResult>;
export type CaptureAuthority = { identity: RenderedVisualPageIdentity; targetUrl: string; allowedOrigins: string[]; internalGenesisOrigin: string | null; internalAuthorization: { header: string; value: string } | null; layoutClass: RenderedVisualLayoutClass; mediaAssignments: CaptureMediaAssignment[] };
const VIEWPORTS = [{ viewportClass: "DESKTOP" as const, width: 1440, height: 1000 }, { viewportClass: "MOBILE" as const, width: 375, height: 812 }];

function secret(): string { const value = process.env.GENESIS_CREDENTIAL_MASTER_KEY?.trim(); if (!value) throw new Error("CAPTURE_INTERNAL_AUTHORITY_UNAVAILABLE"); return value; }
export function signGovernedSnapshotPath(path: string): string { return createHmac("sha256", secret()).update(path).digest("hex"); }
export function verifyGovernedSnapshotPath(path: string, signature: string | null): boolean { if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false; const expected = signGovernedSnapshotPath(path); return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }

function internalOrigin(): string {
  const value = process.env.GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN?.trim() ?? "";
  if (!value) throw new Error("CAPTURE_INTERNAL_ORIGIN_NOT_CONFIGURED");
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("CAPTURE_INTERNAL_ORIGIN_NOT_CONFIGURED"); }
  if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("CAPTURE_INTERNAL_ORIGIN_NOT_CONFIGURED");
  return parsed.origin;
}

function generatedIdentity(model: NonNullable<Awaited<ReturnType<typeof buildGeneratedPageReviewModel>>>, organizationId: string, siteId: string): RenderedVisualPageIdentity {
  return { organizationId, siteId, pageId: model.identity.targetId, pageRevisionIdentity: `job:${model.trace.jobId}:${model.trace.lastActivity}`, canonicalPath: model.identity.canonicalPath, contentHash: hashRenderedVisualContent(model.source.rawHtml), renderedContentHash: model.wordpress.previewHtml ? hashRenderedVisualContent(model.wordpress.previewHtml) : null, campaignId: model.identity.campaignId, targetId: model.identity.targetId, jobId: model.trace.jobId, externalExecutionId: model.trace.externalExecutionId, wordpressObjectId: model.wordpress.objectId, wordpressStatus: model.wordpress.status };
}

export function assertGeneratedCaptureOwnership(input: { requestedOrganizationId: string; requestedSiteId: string; resolvedOrganizationId: string; resolvedSiteId: string; wordpressObjectId: string | null; traceWordpressObjectId: string | null; wordpressVerified: boolean }): void {
  if (input.requestedOrganizationId !== input.resolvedOrganizationId || input.requestedSiteId !== input.resolvedSiteId || !input.wordpressObjectId || input.wordpressObjectId !== input.traceWordpressObjectId || !input.wordpressVerified) throw new Error("AUTHORITY_MISMATCH");
}

export async function resolveGeneratedPageCaptureAuthority(input: { organizationId: string; siteId: string; jobId: string }): Promise<CaptureAuthority> {
  const model = await buildGeneratedPageReviewModel(input);
  if (!model) throw new Error("PAGE_NOT_FOUND");
  assertGeneratedCaptureOwnership({ requestedOrganizationId: input.organizationId, requestedSiteId: input.siteId, resolvedOrganizationId: model.actions.visualCapture.organizationId, resolvedSiteId: model.actions.visualCapture.siteId, wordpressObjectId: model.wordpress.objectId, traceWordpressObjectId: model.trace.wordpressObjectId, wordpressVerified: model.wordpress.verified });
  if (!model.wordpress.previewHtml) throw new Error(model.wordpress.readState === "AUTH_FAILURE" ? "WORDPRESS_AUTH_FAILED" : "AUTHORITY_MISMATCH");
  const site = getSiteById(input.siteId);
  if (!site || site.organizationId !== input.organizationId || !site.domain) throw new Error("AUTHORITY_MISMATCH");
  const identity = generatedIdentity(model, input.organizationId, input.siteId);
  const origin = internalOrigin();
  const pathname = `/api/glw/pages/${encodeURIComponent(input.jobId)}/visual-snapshot`;
  const query = `organizationId=${encodeURIComponent(input.organizationId)}&siteId=${encodeURIComponent(input.siteId)}`;
  const signedPath = `${pathname}?${query}`;
  return { identity, targetUrl: `${origin}${signedPath}`, allowedOrigins: [origin, `https://${site.domain.replace(/^www\./, "")}`], internalGenesisOrigin: origin, internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) }, layoutClass: "CONTENT_ARTICLE", mediaAssignments: model.images.contextualInUse.imageUrl ? [{ assignmentId: null, semanticRole: "CONTEXTUAL_IN_USE", mediaId: model.images.contextualInUse.wordpressMediaId, sourceUrl: model.images.contextualInUse.imageUrl, contextId: model.images.contextualInUse.state }] : [] };
}

export function resolveSiteHomeCaptureAuthority(input: { organizationId: string; siteId: string }): CaptureAuthority {
  const site = getSiteById(input.siteId);
  if (!site || site.organizationId !== input.organizationId || !site.enabled || site.lifecycleState !== "active" || !site.domain) throw new Error("AUTHORITY_MISMATCH");
  const session = getSiteBuildSession(input); if (!session) throw new Error("PAGE_NOT_FOUND");
  const records = getSiteBuildRecords({ ...input, buildSessionId: session.buildSessionId });
  const page = records.currentAssembly?.pages.find((item) => item.pageRole === "HOME") ?? null;
  const update = page ? records.wordpressContentUpdates.find((item) => item.pageRevisionId === page.pageRevisionId) ?? null : null;
  if (!page || !update) throw new Error("PAGE_NOT_FOUND");
  const visual = listSiteVisualAssemblies({ ...input, buildSessionId: session.buildSessionId }).filter((item) => item.pageId === page.pageId).at(-1) ?? null;
  if (!visual || visual.pageRevisionId !== page.pageRevisionId || visual.wordpressObjectId !== update.wordpressObjectId) throw new Error("AUTHORITY_MISMATCH");
  const origin = new URL(`https://${site.domain.replace(/^www\./, "")}`).origin;
  return { identity: { organizationId: input.organizationId, siteId: input.siteId, pageId: page.pageId, pageRevisionIdentity: page.pageRevisionId, canonicalPath: "/", contentHash: page.contentFingerprint, renderedContentHash: null, campaignId: null, targetId: null, jobId: null, externalExecutionId: null, wordpressObjectId: update.wordpressObjectId, wordpressStatus: "publish" }, targetUrl: `${origin}/`, allowedOrigins: [origin], internalGenesisOrigin: null, internalAuthorization: null, layoutClass: "FULL_WIDTH_MARKETING_PAGE", mediaAssignments: [{ assignmentId: visual.assemblyId, semanticRole: "CONTEXTUAL_IN_USE", mediaId: visual.wordpressMediaId, sourceUrl: visual.wordpressMediaUrl, contextId: visual.designSystemVersion }] };
}

function currentCertification(authority: CaptureAuthority): RenderedVisualCertification | null {
  if (authority.identity.renderedContentHash) return getRenderedVisualCertificationState({ currentIdentity: authority.identity }).certification;
  return listRenderedVisualCertifications({ organizationId: authority.identity.organizationId, siteId: authority.identity.siteId, pageId: authority.identity.pageId }).filter((item) => item.identity.pageRevisionIdentity === authority.identity.pageRevisionIdentity && item.identity.contentHash === authority.identity.contentHash).at(-1) ?? null;
}

export async function runGovernedRenderCapture(input: { authority: CaptureAuthority; mode: GovernedCaptureMode; actor: string; browserAdapter?: BrowserAdapter }): Promise<{ certification: RenderedVisualCertification; reused: boolean; ownerDecision: "PENDING"; publicationPerformed: false; wordpressMutationPerformed: false }> {
  const existing = currentCertification(input.authority);
  if (existing && input.mode === "CURRENT") return { certification: existing, reused: true, ownerDecision: "PENDING", publicationPerformed: false, wordpressMutationPerformed: false };
  const key = `${input.authority.identity.organizationId}:${input.authority.identity.siteId}:${input.authority.identity.pageId}`;
  return withGovernedCaptureLock(key, async () => {
    const captureSetId = `visual-capture-set-${randomUUID()}`; const startedAt = new Date().toISOString();
    appendRenderedVisualCaptureAudit({ actor: input.actor, organizationId: input.authority.identity.organizationId, siteId: input.authority.identity.siteId, pageId: input.authority.identity.pageId, pageRevisionIdentity: input.authority.identity.pageRevisionIdentity, certificationId: null, captureSetId, startedAt, completedAt: null, result: "STARTED", failureReason: null });
    try {
      const adapter = input.browserAdapter ?? captureGovernedRenderedPage;
      const results: GovernedBrowserCaptureResult[] = [];
      for (const viewport of VIEWPORTS) results.push(await adapter({ targetUrl: input.authority.targetUrl, allowedOrigins: input.authority.allowedOrigins, internalGenesisOrigin: input.authority.internalGenesisOrigin, internalAuthorization: input.authority.internalAuthorization, viewportClass: viewport.viewportClass, viewport: { width: viewport.width, height: viewport.height }, captureId: `${captureSetId}-${viewport.viewportClass.toLowerCase()}`, mediaAssignments: input.authority.mediaAssignments }));
      if (results.length > GOVERNED_RENDER_CAPTURE_LIMITS.maximumCapturesPerRequest || results.reduce((sum, item) => sum + item.bytes.byteLength, 0) > GOVERNED_RENDER_CAPTURE_LIMITS.maximumCaptureSetBytes) throw new Error("CAPTURE_SET_TOO_LARGE");
      if (results[0].renderedContentHash !== results[1].renderedContentHash) throw new Error("CAPTURE_RENDER_IDENTITY_MISMATCH");
      const identity = { ...input.authority.identity, renderedContentHash: input.authority.identity.renderedContentHash ?? results[0].renderedContentHash };
      const captures = results.map((result) => ({ ...result.evidence, screenshotArtifact: storeRenderedVisualCaptureArtifact({ organizationId: identity.organizationId, siteId: identity.siteId, captureSetId, captureId: result.evidence.captureId, mediaType: "image/png", bytes: result.bytes, width: result.imageWidth, height: result.imageHeight }) }));
      const findings = deriveRenderedVisualFindings({ layoutClass: input.authority.layoutClass, captures });
      const now = new Date().toISOString();
      const certification = saveRenderedVisualCertification({ certificationId: `visual-certification-${randomUUID()}`, contract: "rendered-visual-certification-v1", schemaVersion: 1, identity, layoutClass: input.authority.layoutClass, captureSetId, captures, findings, overallState: renderedVisualOverallState(findings), capturedAt: captures[0].capturedAt, createdAt: now, createdBy: input.actor, mutationPerformed: false });
      appendRenderedVisualCaptureAudit({ actor: input.actor, organizationId: identity.organizationId, siteId: identity.siteId, pageId: identity.pageId, pageRevisionIdentity: identity.pageRevisionIdentity, certificationId: certification.certificationId, captureSetId, startedAt, completedAt: now, result: "SUCCEEDED", failureReason: null });
      return { certification, reused: false, ownerDecision: "PENDING", publicationPerformed: false, wordpressMutationPerformed: false };
    } catch (error) {
      appendRenderedVisualCaptureAudit({ actor: input.actor, organizationId: input.authority.identity.organizationId, siteId: input.authority.identity.siteId, pageId: input.authority.identity.pageId, pageRevisionIdentity: input.authority.identity.pageRevisionIdentity, certificationId: null, captureSetId, startedAt, completedAt: new Date().toISOString(), result: "FAILED", failureReason: governedCaptureFailureCode(error) });
      throw error;
    }
  });
}