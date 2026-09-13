import "server-only";

import { createHash } from "node:crypto";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import type { SiteNavigationItem } from "./site-page-generation";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

const SITE_ID = "site-rj-metal-commercial-stainless-counters";
const ORGANIZATION_ID = "rj-metal";
const DOMAIN = "commercialstainlesscounters.com";
const NAVIGATION_TITLE = "Genesis CSC Approved Navigation V1";
export const COMMERCIAL_STAINLESS_HEADER_COMPOSITION_VERSION = "commercial-stainless-header-composition-v1" as const;

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

export function buildCommercialStainlessHeaderComposition(navigationId: number): string {
  if (!Number.isSafeInteger(navigationId) || navigationId < 1) throw new Error("THEME_HEADER_NAVIGATION_ID_INVALID");
  return `<!-- wp:html -->
<style>
header.wp-block-template-part{position:relative;z-index:20;background:#fff;border-bottom:1px solid #d9dcdd}
header.wp-block-template-part>.wp-block-group.alignfull{background:#fff}
header.wp-block-template-part .csc-global-header{width:min(1240px,calc(100% - 48px));max-width:none;margin:0 auto;padding:24px 0;gap:40px}
header.wp-block-template-part .wp-block-site-title{min-width:300px;margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:28px;line-height:.96;letter-spacing:0;text-transform:uppercase}
header.wp-block-template-part .wp-block-site-title a{color:#111315;text-decoration:none}
header.wp-block-template-part .wp-block-navigation{font-size:13px;font-weight:800;text-transform:uppercase}
header.wp-block-template-part .wp-block-navigation__container{flex-wrap:nowrap!important;column-gap:20px;row-gap:0}
header.wp-block-template-part .wp-block-navigation-item__content{padding:10px 0;color:#25292c;text-decoration:none}
header.wp-block-template-part .wp-block-navigation__container>.wp-block-navigation-item:last-child>.wp-block-navigation-item__content{min-height:46px;display:flex;align-items:center;padding:12px 20px;background:#d62828;color:#fff}
header.wp-block-template-part .wp-block-navigation__submenu-container{border:1px solid #d9dcdd!important;box-shadow:0 14px 30px rgba(17,19,21,.12)!important}
@media(min-width:1101px){header.wp-block-template-part .wp-block-navigation__responsive-container-open{display:none!important}header.wp-block-template-part .wp-block-navigation__responsive-container:not(.is-menu-open){display:block!important}}
@media(max-width:1100px){header.wp-block-template-part .csc-global-header{width:calc(100% - 40px);min-height:88px;padding:18px 0;gap:24px}header.wp-block-template-part .wp-block-site-title{max-width:300px;min-width:0;font-size:24px;line-height:1}header.wp-block-template-part .wp-block-navigation__responsive-container:not(.is-menu-open){display:none!important}header.wp-block-template-part .wp-block-navigation__responsive-container-open{width:44px;height:44px;display:flex!important;align-items:center;justify-content:center;background:#d62828;color:#fff}header.wp-block-template-part .wp-block-navigation__responsive-container.is-menu-open{padding:28px;background:#111315;color:#fff}header.wp-block-template-part .wp-block-navigation__responsive-container.is-menu-open .wp-block-navigation-item__content{color:#fff;font-size:16px}}
</style>
<!-- /wp:html -->
<!-- wp:group {"align":"full","layout":{"type":"default"}} -->
<div class="wp-block-group alignfull">
<!-- wp:group {"align":"wide","className":"csc-global-header","layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group alignwide csc-global-header">
<!-- wp:site-title {"level":0} /-->
<!-- wp:navigation {"overlayBackgroundColor":"contrast","overlayTextColor":"base","layout":{"type":"flex","justifyContent":"right","flexWrap":"wrap"},"ref":${navigationId}} /-->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->`;
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

function contentHash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export async function repairCommercialStainlessHeaderComposition(site: SiteConfiguration, expectedHeaderHash: string) {
  if (!/^[a-f0-9]{64}$/.test(expectedHeaderHash)) throw new Error("THEME_HEADER_EXPECTED_HASH_INVALID");
  const resolved = authority(site); const before = await inspectWordPressThemeShell(site);
  if (contentHash(before.header.content) !== expectedHeaderHash || before.ownedNavigationCount !== 1 || !before.ownedNavigationId || before.header.pageListFallback) throw new Error("THEME_HEADER_AUTHORITY_MISMATCH");
  const footerHash = contentHash(before.footer.content); const navigation = before.navigationResources.find((item) => item.id === before.ownedNavigationId);
  if (!navigation?.content) throw new Error("THEME_HEADER_NAVIGATION_AUTHORITY_MISSING");
  const navigationHash = contentHash(navigation.content); const content = buildCommercialStainlessHeaderComposition(before.ownedNavigationId);
  await writeJson(resolved.apiBase, resolved.headers, `template-parts/${before.header.id}`, { content });
  const after = await inspectWordPressThemeShell(site); const afterNavigation = after.navigationResources.find((item) => item.id === before.ownedNavigationId);
  if (after.header.content !== content || after.ownedNavigationId !== before.ownedNavigationId || contentHash(after.footer.content) !== footerHash || !afterNavigation?.content || contentHash(afterNavigation.content) !== navigationHash) throw new Error("THEME_HEADER_POST_WRITE_VERIFICATION_FAILED");
  return { headerTemplatePartId: before.header.id, navigationId: before.ownedNavigationId, beforeHeaderHash: expectedHeaderHash, afterHeaderHash: contentHash(content), footerHash, navigationHash, compositionVersion: COMMERCIAL_STAINLESS_HEADER_COMPOSITION_VERSION, headerUpdated: true, footerUpdated: false, navigationUpdated: false };
}

export const WORDPRESS_THEME_SHELL_AUTHORITY = { navigationTitle: NAVIGATION_TITLE };