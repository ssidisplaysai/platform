import { createHash } from "node:crypto";

import type { SiteGeneratedPageRevision } from "./site-page-generation";
import type { SiteVisualAssembly } from "./site-visual-assembly-repository";

export const COMMERCIAL_STAINLESS_SITE_ID = "site-rj-metal-commercial-stainless-counters";
export const COMMERCIAL_STAINLESS_ORIGIN = "https://commercialstainlesscounters.com";
export const COMMERCIAL_STAINLESS_RICH_COMPOSITION_VERSION = "commercial-stainless-rich-composition-v1";

export type CommercialStainlessCompositionProfile = "PRODUCT_SERVICE" | "CAPABILITY" | "INDUSTRY_APPLICATION" | "DESIGN_BUILD" | "LANDING_CONVERSION" | "RESOURCE";

export type CommercialStainlessPageInventoryItem = {
  wordpressObjectId: string;
  title: string;
  url: string;
  pageType: SiteGeneratedPageRevision["pageRole"];
  currentH1: string;
  currentSeo: { title: string; metaDescription: string };
  currentCanonical: string;
  currentMedia: { id: string; url: string; provenance: SiteVisualAssembly["imageProvenance"]; referenceClassification: SiteVisualAssembly["referenceClassification"] };
  currentInternalLinks: Array<{ label: string; href: string }>;
  currentCompositionProfile: string;
  currentVisualWeaknesses: string[];
  recommendedNewProfile: CommercialStainlessCompositionProfile;
};

export type CommercialStainlessRolloutPlanItem = {
  page: string;
  canonicalPath: string;
  profile: CommercialStainlessCompositionProfile;
  heroTreatment: string;
  mediaRequirements: string;
  keySections: string[];
  ctaTreatment: string;
  specialConsiderations: string;
};

