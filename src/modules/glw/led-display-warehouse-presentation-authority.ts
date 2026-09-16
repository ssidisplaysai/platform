import { load } from "cheerio";

export const LED_DISPLAY_WAREHOUSE_PRESENTATION_CONTRACT = "LED_DISPLAY_WAREHOUSE_PRESENTATION_V1" as const;

export type LedDisplayWarehousePresentationEvaluation = {
  contract: typeof LED_DISPLAY_WAREHOUSE_PRESENTATION_CONTRACT;
  ok: boolean;
  checks: {
    contractBound: boolean;
    darkHighContrastFoundation: boolean;
    blueElectricAccent: boolean;
    imageLedComposition: boolean;
    commercialDensity: boolean;
    excessiveEditorialWhitespace: false | true;
    thinBorderEditorialGridDominant: false | true;
    worksheetRuleGrammar: false | true;
    flatRedEditorialCtaDominant: false | true;
    commercialStainlessPresentationLeakage: false | true;
  };
  blockers: string[];
};

const LEDW_CSS = `:root{color-scheme:dark;--ledw-night:#071119;--ledw-deep:#0b1b28;--ledw-panel:#102a3b;--ledw-panel-strong:#12384e;--ledw-ink:#f3fbff;--ledw-muted:#a9c0cc;--ledw-light:#eaf3f7;--ledw-light-ink:#102431;--ledw-electric:#19d3ff;--ledw-blue:#2563eb;--ledw-line:rgba(94,211,255,.28)}*{box-sizing:border-box}.saw-page{width:100%;max-width:none!important;margin:0!important;overflow:clip;background:var(--ledw-night);color:var(--ledw-ink);font-family:"Montserrat","Trebuchet MS",sans-serif}.saw-page section{position:relative;margin:0!important}.saw-wrap{width:min(1280px,calc(100% - 48px));margin:0 auto}.saw-page h1,.saw-page h2,.saw-page h3{margin:0;color:inherit;font-family:"Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:0}.saw-page h1{max-width:900px;font-size:clamp(48px,6vw,88px);line-height:.96}.saw-page h2{max-width:780px;font-size:clamp(34px,4vw,58px);line-height:1}.saw-page h3{font-size:23px;line-height:1.1}.saw-page p{margin:0;color:var(--ledw-muted);font-size:17px;line-height:1.6}.saw-kicker{margin-bottom:14px!important;color:var(--ledw-electric)!important;font-size:12px!important;font-weight:900;letter-spacing:0!important;text-transform:uppercase}.saw-hero{min-height:720px;display:flex;align-items:flex-end;isolation:isolate;background:var(--ledw-night)}.saw-hero>img{position:absolute;inset:0;z-index:-2;display:block;width:100%;height:100%;object-fit:cover;object-position:center}.saw-hero-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(3,10,16,.96),rgba(3,10,16,.72) 52%,rgba(3,10,16,.18))}.saw-hero-copy{padding:92px 0 70px}.saw-hero h1{color:#fff;text-shadow:0 8px 30px rgba(0,0,0,.38)}.saw-lead{max-width:720px;margin-top:24px!important;color:#d8e8ef!important;font-size:21px!important}.saw-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.saw-button{display:inline-flex;min-height:50px;align-items:center;justify-content:center;padding:0 22px;background:var(--ledw-electric);color:#031019!important;text-decoration:none!important;font-weight:900;box-shadow:0 10px 30px rgba(25,211,255,.18)}.saw-button-alt{border:1px solid rgba(255,255,255,.7);background:rgba(3,10,16,.62);color:#fff!important;box-shadow:none}.saw-product{padding:64px 0;background:var(--ledw-light);color:var(--ledw-light-ink)}.saw-split{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:46px;align-items:center}.saw-media-frame{min-width:0;overflow:hidden;background:#071119;box-shadow:0 18px 48px rgba(4,20,31,.18)}.saw-media-frame img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.saw-copy{max-width:560px}.saw-copy h2{margin-bottom:20px}.saw-copy p{color:#405865}.saw-copy p+p{margin-top:14px}.saw-applications{padding:64px 0 70px;background:var(--ledw-deep)}.saw-intro{max-width:680px;margin-top:16px!important}.saw-application-stage{position:relative;min-height:340px;margin-top:30px;overflow:hidden;background:var(--ledw-panel)}.saw-application-stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.72}.saw-application-stage:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,17,25,.15),rgba(7,17,25,.86))}.saw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}.saw-grid article{min-width:0;min-height:164px;padding:22px;background:var(--ledw-panel);box-shadow:inset 3px 0 0 var(--ledw-electric)}.saw-grid h3{color:#fff}.saw-grid p{margin-top:10px;font-size:15px}.saw-planning{padding:64px 0 70px;background:var(--ledw-night)}.saw-section-heading{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.7fr);gap:40px;align-items:end}.saw-section-heading .saw-kicker{grid-column:1/-1}.saw-section-heading p:last-child{max-width:460px}.saw-plan-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:32px}.saw-plan-grid>div,.saw-plan-grid>div:nth-child(n+5){min-width:0;min-height:118px;padding:18px;background:var(--ledw-panel);box-shadow:inset 0 3px 0 var(--ledw-blue)}.saw-plan-grid>div:nth-child(n+5){grid-column:auto}.saw-plan-grid strong{display:block;color:var(--ledw-electric);font-size:16px}.saw-plan-grid p{margin-top:8px;font-size:14px}.saw-cta{padding:68px 0;background:var(--ledw-deep);color:#fff;box-shadow:inset 0 1px 0 var(--ledw-line)}.saw-cta-inner{display:grid;grid-template-columns:minmax(0,.8fr) minmax(440px,1.2fr);grid-template-areas:"kicker heading" "copy heading" "button heading";gap:12px 64px;align-items:center}.saw-cta .saw-kicker,.saw-cta h2{color:#fff!important}.saw-cta .saw-kicker{grid-area:kicker;margin-bottom:0!important;color:var(--ledw-electric)!important}.saw-cta h2{grid-area:heading;max-width:700px}.saw-cta p{grid-area:copy;max-width:560px}.saw-cta .saw-button{grid-area:button;width:max-content;margin-top:10px}.saw-button-light{background:var(--ledw-electric);color:#031019!important}@media(max-width:782px){.saw-wrap{width:min(100% - 36px,1280px)}.saw-page h1{font-size:44px}.saw-page h2{font-size:35px}.saw-page p{font-size:16px}.saw-hero{min-height:620px}.saw-hero-shade{background:linear-gradient(180deg,rgba(3,10,16,.24),rgba(3,10,16,.96) 68%)}.saw-hero-copy{padding:84px 0 48px}.saw-lead{font-size:18px!important}.saw-actions{display:grid}.saw-button{width:100%}.saw-product,.saw-applications,.saw-planning,.saw-cta{padding:50px 0}.saw-split,.saw-section-heading{grid-template-columns:1fr;gap:26px}.saw-application-stage{min-height:240px;margin-top:24px}.saw-grid{grid-template-columns:1fr;gap:10px}.saw-grid article{min-height:0}.saw-plan-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.saw-plan-grid>div,.saw-plan-grid>div:nth-child(n+5){grid-column:auto;min-height:0}.saw-cta-inner{grid-template-columns:1fr;grid-template-areas:"kicker" "heading" "copy" "button";gap:18px}.saw-cta .saw-button{width:100%;margin-top:4px}}@media(max-width:420px){.saw-plan-grid{grid-template-columns:1fr}}`;

