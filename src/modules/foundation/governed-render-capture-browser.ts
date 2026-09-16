import "server-only";

import { existsSync } from "node:fs";
import { chromium, type Browser, type Page, type Request } from "playwright-core";
import sharp from "sharp";
import { GOVERNED_RENDER_CAPTURE_LIMITS, GOVERNED_RENDER_CAPTURE_VERSION, validateCaptureRedirectChain, validateGovernedCaptureUrl } from "./governed-render-capture-security";
import { hashRenderedVisualContent, type RenderedVisualBounds, type RenderedVisualCaptureEvidence, type RenderedVisualViewportClass } from "./rendered-visual-certification";
import type { GenesisRenderedContrastObservation } from "./background-aware-text-contrast";

export type CaptureMediaAssignment = { assignmentId: string | null; semanticRole: "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE"; mediaId: string | null; sourceUrl: string | null; contextId: string | null };
export type GovernedBrowserCaptureInput = {
  targetUrl: string;
  allowedOrigins: readonly string[];
  internalGenesisOrigin?: string | null;
  internalAuthorization?: { header: string; value: string } | null;
  viewportClass: RenderedVisualViewportClass;
  viewport: { width: number; height: number };
  captureId: string;
  mediaAssignments: readonly CaptureMediaAssignment[];
};
export type ThemeIntegrationEvidence = { visibleH1Count: number; visibleH1Texts: readonly string[]; duplicateThemeTitleVisible: boolean; duplicateThemeFeaturedMediaVisible: boolean; globalHeaderPresent: boolean; globalFooterPresent: boolean; fontAuthorityExpected: boolean; headerActionsContained: boolean; quoteCtaContained: boolean; backgroundAwareTextContrast: readonly GenesisRenderedContrastObservation[]; heroContrast: null | { backgroundImage: string; eyebrowColor: string; h1Color: string; supportingCopyColor: string; primaryTextColor: string; primaryBackgroundColor: string; secondaryTextColor: string; secondaryBorderColor: string; disclaimerColor: string; textOverlap: boolean }; richComposition: null | { productGridColumns: string; productImageBounds: RenderedVisualBounds | null; productCopyBounds: RenderedVisualBounds | null; productHeadingWordBreak: string; productHeadingOverflowWrap: string; productHeadingHyphens: string; productHeadingMaxWordFragments: number; contextualCopyBounds: RenderedVisualBounds | null; contextualHeadingWordBreak: string; contextualHeadingMaxWordFragments: number }; overflowElements: readonly { selector: string; left: number; right: number; width: number; clientWidth: number; scrollWidth: number; position: string; minWidth: string; maxWidth: string }[] };
export type GovernedBrowserCaptureResult = { evidence: Omit<RenderedVisualCaptureEvidence, "screenshotArtifact">; themeIntegration: ThemeIntegrationEvidence; styleSettlement: { stable: boolean; samples: number; stylesheetCount: number; signature: string; elapsedMs: number }; screenshotComputedStyleCorrelationId: string; bytes: Uint8Array; imageWidth: number; imageHeight: number; renderedContentHash: string };

function edgeExecutable(): string {
  const configured = process.env.GENESIS_RENDER_CAPTURE_BROWSER_PATH?.trim();
  const candidates = [configured, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].filter((value): value is string => Boolean(value));
  const found = candidates.find(existsSync);
  if (!found) throw new Error("CAPTURE_BROWSER_UNAVAILABLE");
  return found;
}

function cleanBounds(value: { x: number; y: number; width: number; height: number } | null): RenderedVisualBounds | null {
  if (!value) return null;
  return { x: Math.max(0, value.x), y: Math.max(0, value.y), width: Math.max(0, value.width), height: Math.max(0, value.height) };
}

