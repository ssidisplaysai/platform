import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import type { SiteNavigationItem } from "./site-page-generation";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

const SITE_ID = "site-rj-metal-commercial-stainless-counters";
const ORGANIZATION_ID = "rj-metal";
const DOMAIN = "commercialstainlesscounters.com";
const NAVIGATION_TITLE = "Genesis CSC Approved Navigation V1";

type WordPressRendered = { raw?: string; rendered?: string };
type WordPressNavigation = { id?: number; status?: string; title?: WordPressRendered; content?: WordPressRendered };
type WordPressTemplatePart = { id?: string; slug?: string; theme?: string; area?: string; status?: string; content?: WordPressRendered };

export type ApprovedThemeShellNavigation = {
  items: SiteNavigationItem[];
  footerLinks: Array<{ label: string; href: string }>;
};

function canonicalUrl(href: string): string {
  const path = href.startsWith("/") ? href : `/${href}`;
  return `https://${DOMAIN}${path}`;
}

function navigationLink(item: { label: string; href: string }, topLevel: boolean): string {
  const attributes = { label: item.label, url: canonicalUrl(item.href), kind: "custom", ...(topLevel ? { isTopLevelLink: true } : {}) };
  return `<!-- wp:navigation-link ${JSON.stringify(attributes)} /-->`;
}

export function buildApprovedNavigationBlocks(items: SiteNavigationItem[]): string {
  return items.map((item) => item.children.length === 0
    ? navigationLink(item, true)
    : [
        `<!-- wp:navigation-submenu ${JSON.stringify({ label: item.label, url: canonicalUrl(item.href), kind: "custom", isTopLevelItem: true })} -->`,
        ...item.children.map((child) => navigationLink(child, false)),
        "<!-- /wp:navigation-submenu -->",
      ].join("\n")).join("\n");
}

export function bindHeaderNavigation(content: string, navigationId: number): string {
  let replacements = 0;
  const updated = content.replace(/<!-- wp:navigation(?:\s+(\{[^]*?\}))?\s*\/-->/g, (_match, json: string | undefined) => {
    replacements += 1;
    const attributes = json ? JSON.parse(json) as Record<string, unknown> : {};
    return `<!-- wp:navigation ${JSON.stringify({ ...attributes, ref: navigationId })} /-->`;
  });
  if (replacements !== 1) throw new Error(`THEME_SHELL_HEADER_NAVIGATION_BLOCK_COUNT:${replacements}`);
  return updated;
}