const LEDW_POLISH_CSS = `.saw-wrap{width:min(1360px,calc(100% - 32px))}.saw-plan-grid{grid-template-columns:repeat(8,minmax(0,1fr))}.saw-plan-grid>div,.saw-plan-grid>div:nth-child(n+5){grid-column:span 2}.saw-plan-grid>div:nth-child(5){grid-column:2/span 2}.saw-cta-inner{grid-template-columns:minmax(0,.8fr) minmax(440px,1.2fr);grid-template-areas:"kicker heading" "support heading";gap:14px 64px;align-items:start}.saw-cta-support{grid-area:support;display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:18px}.saw-cta-support p{max-width:560px}.saw-cta-support .saw-button{width:max-content;max-width:100%;margin:0}@media(max-width:782px){.saw-wrap{width:min(100% - 36px,1360px)}.saw-plan-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.saw-plan-grid>div,.saw-plan-grid>div:nth-child(n+5){grid-column:auto}.saw-plan-grid>div:last-child{grid-column:1/-1}.saw-cta-inner{grid-template-columns:1fr;grid-template-areas:"kicker" "heading" "support";gap:18px}.saw-cta-support{width:100%;gap:16px}.saw-cta-support .saw-button{width:100%}}@media(max-width:420px){.saw-plan-grid{grid-template-columns:1fr}.saw-plan-grid>div,.saw-plan-grid>div:nth-child(n+5){grid-column:1}}`;

