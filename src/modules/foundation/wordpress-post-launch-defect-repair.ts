import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

const SNIPPET_NAME = "Genesis CSC Post Launch Defect Repair V1";
const SNIPPET_CODE = `const GENESIS_CSC_PAGE_IDS_V1 = array(10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24);
const GENESIS_CSC_MARKET_PATHS_V1 = array(
    17 => 'markets/education',
    18 => 'markets/foodservice',
    19 => 'markets/healthcare',
    20 => 'markets/hospitality',
    21 => 'markets/industrial',
    22 => 'markets/labs',
);

if (get_option('blogdescription') === 'Just another WordPress site') {
    update_option('blogdescription', '', true);
}
if (get_option('blogname') === 'My blog') {
    update_option('blogname', 'Commercial Stainless Counters', true);
}

add_filter('render_block', function ($content, $block) {
    if (($block['blockName'] ?? '') === 'core/post-title' && is_page(GENESIS_CSC_PAGE_IDS_V1)) {
        return '';
    }
    return $content;
}, 20, 2);

add_filter('page_link', function ($link, $post_id) {
    if (isset(GENESIS_CSC_MARKET_PATHS_V1[(int) $post_id])) {
        return home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[(int) $post_id] . '/');
    }
    return $link;
}, 20, 2);

add_filter('post_type_link', function ($link, $post) {
    if ($post instanceof WP_Post && $post->post_type === 'page' && isset(GENESIS_CSC_MARKET_PATHS_V1[(int) $post->ID])) {
        return home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[(int) $post->ID] . '/');
    }
    return $link;
}, 20, 2);

add_filter('get_canonical_url', function ($url, $post) {
    if ($post instanceof WP_Post && isset(GENESIS_CSC_MARKET_PATHS_V1[(int) $post->ID])) {
        return home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[(int) $post->ID] . '/');
    }
    return $url;
}, 20, 2);

add_filter('wpseo_canonical', function ($url) {
    $post_id = (int) get_queried_object_id();
    return isset(GENESIS_CSC_MARKET_PATHS_V1[$post_id]) ? home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[$post_id] . '/') : $url;
}, 20);

add_filter('wpseo_opengraph_url', function ($url) {
    $post_id = (int) get_queried_object_id();
    return isset(GENESIS_CSC_MARKET_PATHS_V1[$post_id]) ? home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[$post_id] . '/') : $url;
}, 20);

add_filter('rest_prepare_page', function ($response, $post) {
    if ($post instanceof WP_Post && isset(GENESIS_CSC_MARKET_PATHS_V1[(int) $post->ID])) {
        $response->data['link'] = home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[(int) $post->ID] . '/');
    }
    return $response;
}, 20, 2);

add_filter('rest_post_dispatch', function ($response, $server, $request) {
    if (!preg_match('#^/wp/v2/pages/(\\d+)$#', $request->get_route(), $matches)) {
        return $response;
    }
    $post_id = (int) $matches[1];
    if (!isset(GENESIS_CSC_MARKET_PATHS_V1[$post_id]) || !($response instanceof WP_REST_Response)) {
        return $response;
    }
    $data = $response->get_data();
    if (is_array($data)) {
        $data['link'] = home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[$post_id] . '/');
        $response->set_data($data);
    }
    return $response;
}, 20, 3);

add_action('init', function () {
    foreach (GENESIS_CSC_MARKET_PATHS_V1 as $post_id => $path) {
        add_rewrite_rule('^' . $path . '/?$', 'index.php?page_id=' . (int) $post_id, 'top');
    }
    if (get_option('genesis_csc_market_rewrite_v1') !== '2') {
        flush_rewrite_rules(false);
        update_option('genesis_csc_market_rewrite_v1', '2', true);
    }
}, -1000);

add_filter('redirect_canonical', function ($redirect_url, $requested_url) {
    $post_id = (int) get_queried_object_id();
    if (!isset(GENESIS_CSC_MARKET_PATHS_V1[$post_id])) {
        return $redirect_url;
    }
    $approved = home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[$post_id] . '/');
    $requested_path = trailingslashit((string) wp_parse_url($requested_url, PHP_URL_PATH));
    $approved_path = trailingslashit((string) wp_parse_url($approved, PHP_URL_PATH));
    return $requested_path === $approved_path ? false : $approved;
}, 20, 2);

add_action('template_redirect', function () {
    $post_id = (int) get_queried_object_id();
    if (!isset(GENESIS_CSC_MARKET_PATHS_V1[$post_id])) {
        return;
    }
    $approved = home_url('/' . GENESIS_CSC_MARKET_PATHS_V1[$post_id] . '/');
    $requested_path = trailingslashit((string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
    $approved_path = trailingslashit((string) wp_parse_url($approved, PHP_URL_PATH));
    if ($requested_path !== $approved_path) {
        wp_safe_redirect($approved, 301, 'Genesis CSC Post Launch Defect Repair V1');
        exit;
    }
}, -1000);`;

