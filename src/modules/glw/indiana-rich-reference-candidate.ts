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

function renderLegacyIndianaRichReferenceCandidate(candidate: IndianaRichReferenceCandidate, media: ReturnType<typeof candidateMediaDataUrls>): string {
  const $ = load(candidate.artifact.contentHtml, null, false);
  for (const item of media) {
    const assignment = candidate.plan.mediaAssignments.find((entry) => entry.assignmentId === item.assignmentId)!;
    $(`img[src="${assignment.asset.type === "APPROVED_EXISTING" ? assignment.asset.url : ""}"]`).attr("src", item.dataUrl).attr("data-media-role", item.semanticRole).attr("data-media-id", item.mediaId);
  }
  const css = `:root{color-scheme:dark;--ink:#f7f4ed;--muted:#b8b5ad;--line:#333630;--panel:#171916;--accent:#e84b36;--lime:#b8d66b}*{box-sizing:border-box}html,body{margin:0;background:#0d0f0d;color:var(--ink);font-family:"Trebuchet MS",sans-serif}body{overflow-x:hidden}header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,76px);border-bottom:1px solid var(--line);background:#11130f}header strong{font-family:Georgia,serif;font-size:22px}header a{color:var(--ink);text-decoration:none;font-size:14px}.saw-page{width:100%;overflow:hidden}.saw-page section{padding:clamp(56px,7vw,104px) clamp(20px,7vw,100px);border-bottom:1px solid var(--line)}.saw-page h1,.saw-page h2{font-family:Georgia,serif;letter-spacing:0;margin:0}.saw-page h1{font-size:clamp(40px,6vw,84px);line-height:1.02;max-width:850px}.saw-page h2{font-size:clamp(28px,4vw,48px);line-height:1.08}.saw-page p,.saw-page li{font-size:17px;line-height:1.7;color:var(--muted);max-width:760px}.saw-hero{position:relative;min-height:min(78vh,780px);display:flex;align-items:flex-end;isolation:isolate}.saw-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.saw-hero:after{content:"";position:absolute;inset:0;background:rgba(5,8,6,.72);z-index:-1}.saw-hero-copy{max-width:920px}.saw-kicker{text-transform:uppercase;font-weight:800;color:var(--lime)!important;font-size:13px!important}.saw-copy{font-size:clamp(17px,2vw,22px)!important}.saw-actions{display:flex;gap:12px;flex-wrap:wrap}.saw-button{display:inline-flex;min-height:46px;align-items:center;padding:0 20px;background:var(--accent);color:white!important;text-decoration:none;font-weight:800}.saw-button.alt{background:transparent;border:1px solid #d9ddd5}.saw-note{font-size:13px!important}.saw-product,.saw-split{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(320px,1.1fr);gap:clamp(32px,6vw,88px);align-items:center}.saw-product>h2{grid-column:1/-1}.saw-product>img,.saw-split>img{width:100%;aspect-ratio:4/3;object-fit:cover;border:1px solid var(--line)}.saw-product-copy,.saw-split-copy{min-width:0}.saw-page ul{max-width:850px;padding-left:22px}.saw-page li+li{margin-top:12px}.saw-page section:nth-child(odd):not(.saw-hero){background:#131512}.saw-cta{background:var(--accent)!important}.saw-cta p,.saw-cta .saw-kicker{color:white!important}.saw-cta a{color:white;font-weight:800}footer{padding:32px clamp(20px,7vw,100px);color:#898d84;font-size:13px}@media(max-width:720px){header{height:60px;padding:0 18px}.saw-page section{padding:48px 20px}.saw-hero{min-height:680px}.saw-page h1{font-size:42px}.saw-product,.saw-split{grid-template-columns:1fr;gap:24px}.saw-product>h2{grid-column:auto}.saw-page p,.saw-page li{font-size:16px}.saw-actions{display:grid}.saw-button{justify-content:center;width:100%}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${candidate.artifact.seoTitle}</title><style>${css}</style></head><body><header><strong>LED Display Warehouse</strong><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a></header>${$.html()}<footer>Candidate ${candidate.candidateId} · Local review only · Not published</footer></body></html>`;
}

