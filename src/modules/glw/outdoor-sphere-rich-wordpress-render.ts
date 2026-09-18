import "server-only";

import { load } from "cheerio";

const BLOCKED_TAGS = "h1,img,style,script,iframe,object,embed,form";

type OutdoorSphereRichWordPressRenderInput = {
  title: string;
  stateName: string;
  productTopic: string;
  semanticSourceHtml: string;
  excerpt: string;
  contextualMediaUrl: string;
  productAuthorityMediaUrl: string;
  productAuthorityAltText: string;
  canonicalProductUrl?: string | null;
  governedCtaUrl?: string | null;
};

type OutdoorSphereRichWordPressRenderResult =
  | {
      ok: true;
      html: string;
      sanitizedGuideHtml: string;
    }
  | {
      ok: false;
      code: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED";
      message: string;
    };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUri(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (/^\s*javascript:/i.test(trimmed)) return null;
  if (/^\s*data:/i.test(trimmed)) return null;
  return trimmed;
}

function sanitizeSemanticArticle(sourceHtml: string): string {
  const $ = load(`<div id="glw-sphere-guide-root">${sourceHtml}</div>`, { decodeEntities: false });
  const root = $("#glw-sphere-guide-root");

  root.find(BLOCKED_TAGS).remove();

  root.find("*").each((_, element) => {
    const attributes = Object.keys(element.attribs ?? {});
    for (const name of attributes) {
      const value = element.attribs[name] ?? "";
      if (/^on/i.test(name)) {
        $(element).removeAttr(name);
        continue;
      }
      if (/^(href|src|action|xlink:href|formaction)$/i.test(name) && /^\s*javascript:/i.test(value)) {
        $(element).removeAttr(name);
      }
    }
  });

  return (root.html() ?? "").trim();
}

