import type { SiteGeneratedPageRevision } from "./site-page-generation";

export const PAGE_HERO_MEDIA_TOKEN = "{{GENESIS_PAGE_HERO_URL}}";
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const button = (href: string, label: string, secondary = false) =>
  `<a class="gvs-button${secondary ? " gvs-button--secondary" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)} <span aria-hidden="true">→</span></a>`;

export function renderCommercialStainlessPage(input: {
  page: SiteGeneratedPageRevision;
  wordpressObjectId: string;
  mediaUrl?: string;
  instructions?: string;
}): string {
  const { page } = input;
  const mediaUrl = input.mediaUrl ?? PAGE_HERO_MEDIA_TOKEN;
  const sections = page.sections;
  const links = page.internalLinks;
  const roleClass = `gvs-page--${page.pageRole.toLowerCase()}`;
  const sectionHtml = sections
    .slice(1, -1)
    .map((section, index) => {
      const bodies = section.body
        .map((text) => `<p>${escapeHtml(text)}</p>`)
        .join("");
      const related =
        section.presentation === "GRID"
          ? `<div class="gvs-grid">${links
              .slice(0, page.pageRole === "MARKET" ? 4 : 6)
              .map(
                (item) =>
                  `<a class="gvs-card" href="${escapeHtml(item.href)}"><strong>${escapeHtml(item.anchorText)}</strong><span>Explore pathway →</span></a>`,
              )
              .join("")}</div>`
          : "";
      const dark =
        section.presentation === "STEPS" ||
        section.presentation === "FAQ" ||
        index % 3 === 2;
      const split =
        index === 0 &&
        ["OFFERING", "CAPABILITIES", "ABOUT"].includes(page.pageRole);
      return split
        ? `<section class="gvs-split"><div class="gvs-split__image" role="img" aria-label="${escapeHtml(page.imageRequirements[0]?.altTextGuidance ?? page.name)}"></div><div class="gvs-split__copy"><span class="gvs-kicker">${escapeHtml(page.pageRole.replaceAll("_", " "))}</span><h2>${escapeHtml(section.heading)}</h2>${bodies}${related}</div></section>`
        : `<section class="gvs-section${dark ? " gvs-section--dark" : ""}"><div class="gvs-wrap"><span class="gvs-kicker">${escapeHtml(section.presentation)}</span><h2>${escapeHtml(section.heading)}</h2><div class="gvs-copy">${bodies}</div>${related}</div></section>`;
    })
    .join("");
  const finalSection = sections.at(-1);
  const footerLinks = links
    .slice(0, 8)
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}">${escapeHtml(item.anchorText)}</a>`,
    )
    .join("");
  return `<!-- wp:html --><style>.page-id-${escapeHtml(input.wordpressObjectId)} .entry-title,.page-id-${escapeHtml(input.wordpressObjectId)} .wp-block-post-title{display:none!important}.gvs-page{--ink:#111315;--red:#d62828;--white:#fff;--steel:#d9dcdd;margin:0;color:var(--ink);font-family:Arial,sans-serif}.gvs-page *{box-sizing:border-box}.gvs-wrap{width:min(1120px,calc(100% - 40px));margin:auto}.gvs-utility{padding:12px 0;background:#17191b;color:#fff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.gvs-header{padding:20px 0;background:#fff}.gvs-header .gvs-wrap,.gvs-nav{display:flex;align-items:center;justify-content:space-between;gap:32px}.gvs-brand{min-width:230px}.gvs-brand strong{display:block;font-size:24px;line-height:1}.gvs-brand small{display:block;margin-top:6px;font-size:10px;text-transform:uppercase}.gvs-nav{font-size:12px;font-weight:800;text-transform:uppercase}.gvs-nav a,.gvs-footer a{color:inherit;text-decoration:none}.gvs-hero{min-height:520px;display:flex;align-items:center;background:linear-gradient(90deg,rgba(9,11,13,.94),rgba(9,11,13,.58) 52%,rgba(9,11,13,.1)),url('${mediaUrl}') 65% 50%/cover;color:#fff}.gvs-page--market .gvs-hero{background-position:50% 50%,50% 48%}.gvs-page--contact .gvs-hero{min-height:460px}.gvs-kicker{display:block;margin-bottom:16px;color:var(--red);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.gvs-hero h1,.gvs-section h2,.gvs-split h2,.gvs-cta h2{font-family:Impact,'Arial Narrow',sans-serif;letter-spacing:0;text-transform:uppercase}.gvs-hero h1{max-width:700px;margin:0 0 22px;font-size:clamp(40px,5.5vw,72px);line-height:.98}.gvs-hero p{max-width:650px;font-size:18px;line-height:1.6}.gvs-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:28px}.gvs-button{display:inline-flex;align-items:center;justify-content:space-between;gap:14px;min-height:48px;padding:14px 22px;background:var(--red);color:#fff;text-decoration:none;font-size:13px;font-weight:900;text-transform:uppercase}.gvs-button--secondary{border:1px solid #fff;background:transparent}.gvs-section{padding:72px 0;background:#fff}.gvs-section--dark{background:#17191b;color:#fff}.gvs-section h2,.gvs-split h2{max-width:850px;margin:0 0 22px;font-size:clamp(34px,4.6vw,58px);line-height:1}.gvs-copy{max-width:820px;font-size:17px;line-height:1.7}.gvs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:32px}.gvs-card{min-height:160px;display:flex;flex-direction:column;justify-content:flex-end;padding:24px;border:1px solid #cfd2d3;border-bottom:5px solid var(--red);background:#f3f4f4;color:#111;text-decoration:none}.gvs-card strong{font-size:17px;text-transform:uppercase}.gvs-card span{margin-top:8px;font-size:12px}.gvs-split{display:grid;grid-template-columns:1fr 1fr;min-height:500px;background:#17191b;color:#fff}.gvs-split__image{background:url('${mediaUrl}') 60% 50%/cover}.gvs-split__copy{display:flex;flex-direction:column;justify-content:center;padding:64px}.gvs-split__copy p{font-size:17px;line-height:1.7}.gvs-cta{padding:58px 0;background:var(--red);color:#fff}.gvs-cta .gvs-wrap{display:flex;align-items:center;justify-content:space-between;gap:32px}.gvs-cta h2{margin:0;font-size:clamp(34px,4.4vw,56px)}.gvs-footer{padding:46px 0;background:#111315;color:#fff}.gvs-footer__grid{display:grid;grid-template-columns:2fr 3fr;gap:40px}.gvs-footer__links{display:flex;flex-wrap:wrap;gap:16px;font-size:11px;text-transform:uppercase}@media(max-width:900px){.gvs-nav{display:none}.gvs-grid{grid-template-columns:repeat(2,1fr)}.gvs-split{grid-template-columns:1fr}.gvs-split__image{min-height:340px}.gvs-cta .gvs-wrap,.gvs-footer__grid{display:grid;grid-template-columns:1fr}}@media(max-width:560px){.gvs-wrap{width:min(100% - 28px,1120px)}.gvs-hero{min-height:560px;background-position:58% 50%}.gvs-hero h1{font-size:40px}.gvs-grid{grid-template-columns:1fr}.gvs-section{padding:52px 0}.gvs-split__copy{padding:46px 24px}}</style><div class="gvs-page ${roleClass}"><div class="gvs-utility"><div class="gvs-wrap">Commercial stainless fabrication · Project-focused solutions</div></div><header class="gvs-header"><div class="gvs-wrap"><div class="gvs-brand"><strong>CSC</strong><small>Commercial Stainless Counters · Powered by Rocklin Metal</small></div><nav class="gvs-nav" aria-label="Draft visual navigation"><a href="/commercial-stainless-counters/">Solutions</a><a href="/capabilities/">Capabilities</a><a href="/about/">About</a>${button("/request-a-quote/", "Get a Quote")}</nav></div></header><section class="gvs-hero"><div class="gvs-wrap"><span class="gvs-kicker">${escapeHtml(page.pageRole.replaceAll("_", " "))}</span><h1>${escapeHtml(page.h1)}</h1>${sections[0]?.body.map((text) => `<p>${escapeHtml(text)}</p>`).join("") ?? ""}<div class="gvs-actions">${button("/request-a-quote/", "Request a Quote")}${button(links[0]?.href ?? "/commercial-stainless-counters/", links[0]?.anchorText ?? "Explore Solutions", true)}</div></div></section>${sectionHtml}<section class="gvs-cta"><div class="gvs-wrap"><div><span class="gvs-kicker">Next step</span><h2>${escapeHtml(finalSection?.heading ?? "Request a Quote")}</h2>${finalSection?.body.map((text) => `<p>${escapeHtml(text)}</p>`).join("") ?? ""}</div>${button("/request-a-quote/", "Request a Quote", true)}</div></section><footer class="gvs-footer"><div class="gvs-wrap gvs-footer__grid"><div class="gvs-brand"><strong>CSC</strong><small>Commercial Stainless Counters · Powered by Rocklin Metal</small></div><nav class="gvs-footer__links" aria-label="Draft footer pathways">${footerLinks}</nav></div></footer></div><!-- /wp:html -->`;
}