export function renderIndianaRichReferenceCandidate(candidate: IndianaRichReferenceCandidate, media: ReturnType<typeof candidateMediaDataUrls>): string {
  const hero = media.find((item) => item.mediaId === candidate.heroMediaId);
  const supporting = media.find((item) => item.mediaId === candidate.supportingMediaId);
  if (!hero || !supporting) throw new Error("INDIANA_RICH_CANDIDATE_MEDIA_REQUIRED");
  const content = `<main class="saw-page" data-genesis-primary-content data-composition-contract="${candidate.compositionContractVersion}" data-candidate-id="${candidate.candidateId}" data-candidate-sha="${candidate.candidateSha}">
<section class="saw-hero" data-genesis-hero data-reference-section="HERO"><img src="${hero.dataUrl}" alt="Outdoor Digital Sphere display" data-media-role="PRODUCT_AUTHORITY" data-media-id="${hero.mediaId}"><div class="saw-hero-shade"></div><div class="saw-wrap saw-hero-copy"><p class="saw-kicker">Creative outdoor display concepts</p><h1>Outdoor Digital Sphere in Indiana</h1><p class="saw-lead">Create a memorable visual focal point for an Indiana venue, event, campus, or destination. Start with the experience you want to build, then shape the project around your location, audience, content, and timeline.</p><div class="saw-actions"><a class="saw-button" href="/contact-us/">Request Project Information</a><a class="saw-button saw-button-alt" href="/outdoor-digital-sphere/">Explore Outdoor Digital Sphere</a></div></div></section>
<section class="saw-product" data-reference-section="PRODUCT_IDENTITY"><div class="saw-wrap saw-split"><div class="saw-media-frame"><img src="${supporting.dataUrl}" alt="Outdoor Digital Sphere in an event setting" data-media-role="CONTEXTUAL_IN_USE" data-media-id="${supporting.mediaId}"></div><div class="saw-copy"><p class="saw-kicker">Outdoor Digital Sphere projects</p><h2>A bold centerpiece for shared experiences</h2><p>An outdoor digital sphere introduces a sculptural display format that can become a natural point of attention within a larger project. Its distinctive shape gives creative teams a different canvas for visual storytelling, branded moments, and event-focused content.</p><p>For projects throughout Indiana, the conversation starts with the setting and the experience. Share the location, audience, visual goals, and timing so the project can be explored around your specific needs.</p></div></div></section>
<section class="saw-applications" data-reference-section="APPLICATIONS"><div class="saw-wrap"><p class="saw-kicker">Application ideas</p><h2>Designed around the moment you want to create</h2><p class="saw-intro">Explore concepts that connect the sphere to a clear audience and purpose.</p><div class="saw-grid"><article><span>01</span><h3>Branded experiences</h3><p>Create a recognizable visual anchor for launches, campaigns, and guest experiences.</p></article><article><span>02</span><h3>Events</h3><p>Build a central content moment for festivals, celebrations, and programmed gatherings.</p></article><article><span>03</span><h3>Public spaces</h3><p>Explore a distinctive focal point for plazas and other shared environments.</p></article><article><span>04</span><h3>Campuses</h3><p>Consider creative concepts for student activities, programs, and special occasions.</p></article><article><span>05</span><h3>Hospitality and destinations</h3><p>Shape an arrival moment or visual feature around the guest journey.</p></article><article><span>06</span><h3>Experiential installations</h3><p>Bring content, place, and audience together in a focused creative concept.</p></article></div></div></section>
<section class="saw-planning" data-reference-section="PLANNING_GUIDANCE"><div class="saw-wrap"><div class="saw-section-heading"><p class="saw-kicker">Plan your project</p><h2>Turn the initial idea into a useful project brief</h2><p>Organize the first conversation around the decisions that matter to your team.</p></div><div class="saw-plan-grid"><div><strong>Location</strong><p>Describe the proposed site and how people move through it.</p></div><div><strong>Audience</strong><p>Identify who the experience is intended to reach.</p></div><div><strong>Viewing experience</strong><p>Share where visitors may approach, gather, and look.</p></div><div><strong>Content goals</strong><p>Outline the visual story, campaign, or program you want to present.</p></div><div><strong>Placement</strong><p>Note the area under consideration and relevant site constraints.</p></div><div><strong>Infrastructure</strong><p>List the site information and project requirements available for review.</p></div><div><strong>Project schedule</strong><p>Include target dates and the milestones your team is working toward.</p></div></div></div></section>
<section class="saw-cta" data-reference-section="CTA"><div class="saw-wrap saw-cta-inner"><p class="saw-kicker">Start the conversation</p><h2>Discuss an Outdoor Digital Sphere project in Indiana</h2><p>Tell us about the intended location, approximate size, application, audience, timeline, and project objectives. We will help organize the next conversation around your project.</p><a class="saw-button saw-button-light" href="/contact-us/">Request Project Information</a></div></section>
</main>`;
  const css = `:root{color-scheme:light;--saw-ink:#17201d;--saw-muted:#59625d;--saw-line:#dce1dc;--saw-paper:#f7f8f5;--saw-dark:#111816;--saw-accent:#d8402f}*{box-sizing:border-box}.saw-page{width:100%;max-width:none!important;margin:0!important;overflow:clip;background:#fff;color:var(--saw-ink);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}.saw-page section{position:relative;margin:0!important}.saw-wrap{width:min(1280px,calc(100% - 48px));margin:0 auto}.saw-page h1,.saw-page h2,.saw-page h3{margin:0;letter-spacing:0;color:inherit}.saw-page h1{max-width:850px;font-size:clamp(48px,6vw,86px);line-height:1}.saw-page h2{max-width:760px;font-size:clamp(34px,4vw,56px);line-height:1.08}.saw-page h3{font-size:21px;line-height:1.2}.saw-page p{margin:0;color:var(--saw-muted);font-size:18px;line-height:1.65}.saw-kicker{margin-bottom:18px!important;color:var(--saw-accent)!important;font-size:13px!important;font-weight:800;letter-spacing:1.4px!important;text-transform:uppercase}.saw-hero{min-height:760px;display:flex;align-items:flex-end;isolation:isolate;background:var(--saw-dark)}.saw-hero>img{position:absolute;inset:0;z-index:-2;display:block;width:100%;height:100%;object-fit:cover;object-position:center}.saw-hero-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(8,13,11,.94) 0%,rgba(8,13,11,.72) 48%,rgba(8,13,11,.2) 100%)}.saw-hero-copy{padding:104px 0 82px}.saw-hero h1{color:#fff}.saw-lead{max-width:720px;margin-top:28px!important;color:#e1e6e1!important;font-size:22px!important}.saw-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:34px}.saw-button{display:inline-flex;min-height:52px;align-items:center;justify-content:center;padding:0 24px;background:var(--saw-accent);color:#fff!important;text-decoration:none!important;font-weight:800}.saw-button-alt{border:1px solid rgba(255,255,255,.75);background:rgba(12,18,15,.3)}.saw-product{padding:88px 0;background:#fff}.saw-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(380px,1fr);gap:64px;align-items:center}.saw-media-frame{min-width:0;overflow:hidden;background:#e7e9e6}.saw-media-frame img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.saw-copy{max-width:560px}.saw-copy h2{margin-bottom:24px}.saw-copy p+p{margin-top:16px}.saw-applications{padding:88px 0 96px;background:var(--saw-paper)}.saw-intro{max-width:680px;margin-top:20px!important}.saw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:42px}.saw-grid article{display:flex;min-width:0;min-height:220px;flex-direction:column;padding:30px;border:1px solid var(--saw-line);background:#fff}.saw-grid span{display:block;margin-bottom:24px;color:var(--saw-accent);font-weight:800}.saw-grid p{margin-top:12px;font-size:16px}.saw-planning{padding:88px 0 96px;background:#fff}.saw-section-heading{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.65fr);gap:64px;align-items:end}.saw-section-heading .saw-kicker{grid-column:1/-1}.saw-section-heading p:last-child{max-width:440px;padding-bottom:4px}.saw-plan-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:24px;margin-top:46px}.saw-plan-grid>div{grid-column:span 3;min-width:0;min-height:128px;padding:20px 4px 0 0;border-top:3px solid var(--saw-ink)}.saw-plan-grid>div:nth-child(n+5){grid-column:span 4}.saw-plan-grid strong{font-size:18px}.saw-plan-grid p{margin-top:10px;font-size:15px}.saw-cta{padding:82px 0;background:var(--saw-accent);color:#fff}.saw-cta-inner{display:grid;grid-template-columns:minmax(0,.78fr) minmax(460px,1.22fr);grid-template-areas:"kicker heading" "copy heading" "button heading";gap:14px 88px;align-items:center}.saw-cta .saw-kicker,.saw-cta h2,.saw-cta p{color:#fff!important}.saw-cta .saw-kicker{grid-area:kicker;margin-bottom:2px!important}.saw-cta h2{grid-area:heading;max-width:700px;font-size:clamp(38px,4vw,58px)}.saw-cta p{grid-area:copy;max-width:560px}.saw-cta .saw-button{grid-area:button;width:max-content;margin-top:14px}.saw-button-light{background:#fff;color:var(--saw-ink)!important}@media(max-width:782px){.saw-wrap{width:min(100% - 40px,1280px)}.saw-page h1{font-size:43px}.saw-page h2{font-size:34px}.saw-page p{font-size:16px}.saw-hero{min-height:650px}.saw-hero-shade{background:linear-gradient(180deg,rgba(8,13,11,.35),rgba(8,13,11,.94) 64%)}.saw-hero-copy{padding:92px 0 52px}.saw-lead{font-size:18px!important}.saw-actions{display:grid}.saw-button{width:100%}.saw-product,.saw-applications,.saw-planning,.saw-cta{padding:64px 0}.saw-split,.saw-section-heading{grid-template-columns:1fr;gap:32px}.saw-grid{grid-template-columns:1fr;gap:14px}.saw-grid article{min-height:0;padding:26px}.saw-plan-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.saw-plan-grid>div,.saw-plan-grid>div:nth-child(n+5){grid-column:span 1;min-height:0}.saw-cta-inner{grid-template-columns:1fr;grid-template-areas:"kicker" "heading" "copy" "button";gap:20px}.saw-cta h2{font-size:36px}.saw-cta .saw-button{width:100%;margin-top:6px}}@media(max-width:420px){.saw-plan-grid{grid-template-columns:1fr}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${candidate.artifact.seoTitle}</title><style>${css}</style></head><body>${content}</body></html>`;
}

