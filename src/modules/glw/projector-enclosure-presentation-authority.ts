import { load } from "cheerio";

export const PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT = "PROJECTOR_ENCLOSURE_PRESENTATION_V1" as const;

export type ProjectorEnclosurePresentationEvaluation = {
  contract: typeof PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT;
  ok: boolean;
  checks: {
    contractBound: boolean;
    lightCommercialFoundation: boolean;
    blueNavyAccentAuthority: boolean;
    restrainedTypography: boolean;
    singlePrimaryHero: boolean;
    simplifiedTopFlow: boolean;
    industrialPaletteAbsent: boolean;
    consistentContentContainer: boolean;
  };
  blockers: string[];
};

const PROJECTOR_ENCLOSURE_CSS = `:root{color-scheme:light;--pe-navy:#10324a;--pe-blue:#1f5f94;--pe-accent:#2f88cc;--pe-ink:#172a37;--pe-muted:#4f6473;--pe-paper:#f5f8fb;--pe-line:#d6e2ec}.saw,.saw-page{width:100%;max-width:none!important;margin:0!important;overflow-x:clip;background:#fff;color:var(--pe-ink);font-family:inherit}.saw *,.saw-page *{box-sizing:border-box}.saw-wrap{width:min(1180px,calc(100% - 40px));margin:0 auto;min-width:0}.saw h1,.saw h2,.saw h3,.saw-page h1,.saw-page h2,.saw-page h3{font-family:inherit;letter-spacing:0;line-height:1.16;color:var(--pe-navy)}.saw h1,.saw-page h1{font-size:clamp(2rem,5vw,3.35rem)}.saw h2,.saw-page h2{font-size:clamp(1.45rem,3.1vw,2.35rem)}.saw p,.saw li,.saw-page p,.saw-page li{color:var(--pe-muted);line-height:1.72}.saw-kicker{color:var(--pe-accent)!important;font-size:12px!important;font-weight:700;letter-spacing:.08em!important;text-transform:uppercase}.saw-hero{min-height:560px;display:flex;align-items:flex-end;padding:64px 0;background:linear-gradient(100deg,rgba(14,39,60,.92),rgba(14,39,60,.72) 52%,rgba(14,39,60,.24));color:#fff}.saw-hero h1,.saw-hero .saw-copy{color:#fff}.saw-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}.saw-button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:4px;background:var(--pe-blue);color:#fff!important;text-decoration:none;font-weight:700}.saw-button.alt{background:transparent;border:1px solid #fff}.saw-product,.saw-split,.saw-application,.saw-section{padding:56px 0}.saw-product{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);background:#fff;border-top:1px solid var(--pe-line);border-bottom:1px solid var(--pe-line)}.saw-product figure{margin:0;background:var(--pe-paper)}.saw-product img{display:block;width:100%;height:auto;aspect-ratio:20/9;object-fit:contain}.saw-product-copy,.saw-split-copy{padding:0 4vw}.saw-split{display:grid;grid-template-columns:1fr 1fr;background:#f8fbfe}.saw-split img{width:100%;height:100%;min-height:420px;object-fit:cover}.saw-application{min-height:520px;display:flex;align-items:flex-end;background:linear-gradient(0deg,rgba(13,35,52,.88),rgba(13,35,52,.22));color:#fff}.saw-application h2,.saw-application p{color:#fff}.saw-guide{max-width:78ch}.saw-guide h2{margin-top:38px}.saw-facts,.saw-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.saw-facts article,.saw-links a{display:flex;flex-direction:column;padding:18px;border:1px solid var(--pe-line);background:#fff;text-decoration:none;color:inherit}.saw-cta{background:linear-gradient(100deg,var(--pe-navy),#1c4f74);color:#fff}.saw-cta h2,.saw-cta p{color:#fff}@media(max-width:820px){.saw-wrap{width:min(1180px,calc(100% - 28px))}.saw-hero,.saw-application{min-height:460px;padding:48px 0}.saw-product,.saw-split{grid-template-columns:1fr}.saw-product-copy,.saw-split-copy{padding:28px 0 0}.saw-facts,.saw-links{grid-template-columns:1fr}}`;

function uniqueSections(nodes: unknown[]): unknown[] {
  const seen = new Set<unknown>();
  const unique: unknown[] = [];
  for (const node of nodes) {
    if (seen.has(node)) continue;
    seen.add(node);
    unique.push(node);
  }
  return unique;
}