async function settle(page: Page): Promise<{ stable: boolean; samples: number; stylesheetCount: number; signature: string; elapsedMs: number }> {
  await page.waitForLoadState("domcontentloaded", { timeout: GOVERNED_RENDER_CAPTURE_LIMITS.navigationTimeoutMs });
  return page.evaluate(async (timeoutMs) => {
    const startedAt = performance.now();
    const bounded = (promise: Promise<unknown>) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    await bounded(document.fonts?.ready ?? Promise.resolve());
    const images = Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); }));
    await bounded(Promise.all(images));
    const styles = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((link) => link.sheet ? Promise.resolve() : new Promise((resolve) => { link.addEventListener("load", resolve, { once: true }); link.addEventListener("error", resolve, { once: true }); }));
    await bounded(Promise.all(styles));
    const signature = () => { const selectors = [".saw-hero h1", "#contextual-in-use h2", '[data-media-role="APPLICATION_EXPERIENCE"] h2', ".saw-cta h2", ".saw-cta .saw-kicker"]; const values = selectors.map((selector) => { const element = document.querySelector(selector); if (!element) return `${selector}:missing`; const style = getComputedStyle(element); const box = element.getBoundingClientRect(); return `${selector}:${style.color}:${style.backgroundColor}:${style.fontFamily}:${style.fontSize}:${style.fontWeight}:${style.display}:${Math.round(box.x)}:${Math.round(box.y)}:${Math.round(box.width)}:${Math.round(box.height)}`; }); return `${document.styleSheets.length}|${document.querySelectorAll("style,link[rel=stylesheet]").length}|${document.querySelectorAll("*").length}|${values.join("|")}`; };
    let prior = ""; let stableSamples = 0; let samples = 0; let finalSignature = "";
    while (performance.now() - startedAt < timeoutMs && stableSamples < 3) { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); await new Promise((resolve) => setTimeout(resolve, 100)); finalSignature = signature(); samples += 1; if (finalSignature === prior) stableSamples += 1; else stableSamples = 0; prior = finalSignature; }
    return { stable: stableSamples >= 3, samples, stylesheetCount: document.styleSheets.length, signature: finalSignature, elapsedMs: Math.round(performance.now() - startedAt) };
  }, GOVERNED_RENDER_CAPTURE_LIMITS.settleTimeoutMs);
}