export function buildApprovedFooterBlocks(footerLinks: Array<{ label: string; href: string }>): string {
  const links = footerLinks.map((item) => navigationLink(item, true)).join("\n");
  return `<!-- wp:group {"align":"wide","layout":{"type":"flex","flexWrap":"wrap","justifyContent":"right"}} -->\n<div class="wp-block-group alignwide">\n<!-- wp:navigation {"overlayMenu":"never","layout":{"type":"flex","justifyContent":"right"}} -->\n${links}\n<!-- /wp:navigation -->\n</div>\n<!-- /wp:group -->`;
}

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function authority(site: SiteConfiguration) {
  if (site.siteId !== SITE_ID || site.organizationId !== ORGANIZATION_ID || site.domain !== DOMAIN) throw new Error("THEME_SHELL_SCOPE_MISMATCH");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("THEME_SHELL_AUTHORITY_REQUIRED");
  const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  return { apiBase, headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" } };
}

async function readCollection<T>(apiBase: string, headers: Record<string, string>, path: string): Promise<T[]> {
  const response = await fetch(`${apiBase}/${path}?context=edit&status=publish,draft&per_page=100&_genesis_shell=${crypto.randomUUID()}`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`THEME_SHELL_READ_FAILED:${path}:${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error(`THEME_SHELL_RESPONSE_INVALID:${path}`);
  return body as T[];
}

async function writeJson<T>(apiBase: string, headers: Record<string, string>, path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiBase}/${path}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`THEME_SHELL_WRITE_FAILED:${path}:${response.status}`);
  return await response.json() as T;
}

function exactPart(parts: WordPressTemplatePart[], area: "header" | "footer"): WordPressTemplatePart {
  const matches = parts.filter((part) => part.area === area && part.slug === area);
  if (matches.length !== 1 || !matches[0].id || typeof matches[0].content?.raw !== "string") throw new Error(`THEME_SHELL_${area.toUpperCase()}_PART_NOT_EXACT`);
  if (matches[0].id !== `twentytwentyfive//${area}`) throw new Error(`THEME_SHELL_${area.toUpperCase()}_PART_ID_MISMATCH`);
  return matches[0];
}

export async function inspectWordPressThemeShell(site: SiteConfiguration) {
  const resolved = authority(site);
  const [navigations, parts] = await Promise.all([
    readCollection<WordPressNavigation>(resolved.apiBase, resolved.headers, "navigation"),
    readCollection<WordPressTemplatePart>(resolved.apiBase, resolved.headers, "template-parts"),
  ]);
  const header = exactPart(parts, "header");
  const footer = exactPart(parts, "footer");
  const owned = navigations.filter((item) => item.title?.raw === NAVIGATION_TITLE);
  const headerContent = header.content?.raw ?? "";
  const footerContent = footer.content?.raw ?? "";
  return {
    navigationResources: navigations.map((item) => ({ id: Number(item.id ?? 0), title: item.title?.raw ?? null, status: item.status ?? null, content: item.content?.raw ?? null })),
    ownedNavigationCount: owned.length,
    ownedNavigationId: owned.length === 1 ? Number(owned[0].id ?? 0) : null,
    header: { id: header.id, theme: header.theme ?? null, pageListFallback: !/"ref"\s*:\s*\d+/.test(headerContent), content: headerContent },
    footer: { id: footer.id, theme: footer.theme ?? null, hasThemeDemo: /Blog|FAQs|Authors|Events|Shop|Patterns|Themes|Twenty Twenty-Five|Designed with/i.test(footerContent), content: footerContent },
    readOnly: true as const,
  };
}

export async function repairWordPressThemeShell(site: SiteConfiguration, approved: ApprovedThemeShellNavigation) {
  if (approved.items.length !== 6 || approved.items.reduce((count, item) => count + item.children.length, 0) !== 10) throw new Error("THEME_SHELL_APPROVED_NAVIGATION_COUNT_MISMATCH");
  if (approved.footerLinks.length !== 3) throw new Error("THEME_SHELL_APPROVED_FOOTER_COUNT_MISMATCH");
  const resolved = authority(site);
  const before = await inspectWordPressThemeShell(site);
  if (before.ownedNavigationCount > 1) throw new Error("THEME_SHELL_OWNED_NAVIGATION_COLLISION");
  const navigationContent = buildApprovedNavigationBlocks(approved.items);
  const navigation = before.ownedNavigationId
    ? await writeJson<WordPressNavigation>(resolved.apiBase, resolved.headers, `navigation/${before.ownedNavigationId}`, { title: NAVIGATION_TITLE, content: navigationContent, status: "publish" })
    : await writeJson<WordPressNavigation>(resolved.apiBase, resolved.headers, "navigation", { title: NAVIGATION_TITLE, content: navigationContent, status: "publish" });
  const navigationId = Number(navigation.id ?? 0);
  if (!navigationId) throw new Error("THEME_SHELL_NAVIGATION_ID_MISSING");
  const headerContent = bindHeaderNavigation(before.header.content, navigationId);
  const footerContent = buildApprovedFooterBlocks(approved.footerLinks);
  await writeJson(resolved.apiBase, resolved.headers, `template-parts/${before.header.id}`, { content: headerContent });
  await writeJson(resolved.apiBase, resolved.headers, `template-parts/${before.footer.id}`, { content: footerContent });
  const after = await inspectWordPressThemeShell(site);
  if (after.ownedNavigationId !== navigationId || after.header.pageListFallback || after.footer.hasThemeDemo || after.header.content !== headerContent || after.footer.content !== footerContent) throw new Error("THEME_SHELL_POST_WRITE_VERIFICATION_FAILED");
  return { navigationId, headerTemplatePartId: before.header.id, footerTemplatePartId: before.footer.id, navigationCreated: before.ownedNavigationId === null, headerUpdated: before.header.content !== headerContent, footerUpdated: before.footer.content !== footerContent };
}

export const WORDPRESS_THEME_SHELL_AUTHORITY = { navigationTitle: NAVIGATION_TITLE };