export type CommercialStainlessRichPreview = {
  version: typeof COMMERCIAL_STAINLESS_RICH_COMPOSITION_VERSION;
  previewOnly: true;
  wordpressMutation: false;
  publicationMutation: false;
  campaignMutation: false;
  page: CommercialStainlessPageInventoryItem;
  html: string;
  seoHashBefore: string;
  seoHashAfter: string;
  preservedLinks: string[];
  media: Array<{ id: string; url: string; provenance: string; role: string }>;
  geometry: { currentCanvasWidth: number; proposedCanvasWidth: number; breakpoints: number[] };
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function absoluteUrl(path: string): string {
  return new URL(path, COMMERCIAL_STAINLESS_ORIGIN).href;
}

function seoHash(item: Pick<CommercialStainlessPageInventoryItem, "currentH1" | "currentSeo" | "currentCanonical">): string {
  return createHash("sha256").update(JSON.stringify({ h1: item.currentH1, title: item.currentSeo.title, metaDescription: item.currentSeo.metaDescription, canonical: item.currentCanonical })).digest("hex");
}

export function classifyCommercialStainlessPage(page: Pick<SiteGeneratedPageRevision, "pageRole" | "canonicalPath">): CommercialStainlessCompositionProfile {
  if (page.canonicalPath === "/design-build-fabrication/") return "DESIGN_BUILD";
  if (page.pageRole === "HOME" || page.pageRole === "CONTACT") return "LANDING_CONVERSION";
  if (page.pageRole === "CAPABILITIES") return "CAPABILITY";
  if (page.pageRole === "MARKET") return "INDUSTRY_APPLICATION";
  if (page.pageRole === "ABOUT") return "RESOURCE";
  return "PRODUCT_SERVICE";
}

function visualWeaknesses(page: SiteGeneratedPageRevision): string[] {
  const common = ["Theme constraint reduces the designed canvas to approximately 645px on desktop.", "Page content repeats a body-level brand/navigation shell below the certified global header.", "Section rhythm relies on a repeated narrow text-and-card pattern."];
  if (page.pageRole === "MARKET") return [...common, "Industry context is carried by one hero image instead of varied application modules."];
  if (page.pageRole === "OFFERING") return [...common, "Product and fabrication pathways need stronger media-backed hierarchy and process context."];
  if (page.pageRole === "CAPABILITIES") return [...common, "Capability workflow and project-input guidance are not visually differentiated."];
  if (page.pageRole === "HOME") return ["Homepage is the approved visual direction and should remain unchanged during the proof."];
  return [...common, "Conversion hierarchy is visually understated."];
}

export function inventoryCommercialStainlessPages(input: { pages: SiteGeneratedPageRevision[]; visuals: SiteVisualAssembly[] }): CommercialStainlessPageInventoryItem[] {
  const currentVisuals = new Map(input.visuals.map((visual) => [visual.pageId, visual]));
  const inventory = input.pages.map((page) => {
    const visual = currentVisuals.get(page.pageId);
    if (!visual) throw new Error(`COMMERCIAL_STAINLESS_VISUAL_AUTHORITY_MISSING:${page.pageId}`);
    return {
      wordpressObjectId: visual.wordpressObjectId,
      title: page.name,
      url: absoluteUrl(page.canonicalPath),
      pageType: page.pageRole,
      currentH1: page.h1,
      currentSeo: { title: page.seoTitle, metaDescription: page.metaDescription },
      currentCanonical: absoluteUrl(page.canonicalPath),
      currentMedia: { id: visual.wordpressMediaId, url: visual.wordpressMediaUrl, provenance: visual.imageProvenance, referenceClassification: visual.referenceClassification },
      currentInternalLinks: page.internalLinks.map((link) => ({ label: link.anchorText, href: link.href })),
      currentCompositionProfile: page.pageRole === "HOME" ? "APPROVED_HOME_VISUAL" : `LEGACY_NARROW_${page.pageRole}`,
      currentVisualWeaknesses: visualWeaknesses(page),
      recommendedNewProfile: classifyCommercialStainlessPage(page),
    } satisfies CommercialStainlessPageInventoryItem;
  }).sort((left, right) => Number(left.wordpressObjectId) - Number(right.wordpressObjectId));
  if (inventory.length !== 15 || inventory.map((item) => item.wordpressObjectId).join(",") !== "10,11,12,13,14,15,16,17,18,19,20,21,22,23,24") throw new Error("COMMERCIAL_STAINLESS_15_PAGE_AUTHORITY_REQUIRED");
  return inventory;
}

function itemByPath(inventory: CommercialStainlessPageInventoryItem[], path: string): CommercialStainlessPageInventoryItem {
  const item = inventory.find((candidate) => new URL(candidate.url).pathname === path);
  if (!item) throw new Error(`COMMERCIAL_STAINLESS_PAGE_AUTHORITY_MISSING:${path}`);
  return item;
}

function mediaFigure(item: CommercialStainlessPageInventoryItem, label: string): string {
  return `<figure class="csc-media"><img src="${escapeHtml(item.currentMedia.url)}" alt="${escapeHtml(label)}"><figcaption>${escapeHtml(label)} <span>Existing approved media ${escapeHtml(item.currentMedia.id)} · ${escapeHtml(item.currentMedia.provenance.replaceAll("_", " "))}</span></figcaption></figure>`;
}

function linkCard(item: CommercialStainlessPageInventoryItem, eyebrow: string): string {
  return `<a class="csc-card" href="${escapeHtml(new URL(item.url).pathname)}"><img src="${escapeHtml(item.currentMedia.url)}" alt="Conceptual visual for ${escapeHtml(item.title)}"><span>${escapeHtml(eyebrow)}</span><strong>${escapeHtml(item.title)}</strong><small>Explore pathway</small></a>`;
}

export function renderDesignBuildRichComposition(input: { page: SiteGeneratedPageRevision; inventory: CommercialStainlessPageInventoryItem[] }): CommercialStainlessRichPreview {
  const proof = itemByPath(input.inventory, "/design-build-fabrication/");
  if (proof.wordpressObjectId !== "14" || input.page.canonicalPath !== "/design-build-fabrication/") throw new Error("COMMERCIAL_STAINLESS_DESIGN_BUILD_AUTHORITY_REQUIRED");
  const capabilities = itemByPath(input.inventory, "/capabilities/");
  const products = ["/commercial-stainless-counters/", "/commercial-worktables-and-prep-tables/", "/stainless-countertop/", "/mobile-and-modular-stainless-workstations/"].map((path) => itemByPath(input.inventory, path));
  const industries = ["/markets/foodservice/", "/markets/healthcare/", "/markets/education/", "/markets/hospitality/", "/markets/industrial/", "/markets/labs/"].map((path) => itemByPath(input.inventory, path));
  const requiredPaths = new Set(["/about/", "/capabilities/", ...input.page.internalLinks.map((link) => link.href), ...products.map((item) => new URL(item.url).pathname)]);
  const preservedLinks = [...requiredPaths].sort();
  const heroCopy = input.page.sections[0]?.body.join(" ") ?? "";
  const fitCopy = input.page.sections[1]?.body.join(" ") ?? "";
  const inputsCopy = input.page.sections[2]?.body.join(" ") ?? "";
  const coordinationCopy = input.page.sections[3]?.body.join(" ") ?? "";
  const finalCopy = input.page.sections.at(-1)?.body.join(" ") ?? "";
  const title = escapeHtml(input.page.h1);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(input.page.metaDescription)}"><link rel="canonical" href="${escapeHtml(proof.currentCanonical)}"><base href="${COMMERCIAL_STAINLESS_ORIGIN}/"><title>${escapeHtml(input.page.seoTitle)}</title><style>
:root{--csc-black:#0d0f10;--csc-charcoal:#191c1e;--csc-red:#c91f2b;--csc-white:#fff;--csc-steel:#e7e9e9;--csc-muted:#606568}*{box-sizing:border-box}html,body{margin:0;overflow-x:hidden;background:var(--csc-white);color:var(--csc-black);font-family:Arial,sans-serif}a{color:inherit}.csc-shell-wrap,.csc-wrap{width:min(1240px,calc(100% - 64px));margin:0 auto}.csc-global-header{position:relative;z-index:2;border-bottom:1px solid #d8dada;background:#fff}.csc-global-header .csc-shell-wrap{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:32px}.csc-site-title{max-width:260px;font-family:Impact,'Arial Narrow',sans-serif;font-size:25px;line-height:1;text-transform:uppercase;text-decoration:none}.csc-global-nav{display:flex;align-items:center;gap:22px;font-size:12px;font-weight:800;text-transform:uppercase}.csc-global-nav a,.csc-mobile-menu a{text-decoration:none}.csc-global-nav .csc-nav-cta,.csc-mobile-menu .csc-nav-cta{padding:14px 18px;background:var(--csc-red);color:#fff}.csc-mobile-menu{display:none}.csc-rich-main{margin:0}.csc-hero{position:relative;min-height:650px;display:flex;align-items:center;isolation:isolate;background:#111;color:#fff}.csc-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-2}.csc-hero:after{content:"";position:absolute;inset:0;background:rgba(5,7,8,.72);z-index:-1}.csc-hero-copy{max-width:790px;padding:96px 0}.csc-eyebrow{display:flex;align-items:center;gap:12px;margin:0 0 20px;color:var(--csc-red);font-size:12px;font-weight:900;text-transform:uppercase}.csc-eyebrow:before{content:"";width:36px;height:4px;background:currentColor}.csc-hero h1,.csc-section h2,.csc-split h2,.csc-final-cta h2{margin:0;font-family:Impact,'Arial Narrow',sans-serif;font-size:76px;line-height:.96;text-transform:uppercase}.csc-hero p{max-width:690px;margin:24px 0 0;font-size:19px;line-height:1.65}.csc-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}.csc-button{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 24px;background:var(--csc-red);color:#fff;font-size:13px;font-weight:900;text-decoration:none;text-transform:uppercase}.csc-button--ghost{border:1px solid #fff;background:transparent}.csc-benefits{background:var(--csc-black);color:#fff}.csc-benefits .csc-wrap{display:grid;grid-template-columns:repeat(4,1fr)}.csc-benefit{padding:28px 24px;border-right:1px solid #34383a}.csc-benefit:last-child{border-right:0}.csc-benefit strong{display:block;font-size:15px;text-transform:uppercase}.csc-benefit span{display:block;margin-top:8px;color:#b9bdbe;font-size:12px;line-height:1.45}.csc-section{padding:88px 0}.csc-section--steel{background:var(--csc-steel)}.csc-section--dark{background:var(--csc-charcoal);color:#fff}.csc-section h2,.csc-split h2,.csc-final-cta h2{max-width:900px;font-size:54px;line-height:1}.csc-lead{max-width:760px;margin:22px 0 0;color:var(--csc-muted);font-size:17px;line-height:1.7}.csc-section--dark .csc-lead{color:#c6c9ca}.csc-card-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:38px}.csc-card{min-height:340px;display:flex;flex-direction:column;background:#fff;color:#111;text-decoration:none}.csc-card img{width:100%;height:190px;object-fit:cover}.csc-card span,.csc-card strong,.csc-card small{margin-left:22px;margin-right:22px}.csc-card span{margin-top:20px;color:var(--csc-red);font-size:11px;font-weight:900;text-transform:uppercase}.csc-card strong{margin-top:9px;font-size:18px;line-height:1.2;text-transform:uppercase}.csc-card small{margin-top:auto;padding:16px 0 22px;color:#555;font-weight:700;text-transform:uppercase}.csc-process{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin-top:38px;background:#383c3e}.csc-step{min-height:230px;padding:28px 22px;background:var(--csc-charcoal)}.csc-step b{display:block;color:var(--csc-red);font-size:36px}.csc-step strong{display:block;margin-top:26px;font-size:15px;text-transform:uppercase}.csc-step p{margin:10px 0 0;color:#bfc2c3;font-size:13px;line-height:1.55}.csc-split{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);min-height:620px;background:var(--csc-black);color:#fff}.csc-split .csc-media{min-height:620px}.csc-split-copy{display:flex;flex-direction:column;justify-content:center;padding:76px}.csc-split-copy p{max-width:590px;color:#c7caca;font-size:17px;line-height:1.7}.csc-media{position:relative;margin:0;background:#111;overflow:hidden}.csc-media img{width:100%;height:100%;object-fit:cover}.csc-media figcaption{position:absolute;left:22px;right:22px;bottom:20px;padding:12px;background:rgba(0,0,0,.78);color:#fff;font-size:12px;font-weight:800;text-transform:uppercase}.csc-media figcaption span{display:block;margin-top:5px;color:#bbb;font-size:10px;font-weight:400}.csc-industry-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:38px}.csc-industry-grid .csc-card{min-height:300px}.csc-industry-grid .csc-card img{height:170px}.csc-inputs{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.7fr);gap:56px;align-items:start}.csc-input-list{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:32px 0 0;padding:0;list-style:none}.csc-input-list li{padding:18px;border-left:4px solid var(--csc-red);background:#fff;font-size:14px;font-weight:800;text-transform:uppercase}.csc-note{padding:32px;background:#fff;border-top:6px solid var(--csc-red)}.csc-note strong{font-size:17px;text-transform:uppercase}.csc-note p{margin:12px 0 0;color:#555;line-height:1.65}.csc-final-cta{padding:72px 0;background:var(--csc-red);color:#fff}.csc-final-cta .csc-wrap{display:flex;align-items:center;justify-content:space-between;gap:40px}.csc-final-cta p{max-width:680px;line-height:1.65}.csc-final-cta .csc-button{border:1px solid #fff;background:#fff;color:var(--csc-red)}.csc-global-footer{padding:34px 0;background:var(--csc-black);color:#fff}.csc-global-footer .csc-shell-wrap{display:flex;align-items:center;justify-content:space-between;gap:28px}.csc-global-footer nav{display:flex;flex-wrap:wrap;gap:20px;font-size:12px;text-transform:uppercase}.csc-global-footer a{text-decoration:none}
@media(max-width:1100px){.csc-shell-wrap,.csc-wrap{width:min(100% - 48px,1240px)}.csc-global-header .csc-shell-wrap{align-items:flex-start;padding:22px 0}.csc-global-nav{flex-wrap:wrap;justify-content:flex-end}.csc-hero h1{font-size:62px}.csc-card-grid{grid-template-columns:repeat(2,1fr)}.csc-process{grid-template-columns:repeat(3,1fr)}.csc-split-copy{padding:56px}.csc-industry-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:800px){.csc-global-header .csc-shell-wrap,.csc-global-footer .csc-shell-wrap{display:block}.csc-global-nav{margin-top:20px;justify-content:flex-start}.csc-hero{min-height:580px}.csc-hero-copy{padding:72px 0}.csc-hero h1{font-size:52px}.csc-benefits .csc-wrap{grid-template-columns:repeat(2,1fr)}.csc-benefit:nth-child(2){border-right:0}.csc-section{padding:68px 0}.csc-section h2,.csc-split h2,.csc-final-cta h2{font-size:44px}.csc-process{grid-template-columns:repeat(2,1fr)}.csc-split{grid-template-columns:1fr}.csc-split .csc-media{min-height:430px}.csc-inputs{grid-template-columns:1fr}.csc-final-cta .csc-wrap{display:block}.csc-final-cta .csc-button{margin-top:24px}.csc-global-footer nav{margin-top:18px}}
@media(max-width:520px){.csc-shell-wrap,.csc-wrap{width:min(100% - 28px,1240px)}.csc-site-title{font-size:22px}.csc-global-nav{display:none}.csc-mobile-menu{display:block;position:relative;margin-top:18px}.csc-mobile-menu summary{padding:13px 16px;border:1px solid #bbb;font-size:12px;font-weight:900;list-style:none;text-align:center;text-transform:uppercase}.csc-mobile-menu summary::-webkit-details-marker{display:none}.csc-mobile-menu nav{display:grid;gap:1px;margin-top:8px;background:#ddd}.csc-mobile-menu a{padding:13px 14px;background:#fff;font-size:11px;font-weight:800;text-transform:uppercase}.csc-mobile-menu .csc-nav-cta{text-align:center}.csc-hero{min-height:620px}.csc-hero h1{font-size:42px}.csc-hero p{font-size:17px}.csc-actions{display:grid}.csc-benefits .csc-wrap,.csc-card-grid,.csc-process,.csc-industry-grid,.csc-input-list{grid-template-columns:1fr}.csc-benefit{border-right:0;border-bottom:1px solid #34383a}.csc-section h2,.csc-split h2,.csc-final-cta h2{font-size:38px}.csc-card{min-height:310px}.csc-split .csc-media{min-height:320px}.csc-split-copy{padding:48px 24px}.csc-inputs{gap:32px}}
</style></head><body><header class="csc-global-header"><div class="csc-shell-wrap"><a class="csc-site-title" href="/">Commercial Stainless Counters</a><nav class="csc-global-nav" aria-label="Approved site navigation"><a href="/commercial-stainless-counters/">Commercial Stainless Counters</a><a href="/commercial-stainless-counters/">Products &amp; Solutions</a><a href="/markets/education/">Industries</a><a href="/capabilities/">Capabilities</a><a href="/about/">About</a><a class="csc-nav-cta" href="/request-a-quote/">Request a Quote</a></nav><details class="csc-mobile-menu"><summary>Menu</summary><nav aria-label="Approved mobile site navigation"><a href="/commercial-stainless-counters/">Commercial Stainless Counters</a><a href="/commercial-stainless-counters/">Products &amp; Solutions</a><a href="/markets/education/">Industries</a><a href="/capabilities/">Capabilities</a><a href="/about/">About</a><a class="csc-nav-cta" href="/request-a-quote/">Request a Quote</a></nav></details></div></header><main class="csc-rich-main"><section class="csc-hero"><img src="${escapeHtml(proof.currentMedia.url)}" alt="Conceptual commercial stainless fabrication environment"><div class="csc-wrap"><div class="csc-hero-copy"><p class="csc-eyebrow">Design-Build Stainless Fabrication</p><h1>${title}</h1><p>${escapeHtml(heroCopy)}</p><div class="csc-actions"><a class="csc-button" href="/request-a-quote/">Request a Quote</a><a class="csc-button csc-button--ghost" href="/capabilities/">Explore Capabilities</a></div></div></div></section><section class="csc-benefits" aria-label="Project value"><div class="csc-wrap"><div class="csc-benefit"><strong>Commercial Applications</strong><span>Solutions organized around documented operating requirements.</span></div><div class="csc-benefit"><strong>Custom Fabrication</strong><span>Project-specific stainless pathways grounded in approved capability.</span></div><div class="csc-benefit"><strong>Project-Focused</strong><span>Drawings, dimensions, interfaces, and context stay visible.</span></div><div class="csc-benefit"><strong>Requirement-Led</strong><span>Open decisions remain explicit before finalization.</span></div></div></section><section class="csc-section csc-section--steel"><div class="csc-wrap"><p class="csc-eyebrow">What We Fabricate</p><h2>Stainless pathways built around the work</h2><p class="csc-lead">${escapeHtml(fitCopy)}</p><div class="csc-card-grid">${products.map((item) => linkCard(item, "Approved Solution")).join("")}</div></div></section><section class="csc-section csc-section--dark"><div class="csc-wrap"><p class="csc-eyebrow">Design-Build Process</p><h2>From requirement to fabrication planning</h2><p class="csc-lead">${escapeHtml(inputsCopy)}</p><div class="csc-process"><article class="csc-step"><b>01</b><strong>Define Requirements</strong><p>Capture intended use, desired outcome, and known constraints.</p></article><article class="csc-step"><b>02</b><strong>Review Drawings &amp; Dimensions</strong><p>Bring available drawings, photographs, dimensions, and specifications.</p></article><article class="csc-step"><b>03</b><strong>Coordinate Interfaces</strong><p>Keep equipment, utilities, access, casework, and traffic flow visible.</p></article><article class="csc-step"><b>04</b><strong>Fabrication Planning</strong><p>Identify openings, supports, edges, mobility, and unresolved decisions.</p></article><article class="csc-step"><b>05</b><strong>Project Handoff</strong><p>Move the documented requirement toward a useful quote conversation.</p></article></div></div></section><section class="csc-split">${mediaFigure(capabilities, "Conceptual fabrication capability context")}<div class="csc-split-copy"><p class="csc-eyebrow">Capability &amp; Coordination</p><h2>Coordinate the complete requirement</h2><p>${escapeHtml(coordinationCopy)}</p><p>Project details remain specific to the documented application and constraints rather than being assumed from another project.</p><div class="csc-actions"><a class="csc-button" href="/capabilities/">View Capabilities</a><a class="csc-button csc-button--ghost" href="/request-a-quote/">Discuss Your Project</a></div></div></section><section class="csc-section"><div class="csc-wrap"><p class="csc-eyebrow">Industries &amp; Applications</p><h2>Commercial environments with distinct requirements</h2><p class="csc-lead">Explore existing approved industry pathways without treating every application as the same project.</p><div class="csc-industry-grid">${industries.map((item) => linkCard(item, "Industry Pathway")).join("")}</div></div></section><section class="csc-section csc-section--steel"><div class="csc-wrap csc-inputs"><div><p class="csc-eyebrow">Project Inputs</p><h2>What to send for a focused conversation</h2><p class="csc-lead">${escapeHtml(inputsCopy)}</p><ul class="csc-input-list"><li>Dimensions</li><li>Drawings</li><li>Photographs</li><li>Equipment Context</li><li>Application Requirements</li><li>Schedule</li><li>Access Constraints</li><li>Desired Outcome</li></ul></div><aside class="csc-note"><strong>Keep assumptions visible</strong><p>Unknown details should remain identified for project-specific follow-up. This preview does not add engineering, certification, delivery, or nationwide-service claims.</p></aside></div></section><section class="csc-final-cta"><div class="csc-wrap"><div><p class="csc-eyebrow">Start the Conversation</p><h2>Request a Quote</h2><p>${escapeHtml(finalCopy)}</p></div><a class="csc-button" href="/request-a-quote/">Request a Quote</a></div></section></main><footer class="csc-global-footer"><div class="csc-shell-wrap"><strong>Commercial Stainless Counters</strong><nav aria-label="Approved footer navigation"><a href="/capabilities/">Capabilities</a><a href="/about/">About</a><a href="/request-a-quote/">Request a Quote</a></nav></div></footer></body></html>`;
  const hash = seoHash(proof);
  const media = [proof, capabilities, ...products, ...industries].filter((item, index, all) => all.findIndex((candidate) => candidate.currentMedia.id === item.currentMedia.id) === index).map((item) => ({ id: item.currentMedia.id, url: item.currentMedia.url, provenance: item.currentMedia.provenance, role: item === proof ? "HERO" : item === capabilities ? "CAPABILITY" : item.recommendedNewProfile === "INDUSTRY_APPLICATION" ? "INDUSTRY_APPLICATION" : "PRODUCT_SERVICE" }));
  return { version: COMMERCIAL_STAINLESS_RICH_COMPOSITION_VERSION, previewOnly: true, wordpressMutation: false, publicationMutation: false, campaignMutation: false, page: proof, html, seoHashBefore: hash, seoHashAfter: hash, preservedLinks, media, geometry: { currentCanvasWidth: 645, proposedCanvasWidth: 1240, breakpoints: [1440, 1024, 768, 375] } };
}

export function createCommercialStainlessRolloutPlan(inventory: CommercialStainlessPageInventoryItem[]): CommercialStainlessRolloutPlanItem[] {
  return inventory.filter((item) => new URL(item.url).pathname !== "/design-build-fabrication/").map((item) => {
    const path = new URL(item.url).pathname;
    const profile = item.recommendedNewProfile;
    const treatments: Record<CommercialStainlessCompositionProfile, Omit<CommercialStainlessRolloutPlanItem, "page" | "canonicalPath" | "profile">> = {
      PRODUCT_SERVICE: { heroTreatment: "Product/application image with focused solution positioning.", mediaRequirements: "Existing product or contextual application media; add candidates only through later governed review.", keySections: ["Solution overview", "Benefits", "In-use context", "Related solutions", "Industries", "Quote CTA"], ctaTreatment: "Request a Quote with a contextual secondary solution link.", specialConsiderations: "Preserve product authority boundaries and avoid unsupported specifications." },
      CAPABILITY: { heroTreatment: "Fabrication-context hero with capability statement.", mediaRequirements: "Existing fabrication/process media.", keySections: ["Capability statement", "Workflow", "Fabrication strengths", "Application context", "Industries", "Project inputs", "Quote CTA"], ctaTreatment: "Discuss Your Project leading to Request a Quote.", specialConsiderations: "Do not imply engineering or certification services beyond authority." },
      INDUSTRY_APPLICATION: { heroTreatment: "Industry-specific environment with restrained dark overlay.", mediaRequirements: "Existing conceptual industry media with explicit non-documentary treatment.", keySections: ["Common requirements", "Relevant solutions", "Application imagery", "Why custom", "Related capabilities", "Quote CTA"], ctaTreatment: "Request a Quote plus relevant product pathway.", specialConsiderations: "Keep each market distinct while avoiding customer-project implications." },
      DESIGN_BUILD: { heroTreatment: "Project-led fabrication hero.", mediaRequirements: "Existing fabrication and product pathway media.", keySections: ["Requirements", "Process", "Fabrication pathways", "Industries", "Project inputs", "Quote CTA"], ctaTreatment: "Request a Quote and Explore Capabilities.", specialConsiderations: "Proof profile; no rollout before owner approval." },
      LANDING_CONVERSION: { heroTreatment: path === "/" ? "Preserve approved homepage." : "Focused conversion hero with concise project-input guidance.", mediaRequirements: "Existing approved hero media.", keySections: path === "/" ? ["No proof-stage change"] : ["Project context", "Information to send", "Next steps", "Quote CTA"], ctaTreatment: "Single dominant Request a Quote action.", specialConsiderations: path === "/" ? "Homepage must remain unchanged." : "Do not invent contact details or submission mechanisms." },
      RESOURCE: { heroTreatment: "Credibility-focused identity hero.", mediaRequirements: "Existing company/fabrication context media.", keySections: ["Project-first approach", "What to expect", "Capabilities", "Industry pathways", "Quote CTA"], ctaTreatment: "Explore Capabilities then Request a Quote.", specialConsiderations: "Do not add unsupported company history, locations, certifications, or scale claims." },
    };
    return { page: item.title, canonicalPath: path, profile, ...treatments[profile] };
  });
}