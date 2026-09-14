import { createHash } from "node:crypto";

import type { SiteGeneratedPageRevision } from "./site-page-generation";
import {
  COMMERCIAL_STAINLESS_ORIGIN,
  extractCommercialStainlessPublicShell,
  type CommercialStainlessCompositionProfile,
  type CommercialStainlessPageInventoryItem,
} from "./commercial-stainless-rich-composition";

export const COMMERCIAL_STAINLESS_APPROVED_DESIGN_REFERENCE_SHA = "d86c133510b7848865308dfc2b51e20b754192c9";
export const COMMERCIAL_STAINLESS_WAVE_1_PATHS = [
  "/request-a-quote/",
  "/capabilities/",
  "/commercial-worktables-and-prep-tables/",
  "/markets/education/",
  "/about/",
] as const;

export type CommercialStainlessPageProfilePlan = {
  wordpressObjectId: string;
  url: string;
  currentProfile: string;
  targetProfile: CommercialStainlessCompositionProfile;
  primaryIntent: string;
  primaryCta: string;
  requiredMediaRoles: string[];
  wave: "WAVE_1" | "WAVE_2" | "WAVE_3" | "PRESERVE_HOME";
};

export type CommercialStainlessWave1Stage = {
  stageId: string;
  status: "READY_FOR_OWNER_REVIEW";
  stagingMode: "LOCAL_PREVIEW_EQUIVALENT";
  approvedDesignReferenceSha: typeof COMMERCIAL_STAINLESS_APPROVED_DESIGN_REFERENCE_SHA;
  page: CommercialStainlessPageInventoryItem;
  targetProfile: CommercialStainlessCompositionProfile;
  heroVariant: string;
  sectionSequence: string[];
  mediaLayout: string;
  ctaPlacement: string;
  currentHtml: string;
  proposedHtml: string;
  wordpressContent: string;
  wordpressContentHash: string;
  seoHashBefore: string;
  seoHashAfter: string;
  canonicalPreserved: true;
  urlPreserved: true;
  indexabilityPreserved: true;
  wordpressMutation: false;
  publicationMutation: false;
  media: Array<{ id: string; url: string; provenance: string; role: string }>;
  links: string[];
  desktopHeight: number;
  mobileHeight: number;
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function pathOf(item: CommercialStainlessPageInventoryItem): string {
  return new URL(item.url).pathname;
}

function itemByPath(inventory: CommercialStainlessPageInventoryItem[], path: string): CommercialStainlessPageInventoryItem {
  const item = inventory.find((candidate) => pathOf(candidate) === path);
  if (!item) throw new Error(`COMMERCIAL_STAINLESS_WAVE_PAGE_MISSING:${path}`);
  return item;
}

function pageByPath(pages: SiteGeneratedPageRevision[], path: string): SiteGeneratedPageRevision {
  const page = pages.find((candidate) => candidate.canonicalPath === path);
  if (!page) throw new Error(`COMMERCIAL_STAINLESS_WAVE_CONTENT_MISSING:${path}`);
  return page;
}

function hashSeo(item: CommercialStainlessPageInventoryItem): string {
  return createHash("sha256").update(JSON.stringify({ h1: item.currentH1, title: item.currentSeo.title, meta: item.currentSeo.metaDescription, canonical: item.currentCanonical, indexability: "index,follow" })).digest("hex");
}

function withSeoHead(headHtml: string, item: CommercialStainlessPageInventoryItem): string {
  return headHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(item.currentSeo.title)}</title>`)
    .replace(/<meta[^>]+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(item.currentSeo.metaDescription)}">`)
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(item.currentCanonical)}">`);
}

function sectionCopy(page: SiteGeneratedPageRevision, index: number): string {
  return page.sections[index]?.body.map(escapeHtml).join(" ") ?? "";
}

function relatedCard(item: CommercialStainlessPageInventoryItem, role: string): string {
  return `<a class="wr-card" href="${escapeHtml(pathOf(item))}"><img src="${escapeHtml(item.currentMedia.url)}" alt="Conceptual context for ${escapeHtml(item.title)}" title="${escapeHtml(role)} visual"><span>${escapeHtml(role)}</span><strong>${escapeHtml(item.title)}</strong><small>Explore pathway</small></a>`;
}

function media(item: CommercialStainlessPageInventoryItem, label: string, className = "wr-media"): string {
  return `<figure class="${className}" data-media-role="CONTEXTUAL_SUPPORT"><img src="${escapeHtml(item.currentMedia.url)}" alt="${escapeHtml(label)}" title="${escapeHtml(label)}"><figcaption>${escapeHtml(label)}<small>Existing media ${escapeHtml(item.currentMedia.id)} · ${escapeHtml(item.currentMedia.provenance.replaceAll("_", " "))}</small></figcaption></figure>`;
}