export function renderIndianaRichReferenceWordPressContent(candidate: IndianaRichReferenceCandidate): string {
  const media = candidateMediaDataUrls(candidate);
  const $ = load(renderIndianaRichReferenceCandidate(candidate, media));
  const style = $("style").first().toString();
  return `${style}${$("main").toString()}`;
}

export function candidateVisualSummary(certification: RenderedVisualCertification): { desktopPass: boolean; mobilePass: boolean; horizontalOverflow: number; brokenImages: number; blankImageContainers: number; clippedHeadings: number; headerRegression: boolean; headerOverlap: boolean; footerOverlap: boolean; ctaVisible: boolean; mobileReadable: boolean; contentWidthBalanced: boolean; sectionRhythmPass: boolean; productIntroductionCompositionPass: boolean; applicationGridPass: boolean; planningGridPass: boolean; ctaWidthAlignedWithPage: boolean; ctaTextBalance: boolean; ctaButtonProminent: boolean; excessiveCtaWhitespace: boolean; finalCtaCompositionPass: boolean } {
  const desktop = certification.captures.find((capture) => capture.viewportClass === "DESKTOP");
  const mobile = certification.captures.find((capture) => capture.viewportClass === "MOBILE");
  const pass = (viewport: typeof desktop) => Boolean(viewport && viewport.horizontalOverflow === 0 && viewport.hero.present && viewport.hero.headingBounds && viewport.hero.primaryCtaBounds && !viewport.hostIntegration.headerRegression && !viewport.hostIntegration.headerOverlap && !viewport.hostIntegration.footerOverlap && viewport.hostIntegration.blankImageContainers === 0 && viewport.hostIntegration.contentWidthBalanced && viewport.hostIntegration.sectionRhythmPass && viewport.hostIntegration.productIntroductionCompositionPass && viewport.hostIntegration.applicationGridPass && viewport.hostIntegration.planningGridPass && viewport.hostIntegration.finalCtaCompositionPass && viewport.media.every((item) => item.rendered));
  const clipped = certification.captures.reduce((sum, capture) => sum + capture.sections.filter((section) => section.headingBounds && (section.headingBounds.x < section.bounds.x - 1 || section.headingBounds.x + section.headingBounds.width > section.bounds.x + section.bounds.width + 1)).length, 0);
  return { desktopPass: pass(desktop), mobilePass: pass(mobile), horizontalOverflow: Math.max(...certification.captures.map((capture) => capture.horizontalOverflow)), brokenImages: certification.captures.reduce((sum, capture) => sum + capture.media.filter((item) => !item.rendered).length, 0), blankImageContainers: certification.captures.reduce((sum, capture) => sum + capture.hostIntegration.blankImageContainers, 0), clippedHeadings: clipped, headerRegression: certification.captures.some((capture) => capture.hostIntegration.headerRegression), headerOverlap: certification.captures.some((capture) => capture.hostIntegration.headerOverlap), footerOverlap: certification.captures.some((capture) => capture.hostIntegration.footerOverlap), ctaVisible: certification.captures.every((capture) => Boolean(capture.hero.primaryCtaBounds)), mobileReadable: Boolean(mobile && mobile.primaryContentBounds && mobile.primaryContentBounds.width <= mobile.viewportWidth && mobile.horizontalOverflow === 0), contentWidthBalanced: certification.captures.every((capture) => capture.hostIntegration.contentWidthBalanced), sectionRhythmPass: certification.captures.every((capture) => capture.hostIntegration.sectionRhythmPass), productIntroductionCompositionPass: certification.captures.every((capture) => capture.hostIntegration.productIntroductionCompositionPass), applicationGridPass: certification.captures.every((capture) => capture.hostIntegration.applicationGridPass), planningGridPass: certification.captures.every((capture) => capture.hostIntegration.planningGridPass), ctaWidthAlignedWithPage: certification.captures.every((capture) => capture.hostIntegration.ctaWidthAlignedWithPage), ctaTextBalance: certification.captures.every((capture) => capture.hostIntegration.ctaTextBalance), ctaButtonProminent: certification.captures.every((capture) => capture.hostIntegration.ctaButtonProminent), excessiveCtaWhitespace: certification.captures.some((capture) => capture.hostIntegration.excessiveCtaWhitespace), finalCtaCompositionPass: certification.captures.every((capture) => capture.hostIntegration.finalCtaCompositionPass) };
}