export function renderOutdoorSphereRichWordPress(
  input: OutdoorSphereRichWordPressRenderInput,
): OutdoorSphereRichWordPressRenderResult {
  const title = input.title.trim();
  const stateName = input.stateName.trim();
  const productTopic = input.productTopic.trim();
  const contextualMediaUrl = sanitizeUri(input.contextualMediaUrl);
  const productAuthorityMediaUrl = sanitizeUri(input.productAuthorityMediaUrl);
  const excerpt = input.excerpt.trim();
  const canonicalProductUrl = sanitizeUri(input.canonicalProductUrl);
  const governedCtaUrl = sanitizeUri(input.governedCtaUrl);

  if (!title || !stateName || !productTopic || !excerpt) {
    return {
      ok: false,
      code: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      message: "Outdoor Sphere rich composition requires title, state, product topic, and excerpt.",
    };
  }
  if (!contextualMediaUrl) {
    return {
      ok: false,
      code: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      message: "Outdoor Sphere rich composition requires an exact generated contextual media URL.",
    };
  }
  if (!productAuthorityMediaUrl) {
    return {
      ok: false,
      code: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      message: "Outdoor Sphere rich composition requires approved product authority media URL.",
    };
  }

  const sanitizedGuideHtml = sanitizeSemanticArticle(input.semanticSourceHtml);
  if (!sanitizedGuideHtml) {
    return {
      ok: false,
      code: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      message: "Outdoor Sphere rich composition requires non-empty sanitized semantic guide content.",
    };
  }

  const safeTitle = escapeHtml(title);
  const safeStateName = escapeHtml(stateName);
  const safeExcerpt = escapeHtml(excerpt);
  const safeProductTopic = escapeHtml(productTopic);
  const safeContextualMediaUrl = escapeHtml(contextualMediaUrl.replace(/[\r\n]/g, ""));

  const primaryCta = governedCtaUrl
    ? `<a class="glw-sphere-button glw-sphere-button-primary" href="${escapeHtml(governedCtaUrl)}">Discuss project planning</a>`
    : "";

  const secondaryCta = canonicalProductUrl
    ? `<a class="glw-sphere-button glw-sphere-button-secondary" href="${escapeHtml(canonicalProductUrl)}">View Outdoor Digital Sphere product</a>`
    : "";

  const ctaBand = governedCtaUrl
    ? `<section class="glw-sphere-cta">
      <div class="glw-sphere-shell">
        <h2>Discuss an Outdoor Digital Sphere project in ${safeStateName}</h2>
        <p>Coordinate concept direction, media strategy, and planning constraints with an exact governed workflow path.</p>
        <a class="glw-sphere-button glw-sphere-button-primary" href="${escapeHtml(governedCtaUrl)}">Start planning conversation</a>
      </div>
    </section>`
    : "";

  const html = `<article class="glw-sphere-page" data-genesis-primary-content="true">
  <style>
    .glw-sphere-page{color:#122022;background:#eef1f0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6;overflow-x:hidden}
    .glw-sphere-shell{max-width:1180px;margin:0 auto;padding:0 20px;min-width:0}
    .glw-sphere-band{height:10px;background:linear-gradient(90deg,#0f1720,#c2571c,#f1a63a)}
    .glw-sphere-hero{position:relative;min-height:560px;display:flex;align-items:flex-end;background-size:cover;background-position:center;background-image:linear-gradient(110deg,rgba(10,16,22,.9),rgba(10,16,22,.56)),url("${safeContextualMediaUrl}")}
    .glw-sphere-hero-inner{padding:76px 0 72px;color:#fff;max-width:900px}
    .glw-sphere-eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#f4c06a;margin:0 0 18px}
    .glw-sphere-hero h1{margin:0;font-size:clamp(2.2rem,5vw,4.1rem);line-height:1.02;letter-spacing:-.01em}
    .glw-sphere-hero p{margin:22px 0 0;max-width:62ch;color:rgba(255,255,255,.86)}
    .glw-sphere-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
    .glw-sphere-button{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;text-decoration:none;font-weight:700;border-radius:999px;font-size:14px}
    .glw-sphere-button-primary{background:#f1a63a;color:#111a22}
    .glw-sphere-button-secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}
    .glw-sphere-product{background:#fff;border-top:1px solid #d7dedb;border-bottom:1px solid #d7dedb;padding:70px 0}
    .glw-sphere-product-grid{display:block;min-width:0}
    .glw-sphere-product-copy{max-width:820px;min-width:0}
    .glw-sphere-product-kicker{margin:0;color:#b44713;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.16em}
    .glw-sphere-product h2{margin:14px 0 18px;font-size:clamp(1.8rem,3.3vw,3rem);line-height:1.08;overflow-wrap:anywhere}
    .glw-sphere-product p{margin:0 0 14px;color:#31464a;overflow-wrap:anywhere}
    .glw-sphere-planning{background:radial-gradient(circle at 12% 0%,#283741 0,#17242f 40%,#0c151d 100%);color:#e8edf0;padding:74px 0}
    .glw-sphere-planning h2{margin:0 0 18px;font-size:clamp(1.7rem,2.8vw,2.7rem);overflow-wrap:anywhere}
    .glw-sphere-planning p{margin:0 0 24px;max-width:68ch;color:rgba(232,237,240,.85)}
    .glw-sphere-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;min-width:0}
    .glw-sphere-card{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);padding:14px 12px;font-size:13px;font-weight:700;letter-spacing:.01em;text-align:center;min-width:0;overflow-wrap:anywhere}
    .glw-sphere-guide{background:#f2f4f3;padding:72px 0 78px;border-top:1px solid #dbe0de;border-bottom:1px solid #dbe0de}
    .glw-sphere-guide-frame{background:#fff;border:1px solid #d7dedb;padding:30px;max-width:940px;margin:0 auto;min-width:0;overflow-wrap:anywhere}
    .glw-sphere-guide-frame h2,.glw-sphere-guide-frame h3,.glw-sphere-guide-frame h4{line-height:1.2;color:#152328}
    .glw-sphere-guide-frame p,.glw-sphere-guide-frame li,.glw-sphere-guide-frame td,.glw-sphere-guide-frame th{color:#26383c}
    .glw-sphere-guide-frame table{width:100%;border-collapse:collapse;table-layout:fixed}
    .glw-sphere-guide-frame td,.glw-sphere-guide-frame th{border:1px solid #d7dedb;padding:8px;word-break:break-word}
    .glw-sphere-guide-frame a{color:#a33e0f;font-weight:700}
    .glw-sphere-cta{background:linear-gradient(100deg,#17242f 0,#203746 52%,#c2571c 100%);color:#fff;padding:58px 0}
    .glw-sphere-cta h2{margin:0 0 10px;font-size:clamp(1.6rem,3vw,2.5rem);line-height:1.15}
    .glw-sphere-cta p{margin:0 0 20px;max-width:64ch;color:rgba(255,255,255,.86)}
    @media (max-width:1024px){
      .glw-sphere-card-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
    }
    @media (max-width:800px){
      .glw-sphere-shell{padding:0 16px}
      .glw-sphere-hero{min-height:500px}
      .glw-sphere-product{padding:54px 0}
      .glw-sphere-planning{padding:56px 0}
      .glw-sphere-guide{padding:54px 0}
      .glw-sphere-guide-frame{padding:20px}
      .glw-sphere-cta{padding:48px 0}
    }
  </style>
  <div class="glw-sphere-band" aria-hidden="true"></div>
  <section class="glw-sphere-hero" data-genesis-hero="true" data-media-role="CONTEXTUAL_IN_USE">
    <div class="glw-sphere-shell glw-sphere-hero-inner">
      <p class="glw-sphere-eyebrow">Creative Outdoor Display Concepts</p>
      <h1>${safeTitle}</h1>
      <p>${safeExcerpt}</p>
      <div class="glw-sphere-actions">${primaryCta}${secondaryCta}</div>
    </div>
  </section>
  <section class="glw-sphere-product" data-media-role="PRODUCT_AUTHORITY">
    <div class="glw-sphere-shell glw-sphere-product-grid">
      <div class="glw-sphere-product-copy">
        <p class="glw-sphere-product-kicker">Planning Orientation</p>
        <h2>${safeProductTopic} planning for ${safeStateName}</h2>
        <p>This section provides neutral planning direction for early-stage concept development.</p>
        <p>No local installation claim is made by this conceptual preview and composition path.</p>
      </div>
    </div>
  </section>
  <section class="glw-sphere-planning">
    <div class="glw-sphere-shell">
      <h2>Application and planning checkpoints</h2>
      <p>Use these prompts to shape visual intent and technical readiness without asserting unverified local outcomes.</p>
      <div class="glw-sphere-card-grid">
        <div class="glw-sphere-card">Location</div>
        <div class="glw-sphere-card">Audience</div>
        <div class="glw-sphere-card">Viewing experience</div>
        <div class="glw-sphere-card">Content goals</div>
        <div class="glw-sphere-card">Placement</div>
        <div class="glw-sphere-card">Infrastructure</div>
        <div class="glw-sphere-card">Project schedule</div>
      </div>
    </div>
  </section>
  <section class="glw-sphere-guide">
    <div class="glw-sphere-shell">
      <div class="glw-sphere-guide-frame">${sanitizedGuideHtml}</div>
    </div>
  </section>
  ${ctaBand}
</article>`;

  return {
    ok: true,
    html,
    sanitizedGuideHtml,
  };
}