const commonStyles = `
:root{--black:#0d0f10;--charcoal:#191c1e;--red:#c91f2b;--white:#fff;--steel:#e7e9e9;--muted:#5e6467}*{box-sizing:border-box}html,body{margin:0;overflow-x:hidden;background:#fff;color:var(--black);font-family:Arial,sans-serif}a{color:inherit}.wr-main{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}.wr-wrap{width:min(1240px,calc(100% - 64px));margin:auto}.wr-hero{position:relative;min-height:610px;display:flex;align-items:center;isolation:isolate;background:#111;color:#fff}.wr-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.wr-hero:after{content:"";position:absolute;inset:0;background:rgba(5,7,8,.74);z-index:-1}.wr-hero--split:after{background:linear-gradient(90deg,rgba(5,7,8,.94),rgba(5,7,8,.68) 55%,rgba(5,7,8,.22))}.wr-hero--product>img{object-position:center 58%}.wr-hero--industry>img{object-position:center 45%}.wr-hero--resource{min-height:520px}.wr-hero-copy{max-width:780px;padding:88px 0}.wr-eyebrow{display:flex;align-items:center;gap:12px;margin:0 0 18px;color:var(--red);font-size:12px;font-weight:900;text-transform:uppercase}.wr-eyebrow:before{content:"";width:34px;height:4px;background:currentColor}.wr-hero h1,.wr-section h2,.wr-split h2,.wr-cta h2{margin:0;font-family:Impact,'Arial Narrow',sans-serif;text-transform:uppercase}.wr-hero h1{max-width:800px;font-size:72px;line-height:.97}.wr-hero p{max-width:690px;margin:22px 0 0;font-size:18px;line-height:1.65}.wr-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:30px}.wr-button{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 24px;background:var(--red);color:#fff;font-size:13px;font-weight:900;text-decoration:none;text-transform:uppercase}.wr-button--ghost{border:1px solid #fff;background:transparent}.wr-band{background:var(--black);color:#fff}.wr-band .wr-wrap{display:grid;grid-template-columns:repeat(4,1fr)}.wr-band article{padding:26px 22px;border-right:1px solid #34383a}.wr-band article:last-child{border:0}.wr-band strong{display:block;font-size:14px;text-transform:uppercase}.wr-band small{display:block;margin-top:8px;color:#bfc3c4;line-height:1.5}.wr-section{padding:82px 0}.wr-section--steel{background:var(--steel)}.wr-section--dark{background:var(--charcoal);color:#fff}.wr-section h2,.wr-split h2,.wr-cta h2{max-width:900px;font-size:52px;line-height:1}.wr-lead{max-width:760px;margin:20px 0 0;color:var(--muted);font-size:17px;line-height:1.72}.wr-section--dark .wr-lead{color:#c6c9ca}.wr-grid{display:grid;gap:18px;margin-top:36px}.wr-grid--4{grid-template-columns:repeat(4,1fr)}.wr-grid--3{grid-template-columns:repeat(3,1fr)}.wr-card{min-height:320px;display:flex;flex-direction:column;background:#fff;color:#111;text-decoration:none}.wr-card img{width:100%;height:180px;object-fit:cover}.wr-card span,.wr-card strong,.wr-card small{margin-left:20px;margin-right:20px}.wr-card span{margin-top:18px;color:var(--red);font-size:11px;font-weight:900;text-transform:uppercase}.wr-card strong{margin-top:8px;font-size:17px;line-height:1.25;text-transform:uppercase}.wr-card small{margin-top:auto;padding:14px 0 20px;color:#555;font-weight:700;text-transform:uppercase}.wr-process{display:grid;gap:1px;margin-top:36px;background:#393d3f}.wr-process--4{grid-template-columns:repeat(4,1fr)}.wr-process--3{grid-template-columns:repeat(3,1fr)}.wr-step{min-height:210px;padding:26px 22px;background:var(--charcoal)}.wr-step b{color:var(--red);font-size:32px}.wr-step strong{display:block;margin-top:24px;font-size:14px;text-transform:uppercase}.wr-step p{color:#c4c7c8;font-size:13px;line-height:1.55}.wr-split{display:grid;grid-template-columns:1.08fr .92fr;min-height:580px;background:var(--black);color:#fff}.wr-split--reverse{grid-template-columns:.92fr 1.08fr}.wr-split-copy{display:flex;flex-direction:column;justify-content:center;padding:68px}.wr-split-copy p{max-width:590px;color:#c8cbcc;font-size:17px;line-height:1.7}.wr-media{position:relative;margin:0;min-height:580px;overflow:hidden;background:#111}.wr-media img{width:100%;height:100%;object-fit:cover}.wr-media figcaption{position:absolute;left:20px;right:20px;bottom:18px;padding:12px;background:rgba(0,0,0,.78);color:#fff;font-size:11px;font-weight:800;text-transform:uppercase}.wr-media small{display:block;margin-top:5px;color:#bbb;font-weight:400}.wr-points{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:30px 0 0;padding:0;list-style:none}.wr-points li{padding:18px;border-left:4px solid var(--red);background:#fff;font-size:13px;font-weight:800;text-transform:uppercase}.wr-editorial{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:54px;align-items:start}.wr-editorial aside{position:sticky;top:20px;padding:30px;border-top:6px solid var(--red);background:var(--steel)}.wr-editorial article p{max-width:720px;font-size:17px;line-height:1.75}.wr-cta{padding:64px 0;background:var(--red);color:#fff}.wr-cta .wr-wrap{display:flex;align-items:center;justify-content:space-between;gap:36px}.wr-cta p{max-width:650px;line-height:1.65}.wr-cta .wr-button{border:1px solid #fff;background:#fff;color:var(--red)}
.wr-related{padding:34px 0;border-top:1px solid #d7d9da;background:#fff}.wr-related strong{display:block;font-size:11px;text-transform:uppercase}.wr-link-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.wr-link-row a{padding:10px 13px;border:1px solid #c8cbcc;font-size:11px;font-weight:800;text-decoration:none;text-transform:uppercase}
@media(max-width:1100px){.wr-wrap{width:min(100% - 48px,1240px)}.wr-hero h1{font-size:60px}.wr-grid--4{grid-template-columns:repeat(2,1fr)}.wr-process--4{grid-template-columns:repeat(2,1fr)}.wr-split-copy{padding:52px}}
@media(max-width:800px){.wr-hero{min-height:560px}.wr-hero-copy{padding:68px 0}.wr-hero h1{font-size:50px}.wr-band .wr-wrap{grid-template-columns:repeat(2,1fr)}.wr-band article:nth-child(2){border-right:0}.wr-section{padding:64px 0}.wr-section h2,.wr-split h2,.wr-cta h2{font-size:42px}.wr-grid--3{grid-template-columns:repeat(2,1fr)}.wr-process--3{grid-template-columns:1fr}.wr-split,.wr-split--reverse{grid-template-columns:1fr}.wr-media{min-height:400px}.wr-editorial{grid-template-columns:1fr}.wr-editorial aside{position:static}.wr-cta .wr-wrap{display:block}.wr-cta .wr-button{margin-top:22px}}
@media(max-width:520px){.wr-wrap{width:min(100% - 28px,1240px)}.wr-hero{min-height:600px}.wr-hero h1{font-size:40px}.wr-hero p{font-size:16px}.wr-actions{display:grid}.wr-band .wr-wrap,.wr-grid--4,.wr-grid--3,.wr-process--4,.wr-points{grid-template-columns:1fr}.wr-band article{border-right:0;border-bottom:1px solid #34383a}.wr-section h2,.wr-split h2,.wr-cta h2{font-size:36px}.wr-card{min-height:300px}.wr-media{min-height:300px}.wr-split-copy{padding:44px 24px}}
`;

