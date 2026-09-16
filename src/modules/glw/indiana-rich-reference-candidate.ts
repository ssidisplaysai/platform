import "server-only";

import { createHash } from "node:crypto";
import { load } from "cheerio";
import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import type { RenderedVisualCertification } from "@/modules/foundation/rendered-visual-certification";
import { getProductMediaAuthorityContent, type ProductMediaAuthorityRecord } from "./product-media-authority";
import { createIndianaRichReferenceCompositionPlan, type IndianaRichReferenceCompositionPlan } from "./indiana-rich-reference-composition-plan";

export const INDIANA_RICH_REFERENCE_CANDIDATE_NAMESPACE = "genesis-indiana-rich-reference-candidate-v1" as const;
export const INDIANA_RICH_REFERENCE_CANDIDATE_ARTIFACT_PATH = ".gcp-foundation-data/genesis-indiana-rich-reference-candidate-v1.json" as const;

export type IndianaRichReferenceCandidate = {
  candidateId: string;
  productId: string;
  state: "IN";
  compositionContractVersion: "GLW_RICH_REFERENCE_COMPOSITION_V1";
  compositionPlanFingerprint: string;
  semanticInputFingerprint: string;
  claimAuthorityFingerprint: string;
  mediaAuthorityFingerprint: string;
  heroMediaId: string;
  supportingMediaId: string;
  applicationMediaId: string;
  candidateSha: string;
  createdAt: string;
  artifact: IndianaRichReferenceCompositionPlan["artifact"];
  plan: IndianaRichReferenceCompositionPlan;
  status: "READY_FOR_VISUAL_CERTIFICATION";
  wordpressMutationAuthorized: false;
  generationPerformed: false;
};

type State = { candidates: IndianaRichReferenceCandidate[] };
const seed = (): State => ({ candidates: [] });

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function mediaFingerprint(records: readonly ProductMediaAuthorityRecord[]): string {
  return sha256(JSON.stringify(records.map((record) => ({ mediaAuthorityId: record.mediaAuthorityId, hash: record.hash, ownerApproval: record.ownerApproval, approvedUsageScopes: [...record.approvedUsageScopes], heroSelected: record.heroSelected, heroSelectedBy: record.heroSelectedBy, heroSelectedAt: record.heroSelectedAt })).sort((left, right) => left.mediaAuthorityId.localeCompare(right.mediaAuthorityId))));
}