type Snippet = { id?: number; name?: string; code?: string; active?: boolean; scope?: string };
function authorization(username: string, password: string): string { return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`; }
function authority(site: SiteConfiguration) { if (site.siteId !== "site-rj-metal-commercial-stainless-counters" || site.organizationId !== "rj-metal" || site.domain !== "commercialstainlesscounters.com") throw new Error("POST_LAUNCH_REPAIR_SCOPE_MISMATCH"); const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference); if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("POST_LAUNCH_REPAIR_AUTHORITY_REQUIRED"); const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl); return { origin: new URL(apiBase).origin, headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" } }; }
async function list(origin: string, headers: Record<string, string>): Promise<Snippet[]> { const response = await fetch(`${origin}/wp-json/code-snippets/v1/snippets?search=${encodeURIComponent(SNIPPET_NAME)}&per_page=100`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`POST_LAUNCH_SNIPPET_READ_FAILED:${response.status}`); const body = await response.json(); return Array.isArray(body) ? body : Array.isArray((body as { data?: unknown }).data) ? (body as { data: Snippet[] }).data : []; }
export async function inspectWordPressPostLaunchRepair(site: SiteConfiguration) { const resolved = authority(site); const snippet = (await list(resolved.origin, resolved.headers)).find((item) => item.name === SNIPPET_NAME) ?? null; const index = await fetch(`${resolved.origin}/wp-json/`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }); const identity = index.ok ? await index.json() as { description?: string } : {}; return { tagline: identity.description ?? null, snippet: snippet ? { id: Number(snippet.id ?? 0), active: snippet.active === true, scope: snippet.scope ?? null, exactCode: snippet.code === SNIPPET_CODE } : null, readOnly: true as const }; }
export async function repairWordPressPostLaunchDefects(site: SiteConfiguration) { const resolved = authority(site); const existing = (await list(resolved.origin, resolved.headers)).find((item) => item.name === SNIPPET_NAME) ?? null; if (existing && existing.active === true && existing.code === SNIPPET_CODE) return { snippetId: Number(existing.id), created: false, activated: false, updated: false }; if (existing?.id) { const update = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets/${existing.id}`, { method: "PUT", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ code: SNIPPET_CODE, active: true, scope: "global", priority: 2 }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!update.ok) throw new Error(`POST_LAUNCH_SNIPPET_UPDATE_FAILED:${update.status}`); return { snippetId: Number(existing.id), created: false, activated: existing.active !== true, updated: true }; } const response = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ name: SNIPPET_NAME, desc: "Mechanical public-rendering and approved market-path repairs for Commercial Stainless Counters.", code: SNIPPET_CODE, tags: ["genesis", "post-launch", "canonical"], scope: "global", active: false, priority: 2 }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); const body = await response.json().catch(() => null) as Snippet | null; if (!response.ok || !body?.id) throw new Error(`POST_LAUNCH_SNIPPET_CREATE_FAILED:${response.status}`); const activate = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets/${body.id}/activate`, { method: "POST", headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!activate.ok) throw new Error(`POST_LAUNCH_SNIPPET_ACTIVATION_FAILED:${activate.status}`); return { snippetId: Number(body.id), created: true, activated: true, updated: false }; }
export const WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET = { name: SNIPPET_NAME, code: SNIPPET_CODE };