function preservedContextLinks(page: CommercialStainlessPageInventoryItem): string {
  const links = page.currentInternalLinks.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("");
  return links ? `<section class="wr-related"><div class="wr-wrap"><strong>Continue exploring</strong><div class="wr-link-row">${links}</div></div></section>` : "";
}

function wrap(input: { page: CommercialStainlessPageInventoryItem; shellHtml: string; body: string }): string {
  const shell = extractCommercialStainlessPublicShell(input.shellHtml);
  const head = withSeoHead(shell.headHtml, input.page);
  return `<!doctype html><html lang="en"><head>${head}<base href="${COMMERCIAL_STAINLESS_ORIGIN}/"><style>${commonStyles}</style></head><body${shell.bodyAttributes}><div class="wp-site-blocks">${shell.headerHtml}<main class="wr-main"><div class="wr-page">${input.body}${preservedContextLinks(input.page)}</div></main>${shell.footerHtml}</div></body></html>`;
}

function hero(input: { item: CommercialStainlessPageInventoryItem; page: SiteGeneratedPageRevision; variant: string; eyebrow: string; primaryHref: string; primaryLabel: string; secondaryHref?: string; secondaryLabel?: string }): string {
  return `<section class="wr-hero ${escapeHtml(input.variant)}" data-media-role="PRIMARY_HERO"><img src="${escapeHtml(input.item.currentMedia.url)}" alt="Conceptual visual for ${escapeHtml(input.item.title)}" title="${escapeHtml(input.item.title)} hero visual"><div class="wr-wrap"><div class="wr-hero-copy"><p class="wr-eyebrow">${escapeHtml(input.eyebrow)}</p><h1>${escapeHtml(input.page.h1)}</h1><p>${sectionCopy(input.page, 0)}</p><div class="wr-actions"><a class="wr-button" href="${escapeHtml(input.primaryHref)}">${escapeHtml(input.primaryLabel)}</a>${input.secondaryHref && input.secondaryLabel ? `<a class="wr-button wr-button--ghost" href="${escapeHtml(input.secondaryHref)}">${escapeHtml(input.secondaryLabel)}</a>` : ""}</div></div></div></section>`;
}