export function buildIndianaRichReferenceCandidate(input: {
  records: readonly ProductMediaAuthorityRecord[];
  semanticSource: { jobId: string; artifactSha256: string };
  expectedPlanFingerprint: string;
  claimAuthorityFingerprint: string;
  now?: Date;
}): IndianaRichReferenceCandidate {
  const plan = createIndianaRichReferenceCompositionPlan({ records: input.records, semanticSource: input.semanticSource });
  if (plan.fingerprint !== input.expectedPlanFingerprint) throw new Error("INDIANA_RICH_CANDIDATE_PLAN_FINGERPRINT_MISMATCH");
  if (!/^[0-9a-f]{64}$/.test(input.claimAuthorityFingerprint)) throw new Error("INDIANA_RICH_CANDIDATE_CLAIM_AUTHORITY_INVALID");
  const mediaAuthorityFingerprint = mediaFingerprint(input.records);
  const candidateSha = sha256(JSON.stringify({ artifact: plan.artifact, planFingerprint: plan.fingerprint, semanticInputFingerprint: input.semanticSource.artifactSha256, claimAuthorityFingerprint: input.claimAuthorityFingerprint, mediaAuthorityFingerprint }));
  const candidate: IndianaRichReferenceCandidate = {
    candidateId: `indiana-rich-reference-candidate-${candidateSha.slice(0, 24)}`,
    productId: plan.productId,
    state: "IN",
    compositionContractVersion: "GLW_RICH_REFERENCE_COMPOSITION_V1",
    compositionPlanFingerprint: plan.fingerprint,
    semanticInputFingerprint: input.semanticSource.artifactSha256,
    claimAuthorityFingerprint: input.claimAuthorityFingerprint,
    mediaAuthorityFingerprint,
    heroMediaId: plan.media.hero.mediaAuthorityId,
    supportingMediaId: plan.media.supporting.mediaAuthorityId,
    applicationMediaId: plan.media.application.mediaAuthorityId,
    candidateSha,
    createdAt: (input.now ?? new Date()).toISOString(),
    artifact: plan.artifact,
    plan,
    status: "READY_FOR_VISUAL_CERTIFICATION",
    wordpressMutationAuthorized: false,
    generationPerformed: false,
  };
  const loaded = loadPersistedState<State>({ namespace: INDIANA_RICH_REFERENCE_CANDIDATE_NAMESPACE, seedFactory: seed });
  const existing = loaded.state.candidates.find((item) => item.candidateId === candidate.candidateId);
  if (existing) return deepClone(existing);
  if (loaded.state.candidates.length > 0) throw new Error("INDIANA_RICH_CANDIDATE_ALREADY_EXISTS");
  loaded.state.candidates.push(candidate);
  savePersistedState({ namespace: INDIANA_RICH_REFERENCE_CANDIDATE_NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(candidate);
}

export function getIndianaRichReferenceCandidate(candidateId?: string | null): IndianaRichReferenceCandidate | null {
  const candidates = loadPersistedState<State>({ namespace: INDIANA_RICH_REFERENCE_CANDIDATE_NAMESPACE, seedFactory: seed }).state.candidates;
  const candidate = candidateId ? candidates.find((item) => item.candidateId === candidateId) : candidates.at(-1);
  return candidate ? deepClone(candidate) : null;
}

export function candidateMediaDataUrls(candidate: IndianaRichReferenceCandidate): Array<{ assignmentId: string; semanticRole: "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE"; mediaId: string; dataUrl: string }> {
  return candidate.plan.mediaAssignments.map((assignment) => {
    const mediaId = assignment.approval.candidateId;
    const content = getProductMediaAuthorityContent({ mediaAuthorityId: mediaId, organizationId: assignment.organizationId, siteId: assignment.siteId, productId: candidate.productId });
    const expectedHash = assignment.asset.type === "APPROVED_EXISTING" ? assignment.asset.sha256 : "";
    if (!content || content.hash !== expectedHash) throw new Error("INDIANA_RICH_CANDIDATE_MEDIA_STALE");
    return { assignmentId: assignment.assignmentId, semanticRole: assignment.role as "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE", mediaId, dataUrl: `data:${content.mimeType};base64,${content.bytes.toString("base64")}` };
  });
}

export function renderIndianaRichReferenceCandidate(candidate: IndianaRichReferenceCandidate, media: ReturnType<typeof candidateMediaDataUrls>): string {
  const $ = load(candidate.artifact.contentHtml, null, false);
  for (const item of media) {
    const assignment = candidate.plan.mediaAssignments.find((entry) => entry.assignmentId === item.assignmentId)!;
    $(`img[src="${assignment.asset.type === "APPROVED_EXISTING" ? assignment.asset.url : ""}"]`).attr("src", item.dataUrl).attr("data-media-role", item.semanticRole).attr("data-media-id", item.mediaId);
  }
  const css = `:root{color-scheme:dark;--ink:#f7f4ed;--muted:#b8b5ad;--line:#333630;--panel:#171916;--accent:#e84b36;--lime:#b8d66b}*{box-sizing:border-box}html,body{margin:0;background:#0d0f0d;color:var(--ink);font-family:"Trebuchet MS",sans-serif}body{overflow-x:hidden}header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,76px);border-bottom:1px solid var(--line);background:#11130f}header strong{font-family:Georgia,serif;font-size:22px}header a{color:var(--ink);text-decoration:none;font-size:14px}.saw-page{width:100%;overflow:hidden}.saw-page section{padding:clamp(56px,7vw,104px) clamp(20px,7vw,100px);border-bottom:1px solid var(--line)}.saw-page h1,.saw-page h2{font-family:Georgia,serif;letter-spacing:0;margin:0}.saw-page h1{font-size:clamp(40px,6vw,84px);line-height:1.02;max-width:850px}.saw-page h2{font-size:clamp(28px,4vw,48px);line-height:1.08}.saw-page p,.saw-page li{font-size:17px;line-height:1.7;color:var(--muted);max-width:760px}.saw-hero{position:relative;min-height:min(78vh,780px);display:flex;align-items:flex-end;isolation:isolate}.saw-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.saw-hero:after{content:"";position:absolute;inset:0;background:rgba(5,8,6,.72);z-index:-1}.saw-hero-copy{max-width:920px}.saw-kicker{text-transform:uppercase;font-weight:800;color:var(--lime)!important;font-size:13px!important}.saw-copy{font-size:clamp(17px,2vw,22px)!important}.saw-actions{display:flex;gap:12px;flex-wrap:wrap}.saw-button{display:inline-flex;min-height:46px;align-items:center;padding:0 20px;background:var(--accent);color:white!important;text-decoration:none;font-weight:800}.saw-button.alt{background:transparent;border:1px solid #d9ddd5}.saw-note{font-size:13px!important}.saw-product,.saw-split{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(320px,1.1fr);gap:clamp(32px,6vw,88px);align-items:center}.saw-product>h2{grid-column:1/-1}.saw-product>img,.saw-split>img{width:100%;aspect-ratio:4/3;object-fit:cover;border:1px solid var(--line)}.saw-product-copy,.saw-split-copy{min-width:0}.saw-page ul{max-width:850px;padding-left:22px}.saw-page li+li{margin-top:12px}.saw-page section:nth-child(odd):not(.saw-hero){background:#131512}.saw-cta{background:var(--accent)!important}.saw-cta p,.saw-cta .saw-kicker{color:white!important}.saw-cta a{color:white;font-weight:800}footer{padding:32px clamp(20px,7vw,100px);color:#898d84;font-size:13px}@media(max-width:720px){header{height:60px;padding:0 18px}.saw-page section{padding:48px 20px}.saw-hero{min-height:680px}.saw-page h1{font-size:42px}.saw-product,.saw-split{grid-template-columns:1fr;gap:24px}.saw-product>h2{grid-column:auto}.saw-page p,.saw-page li{font-size:16px}.saw-actions{display:grid}.saw-button{justify-content:center;width:100%}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${candidate.artifact.seoTitle}</title><style>${css}</style></head><body><header><strong>LED Display Warehouse</strong><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a></header>${$.html()}<footer>Candidate ${candidate.candidateId} · Local review only · Not published</footer></body></html>`;
}

export function candidateVisualSummary(certification: RenderedVisualCertification): { desktopPass: boolean; mobilePass: boolean; horizontalOverflow: number; brokenImages: number; clippedHeadings: number; ctaVisible: boolean; mobileReadable: boolean } {
  const desktop = certification.captures.find((capture) => capture.viewportClass === "DESKTOP");
  const mobile = certification.captures.find((capture) => capture.viewportClass === "MOBILE");
  const pass = (viewport: typeof desktop) => Boolean(viewport && viewport.horizontalOverflow === 0 && viewport.hero.present && viewport.hero.headingBounds && viewport.hero.primaryCtaBounds && viewport.media.every((item) => item.rendered));
  const clipped = certification.captures.reduce((sum, capture) => sum + capture.sections.filter((section) => section.headingBounds && (section.headingBounds.x < section.bounds.x - 1 || section.headingBounds.x + section.headingBounds.width > section.bounds.x + section.bounds.width + 1)).length, 0);
  return { desktopPass: pass(desktop), mobilePass: pass(mobile), horizontalOverflow: Math.max(...certification.captures.map((capture) => capture.horizontalOverflow)), brokenImages: certification.captures.reduce((sum, capture) => sum + capture.media.filter((item) => !item.rendered).length, 0), clippedHeadings: clipped, ctaVisible: certification.captures.every((capture) => Boolean(capture.hero.primaryCtaBounds)), mobileReadable: Boolean(mobile && mobile.primaryContentBounds && mobile.primaryContentBounds.width <= mobile.viewportWidth && mobile.horizontalOverflow === 0) };
}
