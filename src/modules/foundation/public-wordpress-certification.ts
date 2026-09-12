import "server-only";

export type PublicWordPressRouteSpec = {
  path: string;
  expectedH1: string;
  expectedTitle?: string;
};

export type PublicWordPressRedirectSpec = {
  from: string;
  to: string;
};

export type PublicWordPressViewportEvidence = {
  viewport: "desktop" | "mobile";
  navigationVisible: boolean;
  navigationOperable: boolean;
  brandIdentityVisible: boolean;
  horizontalOverflow: boolean;
};

export type PublicWordPressCertificationSpec = {
  canonicalOrigin: string;
  wordpressSettings?: { home: string | null; siteUrl: string | null };
  routes: readonly PublicWordPressRouteSpec[];
  oldRedirects?: readonly PublicWordPressRedirectSpec[];
  expectedBrand: string;
  forbiddenPublicTerms?: readonly string[];
  viewportEvidence?: readonly PublicWordPressViewportEvidence[];
};

export type PublicWordPressRouteEvidence = {
  path: string;
  status: number;
  finalUrl: string;
  canonicalUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  indexable: boolean;
  placeholderLinkCount: number;
  developmentUrlCount: number;
  governanceLeakCount: number;
  defaultArtifactCount: number;
  brokenMediaCount: number;
  internalPaths: readonly string[];
  blockers: readonly string[];
};

export type PublicWordPressCertification = {
  ready: boolean;
  canonicalOrigin: string;
  routes: readonly PublicWordPressRouteEvidence[];
  redirects: readonly { from: string; to: string; status: number; finalUrl: string; valid: boolean }[];
  orphanPaths: readonly string[];
  viewportChecks: { supplied: boolean; ready: boolean; blockers: readonly string[] };
  blockers: readonly string[];
  mutationPerformed: false;
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_FORBIDDEN_TERMS = ["owner-confirmed", "approved authority", "pending validation", "evidence gated", "genesis"];
const DEFAULT_ARTIFACTS = ["hello world", "sample page", "just another wordpress site", "proudly powered by wordpress"];

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("PUBLIC_CERTIFICATION_HTTPS_ORIGIN_REQUIRED");
  return url.origin;
}

function normalizePath(value: string): string {
  const path = `/${value.trim().replace(/^\/+|\/+$/g, "")}`;
  return path === "/" ? path : `${path}/`;
}

function text(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function firstMatch(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1]?.trim() ?? null;
}

