import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { deepClone, FoundationPersistenceConflictError, loadPersistedState, savePersistedState } from "./foundation-persistence";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { getSiteById } from "./site-repository";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";

const SNIPPET_NAME = "Genesis ProjectorEnclosure Bounded Elementor Authority Bridge V1";
const BRIDGE_PATH = "/genesis-projectorenclosure/v1/elementor-authority";
const NAMESPACE = "projectorenclosure-elementor-authority-bridge-v1";
export const HEADER_AUTHORITY = { documentId: 7074, widgetId: "fe45a9d", templateRole: "site_header" } as const;
export const FOOTER_AUTHORITY = { documentId: 8449, widgetId: "3e23e97", templateRole: "site_footer" } as const;

export const PROJECTORENCLOSURE_ELEMENTOR_AUTHORITY_BRIDGE_CODE = `const GENESIS_PE_ELEMENTOR_BRIDGE_PAIRS_V1 = [
    7074 => ['widget_id' => 'fe45a9d', 'template_role' => 'site_header'],
    8449 => ['widget_id' => '3e23e97', 'template_role' => 'site_footer'],
];

function genesis_pe_bridge_permission_v1() {
    return is_user_logged_in() && current_user_can('manage_options');
}

function genesis_pe_bridge_pair_v1($document_id, $widget_id) {
    $document_id = (int) $document_id;
    $widget_id = sanitize_key((string) $widget_id);
    if (!isset(GENESIS_PE_ELEMENTOR_BRIDGE_PAIRS_V1[$document_id]) || GENESIS_PE_ELEMENTOR_BRIDGE_PAIRS_V1[$document_id]['widget_id'] !== $widget_id) {
        return new WP_Error('genesis_bridge_pair_forbidden', 'Exact document/widget authority required.', ['status' => 404]);
    }
    return ['document_id' => $document_id, 'widget_id' => $widget_id] + GENESIS_PE_ELEMENTOR_BRIDGE_PAIRS_V1[$document_id];
}

function &genesis_pe_bridge_find_widget_v1(&$elements, $widget_id) {
    static $missing = null;
    foreach ($elements as &$element) {
        if (($element['id'] ?? '') === $widget_id) return $element;
        if (!empty($element['elements']) && is_array($element['elements'])) {
            $found =& genesis_pe_bridge_find_widget_v1($element['elements'], $widget_id);
            if ($found !== null) return $found;
        }
    }
    return $missing;
}

function genesis_pe_bridge_read_v1($document_id, $widget_id) {
    $pair = genesis_pe_bridge_pair_v1($document_id, $widget_id);
    if (is_wp_error($pair)) return $pair;
    $post = get_post($pair['document_id']);
    if (!$post || $post->post_type !== 'elementor_library') return new WP_Error('genesis_bridge_document_invalid', 'Elementor Library document required.', ['status' => 409]);
    $raw = (string) get_post_meta($pair['document_id'], '_elementor_data', true);
    $elements = json_decode($raw, true);
    if ($raw === '' || !is_array($elements)) return new WP_Error('genesis_bridge_data_invalid', 'Exact Elementor JSON required.', ['status' => 409]);
    $widget =& genesis_pe_bridge_find_widget_v1($elements, $pair['widget_id']);
    if ($widget === null || ($widget['widgetType'] ?? '') !== 'html' || !isset($widget['settings']['html']) || !is_string($widget['settings']['html'])) return new WP_Error('genesis_bridge_widget_invalid', 'Exact HTML widget required.', ['status' => 409]);
    return ['pair' => $pair, 'post' => $post, 'raw' => $raw, 'elements' => $elements, 'widget_html' => $widget['settings']['html']];
}

function genesis_pe_bridge_response_v1($read) {
    if (is_wp_error($read)) return $read;
    return ['documentId' => $read['pair']['document_id'], 'widgetId' => $read['pair']['widget_id'], 'widgetType' => 'html', 'templateRole' => $read['pair']['template_role'], 'widgetHTML' => $read['widget_html'], 'documentHash' => hash('sha256', $read['raw']), 'widgetHash' => hash('sha256', $read['widget_html']), 'modifiedGMT' => $read['post']->post_modified_gmt];
}

function genesis_pe_bridge_get_v1(WP_REST_Request $request) {
    return rest_ensure_response(genesis_pe_bridge_response_v1(genesis_pe_bridge_read_v1($request['document_id'], $request['widget_id'])));
}

function genesis_pe_bridge_update_v1(WP_REST_Request $request) {
    $read = genesis_pe_bridge_read_v1($request['document_id'], $request['widget_id']);
    if (is_wp_error($read)) return $read;
    $expected_document = sanitize_text_field((string) $request->get_param('expectedDocumentHash'));
    $expected_widget = sanitize_text_field((string) $request->get_param('expectedWidgetHash'));
    $replacement = $request->get_param('replacementWidgetHTML');
    if (!is_string($replacement) || !hash_equals(hash('sha256', $read['raw']), $expected_document) || !hash_equals(hash('sha256', $read['widget_html']), $expected_widget)) return new WP_Error('genesis_bridge_hash_conflict', 'Exact document and widget hashes required.', ['status' => 409]);
    $before_token = wp_json_encode($read['widget_html'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $after_token = wp_json_encode($replacement, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (substr_count($read['raw'], $before_token) !== 1) return new WP_Error('genesis_bridge_widget_token_conflict', 'Exact widget token cardinality required.', ['status' => 409]);
    $updated = str_replace($before_token, $after_token, $read['raw'], $count);
    if ($count !== 1) return new WP_Error('genesis_bridge_update_cardinality', 'One widget HTML replacement required.', ['status' => 409]);
    $backup_id = hash('sha256', $read['raw']);
    update_option('genesis_pe_elementor_bridge_backup_v1_' . $read['pair']['document_id'] . '_' . $backup_id, ['raw' => $read['raw'], 'widget_html' => $read['widget_html'], 'document_hash' => $backup_id, 'widget_hash' => hash('sha256', $read['widget_html']), 'created_gmt' => gmdate('c')], false);
    update_post_meta($read['pair']['document_id'], '_elementor_data', wp_slash($updated));
    clean_post_cache($read['pair']['document_id']);
    $after = genesis_pe_bridge_read_v1($read['pair']['document_id'], $read['pair']['widget_id']);
    if (is_wp_error($after) || str_replace($after_token, $before_token, $after['raw'], $reverse_count) !== $read['raw'] || $reverse_count !== 1) { update_post_meta($read['pair']['document_id'], '_elementor_data', wp_slash($read['raw'])); clean_post_cache($read['pair']['document_id']); return new WP_Error('genesis_bridge_readback_failed', 'Unrelated Elementor normalization detected; original restored.', ['status' => 409]); }
    return rest_ensure_response(['backupId' => $backup_id, 'authority' => genesis_pe_bridge_response_v1($after)]);
}

function genesis_pe_bridge_rollback_v1(WP_REST_Request $request) {
    $read = genesis_pe_bridge_read_v1($request['document_id'], $request['widget_id']);
    if (is_wp_error($read)) return $read;
    $expected = sanitize_text_field((string) $request->get_param('expectedCurrentDocumentHash'));
    $backup_id = sanitize_text_field((string) $request->get_param('backupId'));
    if (!hash_equals(hash('sha256', $read['raw']), $expected)) return new WP_Error('genesis_bridge_rollback_hash_conflict', 'Exact current document hash required.', ['status' => 409]);
    $backup = get_option('genesis_pe_elementor_bridge_backup_v1_' . $read['pair']['document_id'] . '_' . $backup_id);
    if (!is_array($backup) || !isset($backup['raw']) || !hash_equals(hash('sha256', (string) $backup['raw']), $backup_id)) return new WP_Error('genesis_bridge_backup_invalid', 'Exact rollback backup required.', ['status' => 409]);
    update_post_meta($read['pair']['document_id'], '_elementor_data', wp_slash((string) $backup['raw'])); clean_post_cache($read['pair']['document_id']);
    return rest_ensure_response(['rolledBack' => true, 'authority' => genesis_pe_bridge_response_v1(genesis_pe_bridge_read_v1($read['pair']['document_id'], $read['pair']['widget_id']))]);
}

add_action('rest_api_init', function () {
    $args = ['document_id' => ['validate_callback' => function ($value) { return in_array((int) $value, [7074, 8449], true); }], 'widget_id' => ['validate_callback' => function ($value) { return in_array((string) $value, ['fe45a9d', '3e23e97'], true); }]];
    register_rest_route('genesis-projectorenclosure/v1', '/elementor-authority/(?P<document_id>\\d+)/(?P<widget_id>[a-z0-9]+)', ['methods' => WP_REST_Server::READABLE, 'callback' => 'genesis_pe_bridge_get_v1', 'permission_callback' => 'genesis_pe_bridge_permission_v1', 'args' => $args]);
    register_rest_route('genesis-projectorenclosure/v1', '/elementor-authority/(?P<document_id>\\d+)/(?P<widget_id>[a-z0-9]+)', ['methods' => WP_REST_Server::EDITABLE, 'callback' => 'genesis_pe_bridge_update_v1', 'permission_callback' => 'genesis_pe_bridge_permission_v1', 'args' => $args]);
    register_rest_route('genesis-projectorenclosure/v1', '/elementor-authority/(?P<document_id>\\d+)/(?P<widget_id>[a-z0-9]+)/rollback', ['methods' => WP_REST_Server::EDITABLE, 'callback' => 'genesis_pe_bridge_rollback_v1', 'permission_callback' => 'genesis_pe_bridge_permission_v1', 'args' => $args]);
});`;