function band(labels: Array<[string, string]>): string {
  return `<section class="wr-band"><div class="wr-wrap">${labels.map(([title, detail]) => `<article><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></article>`).join("")}</div></section>`;
}

function finalCta(title: string, copy: string, label = "Request a Quote"): string {
  return `<section class="wr-cta"><div class="wr-wrap"><div><p class="wr-eyebrow">Next Step</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><a class="wr-button" href="/request-a-quote/">${escapeHtml(label)}</a></div></section>`;
}

function buildLanding(page: SiteGeneratedPageRevision, item: CommercialStainlessPageInventoryItem, inventory: CommercialStainlessPageInventoryItem[]): { body: string; sequence: string[]; mediaLayout: string; ctaPlacement: string; heroVariant: string } {
  const capability = itemByPath(inventory, "/capabilities/");
  const solutions = ["/commercial-stainless-counters/", "/commercial-worktables-and-prep-tables/", "/stainless-countertop/"].map((path) => itemByPath(inventory, path));
  const body = `${hero({ item, page, variant: "wr-hero--conversion", eyebrow: "Start Your Commercial Stainless Project", primaryHref: "/request-a-quote/", primaryLabel: "Request a Quote", secondaryHref: "/capabilities/", secondaryLabel: "View Capabilities" })}${band([["Project Context", "Start with the application and desired outcome."], ["Dimensions", "Share known sizes and interfaces."], ["Drawings & Photos", "Use available documents to clarify scope."], ["Schedule", "Include timing and coordination constraints."]])}<section class="wr-section wr-section--steel" id="project-inputs"><div class="wr-wrap"><p class="wr-eyebrow">Project Inputs</p><h2>Bring the information available today</h2><p class="wr-lead">${sectionCopy(page, 1)}</p><ul class="wr-points"><li>Contact Information</li><li>Project Type</li><li>Dimensions</li><li>Location of Use</li><li>Drawings</li><li>Photographs</li><li>Equipment Interfaces</li><li>Schedule</li></ul></div></section><section class="wr-section wr-section--dark"><div class="wr-wrap"><p class="wr-eyebrow">Relevant Pathways</p><h2>Start with the closest solution</h2><div class="wr-grid wr-grid--3">${solutions.map((candidate) => relatedCard(candidate, "Solution Pathway")).join("")}</div></div></section><section class="wr-split wr-split--reverse"><div class="wr-split-copy"><p class="wr-eyebrow">What Happens Next</p><h2>${escapeHtml(page.sections[2]?.heading ?? "Review the requirement")}</h2><p>${sectionCopy(page, 2)}</p><p>${sectionCopy(page, 3)}</p><a class="wr-button" href="/capabilities/">Explore Capabilities</a></div>${media(capability, "Conceptual stainless fabrication capability context")}</section>${finalCta("Submit Your Project", sectionCopy(page, 4))}`;
  return { body, sequence: ["HERO", "VALUE_BAND", "PROJECT_INPUTS", "SOLUTION_PATHWAYS", "REVERSE_SPLIT_NEXT_STEPS", "FINAL_CTA"], mediaLayout: "HERO_PLUS_REVERSE_CAPABILITY_SPLIT", ctaPlacement: "HERO_AND_FINAL_WITH_MID_CAPABILITY", heroVariant: "CONVERSION_DARK_CENTER" };
}