export function evaluateProjectorEnclosurePresentation(contentHtml: string): ProjectorEnclosurePresentationEvaluation {
  const $ = load(contentHtml, null, false);
  const root = $(".saw,.saw-page").first();
  const css = $("style").first().text();
  const topSections = root.children("section").slice(0, 5);
  const checks = {
    contractBound: root.attr("data-site-presentation-authority") === PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT,
    lightCommercialFoundation: root.attr("data-presentation-foundation") === "LIGHT_COMMERCIAL_AV" && /color-scheme:light/.test(css),
    blueNavyAccentAuthority: root.attr("data-accent-authority") === "PROJECTOR_ENCLOSURE_BLUE_NAVY" && /--pe-navy:#10324a/.test(css),
    restrainedTypography: !/Impact|Arial Narrow|font-size:clamp\((?:4[5-9]|[5-9]\d)/.test(css),
    singlePrimaryHero: root.children("section.saw-hero").length === 1,
    simplifiedTopFlow: topSections.filter((_, node) => $(node).is(".saw-hero,.saw-product,.saw-split,.saw-application") || $(node).find(".saw-guide").length > 0).length >= 3,
    industrialPaletteAbsent: !/(--saw-paper|--saw-accent:#d8402f|#b3261e|#f2b84b|#e4e0d6)/i.test(css),
    consistentContentContainer: /\.saw-wrap\{width:min\(1180px,calc\(100% - (?:40|28)px\)\)/.test(css),
  };
  const blockers = [
    ...(!checks.contractBound ? ["PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT_REQUIRED"] : []),
    ...(!checks.lightCommercialFoundation ? ["PROJECTOR_ENCLOSURE_LIGHT_FOUNDATION_REQUIRED"] : []),
    ...(!checks.blueNavyAccentAuthority ? ["PROJECTOR_ENCLOSURE_BRAND_ACCENT_REQUIRED"] : []),
    ...(!checks.restrainedTypography ? ["PROJECTOR_ENCLOSURE_TYPOGRAPHY_RESTRAINT_REQUIRED"] : []),
    ...(!checks.singlePrimaryHero ? ["PROJECTOR_ENCLOSURE_SINGLE_HERO_REQUIRED"] : []),
    ...(!checks.simplifiedTopFlow ? ["PROJECTOR_ENCLOSURE_TOP_FLOW_REQUIRED"] : []),
    ...(!checks.industrialPaletteAbsent ? ["PROJECTOR_ENCLOSURE_INDUSTRIAL_PALETTE_FORBIDDEN"] : []),
    ...(!checks.consistentContentContainer ? ["PROJECTOR_ENCLOSURE_CONTAINER_CONSISTENCY_REQUIRED"] : []),
  ];
  return { contract: PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT, ok: blockers.length === 0, checks, blockers };
}

export function applyProjectorEnclosurePresentationAuthority(contentHtml: string): { contentHtml: string; evaluation: ProjectorEnclosurePresentationEvaluation } {
  const $ = load(contentHtml, null, false);
  const root = $(".saw,.saw-page").first();
  if (root.length !== 1) throw new Error("PROJECTOR_ENCLOSURE_PRESENTATION_ROOT_REQUIRED");
  const originalCss = $("style").first().text();

  const heroImageUrl = originalCss.match(/\.saw-hero\{[\s\S]*?url\((['"]?)([^'"\)]+)\1\)/i)?.[2] ?? null;
  const applicationImageUrl = originalCss.match(/\.saw-application\{[\s\S]*?url\((['"]?)([^'"\)]+)\1\)/i)?.[2] ?? null;

  root.attr("data-site-presentation-authority", PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT)
    .attr("data-presentation-family", "PROJECTOR_ENCLOSURE_COMMERCIAL_AV")
    .attr("data-presentation-foundation", "LIGHT_COMMERCIAL_AV")
    .attr("data-accent-authority", "PROJECTOR_ENCLOSURE_BLUE_NAVY")
    .attr("data-spacing-density", "COMMERCIAL_BALANCED");

  const hero = root.children("section.saw-hero").first();
  root.children("section.saw-hero").slice(1).remove();
  const product = root.children("#product-authority,section.saw-product").first();
  const contextual = root.children("#contextual-in-use,section.saw-split").first();
  const application = root.children("section.saw-application").first();
  const guide = root.children("section").filter((_, node) => $(node).find(".saw-guide").length > 0).first();
  const cta = root.children("section.saw-cta,section.saw-section.saw-cta").first();

  if (hero.length === 1 && heroImageUrl) {
    hero.attr("style", `background-image:linear-gradient(100deg,rgba(14,39,60,.92),rgba(14,39,60,.72) 52%,rgba(14,39,60,.24)),url('${heroImageUrl}');background-size:cover;background-position:center;`);
  }
  if (application.length === 1 && applicationImageUrl) {
    application.attr("style", `background-image:linear-gradient(0deg,rgba(13,35,52,.88),rgba(13,35,52,.22)),url('${applicationImageUrl}');background-size:cover;background-position:center;`);
  }

  const allSections = root.children("section").toArray();
  const used = new Set<unknown>([hero.get(0), product.get(0), contextual.get(0), application.get(0), guide.get(0), cta.get(0)].filter(Boolean));
  const remainder = allSections.filter((node) => !used.has(node));

  const ordered = uniqueSections([
    ...hero.toArray(),
    ...product.toArray(),
    ...contextual.toArray(),
    ...application.toArray(),
    ...guide.toArray(),
    ...remainder,
    ...cta.toArray(),
  ]);

  root.children("section").remove();
  for (const section of ordered) root.append(section as never);

  const style = $("style").first();
  if (style.length) style.text(PROJECTOR_ENCLOSURE_CSS);
  else root.before($("<style></style>").text(PROJECTOR_ENCLOSURE_CSS));

  const presented = $.html();
  const evaluation = evaluateProjectorEnclosurePresentation(presented);
  if (!evaluation.ok) throw new Error(`PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT_FAILED:${evaluation.blockers.join(",")}`);
  return { contentHtml: presented, evaluation };
}