type Snippet = { id?: number; name?: string; code?: string; active?: boolean; scope?: string };
type WordPressUser = { id?: number; username?: string; slug?: string; roles?: string[]; capabilities?: Record<string, boolean> };
export type ElementorBridgeAuthority = { documentId: number; widgetId: string; widgetType: "html"; templateRole: "site_header" | "site_footer"; widgetHTML: string; documentHash: string; widgetHash: string; modifiedGMT: string };
type State = { receipts: Record<string, unknown>[] }; const seed = (): State => ({ receipts: [] });
function save(receipt: Record<string, unknown>) { for (let attempt = 0; attempt < 8; attempt += 1) { const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }); try { savePersistedState({ namespace: NAMESPACE, state: { receipts: [...loaded.state.receipts, receipt] }, expectedRevision: loaded.revision }); return deepClone(receipt); } catch (error) { if (!(error instanceof FoundationPersistenceConflictError) || attempt === 7) throw error; } } throw new Error("ELEMENTOR_BRIDGE_CAS_EXHAUSTED"); }
function authority() { const site = getSiteById("site-ssi-projectorenclosure"); if (!site || site.organizationId !== "ssi" || site.domain !== "projectorenclosure.com" || !site.integrations.wordpressApiBaseUrl) throw new Error("ELEMENTOR_BRIDGE_SITE_SCOPE_INVALID"); const temporaryUsername = process.env.GENESIS_PE_BRIDGE_TEMP_USERNAME?.trim(); const temporaryPassword = process.env.GENESIS_PE_BRIDGE_TEMP_APPLICATION_PASSWORD?.replace(/\s+/g, ""); const credential = temporaryUsername && temporaryPassword ? { username: temporaryUsername, applicationPassword: temporaryPassword } : resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference); if (!credential) throw new Error("ELEMENTOR_BRIDGE_CREDENTIAL_REQUIRED"); const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl); return { origin: new URL(apiBase).origin, headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`).toString("base64")}`, "Cache-Control": "no-cache, no-store", Pragma: "no-cache" } }; }
async function listSnippets(origin: string, headers: Record<string, string>) { const response = await fetch(`${origin}/wp-json/code-snippets/v1/snippets?search=${encodeURIComponent(SNIPPET_NAME)}&per_page=100`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`ELEMENTOR_BRIDGE_SNIPPET_READ_FAILED:${response.status}`); const body = await response.json(); return (Array.isArray(body) ? body : Array.isArray((body as { data?: unknown }).data) ? (body as { data: Snippet[] }).data : []) as Snippet[]; }
export async function preflightProjectorEnclosureElementorBridgeAuthority() { const resolved = authority(); const identityResponse = await fetch(`${resolved.origin}/wp-json/wp/v2/users/me?context=edit&_fields=id,username,slug,roles,capabilities`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); const identityBody = await identityResponse.json().catch(() => null) as WordPressUser | { code?: string; message?: string } | null; const authenticated = identityResponse.status === 200 && typeof (identityBody as WordPressUser | null)?.id === "number"; const user = authenticated ? identityBody as WordPressUser : null; const snippetsResponse = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets?search=${encodeURIComponent(SNIPPET_NAME)}&per_page=100`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); const snippetsBody = await snippetsResponse.json().catch(() => null) as { code?: string; message?: string } | unknown[] | null; return { authenticated, authenticatedUserId: user?.id ?? null, authenticatedUsername: user?.username ?? user?.slug ?? null, currentRoles: user?.roles ?? [], manageOptionsCapability: user?.capabilities?.manage_options === true, codeSnippetsRouteAvailable: snippetsResponse.status !== 404, codeSnippetsAuthenticatedAccess: snippetsResponse.status === 200, codeSnippetsHttpStatus: snippetsResponse.status, codeSnippetsAdministrationAuthority: snippetsResponse.status === 200, failure: snippetsResponse.status === 200 ? null : { code: !Array.isArray(snippetsBody) ? snippetsBody?.code ?? null : null, message: !Array.isArray(snippetsBody) ? snippetsBody?.message ?? null : null } }; }
async function bridgeRead(resolved: ReturnType<typeof authority>, pair: typeof HEADER_AUTHORITY | typeof FOOTER_AUTHORITY) { const response = await fetch(`${resolved.origin}/wp-json${BRIDGE_PATH}/${pair.documentId}/${pair.widgetId}`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`ELEMENTOR_BRIDGE_AUTHORITY_READ_FAILED:${pair.documentId}:${response.status}`); const body = await response.json() as ElementorBridgeAuthority; if (body.documentId !== pair.documentId || body.widgetId !== pair.widgetId || body.widgetType !== "html" || body.templateRole !== pair.templateRole || !/^[a-f0-9]{64}$/.test(body.documentHash) || !/^[a-f0-9]{64}$/.test(body.widgetHash)) throw new Error(`ELEMENTOR_BRIDGE_AUTHORITY_MISMATCH:${pair.documentId}`); return body; }
export async function installProjectorEnclosureElementorAuthorityBridge() { const preflight = await preflightProjectorEnclosureElementorBridgeAuthority(); if (!preflight.authenticated || !preflight.manageOptionsCapability || !preflight.codeSnippetsAdministrationAuthority) throw new Error(`ELEMENTOR_BRIDGE_AUTHORITY_PREFLIGHT_FAILED:${preflight.codeSnippetsHttpStatus}`); const resolved = authority(); const matches = (await listSnippets(resolved.origin, resolved.headers)).filter((item) => item.name === SNIPPET_NAME); if (matches.length > 1) throw new Error("ELEMENTOR_BRIDGE_SNIPPET_COLLISION"); let snippet = matches[0] ?? null; let created = false; if (!snippet) { const response = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ name: SNIPPET_NAME, desc: "Temporary exact-pair Elementor HTML widget authority bridge for ProjectorEnclosure global navigation repair.", code: PROJECTORENCLOSURE_ELEMENTOR_AUTHORITY_BRIDGE_CODE, tags: ["genesis", "elementor", "bounded-authority"], scope: "global", active: true, priority: 10 }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); snippet = await response.json().catch(() => null) as Snippet | null; if (!response.ok || !snippet?.id) throw new Error(`ELEMENTOR_BRIDGE_SNIPPET_CREATE_FAILED:${response.status}`); created = true; } else if (snippet.code !== PROJECTORENCLOSURE_ELEMENTOR_AUTHORITY_BRIDGE_CODE || snippet.scope !== "global") throw new Error("ELEMENTOR_BRIDGE_SNIPPET_DRIFT"); if (!snippet.active) { const response = await fetch(`${resolved.origin}/wp-json/code-snippets/v1/snippets/${snippet.id}/activate`, { method: "POST", headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`ELEMENTOR_BRIDGE_ACTIVATION_FAILED:${response.status}`); }
    const [header, footer] = await Promise.all([bridgeRead(resolved, HEADER_AUTHORITY), bridgeRead(resolved, FOOTER_AUTHORITY)]); const unauthenticated = await fetch(`${resolved.origin}/wp-json${BRIDGE_PATH}/7074/fe45a9d`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }); const unauthenticatedWrite = await fetch(`${resolved.origin}/wp-json${BRIDGE_PATH}/7074/fe45a9d`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedDocumentHash: header.documentHash, expectedWidgetHash: header.widgetHash, replacementWidgetHTML: header.widgetHTML }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); const otherDocument = await fetch(`${resolved.origin}/wp-json${BRIDGE_PATH}/7075/fe45a9d`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); const otherWidget = await fetch(`${resolved.origin}/wp-json${BRIDGE_PATH}/7074/deadbeef`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }); const wrongHash = await fetch(`${resolved.origin}/wp-json${BRIDGE_PATH}/7074/fe45a9d`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ expectedDocumentHash: "0".repeat(64), expectedWidgetHash: "0".repeat(64), replacementWidgetHTML: header.widgetHTML }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); const headerAfter = await bridgeRead(resolved, HEADER_AUTHORITY); if (![401, 403].includes(unauthenticated.status) || ![401, 403].includes(unauthenticatedWrite.status) || ![400, 404].includes(otherDocument.status) || ![400, 404].includes(otherWidget.status) || wrongHash.status !== 409 || headerAfter.documentHash !== header.documentHash || headerAfter.widgetHash !== header.widgetHash) throw new Error(`ELEMENTOR_BRIDGE_NEGATIVE_PROOF_FAILED:unauthenticated=${unauthenticated.status}:unauthenticatedWrite=${unauthenticatedWrite.status}:otherDocument=${otherDocument.status}:otherWidget=${otherWidget.status}:wrongHash=${wrongHash.status}:unchanged=${headerAfter.documentHash === header.documentHash && headerAfter.widgetHash === header.widgetHash}`);
    const receipt = { receiptId: `projectorenclosure-elementor-authority-bridge-${randomUUID()}`, bridgeMechanism: "CODE_SNIPPETS_SITE_LOCAL_REST_BRIDGE", snippetId: Number(snippet.id), snippetName: SNIPPET_NAME, snippetCodeHash: createHash("sha256").update(PROJECTORENCLOSURE_ELEMENTOR_AUTHORITY_BRIDGE_CODE).digest("hex"), created, active: true, preflight, authenticationRequired: true, capabilityRequired: "manage_options", allowedDocumentIds: [7074, 8449], allowedWidgetIds: ["fe45a9d", "3e23e97"], header: { ...header, widgetHTML: undefined }, footer: { ...footer, widgetHTML: undefined }, unauthenticatedAccessBlocked: true, unauthenticatedWriteBlocked: true, otherDocumentReadBlocked: true, otherWidgetReadBlocked: true, wrongHashWriteBlocked: true, rollbackAuthorityPrepared: true, navigationMutation: false, createdAt: new Date().toISOString() }; return save(receipt); }
export const getProjectorEnclosureElementorBridgeState = () => deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state);