function buildCapability(page: SiteGeneratedPageRevision, item: CommercialStainlessPageInventoryItem, inventory: CommercialStainlessPageInventoryItem[]): { body: string; sequence: string[]; mediaLayout: string; ctaPlacement: string; heroVariant: string } {
  const products = ["/commercial-stainless-counters/", "/commercial-worktables-and-prep-tables/", "/stainless-countertop/", "/mobile-and-modular-stainless-workstations/"].map((path) => itemByPath(inventory, path));
  const designBuild = itemByPath(inventory, "/design-build-fabrication/");
  const body = `${hero({ item, page, variant: "wr-hero--split", eyebrow: "Commercial Stainless Capabilities", primaryHref: "/request-a-quote/", primaryLabel: "Discuss Your Project", secondaryHref: "/design-build-fabrication/", secondaryLabel: "Design-Build Fabrication" })}<section class="wr-section"><div class="wr-wrap"><p class="wr-eyebrow">What We Can Fabricate</p><h2>${escapeHtml(page.sections[2]?.heading ?? "Products and fabrication pathways")}</h2><p class="wr-lead">${sectionCopy(page, 2)}</p><div class="wr-grid wr-grid--4">${products.map((candidate) => relatedCard(candidate, "Capability Pathway")).join("")}</div></div></section><section class="wr-section wr-section--dark"><div class="wr-wrap"><p class="wr-eyebrow">Process</p><h2>${escapeHtml(page.sections[1]?.heading ?? "From requirement to scope")}</h2><p class="wr-lead">${sectionCopy(page, 1)}</p><div class="wr-process wr-process--4"><article class="wr-step"><b>01</b><strong>Application</strong><p>Define intended use and operating context.</p></article><article class="wr-step"><b>02</b><strong>Inputs</strong><p>Review dimensions, drawings, photographs, and interfaces.</p></article><article class="wr-step"><b>03</b><strong>Open Decisions</strong><p>Keep project-specific details visible for follow-up.</p></article><article class="wr-step"><b>04</b><strong>Quote Scope</strong><p>Move the clarified requirement into a focused conversation.</p></article></div></div></section><section class="wr-split">${media(designBuild, "Conceptual design-build fabrication context")}<div class="wr-split-copy"><p class="wr-eyebrow">Construction Context</p><h2>${escapeHtml(page.sections[3]?.heading ?? "Details that shape the work")}</h2><p>${sectionCopy(page, 3)}</p><a class="wr-button" href="/design-build-fabrication/">Explore Design-Build</a></div></section><section class="wr-section wr-section--steel"><div class="wr-wrap"><p class="wr-eyebrow">Project Inputs</p><h2>Details that support a useful capability review</h2><ul class="wr-points"><li>Dimensions</li><li>Equipment Interfaces</li><li>Openings & Edges</li><li>Supports</li><li>Access</li><li>Mobility</li><li>Finish Expectations</li><li>Schedule</li></ul></div></section>${finalCta("Discuss Your Commercial Stainless Requirement", sectionCopy(page, 5))}`;
  return { body, sequence: ["HERO", "FABRICATION_GRID", "PROCESS", "DESIGN_BUILD_SPLIT", "PROJECT_INPUTS", "FINAL_CTA"], mediaLayout: "HERO_GRID_PLUS_DESIGN_BUILD_SPLIT", ctaPlacement: "HERO_DISCUSS_MID_DESIGN_BUILD_FINAL_QUOTE", heroVariant: "CAPABILITY_OFFSET" };
}

function buildProduct(page: SiteGeneratedPageRevision, item: CommercialStainlessPageInventoryItem, inventory: CommercialStainlessPageInventoryItem[]): { body: string; sequence: string[]; mediaLayout: string; ctaPlacement: string; heroVariant: string } {
  const capability = itemByPath(inventory, "/capabilities/");
  const markets = ["/markets/foodservice/", "/markets/healthcare/", "/markets/education/"].map((path) => itemByPath(inventory, path));
  const related = ["/stainless-countertop/", "/mobile-and-modular-stainless-workstations/", "/design-build-fabrication/"].map((path) => itemByPath(inventory, path));
  const body = `${hero({ item, page, variant: "wr-hero--product", eyebrow: "Commercial Worktables & Prep Tables", primaryHref: "/request-a-quote/", primaryLabel: "Request a Quote", secondaryHref: "/capabilities/", secondaryLabel: "View Capabilities" })}${band([["Workflow Fit", "Plan around the work sequence."], ["Equipment Context", "Coordinate adjacent equipment and interfaces."], ["Project Details", "Dimensions and openings remain project-specific."], ["Commercial Use", "Support demanding day-to-day environments."]])}<section class="wr-section"><div class="wr-wrap"><p class="wr-eyebrow">Product & Application</p><h2>${escapeHtml(page.sections[1]?.heading ?? "Where this solution fits")}</h2><p class="wr-lead">${sectionCopy(page, 1)}</p><div class="wr-grid wr-grid--3">${markets.map((candidate) => relatedCard(candidate, "Application Context")).join("")}</div></div></section><section class="wr-split wr-split--reverse"><div class="wr-split-copy"><p class="wr-eyebrow">Configuration Context</p><h2>${escapeHtml(page.sections[3]?.heading ?? "Coordinate the complete requirement")}</h2><p>${sectionCopy(page, 2)}</p><p>${sectionCopy(page, 3)}</p><a class="wr-button" href="/capabilities/">View Capabilities</a></div>${media(capability, "Conceptual commercial stainless fabrication capability")}</section><section class="wr-section wr-section--steel"><div class="wr-wrap"><p class="wr-eyebrow">Related Solutions</p><h2>Continue through the approved product architecture</h2><div class="wr-grid wr-grid--3">${related.map((candidate) => relatedCard(candidate, "Related Solution")).join("")}</div></div></section>${finalCta("Discuss Your Worktable or Prep Table Requirement", sectionCopy(page, 5))}`;
  return { body, sequence: ["PRODUCT_HERO", "BENEFIT_BAND", "APPLICATION_GRID", "REVERSE_CONFIGURATION_SPLIT", "RELATED_SOLUTIONS", "FINAL_CTA"], mediaLayout: "PRODUCT_HERO_APPLICATION_GRID_REVERSE_SPLIT", ctaPlacement: "HERO_QUOTE_SPLIT_CAPABILITY_FINAL_PROJECT", heroVariant: "PRODUCT_DETAIL_LOW_FOCUS" };
}

