import "server-only";

import { existsSync } from "node:fs";
import { chromium, type Browser, type Page, type Request } from "playwright-core";
import sharp from "sharp";
import { GOVERNED_RENDER_CAPTURE_LIMITS, GOVERNED_RENDER_CAPTURE_VERSION, validateCaptureRedirectChain, validateGovernedCaptureUrl } from "./governed-render-capture-security";
import { hashRenderedVisualContent, type RenderedVisualBounds, type RenderedVisualCaptureEvidence, type RenderedVisualViewportClass } from "./rendered-visual-certification";

export type CaptureMediaAssignment = { assignmentId: string | null; semanticRole: "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE"; mediaId: string | null; sourceUrl: string | null; contextId: string | null };
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
export type GovernedBrowserCaptureResult = { evidence: Omit<RenderedVisualCaptureEvidence, "screenshotArtifact">; bytes: Uint8Array; imageWidth: number; imageHeight: number; renderedContentHash: string };

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

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: GOVERNED_RENDER_CAPTURE_LIMITS.navigationTimeoutMs });
  await page.evaluate(async (timeoutMs) => {
    const bounded = (promise: Promise<unknown>) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    await bounded(document.fonts?.ready ?? Promise.resolve());
    const images = Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); }));
    await bounded(Promise.all(images));
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
      const match = assignment.sourceUrl ? images.find((image) => normalize(image.currentSrc || image.src) === sourcePath && visible(image)) ?? backgroundElements.find((element) => getComputedStyle(element).backgroundImage.includes(sourcePath) && visible(element)) ?? null : null;
      const renderedBounds = box(match);
      return { assignmentId: assignment.assignmentId, semanticRole: assignment.semanticRole, mediaId: assignment.mediaId, assigned: true, rendered: Boolean(renderedBounds), renderedBounds, contextId: assignment.contextId, aboveFold: renderedBounds ? renderedBounds.y < innerHeight : null };
    });
    const sectionElements = Array.from(document.querySelectorAll("main section, article section, .gva-home > section, .gvs-page > section"));
    const explicitSections = sectionElements.slice(0, 60).map((section, index) => {
      const bounds = box(section)!;
      const prior = index > 0 ? box(sectionElements[index - 1]) : null;
      const sectionHeading = section.querySelector("h2,h3");
      const sectionMedia = section.querySelector("img,video,picture");
      return { sectionId: section.id || section.getAttribute("data-section-id") || `section-${index + 1}`, bounds, headingBounds: box(sectionHeading), headingLineCount: lineCount(sectionHeading), contentBounds: box(section.querySelector("p,ul,ol,.gvs-wrap")), mediaBounds: box(sectionMedia), gapBefore: prior ? Math.max(0, bounds.y - (prior.y + prior.height)) : null };
    }).filter((section) => section.bounds);
    const headings = Array.from(primary.querySelectorAll("h2")).slice(0, 60);
    const headingSections = headings.map((sectionHeading, index) => {
      const headingBounds = box(sectionHeading)!; const next = headings[index + 1] ? box(headings[index + 1]) : null; const primaryBounds = box(primary)!;
      const bounds = { x: primaryBounds.x, y: headingBounds.y, width: primaryBounds.width, height: Math.max(headingBounds.height, (next?.y ?? primaryBounds.y + primaryBounds.height) - headingBounds.y) };
      return { sectionId: sectionHeading.id || `heading-section-${index + 1}`, bounds, headingBounds, headingLineCount: lineCount(sectionHeading), contentBounds: bounds, mediaBounds: null, gapBefore: null };
    });
    const sections = explicitSections.length > 0 ? explicitSections : headingSections;
    const heroBounds = box(hero);
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      primaryContentBounds: box(primary), horizontalOverflow: Math.max(0, Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth),
      hero: { authority: hero ? "SEMANTIC_HERO" as const : "NOT_IDENTIFIED" as const, present: hero ? visible(hero) : null, bounds: heroBounds, headingBounds: box(heading), headingLineCount: lineCount(heading), primaryCtaBounds: box(cta), mediaBounds: box(heroMedia), mediaBeforeHero: heroMedia && heroBounds ? box(heroMedia)!.y < heroBounds.y : null, containerAligned: heroBounds && box(primary) ? Math.abs(heroBounds.x - box(primary)!.x) < 4 : null },
      media, sections,
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
    await settle(page);
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
    const renderedContentHash = hashRenderedVisualContent(await page.content());
    return { bytes, imageWidth: metadata.width, imageHeight: metadata.height, renderedContentHash, evidence: { captureId: input.captureId, viewportClass: input.viewportClass, viewportWidth: input.viewport.width, viewportHeight: input.viewport.height, documentWidth: measured.documentWidth, documentHeight: measured.documentHeight, primaryContentBounds: cleanBounds(measured.primaryContentBounds), horizontalOverflow: measured.horizontalOverflow, capturedAt, source: { origin: source.origin, pathname: source.pathname }, renderer: { engine: `${GOVERNED_RENDER_CAPTURE_VERSION}:playwright-edge:bounded-dom-fonts-images`, version: await browser.version(), userAgent: await page.evaluate(() => navigator.userAgent) }, hero: { ...measured.hero, bounds: cleanBounds(measured.hero.bounds), headingBounds: cleanBounds(measured.hero.headingBounds), primaryCtaBounds: cleanBounds(measured.hero.primaryCtaBounds), mediaBounds: cleanBounds(measured.hero.mediaBounds) }, media: measured.media.map((item) => ({ ...item, renderedBounds: cleanBounds(item.renderedBounds) })), sections: measured.sections.map((section) => ({ ...section, bounds: cleanBounds(section.bounds)!, headingBounds: cleanBounds(section.headingBounds), contentBounds: cleanBounds(section.contentBounds), mediaBounds: cleanBounds(section.mediaBounds) })) } };
  } catch (error) {
    if (error instanceof Error && /Timeout/i.test(error.message)) throw new Error("CAPTURE_TIMEOUT");
    throw error;
  } finally { await browser?.close(); }
}