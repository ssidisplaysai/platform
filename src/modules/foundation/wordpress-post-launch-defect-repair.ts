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

function genesis_csc_is_rich_composition_v1($post_id) {
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    $host = preg_replace('/^www\./', '', $host);
    if ($host !== 'commercialstainlesscounters.com' || get_post_type($post_id) !== 'page' || get_post_status($post_id) !== 'publish') {
        return false;
    }
    $blocks = parse_blocks((string) get_post_field('post_content', $post_id, 'raw'));
    $inspect = function ($items) use (&$inspect) {
        foreach ($items as $block) {
            if (($block['blockName'] ?? '') === 'core/html') {
                $processor = new WP_HTML_Tag_Processor((string) ($block['innerHTML'] ?? ''));
                $has_page = false;
                $has_hero = false;
                while ($processor->next_tag()) {
                    $has_page = $has_page || $processor->has_class('wr-page');
                    $has_hero = $has_hero || $processor->has_class('wr-hero');
                }
                if ($has_page && $has_hero) {
                    return true;
                }
            }
            if (!empty($block['innerBlocks']) && $inspect($block['innerBlocks'])) {
                return true;
            }
        }
        return false;
    };
    return $inspect($blocks);
}

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
    if (($block['blockName'] ?? '') === 'core/post-featured-image' && is_page() && genesis_csc_is_rich_composition_v1((int) get_queried_object_id())) {
        return '';
    }
    if (($block['blockName'] ?? '') === 'core/group' && is_page() && genesis_csc_is_rich_composition_v1((int) get_queried_object_id())) {
        $child_names = array_map(function ($child) { return $child['blockName'] ?? ''; }, $block['innerBlocks'] ?? array());
        $padding_top = $block['attrs']['style']['spacing']['padding']['top'] ?? '';
        if (($block['attrs']['align'] ?? '') === 'full' && $padding_top === 'var:preset|spacing|60' && in_array('core/post-featured-image', $child_names, true) && in_array('core/post-content', $child_names, true)) {
            $processor = new WP_HTML_Tag_Processor($content);
            if ($processor->next_tag(array('tag_name' => 'DIV', 'class_name' => 'wp-block-group'))) {
                $style = (string) $processor->get_attribute('style');
                $style = trim((string) preg_replace('/(^|;)\\s*padding-top\\s*:[^;]+;?/i', '$1', $style), '; ');
                if ($style === '') {
                    $processor->remove_attribute('style');
                } else {
                    $processor->set_attribute('style', $style);
                }
                return $processor->get_updated_html();
            }
        }
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
type WordPressEligibilityPage = { id?: number; status?: string; featured_media?: number; content?: { raw?: string } };
function authorization(username: string, password: string): string { return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`; }
function authority(site: SiteConfiguration) { if (site.siteId !== "site-rj-metal-commercial-stainless-counters" || site.organizationId !== "rj-metal" || site.domain !== "commercialstainlesscounters.com") throw new Error("POST_LAUNCH_REPAIR_SCOPE_MISMATCH"); const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference); if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("POST_LAUNCH_REPAIR_AUTHORITY_REQUIRED"); const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl); return { apiBase, origin: new URL(apiBase).origin, headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" } }; }
async function list(origin: string, headers: Record<string, string>): Promise<Snippet[]> { const response = await fetch(`${origin}/wp-json/code-snippets/v1/snippets?search=${encodeURIComponent(SNIPPET_NAME)}&per_page=100`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`POST_LAUNCH_SNIPPET_READ_FAILED:${response.status}`); const body = await response.json(); return Array.isArray(body) ? body : Array.isArray((body as { data?: unknown }).data) ? (body as { data: Snippet[] }).data : []; }
export async function inspectWordPressPostLaunchRepair(site: SiteConfiguration) { const resolved = authority(site); const snippet = (await list(resolved.origin, resolved.headers)).find((item) => item.name === SNIPPET_NAME) ?? null; const index = await fetch(`${resolved.origin}/wp-json/`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }); const identity = index.ok ? await index.json() as { description?: string } : {}; return { tagline: identity.description ?? null, snippet: snippet ? { id: Number(snippet.id ?? 0), active: snippet.active === true, scope: snippet.scope ?? null, exactCode: snippet.code === SNIPPET_CODE } : null, readOnly: true as const }; }
export async function repairWordPressPostLaunchDefects(site: SiteConfiguration) { const resolved = authority(site); const existing = (await list(resolved.origin, resolved.headers)).find((item) => item.name === SNIPPET_NAME) ?? null; if (existing && existing.active === true && existing.code === SNIPPET_CODE) return { snippetId: Number(existing.id), created: false, activated: false, updated: false }; if (existing?.id) { const update = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets/${existing.id}`, { method: "PUT", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ code: SNIPPET_CODE, active: true, scope: "global", priority: 2 }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!update.ok) throw new Error(`POST_LAUNCH_SNIPPET_UPDATE_FAILED:${update.status}`); return { snippetId: Number(existing.id), created: false, activated: existing.active !== true, updated: true }; } const response = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ name: SNIPPET_NAME, desc: "Mechanical public-rendering and approved market-path repairs for Commercial Stainless Counters.", code: SNIPPET_CODE, tags: ["genesis", "post-launch", "canonical"], scope: "global", active: false, priority: 2 }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); const body = await response.json().catch(() => null) as Snippet | null; if (!response.ok || !body?.id) throw new Error(`POST_LAUNCH_SNIPPET_CREATE_FAILED:${response.status}`); const activate = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets/${body.id}/activate`, { method: "POST", headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!activate.ok) throw new Error(`POST_LAUNCH_SNIPPET_ACTIVATION_FAILED:${activate.status}`); return { snippetId: Number(body.id), created: true, activated: true, updated: false }; }
export const WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET = { name: SNIPPET_NAME, code: SNIPPET_CODE };

export type CommercialStainlessRichCompositionEligibilityInput = {
    host: string;
    postType: string;
    status: string;
    blocks: Array<{ blockName: string | null; innerHtml?: string; innerBlocks?: CommercialStainlessRichCompositionEligibilityInput["blocks"] }>;
};

function hasClassToken(html: string, className: string): boolean {
    return [...html.matchAll(/class=["']([^"']*)["']/gi)].some((match) => match[1].split(/\s+/u).includes(className));
}

export function isCommercialStainlessRichCompositionEligible(input: CommercialStainlessRichCompositionEligibilityInput): boolean {
    const host = input.host.trim().toLowerCase().replace(/^www\./u, "");
    if (host !== "commercialstainlesscounters.com" || input.postType !== "page" || input.status !== "publish") return false;
    const inspect = (blocks: CommercialStainlessRichCompositionEligibilityInput["blocks"]): boolean => blocks.some((block) => {
        if (block.blockName === "core/html" && hasClassToken(block.innerHtml ?? "", "wr-page") && hasClassToken(block.innerHtml ?? "", "wr-hero")) return true;
        return block.innerBlocks ? inspect(block.innerBlocks) : false;
    });
    return inspect(input.blocks);
}

export function filterCommercialStainlessFeaturedImageRender(input: CommercialStainlessRichCompositionEligibilityInput & { blockName: string; renderedHtml: string }): string {
    return input.blockName === "core/post-featured-image" && isCommercialStainlessRichCompositionEligible(input) ? "" : input.renderedHtml;
}

export function filterCommercialStainlessHostSpacingRender(input: CommercialStainlessRichCompositionEligibilityInput & { blockName: string; align?: string; paddingTop?: string; directInnerBlockNames: string[]; renderedHtml: string }): string {
    const targetGroup = input.blockName === "core/group" && input.align === "full" && input.paddingTop === "var:preset|spacing|60" && input.directInnerBlockNames.includes("core/post-featured-image") && input.directInnerBlockNames.includes("core/post-content");
    if (!targetGroup || !isCommercialStainlessRichCompositionEligible(input)) return input.renderedHtml;
    return input.renderedHtml.replace(/(<div\b[^>]*\bclass=["'][^"']*\bwp-block-group\b[^"']*["'][^>]*\bstyle=["'])([^"']*)(["'])/i, (_match, start: string, style: string, end: string) => {
        const updated = style.replace(/(^|;)\s*padding-top\s*:[^;]+;?/i, "$1").replace(/^;+|;+$/g, "").trim();
        return updated ? `${start}${updated}${end}` : start.replace(/\s*style=["']$/i, "");
    });
}

function blocksFromRawContent(raw: string): CommercialStainlessRichCompositionEligibilityInput["blocks"] {
    return [...raw.matchAll(/<!--\s*wp:html\s*-->([\s\S]*?)<!--\s*\/wp:html\s*-->/gi)].map((match) => ({ blockName: "core/html", innerHtml: match[1] }));
}

async function readEligibilityPage(url: string, headers: Record<string, string>): Promise<WordPressEligibilityPage> {
    const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`FEATURED_IMAGE_ELIGIBILITY_READ_FAILED:${response.status}`);
    return await response.json() as WordPressEligibilityPage;
}

export async function inspectCommercialStainlessFeaturedImageEligibility(site: SiteConfiguration) {
    const resolved = authority(site);
    const wave1 = [[24, 88], [11, 89], [13, 90], [17, 91], [23, 92]] as const;
    const future = [12, 15, 16, 18, 19, 20, 21, 22] as const;
    const wave1Results = await Promise.all(wave1.map(async ([wordpressObjectId, autosaveId]) => {
        const [page, autosave] = await Promise.all([
            readEligibilityPage(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,featured_media,content&_eligibility=${crypto.randomUUID()}`, resolved.headers),
            readEligibilityPage(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves/${autosaveId}?context=edit&_fields=id,parent,content&_eligibility=${crypto.randomUUID()}`, resolved.headers),
        ]);
        const raw = autosave.content?.raw ?? "";
        return { wordpressObjectId, autosaveId, featuredMediaId: Number(page.featured_media ?? 0), themeWouldRenderFeaturedMedia: Number(page.featured_media ?? 0) > 0, richCompositionOwnsMedia: /<img\b/i.test(raw), eligibleAfterExactPromotion: isCommercialStainlessRichCompositionEligible({ host: site.domain, postType: "page", status: "publish", blocks: blocksFromRawContent(raw) }) };
    }));
    const futureResults = await Promise.all(future.map(async (wordpressObjectId) => {
        const page = await readEligibilityPage(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,featured_media,content&_eligibility=${crypto.randomUUID()}`, resolved.headers);
        const raw = page.content?.raw ?? "";
        return { wordpressObjectId, featuredMediaId: Number(page.featured_media ?? 0), currentlyEligible: isCommercialStainlessRichCompositionEligible({ host: site.domain, postType: "page", status: page.status ?? "", blocks: blocksFromRawContent(raw) }), requiresFutureApprovedMarkers: true };
    }));
    return { wave1: wave1Results, future: futureResults, eligibleWave1Count: wave1Results.filter((item) => item.eligibleAfterExactPromotion).length, currentlyEligibleFutureCount: futureResults.filter((item) => item.currentlyEligible).length, mutationPerformed: false as const };
}