function buildIndustry(page: SiteGeneratedPageRevision, item: CommercialStainlessPageInventoryItem, inventory: CommercialStainlessPageInventoryItem[]): { body: string; sequence: string[]; mediaLayout: string; ctaPlacement: string; heroVariant: string } {
  const solutions = ["/commercial-stainless-counters/", "/commercial-worktables-and-prep-tables/", "/mobile-and-modular-stainless-workstations/"].map((path) => itemByPath(inventory, path));
  const capability = itemByPath(inventory, "/design-build-fabrication/");
  const body = `${hero({ item, page, variant: "wr-hero--industry", eyebrow: "Education Stainless Applications", primaryHref: "/request-a-quote/", primaryLabel: "Discuss an Education Project", secondaryHref: "/commercial-stainless-counters/", secondaryLabel: "Explore Solutions" })}<section class="wr-section wr-section--steel"><div class="wr-wrap"><p class="wr-eyebrow">Education Priorities</p><h2>${escapeHtml(page.sections[1]?.heading ?? "Plan around the environment")}</h2><p class="wr-lead">${sectionCopy(page, 1)}</p><ul class="wr-points"><li>Workflow</li><li>Cleaning Access</li><li>Equipment Coordination</li><li>Traffic Flow</li><li>Available Footprint</li><li>Documented Requirements</li></ul></div></section><section class="wr-section"><div class="wr-wrap"><p class="wr-eyebrow">Relevant Stainless Solutions</p><h2>${escapeHtml(page.sections[2]?.heading ?? "Relevant solution pathways")}</h2><p class="wr-lead">${sectionCopy(page, 2)}</p><div class="wr-grid wr-grid--3">${solutions.map((candidate) => relatedCard(candidate, "Education Application")).join("")}</div></div></section><section class="wr-split">${media(item, "Conceptual education stainless application context")}<div class="wr-split-copy"><p class="wr-eyebrow">Project Coordination</p><h2>${escapeHtml(page.sections[3]?.heading ?? "Coordinate stakeholders and interfaces")}</h2><p>${sectionCopy(page, 3)}</p><a class="wr-button" href="/design-build-fabrication/">Explore Design-Build</a></div></section><section class="wr-section wr-section--dark"><div class="wr-wrap"><p class="wr-eyebrow">Planning Considerations</p><h2>${escapeHtml(page.sections[4]?.heading ?? "Questions for early planning")}</h2><p class="wr-lead">${sectionCopy(page, 4)}</p><div class="wr-grid wr-grid--3">${[capability, itemByPath(inventory, "/capabilities/"), itemByPath(inventory, "/request-a-quote/")].map((candidate) => relatedCard(candidate, "Next Planning Step")).join("")}</div></div></section>${finalCta("Request an Education Project Conversation", sectionCopy(page, 5))}`;
  return { body, sequence: ["INDUSTRY_HERO", "NEEDS_MATRIX", "SOLUTION_GRID", "APPLICATION_SPLIT", "DARK_CONSIDERATIONS", "FINAL_CTA"], mediaLayout: "INDUSTRY_HERO_SELF_MEDIA_SPLIT_DARK_LINKS", ctaPlacement: "HERO_DISCUSS_SPLIT_DESIGN_BUILD_FINAL_INDUSTRY", heroVariant: "INDUSTRY_ENVIRONMENT" };
}

