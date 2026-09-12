import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

const SNIPPET_NAME = "Genesis CSC Canonical HTTPS Host V1";
const CANONICAL_ORIGIN = "https://commercialstainlesscounters.com";
const CANONICAL_HOST = "commercialstainlesscounters.com";

const SNIPPET_CODE = `const GENESIS_CSC_CANONICAL_ORIGIN_V1 = '${CANONICAL_ORIGIN}';
const GENESIS_CSC_CANONICAL_HOST_V1 = '${CANONICAL_HOST}';

if (get_option('home') !== GENESIS_CSC_CANONICAL_ORIGIN_V1) {
    update_option('home', GENESIS_CSC_CANONICAL_ORIGIN_V1, true);
}
if (get_option('siteurl') !== GENESIS_CSC_CANONICAL_ORIGIN_V1) {
    update_option('siteurl', GENESIS_CSC_CANONICAL_ORIGIN_V1, true);
}

add_filter('option_home', function () {
    return GENESIS_CSC_CANONICAL_ORIGIN_V1;
}, PHP_INT_MAX);
add_filter('option_siteurl', function () {
    return GENESIS_CSC_CANONICAL_ORIGIN_V1;
}, PHP_INT_MAX);

add_action('init', function () {
    if ((defined('WP_CLI') && WP_CLI) || wp_doing_cron()) {
        return;
    }
    $host = strtolower(preg_replace('/:\\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    $forwarded_proto = strtolower(trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
    $secure = is_ssl() || $forwarded_proto === 'https';
    if ($host === GENESIS_CSC_CANONICAL_HOST_V1 && $secure) {
        return;
    }
    $request_uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    if ($request_uri === '' || $request_uri[0] !== '/') {
        $request_uri = '/';
    }
    wp_safe_redirect(GENESIS_CSC_CANONICAL_ORIGIN_V1 . $request_uri, 301, 'Genesis CSC Canonical HTTPS Host V1');
    exit;
}, -9999);`;

type WordPressSnippet = { id?: number; name?: string; code?: string; active?: boolean; scope?: string };
type WordPressSettings = { url?: string };

function authorization(username: string, password: string): string { return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`; }
function xml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function decodeXml(value: string): string { return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }

function authority(site: SiteConfiguration) {
  if (site.siteId !== "site-rj-metal-commercial-stainless-counters" || site.organizationId !== "rj-metal" || site.domain !== CANONICAL_HOST) throw new Error("CANONICAL_HOST_SCOPE_MISMATCH");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("WORDPRESS_CANONICAL_AUTHORITY_REQUIRED");
  const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  return { apiBase, origin: new URL(apiBase).origin, headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" }, credential };
}

async function readHome(origin: string, username: string, password: string): Promise<string | null> {
  const payload = `<?xml version="1.0"?><methodCall><methodName>wp.getOptions</methodName><params><param><value><int>0</int></value></param><param><value><string>${xml(username)}</string></value></param><param><value><string>${xml(password)}</string></value></param><param><value><array><data><value><string>blog_url</string></value></data></array></value></param></params></methodCall>`;
  const response = await fetch(`${origin}/xmlrpc.php`, { method: "POST", headers: { "Content-Type": "text/xml" }, body: payload, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  if (!response.ok || body.includes("<fault>")) return null;
  return decodeXml(body.match(/<name>value<\/name><value><string>([\s\S]*?)<\/string>/)?.[1] ?? "") || null;
}

async function listSnippets(origin: string, headers: Record<string, string>): Promise<WordPressSnippet[]> {
  const response = await fetch(`${origin}/wp-json/code-snippets/v1/snippets?search=${encodeURIComponent(SNIPPET_NAME)}&per_page=100`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`CODE_SNIPPETS_READ_FAILED:${response.status}`);
  const body = await response.json();
  return Array.isArray(body) ? body : Array.isArray((body as { data?: unknown }).data) ? (body as { data: WordPressSnippet[] }).data : [];
}

export async function inspectWordPressCanonicalHost(site: SiteConfiguration) {
  const resolved = authority(site);
  const [settingsResponse, snippets] = await Promise.all([
    fetch(`${resolved.apiBase}/settings`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }),
    listSnippets(resolved.origin, resolved.headers),
  ]);
  const settings = settingsResponse.ok ? await settingsResponse.json() as WordPressSettings : {};
  const snippet = snippets.find((item) => item.name === SNIPPET_NAME) ?? null;
  return { canonicalOrigin: CANONICAL_ORIGIN, homeUrl: await readHome(resolved.origin, resolved.credential.username, resolved.credential.applicationPassword), siteUrl: settings.url ?? null, settingsHttp: settingsResponse.status, snippet: snippet ? { id: Number(snippet.id ?? 0), active: snippet.active === true, scope: snippet.scope ?? null, exactCode: snippet.code === SNIPPET_CODE } : null, readOnly: true as const };
}

export async function repairWordPressCanonicalHost(site: SiteConfiguration) {
  const resolved = authority(site);
  const existing = (await listSnippets(resolved.origin, resolved.headers)).find((item) => item.name === SNIPPET_NAME) ?? null;
  if (existing && existing.active === true && existing.code === SNIPPET_CODE) return { snippetId: Number(existing.id), created: false, activated: false };
  if (existing) throw new Error("CANONICAL_SNIPPET_CONFLICT");
  const response = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ name: SNIPPET_NAME, desc: "Canonical HTTPS and apex-host authority for Commercial Stainless Counters.", code: SNIPPET_CODE, tags: ["genesis", "canonical", "https"], scope: "global", active: true, priority: 1 }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => null) as WordPressSnippet | null;
  if (!response.ok || !body?.id) throw new Error(`CANONICAL_SNIPPET_CREATE_FAILED:${response.status}`);
  if (body.active !== true) {
    const activate = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets/${body.id}/activate`, { method: "POST", headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!activate.ok) throw new Error(`CANONICAL_SNIPPET_ACTIVATION_FAILED:${activate.status}`);
  }
  return { snippetId: Number(body.id), created: true, activated: true };
}

export const WORDPRESS_CANONICAL_HOST_SNIPPET = { name: SNIPPET_NAME, code: SNIPPET_CODE, origin: CANONICAL_ORIGIN };
