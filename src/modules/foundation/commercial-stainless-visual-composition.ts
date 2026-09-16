import { createHash } from "node:crypto";
import type { SiteGeneratedPageRevision, SiteNavigationItem } from "./site-page-generation";
import { resolveSharedRichPageProductionProfile } from "./shared-rich-page-production-authority";

export const COMMERCIAL_STAINLESS_COMPOSITION_VERSION = "commercial-stainless-composition-v2" as const;
const COMMERCIAL_STAINLESS_PROFILE = resolveSharedRichPageProductionProfile({ organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", productId: null, pageType: "HOME" });
if (!COMMERCIAL_STAINLESS_PROFILE) throw new Error("COMMERCIAL_STAINLESS_SHARED_PROFILE_REQUIRED");
export const COMMERCIAL_STAINLESS_PRIMARY_WIDTH = COMMERCIAL_STAINLESS_PROFILE.layout.primaryWidth;

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const paragraph = (value: string) => `<p>${escapeHtml(value)}</p>`;
const button = (href: string, label: string, secondary = false) => `<a class="gvc-button${secondary ? " gvc-button--secondary" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)} <span aria-hidden="true">→</span></a>`;

function exactNavigationPath(navigation: SiteNavigationItem[], label: string): string {
  const candidates = navigation.flatMap((item) => [item, ...item.children]);
  const match = candidates.find((item) => item.label === label);
  if (!match || !match.href.startsWith("/")) throw new Error(`COMMERCIAL_STAINLESS_NAVIGATION_AUTHORITY_MISSING:${label}`);
  return match.href;
}

function section(page: SiteGeneratedPageRevision, heading: RegExp) {
  const match = page.sections.find((item) => heading.test(item.heading));
  if (!match) throw new Error(`COMMERCIAL_STAINLESS_SECTION_AUTHORITY_MISSING:${heading.source}`);
  return match;
}

function card(href: string, title: string, detail: string, label: string): string {
  return `<a class="gvc-card" href="${escapeHtml(href)}"><span class="gvc-card__index" aria-hidden="true">${label}</span><strong>${escapeHtml(title)}</strong><span class="gvc-card__detail">${escapeHtml(detail)}</span><span class="gvc-card__action">Explore pathway →</span></a>`;
}

export function renderCommercialStainlessComposition(input: { page: SiteGeneratedPageRevision; navigation: SiteNavigationItem[]; wordpressObjectId: string; mediaUrl: string }): string {
  if (input.wordpressObjectId !== "10" || input.page.pageRole !== "HOME" || input.page.canonicalPath !== "/") throw new Error("COMMERCIAL_STAINLESS_HOME_IDENTITY_MISMATCH");
  const productsSection = section(input.page, /commercial stainless products/i);
  const capabilitiesSection = section(input.page, /fabrication approach/i);
  const capabilitiesDetail = section(input.page, /fabrication proof/i);
  const industriesSection = section(input.page, /commercial industries/i);
  const buyerSection = section(input.page, /commercial buyers/i);
  const ctaSection = input.page.sections.find((item) => item.presentation === "CTA");
  if (!ctaSection) throw new Error("COMMERCIAL_STAINLESS_CTA_AUTHORITY_MISSING");
  const paths = {
    counters: exactNavigationPath(input.navigation, "Commercial Stainless Counters"),
    worktables: exactNavigationPath(input.navigation, "Commercial Worktables & Prep Tables"),
    fabrication: exactNavigationPath(input.navigation, "Design-Build Fabrication"),
    workstations: exactNavigationPath(input.navigation, "Mobile & Modular Stainless Workstations"),
    countertops: exactNavigationPath(input.navigation, "Stainless Countertops"),
    capabilities: exactNavigationPath(input.navigation, "Capabilities"),
    about: exactNavigationPath(input.navigation, "About"),
    quote: exactNavigationPath(input.navigation, "Request a Quote"),
    education: exactNavigationPath(input.navigation, "Education"),
    foodservice: exactNavigationPath(input.navigation, "Foodservice"),
    healthcare: exactNavigationPath(input.navigation, "Healthcare"),
    hospitality: exactNavigationPath(input.navigation, "Hospitality"),
    industrial: exactNavigationPath(input.navigation, "Industrial"),
    labs: exactNavigationPath(input.navigation, "Labs"),
  };
  const heroBody = input.page.sections[0].body;
  const productCards = [
    card(paths.counters, "Commercial Stainless Counters", "Organize counter requirements around the application, footprint, and surrounding equipment.", "01"),
    card(paths.worktables, "Worktables & Prep Tables", "Plan durable work surfaces around workflow, cleaning access, and available space.", "02"),
    card(paths.fabrication, "Design-Build Fabrication", "Bring drawings, dimensions, interfaces, and open project decisions into one conversation.", "03"),
    card(paths.workstations, "Mobile & Modular Workstations", "Evaluate flexible workstation pathways against movement, access, and operating needs.", "04"),
    card(paths.countertops, "Stainless Countertops", "Define countertop requirements with the adjacent casework, equipment, and edge conditions in view.", "05"),
  ].join("");
  const industries = [["Education", paths.education], ["Foodservice", paths.foodservice], ["Healthcare", paths.healthcare], ["Hospitality", paths.hospitality], ["Industrial", paths.industrial], ["Labs", paths.labs]];
  const industryCards = industries.map(([label, href], index) => `<a class="gvc-industry" href="${escapeHtml(href)}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(label)}</strong><b aria-hidden="true">↗</b></a>`).join("");
  const buyerCopy = buyerSection.body.join(" ");
  const values = [
    ["Requirements first", "Start with the application, footprint, interfaces, and known constraints."],
    ["Connected pathways", "Compare counters, worktables, workstations, countertops, and fabrication in one architecture."],
    ["Project context", "Use drawings, dimensions, photographs, workflow needs, and operating context to shape the discussion."],
    ["Quote-ready next step", "Keep open decisions visible and move the requirement toward a focused quote conversation."],
  ];
  const valueCards = values.map(([title, detail], index) => `<article class="gvc-value"><span>0${index + 1}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></article>`).join("");
  const mediaUrl = escapeHtml(input.mediaUrl);
  return `<!-- wp:html -->
<style>
.page-id-${input.wordpressObjectId} main#wp--skip-link--target{margin-top:0!important;padding:0!important}
.page-id-${input.wordpressObjectId} main#wp--skip-link--target>.wp-block-group,.page-id-${input.wordpressObjectId} .wp-block-post-content{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;padding:0!important}
.page-id-${input.wordpressObjectId} .wp-block-post-featured-image{display:none!important}
.page-id-${input.wordpressObjectId} .wp-block-post-content{padding:0!important}
.gvc-page{--ink:#101214;--coal:#191c1f;--steel:#e8eaeb;--red:#d62828;--white:#fff;width:100%;max-width:none;margin:0;overflow:hidden;background:#fff;color:var(--ink);font-family:Arial,sans-serif}
.gvc-page *{box-sizing:border-box}.gvc-primary{width:min(${COMMERCIAL_STAINLESS_PRIMARY_WIDTH}px,calc(100% - 48px));margin:auto}
.gvc-kicker{display:flex;align-items:center;gap:12px;margin-bottom:18px;color:var(--red);font-size:12px;font-weight:900;text-transform:uppercase}.gvc-kicker:before{width:34px;height:4px;background:currentColor;content:""}
.gvc-page h1,.gvc-page h2{letter-spacing:0;font-family:Impact,"Arial Narrow",sans-serif;text-transform:uppercase}.gvc-page p{margin:0;color:inherit;line-height:1.65}
.gvc-hero{min-height:650px;display:flex;align-items:flex-end;padding:72px;background:linear-gradient(90deg,rgba(9,11,13,.96) 0%,rgba(9,11,13,.82) 44%,rgba(9,11,13,.24) 73%,rgba(9,11,13,.08) 100%),url("${mediaUrl}") 66% 50%/cover;color:#fff}.gvc-hero__content{max-width:720px}.gvc-hero h1{max-width:700px;margin:0 0 24px;font-size:clamp(48px,5.6vw,78px);line-height:.98}.gvc-hero__copy{max-width:650px;display:grid;gap:12px;font-size:18px}
.gvc-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:30px}.gvc-button{min-height:50px;display:inline-flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 22px;background:var(--red);color:#fff;text-decoration:none;font-size:13px;font-weight:900;text-transform:uppercase}.gvc-button--secondary{border:1px solid #fff;background:rgba(0,0,0,.2)}
.gvc-indicators{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #34383b;background:var(--coal);color:#fff}.gvc-indicators span{min-height:76px;display:flex;align-items:center;padding:18px 24px;border-right:1px solid #34383b;font-size:13px;font-weight:800;text-transform:uppercase}
.gvc-section{padding:88px 56px}.gvc-section__head{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.65fr);align-items:end;gap:56px;margin-bottom:44px}.gvc-section h2,.gvc-split h2,.gvc-cta h2{margin:0;font-size:clamp(38px,4.2vw,62px);line-height:1}.gvc-lead{max-width:680px;color:#3e4448;font-size:17px;line-height:1.7}
.gvc-products{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}.gvc-card{min-height:250px;grid-column:span 2;display:flex;flex-direction:column;padding:26px;border:1px solid #cfd3d5;border-bottom:6px solid var(--red);background:#f4f5f5;color:var(--ink);text-decoration:none;transition:transform .18s ease,border-color .18s ease}.gvc-card:first-child,.gvc-card:nth-child(2){grid-column:span 3}.gvc-card:hover,.gvc-card:focus-visible{transform:translateY(-4px);border-color:var(--red)}.gvc-card__index{color:var(--red);font-size:12px;font-weight:900}.gvc-card strong{max-width:320px;margin-top:52px;font-size:22px;line-height:1.1;text-transform:uppercase}.gvc-card__detail{max-width:360px;margin-top:14px;color:#565c60;font-size:14px;line-height:1.55}.gvc-card__action{margin-top:auto;padding-top:26px;font-size:12px;font-weight:900;text-transform:uppercase}
.gvc-split{display:grid;grid-template-columns:55fr 45fr;background:var(--coal);color:#fff}.gvc-process{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;padding:64px;background:#303438}.gvc-process article{min-height:190px;padding:28px;background:#222629}.gvc-process span{color:var(--red);font-size:12px;font-weight:900}.gvc-process h3{margin:42px 0 10px;font-size:18px;text-transform:uppercase}.gvc-process p{color:#c9cdcf;font-size:14px}.gvc-split__copy{display:flex;flex-direction:column;justify-content:center;padding:72px 64px}.gvc-split__copy .gvc-lead{display:grid;gap:14px;margin:26px 0 30px;color:#d6d9da}
.gvc-industries{background:#f0f1f1}.gvc-industry-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gvc-industry{min-height:150px;display:grid;grid-template-columns:auto 1fr auto;align-items:end;gap:20px;padding:24px;border:1px solid #c9cdcf;background:#fff;color:var(--ink);text-decoration:none}.gvc-industry span{align-self:start;color:var(--red);font-size:11px;font-weight:900}.gvc-industry strong{font-size:20px;text-transform:uppercase}.gvc-industry b{color:var(--red);font-size:24px}
.gvc-buyer{background:var(--coal);color:#fff}.gvc-buyer__intro{max-width:780px;color:#d4d7d8}.gvc-values{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:42px;background:#44484b}.gvc-value{min-height:250px;padding:28px;background:#202427}.gvc-value>span{color:var(--red);font-size:12px;font-weight:900}.gvc-value h3{margin:50px 0 14px;font-size:19px;text-transform:uppercase}.gvc-value p{color:#c7cbcd;font-size:14px}.gvc-buyer__authority{max-width:820px;margin-top:34px;color:#9fa5a8;font-size:14px}
.gvc-cta{display:grid;grid-template-columns:1fr auto;align-items:center;gap:56px;padding:64px 72px;background:var(--red);color:#fff}.gvc-cta p{max-width:760px;margin-top:18px;font-size:17px}.gvc-cta .gvc-button{border:1px solid #fff;background:#fff;color:var(--ink)}
@media(max-width:1024px){.gvc-primary{width:min(940px,calc(100% - 40px))}.gvc-hero{min-height:590px;padding:52px}.gvc-section{padding:72px 40px}.gvc-products{grid-template-columns:repeat(2,1fr)}.gvc-card,.gvc-card:first-child,.gvc-card:nth-child(2){grid-column:auto}.gvc-card:last-child{grid-column:1/-1}.gvc-split{grid-template-columns:1fr 1fr}.gvc-process{padding:36px}.gvc-split__copy{padding:52px 40px}.gvc-values{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.gvc-primary{width:min(720px,calc(100% - 28px))}.gvc-hero{min-height:560px;padding:42px 32px;background-position:60% 50%}.gvc-hero h1{font-size:48px}.gvc-indicators{grid-template-columns:repeat(2,1fr)}.gvc-section__head,.gvc-split,.gvc-cta{grid-template-columns:1fr}.gvc-section__head{gap:24px}.gvc-process{order:2}.gvc-industry-grid{grid-template-columns:repeat(2,1fr)}.gvc-cta{gap:28px;padding:52px 40px}}
@media(max-width:520px){.gvc-primary{width:calc(100% - 20px)}.gvc-hero{min-height:590px;padding:32px 22px;background-position:62% 50%}.gvc-hero h1{font-size:39px}.gvc-hero__copy{font-size:16px}.gvc-actions{display:grid}.gvc-indicators{grid-template-columns:1fr 1fr}.gvc-indicators span{min-height:68px;padding:14px;font-size:11px}.gvc-section{padding:56px 20px}.gvc-section h2,.gvc-split h2,.gvc-cta h2{font-size:36px}.gvc-products,.gvc-industry-grid,.gvc-values,.gvc-process{grid-template-columns:1fr}.gvc-card,.gvc-card:last-child{grid-column:auto;min-height:220px}.gvc-process{padding:20px}.gvc-process article{min-height:160px}.gvc-split__copy{padding:48px 26px}.gvc-industry{min-height:120px}.gvc-cta{padding:48px 24px}.gvc-cta .gvc-button{width:100%}}
</style>
<div class="gvc-page"><div class="gvc-primary" data-genesis-primary-content>
<section class="gvc-hero" data-genesis-hero><div class="gvc-hero__content"><div class="gvc-kicker">Built around commercial requirements</div><h1>${escapeHtml(input.page.h1)}</h1><div class="gvc-hero__copy">${heroBody.map(paragraph).join("")}</div><div class="gvc-actions">${button(paths.quote, "Request a Quote")}${button(paths.counters, "Explore Solutions", true)}</div></div></section>
<div class="gvc-indicators"><span>Commercial counters</span><span>Worktables & prep tables</span><span>Design-build fabrication</span><span>Project-first planning</span></div>
<section class="gvc-section"><div class="gvc-section__head"><div><div class="gvc-kicker">Products & solutions</div><h2>${escapeHtml(productsSection.heading)}</h2></div><div class="gvc-lead">${productsSection.body.map(paragraph).join("")}</div></div><div class="gvc-products">${productCards}</div></section>
<section class="gvc-split"><div class="gvc-process"><article><span>01</span><h3>Application</h3><p>Start with the commercial need and the work the stainless solution must support.</p></article><article><span>02</span><h3>Dimensions</h3><p>Bring available measurements, drawings, interfaces, openings, and access constraints.</p></article><article><span>03</span><h3>Coordination</h3><p>Review workflow, adjacent equipment, cleaning access, and operating context together.</p></article><article><span>04</span><h3>Quote path</h3><p>Keep unresolved details visible and move toward a focused quote conversation.</p></article></div><div class="gvc-split__copy"><div class="gvc-kicker">Fabrication capabilities</div><h2>${escapeHtml(capabilitiesSection.heading)}</h2><div class="gvc-lead">${capabilitiesSection.body.concat(capabilitiesDetail.body).map(paragraph).join("")}</div>${button(paths.capabilities, "Explore Capabilities")}</div></section>
<section class="gvc-section gvc-industries"><div class="gvc-section__head"><div><div class="gvc-kicker">Industries & applications</div><h2>${escapeHtml(industriesSection.heading)}</h2></div><div class="gvc-lead">${industriesSection.body.map(paragraph).join("")}</div></div><div class="gvc-industry-grid">${industryCards}</div></section>
<section class="gvc-section gvc-buyer"><div class="gvc-kicker">Commercial project planning</div><h2>${escapeHtml(buyerSection.heading)}</h2><p class="gvc-buyer__intro">A clearer way to organize commercial stainless requirements before details are treated as final.</p><div class="gvc-values">${valueCards}</div><p class="gvc-buyer__authority">${escapeHtml(buyerCopy)}</p><div class="gvc-actions">${button(paths.about, "About Commercial Stainless Counters", true)}</div></section>
<section class="gvc-cta"><div><div class="gvc-kicker">Let’s build something together</div><h2>${escapeHtml(ctaSection.heading)}</h2>${ctaSection.body.map(paragraph).join("")}</div>${button(paths.quote, "Request a Quote")}</section>
</div></div>
<!-- /wp:html -->`;
}

export function buildCommercialStainlessCompositionRevision(input: { page: SiteGeneratedPageRevision; navigation: SiteNavigationItem[]; wordpressObjectId: string; mediaUrl: string; actor: string; now?: string }): SiteGeneratedPageRevision {
  const revision = input.page.revision + 1;
  const contentHtml = renderCommercialStainlessComposition(input);
  return { ...input.page, pageRevisionId: `${input.page.pageId}-composition-${revision}`, revision, status: "APPROVED", requestedChanges: "Owner-authorized Commercial Stainless visual composition repair v1.", contentHtml, contentFingerprint: createHash("sha256").update(contentHtml).digest("hex"), createdAt: input.now ?? new Date().toISOString(), createdBy: input.actor, decidedAt: input.now ?? new Date().toISOString(), decidedBy: input.actor };
}