function buildResource(page: SiteGeneratedPageRevision, item: CommercialStainlessPageInventoryItem, inventory: CommercialStainlessPageInventoryItem[]): { body: string; sequence: string[]; mediaLayout: string; ctaPlacement: string; heroVariant: string } {
  const capability = itemByPath(inventory, "/capabilities/");
  const category = itemByPath(inventory, "/commercial-stainless-counters/");
  const body = `${hero({ item, page, variant: "wr-hero--resource wr-hero--split", eyebrow: "Commercial Stainless Counters", primaryHref: "/capabilities/", primaryLabel: "Explore Capabilities", secondaryHref: "/request-a-quote/", secondaryLabel: "Request a Quote" })}<section class="wr-section"><div class="wr-wrap wr-editorial"><aside><p class="wr-eyebrow">Project-First</p><strong>Start with the application, operating context, and information available.</strong></aside><article><h2>${escapeHtml(page.sections[1]?.heading ?? "A practical project-first approach")}</h2><p>${sectionCopy(page, 1)}</p><p>${sectionCopy(page, 2)}</p></article></div></section><section class="wr-split wr-split--reverse"><div class="wr-split-copy"><p class="wr-eyebrow">What to Expect</p><h2>${escapeHtml(page.sections[2]?.heading ?? "A clear path forward")}</h2><p>${sectionCopy(page, 2)}</p><a class="wr-button" href="/commercial-stainless-counters/">Explore Solutions</a></div>${media(capability, "Conceptual commercial stainless capability context")}</section><section class="wr-section wr-section--steel"><div class="wr-wrap"><p class="wr-eyebrow">Useful Starting Points</p><h2>${escapeHtml(page.sections[3]?.heading ?? "Explore capabilities and solutions")}</h2><p class="wr-lead">${sectionCopy(page, 3)}</p><div class="wr-grid wr-grid--3">${[category, capability, itemByPath(inventory, "/request-a-quote/")].map((candidate) => relatedCard(candidate, "Related Resource")).join("")}</div></div></section>${finalCta("Start the Conversation", sectionCopy(page, 4), "Request a Quote")}`;
  return { body, sequence: ["RESOURCE_HERO", "EDITORIAL_APPROACH", "REVERSE_EXPECTATIONS_SPLIT", "RELATED_RESOURCES", "RESTRAINED_FINAL_CTA"], mediaLayout: "RESOURCE_HERO_EDITORIAL_REVERSE_SPLIT", ctaPlacement: "HERO_CAPABILITY_SECONDARY_QUOTE_FINAL_CONVERSATION", heroVariant: "RESOURCE_CREDIBILITY" };
}

function profilePlan(item: CommercialStainlessPageInventoryItem): Omit<CommercialStainlessPageProfilePlan, "wordpressObjectId" | "url" | "currentProfile" | "targetProfile"> {
  const path = pathOf(item);
  const wave: CommercialStainlessPageProfilePlan["wave"] = path === "/" ? "PRESERVE_HOME" : COMMERCIAL_STAINLESS_WAVE_1_PATHS.includes(path as (typeof COMMERCIAL_STAINLESS_WAVE_1_PATHS)[number]) ? "WAVE_1" : ["/commercial-stainless-counters/", "/mobile-and-modular-stainless-workstations/", "/stainless-countertop/", "/markets/foodservice/", "/markets/healthcare/"].includes(path) ? "WAVE_2" : "WAVE_3";
  const plans: Record<CommercialStainlessCompositionProfile, { primaryIntent: string; primaryCta: string; requiredMediaRoles: string[] }> = {
    LANDING_CONVERSION: { primaryIntent: path === "/" ? "Preserve the approved site-level value proposition and broad solution entry points." : "Convert a documented commercial stainless requirement into a focused project conversation.", primaryCta: "Request a Quote", requiredMediaRoles: ["HERO", "SOLUTION_CONTEXT", "CAPABILITY_CONTEXT"] },
    CAPABILITY: { primaryIntent: "Explain fabrication pathways, process, project inputs, and application context.", primaryCta: "Discuss Your Project", requiredMediaRoles: ["HERO_CAPABILITY", "FABRICATION_PROCESS", "PRODUCT_PATHWAYS"] },
    PRODUCT_SERVICE: { primaryIntent: `Present ${item.title} as a specific approved solution with configuration and application context.`, primaryCta: "Request a Quote", requiredMediaRoles: ["PRODUCT_HERO", "PRODUCT_DETAIL", "APPLICATION_CONTEXT"] },
    INDUSTRY_APPLICATION: { primaryIntent: `Connect ${item.title} needs to appropriate stainless products and fabrication capabilities.`, primaryCta: "Discuss This Project", requiredMediaRoles: ["INDUSTRY_HERO", "APPLICATION_CONTEXT", "RELEVANT_SOLUTIONS"] },
    RESOURCE: { primaryIntent: "Provide useful company and process context that supports an informed next step.", primaryCta: "Explore Capabilities", requiredMediaRoles: ["RESOURCE_HERO", "CAPABILITY_CONTEXT", "RELATED_PATHWAYS"] },
    DESIGN_BUILD: { primaryIntent: "Preserve the owner-approved Design-Build reference composition.", primaryCta: "Request a Quote", requiredMediaRoles: ["REFERENCE_ONLY"] },
  };
  return { ...plans[item.recommendedNewProfile], wave };
}

export function createCommercialStainlessRemainingPageProfileMap(inventory: CommercialStainlessPageInventoryItem[]): CommercialStainlessPageProfilePlan[] {
  const plans = inventory.filter((item) => pathOf(item) !== "/design-build-fabrication/").map((item) => ({ wordpressObjectId: item.wordpressObjectId, url: item.url, currentProfile: item.currentCompositionProfile, targetProfile: item.recommendedNewProfile, ...profilePlan(item) }));
  if (plans.length !== 14) throw new Error("COMMERCIAL_STAINLESS_REMAINING_14_REQUIRED");
  return plans;
}