async function geometry(page: Page, assignments: readonly CaptureMediaAssignment[]) {
  return page.evaluate((knownAssignments) => {
    const visible = (element: Element | null) => { if (!element) return false; const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"; };
    const box = (element: Element | null) => { if (!element || !visible(element)) return null; const rect = element.getBoundingClientRect(); return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }; };
    const lineCount = (element: Element | null) => { if (!element || !visible(element)) return null; const rects = Array.from(element.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0); return Math.max(1, new Set(rects.map((rect) => Math.round(rect.top))).size); };
    const primary = document.querySelector("[data-genesis-primary-content]") ?? document.querySelector(".gva-home") ?? document.querySelector(".gvs-page") ?? document.querySelector("main") ?? document.querySelector("article") ?? document.querySelector(".entry-content") ?? document.querySelector("[role=main]") ?? document.body;
    const hero = document.querySelector("[data-genesis-hero]") ?? document.querySelector(".gva-hero") ?? document.querySelector(".gvs-hero") ?? document.querySelector("main > section:first-of-type") ?? document.querySelector("article > header");
    const heading = (hero?.querySelector("h1") ?? document.querySelector("h1"));
    const cta = hero?.querySelector("a,button,[role=button]") ?? null;
    const allMedia = Array.from(document.querySelectorAll("img,video,picture"));
    const heroTop = hero ? box(hero)?.y ?? null : null;
    const heroBackground = hero && getComputedStyle(hero).backgroundImage !== "none" ? hero : null;
    const heroMedia = hero?.querySelector("img,video,picture") ?? heroBackground ?? (heroTop === null ? null : allMedia.filter((item) => (box(item)?.y ?? Number.POSITIVE_INFINITY) < heroTop).at(-1) ?? null);
    const normalize = (value: string) => { try { return new URL(value, document.baseURI).pathname.replace(/\/$/, ""); } catch { return ""; } };
    const images = Array.from(document.images);
    const backgroundElements = Array.from(document.querySelectorAll("[class]"));
    const media = knownAssignments.map((assignment) => {
      const sourcePath = assignment.sourceUrl ? normalize(assignment.sourceUrl) : "";
      const match = images.find((image) => image.dataset.mediaId === assignment.mediaId && visible(image) && image.complete && image.naturalWidth > 1 && image.naturalHeight > 1) ?? (assignment.sourceUrl ? images.find((image) => normalize(image.currentSrc || image.src) === sourcePath && visible(image) && image.complete && image.naturalWidth > 1 && image.naturalHeight > 1) ?? backgroundElements.find((element) => getComputedStyle(element).backgroundImage.includes(sourcePath) && visible(element)) ?? null : null);
      const renderedBounds = box(match);
      return { assignmentId: assignment.assignmentId, semanticRole: assignment.semanticRole, mediaId: assignment.mediaId, assigned: true, rendered: Boolean(renderedBounds), renderedBounds, contextId: assignment.contextId, aboveFold: renderedBounds ? renderedBounds.y < innerHeight : null };
    });
    const sectionElements = Array.from(document.querySelectorAll("main section, article section, .gva-home > section, .gvs-page > section"));
    const explicitSections = sectionElements.slice(0, 60).map((section, index) => {
      const bounds = box(section)!;
      const prior = index > 0 ? box(sectionElements[index - 1]) : null;
      const sectionHeading = section.querySelector("h2,h3");
      const sectionMedia = section.querySelector("img,video,picture");
      return { sectionId: section.id || section.getAttribute("data-section-id") || `section-${index + 1}`, bounds, headingBounds: box(sectionHeading), headingLineCount: lineCount(sectionHeading), contentBounds: box(section.querySelector("[data-prose-content]") ?? section.querySelector("p,ul,ol,.gvs-wrap")), mediaBounds: box(sectionMedia), gapBefore: prior ? Math.max(0, bounds.y - (prior.y + prior.height)) : null };
    }).filter((section) => section.bounds);
    const headings = Array.from(primary.querySelectorAll("h2")).slice(0, 60);
    const headingSections = headings.map((sectionHeading, index) => {
      const headingBounds = box(sectionHeading)!; const next = headings[index + 1] ? box(headings[index + 1]) : null; const primaryBounds = box(primary)!;
      const bounds = { x: primaryBounds.x, y: headingBounds.y, width: primaryBounds.width, height: Math.max(headingBounds.height, (next?.y ?? primaryBounds.y + primaryBounds.height) - headingBounds.y) };
      return { sectionId: sectionHeading.id || `heading-section-${index + 1}`, bounds, headingBounds, headingLineCount: lineCount(sectionHeading), contentBounds: bounds, mediaBounds: null, gapBefore: null };
    });
    const sections = explicitSections.length > 0 ? explicitSections : headingSections;
    const heroBounds = box(hero);
    const visibleH1s = Array.from(document.querySelectorAll("h1")).filter(visible);
    const header = document.querySelector("header,[role=banner],#cafe-site-header");
    const footer = document.querySelector("footer,[role=contentinfo],#cafe-site-footer");
    const intersects = (left: Element | null, right: Element | null) => { if (!left || !right || !visible(left) || !visible(right)) return false; const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; };
    const blankImageContainers = images.filter((image) => visible(image) && (!image.complete || image.naturalWidth <= 1 || image.naturalHeight <= 1)).length;
    const headerActions = header ? Array.from(header.querySelectorAll("a,button")).filter(visible) : [];
    const contained = (element: Element) => { const bounds = element.getBoundingClientRect(); return bounds.left >= -1 && bounds.right <= document.documentElement.clientWidth + 1; };
    const quoteCtas = headerActions.filter((element) => /quote/i.test(element.textContent ?? ""));
    const fontAuthorityExpected = Array.from(document.fonts).some((face) => /Barlow Condensed/i.test(face.family) && face.status === "loaded");
    const maxWordFragments = (element: Element | null) => { if (!element) return 0; let maximum = 0; const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node = walker.nextNode(); while (node) { const text = node.textContent ?? ""; for (const match of text.matchAll(/\S+/g)) { const range = document.createRange(); range.setStart(node, match.index ?? 0); range.setEnd(node, (match.index ?? 0) + match[0].length); const rows = new Set(Array.from(range.getClientRects()).filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))); maximum = Math.max(maximum, rows.size); } node = walker.nextNode(); } return maximum; };
    const productSection = document.querySelector("#product-authority"); const productImage = productSection?.querySelector("img") ?? null; const productCopy = productSection?.querySelector(".saw-product-copy") ?? null; const productHeading = productCopy?.querySelector("h2") ?? null; const contextualSection = document.querySelector("#contextual-in-use"); const contextualCopy = contextualSection?.querySelector(".saw-split-copy") ?? null; const contextualHeading = contextualCopy?.querySelector("h2") ?? null; const productHeadingStyle = productHeading ? getComputedStyle(productHeading) : null; const contextualHeadingStyle = contextualHeading ? getComputedStyle(contextualHeading) : null;
    const richComposition = productSection && productHeading && contextualHeading ? { productGridColumns: getComputedStyle(productSection).gridTemplateColumns, productImageBounds: box(productImage), productCopyBounds: box(productCopy), productHeadingWordBreak: productHeadingStyle?.wordBreak ?? "", productHeadingOverflowWrap: productHeadingStyle?.overflowWrap ?? "", productHeadingHyphens: productHeadingStyle?.hyphens ?? "", productHeadingMaxWordFragments: maxWordFragments(productHeading), contextualCopyBounds: box(contextualCopy), contextualHeadingWordBreak: contextualHeadingStyle?.wordBreak ?? "", contextualHeadingMaxWordFragments: maxWordFragments(contextualHeading) } : null;
    const contrastHero = document.querySelector(".saw-hero"); const contrastEyebrow = contrastHero?.querySelector(".saw-kicker") ?? null; const contrastH1 = contrastHero?.querySelector("h1") ?? null; const contrastCopy = contrastHero?.querySelector(".saw-copy") ?? null; const contrastPrimary = contrastHero?.querySelector(".saw-button:not(.alt)") ?? null; const contrastSecondary = contrastHero?.querySelector(".saw-button.alt") ?? null; const contrastDisclaimer = contrastHero?.querySelector(".saw-note") ?? null; const styleValue = (element: Element | null, property: "color" | "backgroundColor" | "borderColor") => element ? getComputedStyle(element)[property] : ""; const overlaps = (left: Element | null, right: Element | null) => { if (!left || !right) return false; const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }; const heroContrast = contrastHero && contrastH1 ? { backgroundImage: getComputedStyle(contrastHero).backgroundImage, eyebrowColor: styleValue(contrastEyebrow, "color"), h1Color: styleValue(contrastH1, "color"), supportingCopyColor: styleValue(contrastCopy, "color"), primaryTextColor: styleValue(contrastPrimary, "color"), primaryBackgroundColor: styleValue(contrastPrimary, "backgroundColor"), secondaryTextColor: styleValue(contrastSecondary, "color"), secondaryBorderColor: styleValue(contrastSecondary, "borderColor"), disclaimerColor: styleValue(contrastDisclaimer, "color"), textOverlap: overlaps(contrastEyebrow, contrastH1) || overlaps(contrastH1, contrastCopy) || overlaps(contrastCopy, contrastPrimary) || overlaps(contrastPrimary, contrastDisclaimer) } : null;
    const parseRgb = (value: string) => { const match = value.match(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:[, /]+([\d.]+))?/); return match ? { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: match[4] === undefined ? 1 : Number(match[4]) } : null; };
    const luminanceClass = (color: readonly number[]) => (.2126 * color[0] + .7152 * color[1] + .0722 * color[2]) / 255 >= .55 ? "LIGHT" as const : "DARK" as const;
    const roleOf = (element: Element) => element.matches("h1") ? "H1" as const : element.matches("h2") ? "H2" as const : element.matches("h3") ? "H3" as const : element.matches(".saw-kicker") ? "EYEBROW" as const : element.matches(".saw-button.alt") ? "CTA_SECONDARY_TEXT" as const : element.matches(".saw-button") ? "CTA_PRIMARY_TEXT" as const : element.matches(".saw-note") ? "DISCLAIMER" as const : element.matches("figcaption") ? "CAPTION" as const : element.matches("small") ? "LABEL" as const : "BODY_COPY" as const;
    const backgroundOf = (element: Element) => { let cursor: Element | null = element; while (cursor && cursor !== document.documentElement) { const style = getComputedStyle(cursor); const color = parseRgb(style.backgroundColor); if (style.backgroundImage !== "none") { const overlays = [...style.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map((item) => parseRgb(item[0])).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((left, right) => right.alpha - left.alpha); const overlay = overlays[0] ?? null; if (overlay && overlay.alpha >= .7) { const worst = overlay.rgb.map((channel) => Math.round(channel * overlay.alpha + 255 * (1 - overlay.alpha))); const kind = luminanceClass(worst); return { backgroundType: kind === "DARK" ? "IMAGE_WITH_DARK_OVERLAY" as const : "IMAGE_WITH_LIGHT_OVERLAY" as const, backgroundLuminanceClass: kind, overlayPresent: true, overlayLuminanceClass: luminanceClass(overlay.rgb), effectiveBackgroundColor: `rgb(${worst.join(", ")})`, approvedOverlay: true, generatedImage: true }; } return { backgroundType: "MIXED_OR_UNKNOWN" as const, backgroundLuminanceClass: "MIXED_OR_UNKNOWN" as const, overlayPresent: Boolean(overlay), overlayLuminanceClass: overlay ? luminanceClass(overlay.rgb) : null, effectiveBackgroundColor: null, approvedOverlay: false, generatedImage: true }; } if (color && color.alpha >= .95) { const kind = luminanceClass(color.rgb); return { backgroundType: kind === "DARK" ? "DARK_SOLID" as const : "LIGHT_SOLID" as const, backgroundLuminanceClass: kind, overlayPresent: false, overlayLuminanceClass: null, effectiveBackgroundColor: `rgb(${color.rgb.join(", ")})`, approvedOverlay: false, generatedImage: false }; } cursor = cursor.parentElement; } return { backgroundType: "MIXED_OR_UNKNOWN" as const, backgroundLuminanceClass: "MIXED_OR_UNKNOWN" as const, overlayPresent: false, overlayLuminanceClass: null, effectiveBackgroundColor: null, approvedOverlay: false, generatedImage: false }; };
    const specificity = (selector: string): [number, number, number, number] => [0, (selector.match(/#[\w-]+/g) ?? []).length, (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length, (selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?:\([^)]*\))?/g, " ").match(/\b[a-z][\w-]*\b/gi) ?? []).length];
    const cascadeFor = (element: Element) => { const declarations: Array<{ selector: string; property: "color"; value: string; important: boolean; specificity: [number, number, number, number]; order: number; source: string }> = []; let order = 0; const visit = (rules: CSSRuleList, source: string) => { for (const rule of Array.from(rules)) { if (rule instanceof CSSStyleRule) { const selector = rule.selectorText.trim(); try { if (element.matches(selector) && rule.style.getPropertyValue("color")) declarations.push({ selector, property: "color", value: rule.style.getPropertyValue("color").trim(), important: rule.style.getPropertyPriority("color") === "important", specificity: specificity(selector), order: order++, source }); } catch {} } else if ("cssRules" in rule) { try { visit((rule as CSSGroupingRule).cssRules, source); } catch {} } } }; Array.from(document.styleSheets).forEach((sheet, index) => { try { visit(sheet.cssRules, sheet.href ?? `inline-style:${index}`); } catch { declarations.push({ selector: "<cross-origin stylesheet>", property: "color", value: "<unavailable>", important: false, specificity: [0, 0, 0, 0], order: order++, source: sheet.href ?? `unreadable-style:${index}` }); } }); const inline = (element as HTMLElement).style; if (inline?.getPropertyValue("color")) declarations.push({ selector: "<inline style>", property: "color", value: inline.getPropertyValue("color").trim(), important: inline.getPropertyPriority("color") === "important", specificity: [1, 0, 0, 0], order: order++, source: "element.style" }); const readable = declarations.filter((item) => item.value !== "<unavailable>"); const compare = (left: typeof readable[number], right: typeof readable[number]) => Number(left.important) - Number(right.important) || left.specificity.reduce((value, part, index) => value || part - right.specificity[index], 0) || left.order - right.order; return { declarations, winner: readable.sort(compare).at(-1) ?? null }; };
    const textRoot = document.querySelector("[data-genesis-primary-content]") ?? primary; const candidates = Array.from(textRoot.querySelectorAll("h1,h2,h3,p,a,small,figcaption")).filter((element) => visible(element) && Boolean(element.textContent?.trim()) && !element.querySelector("h1,h2,h3,p,a,small,figcaption")); const backgroundAwareTextContrast = candidates.map((element, index) => { const role = roleOf(element); const section = element.closest("section,[data-section-id]"); const cascade = cascadeFor(element); const computed = getComputedStyle(element); return { observationId: `${section?.id || section?.getAttribute("data-media-role") || "section"}-${role}-${index}`, viewport: String(innerWidth), sectionId: section?.id || section?.getAttribute("data-media-role") || "unscoped", textExcerpt: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240), domIdentity: { tagName: element.tagName.toLowerCase(), id: element.id || null, classList: Array.from(element.classList) }, ...backgroundOf(element), textRole: role, foregroundColor: computed.color, webkitTextFillColor: computed.getPropertyValue("-webkit-text-fill-color"), requiredContrast: ["H1", "H2", "H3", "CAPTION", "LABEL"].includes(role) ? 3 : 4.5, source: document.querySelector("[data-native-wordpress-equivalent]") ? "HOST_EQUIVALENT_RENDER" as const : "GENESIS_COMPOSITION_RENDER" as const, matchedColorDeclarations: cascade.declarations, winningColorDeclaration: cascade.winner }; });
    const overflowElements = Array.from(document.querySelectorAll<HTMLElement>("body *")).map((element) => { const bounds = element.getBoundingClientRect(); const style = getComputedStyle(element); const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${typeof element.className === "string" && element.className.trim() ? `.${element.className.trim().replace(/\s+/g, ".")}` : ""}`; return { selector: selector.slice(0, 240), left: Math.round(bounds.left), right: Math.round(bounds.right), width: Math.round(bounds.width), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, position: style.position, minWidth: style.minWidth, maxWidth: style.maxWidth }; }).filter((item) => item.left < -1 || item.right > document.documentElement.clientWidth + 1 || item.scrollWidth > item.clientWidth + 1).sort((left, right) => Math.max(right.right - document.documentElement.clientWidth, -right.left, right.scrollWidth - right.clientWidth) - Math.max(left.right - document.documentElement.clientWidth, -left.left, left.scrollWidth - left.clientWidth)).slice(0, 16);
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      primaryContentBounds: box(primary), horizontalOverflow: Math.max(0, Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth),
      hero: { authority: hero ? "SEMANTIC_HERO" as const : "NOT_IDENTIFIED" as const, present: hero ? visible(hero) : null, bounds: heroBounds, headingBounds: box(heading), headingLineCount: lineCount(heading), primaryCtaBounds: box(cta), mediaBounds: box(heroMedia), mediaBeforeHero: heroMedia && heroBounds ? box(heroMedia)!.y < heroBounds.y : null, containerAligned: heroBounds && box(primary) ? Math.abs(heroBounds.x - box(primary)!.x) < 4 : null },
      hostIntegration: { headerOverlap: intersects(header, primary), footerOverlap: intersects(footer, primary), blankImageContainers },
      media, sections,
      themeIntegration: { visibleH1Count: visibleH1s.length, visibleH1Texts: visibleH1s.map((item) => item.textContent?.trim() ?? "").filter(Boolean), duplicateThemeTitleVisible: visible(document.querySelector(".page-title.the-title")), duplicateThemeFeaturedMediaVisible: visible(document.querySelector(".post-media.single-image")), globalHeaderPresent: visible(header), globalFooterPresent: visible(document.querySelector("footer,[role=contentinfo],#cafe-site-footer")), fontAuthorityExpected, headerActionsContained: headerActions.length > 0 && headerActions.every(contained), quoteCtaContained: quoteCtas.length > 0 && quoteCtas.every(contained), backgroundAwareTextContrast, heroContrast, richComposition, overflowElements },
    };
  }, assignments);
}

export async function captureGovernedRenderedPage(input: GovernedBrowserCaptureInput): Promise<GovernedBrowserCaptureResult> {
  if (input.viewport.width > GOVERNED_RENDER_CAPTURE_LIMITS.maximumScreenshotWidth || input.viewport.height > GOVERNED_RENDER_CAPTURE_LIMITS.maximumScreenshotHeight) throw new Error("CAPTURE_DIMENSIONS_EXCEEDED");
  await validateGovernedCaptureUrl({ targetUrl: input.targetUrl, allowedOrigins: input.allowedOrigins, internalGenesisOrigin: input.internalGenesisOrigin });
  const pins: string[] = [];
  for (const origin of input.allowedOrigins) {
    const target = new URL(origin);
    if (input.internalGenesisOrigin && target.origin === new URL(input.internalGenesisOrigin).origin) continue;
    const resolved = await validateGovernedCaptureUrl({ targetUrl: target.origin, allowedOrigins: input.allowedOrigins, internalGenesisOrigin: input.internalGenesisOrigin });
    pins.push(`MAP ${target.hostname} ${resolved.resolvedAddresses[0]}`);
  }
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ executablePath: edgeExecutable(), headless: true, args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", ...(pins.length ? [`--host-resolver-rules=${pins.join(",")}`] : [])] });
    const context = await browser.newContext({ viewport: input.viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    let blockedMainNavigation: string | null = null;
    await page.route("**/*", async (route) => {
      const request = route.request();
      try {
        const checked = await validateGovernedCaptureUrl({ targetUrl: request.url(), allowedOrigins: input.allowedOrigins, internalGenesisOrigin: input.internalGenesisOrigin });
        const headers = { ...request.headers() };
        if (input.internalAuthorization && checked.internal) headers[input.internalAuthorization.header] = input.internalAuthorization.value;
        else if (input.internalAuthorization) delete headers[input.internalAuthorization.header.toLowerCase()];
        await route.continue({ headers });
      } catch (error) {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) blockedMainNavigation = error instanceof Error ? error.message : "CAPTURE_REDIRECT_BLOCKED";
        await route.abort("blockedbyclient");
      }
    });
    const response = await page.goto(input.targetUrl, { waitUntil: "domcontentloaded", timeout: GOVERNED_RENDER_CAPTURE_LIMITS.navigationTimeoutMs });
    if (blockedMainNavigation) throw new Error(blockedMainNavigation);
    if (!response || !response.ok()) throw new Error(`CAPTURE_NAVIGATION_FAILED:${response?.status() ?? 0}`);
    const chain: string[] = []; let cursor: Request | null = response.request(); while (cursor) { chain.unshift(cursor.url()); cursor = cursor.redirectedFrom(); }
    validateCaptureRedirectChain({ requestedUrl: input.targetUrl, responseUrls: chain, allowedOrigins: input.allowedOrigins });
    const styleSettlement = await settle(page);
    let measured: Awaited<ReturnType<typeof geometry>>;
    try { measured = await geometry(page, input.mediaAssignments); }
    catch { throw new Error("GEOMETRY_EXTRACTION_FAILED"); }
    const imageHeight = Math.min(Math.ceil(measured.documentHeight), GOVERNED_RENDER_CAPTURE_LIMITS.maximumScreenshotHeight);
    const bytes = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: input.viewport.width, height: imageHeight }, timeout: GOVERNED_RENDER_CAPTURE_LIMITS.captureTimeoutMs });
    if (bytes.byteLength > GOVERNED_RENDER_CAPTURE_LIMITS.maximumArtifactBytes) throw new Error("ARTIFACT_TOO_LARGE");
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("GEOMETRY_EXTRACTION_FAILED");
    const capturedAt = new Date().toISOString();
    const source = new URL(input.targetUrl);
    const renderedContent = await page.evaluate(() => (document.querySelector("[data-genesis-primary-content]") ?? document.documentElement).outerHTML);
    const renderedContentHash = hashRenderedVisualContent(renderedContent); const screenshotHash = hashRenderedVisualContent(bytes); const screenshotComputedStyleCorrelationId = hashRenderedVisualContent(`${input.captureId}:${renderedContentHash}:${screenshotHash}:${styleSettlement.signature}`);
    return { bytes, imageWidth: metadata.width, imageHeight: metadata.height, renderedContentHash, styleSettlement, screenshotComputedStyleCorrelationId, themeIntegration: measured.themeIntegration, evidence: { captureId: input.captureId, viewportClass: input.viewportClass, viewportWidth: input.viewport.width, viewportHeight: input.viewport.height, documentWidth: measured.documentWidth, documentHeight: measured.documentHeight, primaryContentBounds: cleanBounds(measured.primaryContentBounds), horizontalOverflow: measured.horizontalOverflow, capturedAt, source: { origin: source.origin, pathname: source.pathname }, renderer: { engine: `${GOVERNED_RENDER_CAPTURE_VERSION}:playwright-edge:bounded-dom-fonts-images:stable-styles`, version: await browser.version(), userAgent: await page.evaluate(() => navigator.userAgent) }, hero: { ...measured.hero, bounds: cleanBounds(measured.hero.bounds), headingBounds: cleanBounds(measured.hero.headingBounds), primaryCtaBounds: cleanBounds(measured.hero.primaryCtaBounds), mediaBounds: cleanBounds(measured.hero.mediaBounds) }, hostIntegration: measured.hostIntegration, media: measured.media.map((item) => ({ ...item, renderedBounds: cleanBounds(item.renderedBounds) })), sections: measured.sections.map((section) => ({ ...section, bounds: cleanBounds(section.bounds)!, headingBounds: cleanBounds(section.headingBounds), contentBounds: cleanBounds(section.contentBounds), mediaBounds: cleanBounds(section.mediaBounds) })) } };
  } catch (error) {
    if (error instanceof Error && /Timeout/i.test(error.message)) throw new Error("CAPTURE_TIMEOUT");
    throw error;
  } finally { await browser?.close(); }
}