function attribute(tag: string, name: string): string | null {
  return new RegExp(`${name}=["']([^"']+)["']`, "i").exec(tag)?.[1]?.trim() ?? null;
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function absolute(origin: string, value: string): URL | null {
  try { return new URL(value, origin); } catch { return null; }
}

async function inspectRoute(input: {
  origin: string;
  route: PublicWordPressRouteSpec;
  expectedPaths: ReadonlySet<string>;
  expectedBrand: string;
  forbiddenTerms: readonly string[];
  fetcher: Fetcher;
}): Promise<PublicWordPressRouteEvidence> {
  const path = normalizePath(input.route.path);
  const response = await input.fetcher(`${input.origin}${path}`, { redirect: "follow", cache: "no-store" });
  const html = await response.text();
  const finalUrl = response.url || `${input.origin}${path}`;
  const canonicalTag = tags(html, "link").find((tag) => /rel=["'][^"']*canonical/i.test(tag));
  const canonicalUrl = canonicalTag ? attribute(canonicalTag, "href") : null;
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescriptionTag = tags(html, "meta").find((tag) => /name=["']description["']/i.test(tag));
  const metaDescription = metaDescriptionTag ? attribute(metaDescriptionTag, "content") : null;
  const robotsTag = tags(html, "meta").find((tag) => /name=["']robots["']/i.test(tag));
  const robots = robotsTag ? attribute(robotsTag, "content")?.toLowerCase() ?? "" : "";
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Text = h1Matches[0] ? text(h1Matches[0][1]) : null;
  const hrefs = tags(html, "a").map((tag) => attribute(tag, "href")).filter((value): value is string => Boolean(value));
  const internalPaths = [...new Set(hrefs.map((href) => absolute(input.origin, href)).filter((url): url is URL => Boolean(url && url.origin === input.origin)).map((url) => normalizePath(url.pathname)))];
  const mediaUrls = tags(html, "img").map((tag) => attribute(tag, "src")).filter((value): value is string => Boolean(value));
  let brokenMediaCount = 0;
  for (const source of mediaUrls) {
    const url = absolute(input.origin, source);
    if (!url) { brokenMediaCount += 1; continue; }
    try {
      const media = await input.fetcher(url.toString(), { method: "HEAD", redirect: "follow", cache: "no-store" });
      if (!media.ok) brokenMediaCount += 1;
    } catch { brokenMediaCount += 1; }
  }
  const lower = text(html).toLowerCase();
  const placeholderLinkCount = hrefs.filter((href) => !href.trim() || href.trim() === "#" || /^javascript:/i.test(href)).length;
  const developmentUrlCount = (html.match(/https?:\/\/(?:localhost|127\.0\.0\.1|[^/\s"']*\.local)(?::\d+)?/gi) ?? []).length;
  const governanceLeakCount = input.forbiddenTerms.filter((term) => lower.includes(term.toLowerCase())).length;
  const defaultArtifactCount = DEFAULT_ARTIFACTS.filter((term) => lower.includes(term)).length;
  const expectedCanonical = `${input.origin}${path}`;
  const blockers = [
    ...(!response.ok ? [`HTTP_${response.status}`] : []),
    ...(new URL(finalUrl).origin !== input.origin ? ["CANONICAL_ORIGIN_MISMATCH"] : []),
    ...(canonicalUrl !== expectedCanonical ? ["CANONICAL_URL_MISMATCH"] : []),
    ...(h1Matches.length !== 1 ? ["H1_COUNT_INVALID"] : []),
    ...(h1Text !== input.route.expectedH1 ? ["H1_TEXT_MISMATCH"] : []),
    ...(input.route.expectedTitle && text(title ?? "") !== input.route.expectedTitle ? ["TITLE_MISMATCH"] : []),
    ...(!metaDescription ? ["META_DESCRIPTION_MISSING"] : []),
    ...(/noindex|none/.test(robots) ? ["INDEXABILITY_BLOCKED"] : []),
    ...(placeholderLinkCount ? ["PLACEHOLDER_LINKS_PRESENT"] : []),
    ...(developmentUrlCount ? ["DEVELOPMENT_URL_LEAK"] : []),
    ...(governanceLeakCount ? ["GOVERNANCE_COPY_LEAK"] : []),
    ...(defaultArtifactCount ? ["DEFAULT_WORDPRESS_ARTIFACT"] : []),
    ...(brokenMediaCount ? ["BROKEN_MEDIA"] : []),
    ...internalPaths.filter((candidate) => !input.expectedPaths.has(candidate)).map((candidate) => `UNDECLARED_INTERNAL_PATH:${candidate}`),
    ...(!lower.includes(input.expectedBrand.toLowerCase()) ? ["PUBLIC_BRAND_IDENTITY_MISSING"] : []),
  ];
  return { path, status: response.status, finalUrl, canonicalUrl, title: title ? text(title) : null, metaDescription, h1Count: h1Matches.length, h1Text, indexable: !/noindex|none/.test(robots), placeholderLinkCount, developmentUrlCount, governanceLeakCount, defaultArtifactCount, brokenMediaCount, internalPaths, blockers };
}

export async function certifyPublicWordPressSite(input: {
  spec: PublicWordPressCertificationSpec;
  fetcher?: Fetcher;
}): Promise<PublicWordPressCertification> {
  const origin = normalizeOrigin(input.spec.canonicalOrigin);
  const fetcher = input.fetcher ?? fetch;
  const expectedPaths = new Set(input.spec.routes.map((route) => normalizePath(route.path)));
  const forbiddenTerms = [...DEFAULT_FORBIDDEN_TERMS, ...(input.spec.forbiddenPublicTerms ?? [])];
  const routes: PublicWordPressRouteEvidence[] = [];
  for (const route of input.spec.routes) routes.push(await inspectRoute({ origin, route, expectedPaths, expectedBrand: input.spec.expectedBrand, forbiddenTerms, fetcher }));
  const inbound = new Map([...expectedPaths].map((path) => [path, 0]));
  for (const route of routes) for (const path of route.internalPaths) if (inbound.has(path)) inbound.set(path, (inbound.get(path) ?? 0) + 1);
  const orphanPaths = [...inbound].filter(([path, count]) => path !== "/" && count === 0).map(([path]) => path);
  const redirects = [];
  for (const redirect of input.spec.oldRedirects ?? []) {
    const from = new URL(redirect.from, origin).toString();
    const expected = new URL(redirect.to, origin).toString();
    const response = await fetcher(from, { redirect: "follow", cache: "no-store" });
    redirects.push({ from, to: expected, status: response.status, finalUrl: response.url, valid: response.ok && response.url === expected });
  }
  const viewport = input.spec.viewportEvidence ?? [];
  const viewportBlockers = viewport.flatMap((evidence) => [
    ...(!evidence.navigationVisible ? [`${evidence.viewport.toUpperCase()}_NAVIGATION_HIDDEN`] : []),
    ...(!evidence.navigationOperable ? [`${evidence.viewport.toUpperCase()}_NAVIGATION_INOPERABLE`] : []),
    ...(!evidence.brandIdentityVisible ? [`${evidence.viewport.toUpperCase()}_BRAND_IDENTITY_MISSING`] : []),
    ...(evidence.horizontalOverflow ? [`${evidence.viewport.toUpperCase()}_HORIZONTAL_OVERFLOW`] : []),
  ]);
  const blockers = [
    ...(input.spec.wordpressSettings?.home !== undefined && input.spec.wordpressSettings.home !== origin ? ["WORDPRESS_HOME_MISMATCH"] : []),
    ...(input.spec.wordpressSettings?.siteUrl !== undefined && input.spec.wordpressSettings.siteUrl !== origin ? ["WORDPRESS_SITEURL_MISMATCH"] : []),
    ...routes.flatMap((route) => route.blockers.map((blocker) => `${route.path}:${blocker}`)),
    ...orphanPaths.map((path) => `${path}:ORPHAN_PATH`),
    ...redirects.filter((redirect) => !redirect.valid).map((redirect) => `${redirect.from}:REDIRECT_INVALID`),
    ...viewportBlockers,
  ];
  return { ready: blockers.length === 0, canonicalOrigin: origin, routes, redirects, orphanPaths, viewportChecks: { supplied: viewport.length > 0, ready: viewportBlockers.length === 0, blockers: viewportBlockers }, blockers, mutationPerformed: false };
}