export function stageCommercialStainlessWave1(input: { pages: SiteGeneratedPageRevision[]; inventory: CommercialStainlessPageInventoryItem[]; publicHtmlByPath: Record<string, string> }): CommercialStainlessWave1Stage[] {
  return COMMERCIAL_STAINLESS_WAVE_1_PATHS.map((path) => {
    const page = pageByPath(input.pages, path);
    const item = itemByPath(input.inventory, path);
    const publicHtml = input.publicHtmlByPath[path];
    if (!publicHtml) throw new Error(`COMMERCIAL_STAINLESS_WAVE_PUBLIC_HTML_MISSING:${path}`);
    const composition = item.recommendedNewProfile === "LANDING_CONVERSION" ? buildLanding(page, item, input.inventory) : item.recommendedNewProfile === "CAPABILITY" ? buildCapability(page, item, input.inventory) : item.recommendedNewProfile === "PRODUCT_SERVICE" ? buildProduct(page, item, input.inventory) : item.recommendedNewProfile === "INDUSTRY_APPLICATION" ? buildIndustry(page, item, input.inventory) : buildResource(page, item, input.inventory);
    const wordpressContent = `<!-- wp:html --><style>${commonStyles}.wr-page{width:100vw!important;max-width:none!important;margin:0 0 0 calc(50% - 50vw)!important;padding:0!important}</style><div class="wr-page">${composition.body}${preservedContextLinks(item)}</div><!-- /wp:html -->`;
    const proposedHtml = wrap({ page: item, shellHtml: publicHtml, body: composition.body });
    const mediaIds = [...proposedHtml.matchAll(/wp-content\/uploads\/[^"')]+/g)].map((match) => `${COMMERCIAL_STAINLESS_ORIGIN}/${match[0]}`);
    const media = [...new Set(mediaIds)].map((url) => {
      const authority = input.inventory.find((candidate) => candidate.currentMedia.url === url);
      if (!authority) throw new Error(`COMMERCIAL_STAINLESS_WAVE_MEDIA_AUTHORITY_MISSING:${url}`);
      return { id: authority.currentMedia.id, url, provenance: authority.currentMedia.provenance, role: authority === item ? "PRIMARY" : authority.recommendedNewProfile };
    });
    const links = [...new Set([...proposedHtml.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]).filter((href) => href.startsWith("/")))].sort();
    const seoHash = hashSeo(item);
    const stageId = `csc-wave1-${createHash("sha256").update(JSON.stringify([COMMERCIAL_STAINLESS_APPROVED_DESIGN_REFERENCE_SHA, item.wordpressObjectId, proposedHtml])).digest("hex").slice(0, 20)}`;
    const heights = item.recommendedNewProfile === "LANDING_CONVERSION" ? { desktopHeight: 5800, mobileHeight: 9800 } : item.recommendedNewProfile === "CAPABILITY" ? { desktopHeight: 6100, mobileHeight: 10400 } : item.recommendedNewProfile === "PRODUCT_SERVICE" ? { desktopHeight: 5800, mobileHeight: 9700 } : item.recommendedNewProfile === "INDUSTRY_APPLICATION" ? { desktopHeight: 6200, mobileHeight: 10500 } : { desktopHeight: 5000, mobileHeight: 8500 };
    const currentHtml = publicHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${COMMERCIAL_STAINLESS_ORIGIN}/">`);
    return { stageId, status: "READY_FOR_OWNER_REVIEW", stagingMode: "LOCAL_PREVIEW_EQUIVALENT", approvedDesignReferenceSha: COMMERCIAL_STAINLESS_APPROVED_DESIGN_REFERENCE_SHA, page: item, targetProfile: item.recommendedNewProfile, heroVariant: composition.heroVariant, sectionSequence: [...composition.sequence, "PRESERVED_CONTEXT_LINKS"], mediaLayout: composition.mediaLayout, ctaPlacement: composition.ctaPlacement, currentHtml, proposedHtml, wordpressContent, wordpressContentHash: createHash("sha256").update(wordpressContent).digest("hex"), seoHashBefore: seoHash, seoHashAfter: seoHash, canonicalPreserved: true, urlPreserved: true, indexabilityPreserved: true, wordpressMutation: false, publicationMutation: false, media, links, ...heights };
  });
}

export function auditCommercialStainlessWave1Diversity(stages: CommercialStainlessWave1Stage[]) {
  return {
    heroVariantCount: new Set(stages.map((stage) => stage.heroVariant)).size,
    sectionSequenceVariantCount: new Set(stages.map((stage) => stage.sectionSequence.join(">"))).size,
    mediaLayoutVariantCount: new Set(stages.map((stage) => stage.mediaLayout)).size,
    ctaPlacementVariantCount: new Set(stages.map((stage) => stage.ctaPlacement)).size,
  };
}