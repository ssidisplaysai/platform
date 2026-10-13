import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { captureGovernedRenderedPage } from "@/modules/foundation/governed-render-capture-browser";
import { resolvePersistenceRoot } from "@/modules/foundation/foundation-persistence";
import { signGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { getLocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { HOUSTON_BUNDLE_ID, HOUSTON_PRODUCT_MEDIA_ID, HOUSTON_PRODUCT_MEDIA_URL } from "./houston-reference-preview";
import { evaluateHoustonThemeIntegration, type HoustonDraftVisualCertification, type HoustonThemeCapture } from "./houston-approved-preview-draft";
import { getHoustonDraftState, saveHoustonDraftCertification, saveHoustonPreviewDraftComparison } from "./houston-approved-preview-draft-repository";
import { evaluateHoustonPreviewDraftDrift } from "./houston-approved-preview-render";
import { inspectHoustonWordPressAuthority } from "./houston-approved-preview-draft-service";

const VIEWPORTS = [
  { viewport: "DESKTOP_1440" as const, width: 1440, height: 1024, viewportClass: "DESKTOP" as const },
  { viewport: "DESKTOP_1024" as const, width: 1024, height: 900, viewportClass: "DESKTOP" as const },
  { viewport: "TABLET_768" as const, width: 768, height: 1024, viewportClass: "DESKTOP" as const },
  { viewport: "MOBILE_375" as const, width: 375, height: 812, viewportClass: "MOBILE" as const },
];
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
function store(receiptId: string, captureId: string, bytes: Uint8Array, width: number, height: number) { const reference = `houston-theme-integrated-draft-artifacts/${receiptId}/${captureId}.png`; const path = join(resolvePersistenceRoot(), ...reference.split("/")); const digest = sha(bytes); mkdirSync(dirname(path), { recursive: true }); if (existsSync(path) && sha(readFileSync(path)) !== digest) throw new Error("HOUSTON_DRAFT_CAPTURE_COLLISION"); if (!existsSync(path)) writeFileSync(path, bytes); return { reference, sha256: digest, bytes: bytes.length, width, height }; }
export function readHoustonDraftCapture(reference: string) { if (!reference.startsWith("houston-theme-integrated-draft-artifacts/") || reference.includes("..")) throw new Error("HOUSTON_DRAFT_CAPTURE_REFERENCE_INVALID"); return readFileSync(join(resolvePersistenceRoot(), ...reference.split("/"))); }

export async function captureHoustonThemeIntegratedDraft() {
  const state = getHoustonDraftState(); const receipt = state.receipts.at(-1); if (!receipt) throw new Error("HOUSTON_DRAFT_RECEIPT_REQUIRED"); const existing = state.certifications.find((item) => item.receiptId === receipt.receiptId); if (existing) return { certification: existing, comparison: state.comparisons.find((item) => item.receiptId === receipt.receiptId)!, reused: true };
  const local = getLocalPageThemingBundle({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, bundleId: HOUSTON_BUNDLE_ID }); if (!local) throw new Error("HOUSTON_PREVIEW_BUNDLE_REQUIRED");
  const current = await inspectHoustonWordPressAuthority(receipt.wordpressObjectId); if (current.body.hash !== receipt.bodyHash || current.identity.template !== receipt.template || current.featuredMediaId !== HOUSTON_PRODUCT_MEDIA_ID) throw new Error("HOUSTON_DRAFT_CAPTURE_IDENTITY_STALE");
  const assignments = [{ assignmentId: `wordpress-media:${HOUSTON_PRODUCT_MEDIA_ID}`, semanticRole: "PRODUCT_AUTHORITY" as const, mediaId: String(HOUSTON_PRODUCT_MEDIA_ID), sourceUrl: HOUSTON_PRODUCT_MEDIA_URL, contextId: "DOCUMENTARY" }, ...receipt.uploadedMedia.map((item) => ({ assignmentId: `wordpress-media:${item.mediaId}`, semanticRole: item.role, mediaId: String(item.mediaId), sourceUrl: item.url, contextId: item.claimClass }))];
  const origin = new URL(process.env.GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN?.trim() || "http://localhost:3003").origin; const pathname = "/api/glw/houston-approved-draft/theme-integrated-snapshot"; const query = "organizationId=ssi&siteId=site-ssi-projectorenclosure"; const signedPath = `${pathname}?${query}`; const setId = `capture-${sha(new Date().toISOString()).slice(0, 16)}`; const captures: HoustonThemeCapture[] = [];
  for (const viewport of VIEWPORTS) { const captureId = `${setId}-${viewport.viewport.toLowerCase()}`; const result = await captureGovernedRenderedPage({ targetUrl: `${origin}${signedPath}`, allowedOrigins: [origin, "https://projectorenclosure.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"], internalGenesisOrigin: origin, internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) }, viewportClass: viewport.viewportClass, viewport: { width: viewport.width, height: viewport.height }, captureId, mediaAssignments: assignments }); captures.push({ captureId, viewport: viewport.viewport, width: viewport.width, height: viewport.height, documentWidth: result.evidence.documentWidth, documentHeight: result.evidence.documentHeight, horizontalOverflow: result.evidence.horizontalOverflow, themeIntegration: result.themeIntegration, mediaRolesRendered: result.evidence.media.filter((item) => item.rendered).map((item) => item.semanticRole), sectionCount: result.evidence.sections.length, artifact: store(receipt.receiptId, captureId, result.bytes, result.imageWidth, result.imageHeight), capturedAt: result.evidence.capturedAt }); }
  const ready = evaluateHoustonThemeIntegration(captures); const createdAt = new Date().toISOString(); const certification: HoustonDraftVisualCertification = { certificationId: `houston-theme-draft-certification-${receipt.receiptId}`, receiptId: receipt.receiptId, renderClass: "THEME_INTEGRATED_RENDER", captureAuthority: "SIGNED_INTERNAL_EQUIVALENT_USING_LIVE_ELEMENTOR_HEADER_FOOTER_SHELL", captures, themeIntegrationReady: ready.state === "PASS", overallState: ready.state, createdAt, ownerReviewRequired: true, publicationPerformed: false };
  if (ready.state !== "PASS") throw new Error(`HOUSTON_THEME_INTEGRATION_NOT_READY:${ready.failures.join(",")}`);
  saveHoustonDraftCertification(certification); const drift = evaluateHoustonPreviewDraftDrift({ expectedBodyHash: receipt.bodyHash, actualBodyHash: current.body.hash, expectedLinks: local.links.links.map((item) => item.url), actualLinks: current.body.links, expectedRoles: local.media.map((item) => item.role), actualRoles: current.body.roles, actualHtml: current.body.raw }); if (drift.drift === "MATERIAL" || drift.drift === "CRITICAL") throw new Error(`HOUSTON_PREVIEW_DRAFT_DRIFT_${drift.drift}`);
  const comparison = saveHoustonPreviewDraftComparison({ comparisonId: `houston-preview-draft-comparison-${receipt.receiptId}`, receiptId: receipt.receiptId, previewVisualCertificationId: state.approvals.find((item) => item.decisionId === receipt.decisionId)!.exactIdentity.previewVisualCertificationId, draftVisualCertificationId: certification.certificationId, drift: drift.drift, reasons: [...drift.reasons, "LIVE_THEME_HEADER_FOOTER_EQUIVALENT"], ownerReviewRequired: true, publicationAuthorized: false, createdAt }); return { certification, comparison, reused: false };
}