export function evaluateLedDisplayWarehousePresentation(contentHtml: string): LedDisplayWarehousePresentationEvaluation {
  const $ = load(contentHtml, null, false);
  const root = $(".saw-page").first();
  const css = $("style").text();
  const checks = {
    contractBound: root.attr("data-site-presentation-authority") === LED_DISPLAY_WAREHOUSE_PRESENTATION_CONTRACT,
    darkHighContrastFoundation: root.attr("data-presentation-foundation") === "DARK_HIGH_CONTRAST" && /color-scheme:dark/.test(css),
    blueElectricAccent: root.attr("data-accent-authority") === "LEDW_BLUE_ELECTRIC" && /--ledw-electric:#19d3ff/.test(css),
    imageLedComposition: root.find('img[data-media-role="PRODUCT_AUTHORITY"]').length === 1 && root.find('img[data-media-role="CONTEXTUAL_IN_USE"]').length === 1 && root.find('[data-reference-section="APPLICATIONS"][data-presentation-tone="DARK_IMAGE_RICH"]').length === 1,
    commercialDensity: root.attr("data-spacing-density") === "COMMERCIAL_COMPACT" && /\.saw-(?:product|applications|planning)\{padding:(?:5[0-9]|6[0-9]|7[0-4])px/.test(css),
    excessiveEditorialWhitespace: /\.saw-(?:product|applications|planning)\{padding:(?:8[0-9]|9[0-9]|1[0-9]{2})px/.test(css),
    thinBorderEditorialGridDominant: /\.saw-grid article\{[^}]*border:1px solid/.test(css) || $(".saw-grid article>span").length > 0,
    worksheetRuleGrammar: /\.saw-plan-grid>div\{[^}]*border-top/.test(css),
    flatRedEditorialCtaDominant: /\.saw-cta\{[^}]*background:(?:var\(--saw-accent\)|#d8402f|#b3261e)/.test(css),
    commercialStainlessPresentationLeakage: root.attr("data-presentation-family") !== "LED_AV_EXPERIENTIAL" || /--saw-paper|--saw-accent:#d8402f|border-top:3px solid var\(--saw-ink\)/.test(css),
  };
  const blockers = [
    ...(!checks.contractBound ? ["LEDW_PRESENTATION_CONTRACT_REQUIRED"] : []),
    ...(!checks.darkHighContrastFoundation ? ["LEDW_DARK_FOUNDATION_REQUIRED"] : []),
    ...(!checks.blueElectricAccent ? ["LEDW_ELECTRIC_ACCENT_REQUIRED"] : []),
    ...(!checks.imageLedComposition ? ["LEDW_APPLICATION_MEDIA_REQUIRED"] : []),
    ...(!checks.commercialDensity ? ["LEDW_COMMERCIAL_DENSITY_REQUIRED"] : []),
    ...(checks.excessiveEditorialWhitespace ? ["LEDW_EXCESSIVE_EDITORIAL_WHITESPACE"] : []),
    ...(checks.thinBorderEditorialGridDominant ? ["LEDW_THIN_BORDER_EDITORIAL_GRID"] : []),
    ...(checks.worksheetRuleGrammar ? ["LEDW_WORKSHEET_RULE_GRAMMAR"] : []),
    ...(checks.flatRedEditorialCtaDominant ? ["LEDW_FLAT_RED_EDITORIAL_CTA"] : []),
    ...(checks.commercialStainlessPresentationLeakage ? ["LEDW_COMMERCIAL_STAINLESS_PRESENTATION_LEAKAGE"] : []),
  ];
  return { contract: LED_DISPLAY_WAREHOUSE_PRESENTATION_CONTRACT, ok: blockers.length === 0, checks, blockers };
}

export function applyLedDisplayWarehousePresentationAuthority(contentHtml: string): { contentHtml: string; evaluation: LedDisplayWarehousePresentationEvaluation } {
  const $ = load(contentHtml, null, false);
  const root = $(".saw-page").first();
  if (root.length !== 1) throw new Error("LEDW_PRESENTATION_ROOT_REQUIRED");
  root.attr("data-site-presentation-authority", LED_DISPLAY_WAREHOUSE_PRESENTATION_CONTRACT)
    .attr("data-presentation-family", "LED_AV_EXPERIENTIAL")
    .attr("data-presentation-foundation", "DARK_HIGH_CONTRAST")
    .attr("data-accent-authority", "LEDW_BLUE_ELECTRIC")
    .attr("data-spacing-density", "COMMERCIAL_COMPACT");
  root.find(".saw-grid article>span").remove();
  root.find('[data-reference-section="APPLICATIONS"]').attr("data-presentation-tone", "DARK_IMAGE_RICH");
  root.find('[data-reference-section="PLANNING_GUIDANCE"]').attr("data-presentation-tone", "DARK_TECHNICAL_PANEL");
  const cta = root.find('[data-reference-section="CTA"]').attr("data-presentation-tone", "DARK_PROJECT_CTA");
  const ctaInner = cta.find(".saw-cta-inner").first();
  if (ctaInner.length === 1 && ctaInner.find(".saw-cta-support").length === 0) {
    const support = $("<div></div>").addClass("saw-cta-support");
    const copy = ctaInner.children("p:not(.saw-kicker)").first();
    const button = ctaInner.children(".saw-button").first();
    if (copy.length) support.append(copy);
    if (button.length) support.append(button);
    ctaInner.append(support);
  }
  const style = $("style").first();
  if (style.length) style.text(`${LEDW_CSS}${LEDW_POLISH_CSS}`); else root.before($("<style></style>").text(`${LEDW_CSS}${LEDW_POLISH_CSS}`));
  const presented = $.html();
  const evaluation = evaluateLedDisplayWarehousePresentation(presented);
  if (!evaluation.ok) throw new Error(`LEDW_PRESENTATION_CONTRACT_FAILED:${evaluation.blockers.join(",")}`);
  return { contentHtml: presented, evaluation };
}
