/**
 * Genesis SSI Public Page Cache Authority v1
 *
 * Install with SSI Snippets and run everywhere. Do not add a PHP opening tag.
 */

const GENESIS_SSI_PAGE_CACHE_V1_HOST = 'projectorenclosure.com';

function genesis_ssi_page_cache_v1_site_allowed() {
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    return preg_replace('/^www\./', '', $host) === GENESIS_SSI_PAGE_CACHE_V1_HOST;
}

function genesis_ssi_page_cache_v1_permission() {
    if (!is_user_logged_in()) {
        return new WP_Error('genesis_page_cache_unauthorized', 'Authentication is required.', array('status' => 401));
    }
    if (!genesis_ssi_page_cache_v1_site_allowed()) {
        return new WP_Error('genesis_page_cache_wrong_site', 'This cache authority is not installed on its approved site.', array('status' => 403));
    }
    if (!current_user_can('edit_others_pages')) {
        return new WP_Error('genesis_page_cache_forbidden', 'The edit_others_pages capability is required.', array('status' => 403));
    }
    return true;
}

function genesis_ssi_page_cache_v1_adapters() {
    return array(
        'wp_rocket' => function_exists('rocket_clean_post'),
        'litespeed_post' => has_action('litespeed_purge_post') !== false,
        'litespeed_url' => has_action('litespeed_purge_url') !== false,
        'w3_total_cache' => function_exists('w3tc_flush_post'),
        'godaddy_wpaas' => class_exists('WPaaS\\Cache') || defined('GD_SYSTEM_PLUGIN_DIR'),
        'advanced_cache_dropin' => file_exists(WP_CONTENT_DIR . '/advanced-cache.php'),
        'object_cache_dropin' => file_exists(WP_CONTENT_DIR . '/object-cache.php'),
    );
}

function genesis_ssi_page_cache_v1_discover() {
    return rest_ensure_response(array(
        'ok' => true,
        'site' => GENESIS_SSI_PAGE_CACHE_V1_HOST,
        'wpCacheEnabled' => defined('WP_CACHE') && WP_CACHE,
        'externalObjectCache' => wp_using_ext_object_cache(),
        'showOnFront' => get_option('show_on_front'),
        'pageOnFront' => (int) get_option('page_on_front'),
        'adapters' => genesis_ssi_page_cache_v1_adapters(),
    ));
}

function genesis_ssi_page_cache_v1_normalize_url($value) {
    $url = wp_parse_url((string) $value);
    if (!is_array($url) || ($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])) {
        return null;
    }
    $host = preg_replace('/^www\./', '', strtolower((string) ($url['host'] ?? '')));
    if ($host !== GENESIS_SSI_PAGE_CACHE_V1_HOST) return null;
    $path = '/' . ltrim((string) ($url['path'] ?? '/'), '/');
    return trailingslashit('https://' . GENESIS_SSI_PAGE_CACHE_V1_HOST . $path);
}

function genesis_ssi_page_cache_v1_purge(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $keys = is_array($params) ? array_keys($params) : array();
    sort($keys);
    if ($keys !== array('action', 'page_id', 'url') || ($params['action'] ?? '') !== 'purge') {
        return new WP_Error('genesis_page_cache_invalid_request', 'Exact action, page_id, and url fields are required.', array('status' => 400));
    }
    $page_id = absint($params['page_id'] ?? 0);
    $page = $page_id ? get_post($page_id) : null;
    $url = genesis_ssi_page_cache_v1_normalize_url($params['url'] ?? '');
    if (!$page || $page->post_type !== 'page' || !$url || !current_user_can('edit_post', $page_id)) {
        return new WP_Error('genesis_page_cache_invalid_target', 'An editable same-site page and canonical URL are required.', array('status' => 409));
    }
    $is_front_page = get_option('show_on_front') === 'page' && (int) get_option('page_on_front') === $page_id;
    $expected_url = $is_front_page ? trailingslashit(home_url('/')) : trailingslashit(get_permalink($page_id));
    if ($url !== genesis_ssi_page_cache_v1_normalize_url($expected_url)) {
        return new WP_Error('genesis_page_cache_identity_mismatch', 'Page ID and canonical URL do not identify the same page.', array('status' => 409));
    }

    clean_post_cache($page_id);
    $used = array();
    if (function_exists('rocket_clean_post')) { rocket_clean_post($page_id); $used[] = 'wp_rocket_post'; }
    if (has_action('litespeed_purge_post') !== false) { do_action('litespeed_purge_post', $page_id); $used[] = 'litespeed_post'; }
    if ($is_front_page && has_action('litespeed_purge_url') !== false) { do_action('litespeed_purge_url', $url); $used[] = 'litespeed_root_url'; }
    if (function_exists('w3tc_flush_post')) { w3tc_flush_post($page_id); $used[] = 'w3_total_cache_post'; }

    if ($used === array()) {
        return new WP_REST_Response(array(
            'ok' => false,
            'state' => 'UNAVAILABLE',
            'pageId' => $page_id,
            'url' => $url,
            'frontPage' => $is_front_page,
            'adapters' => genesis_ssi_page_cache_v1_adapters(),
        ), 503);
    }
    return rest_ensure_response(array(
        'ok' => true,
        'state' => 'CLEARED',
        'pageId' => $page_id,
        'url' => $url,
        'frontPage' => $is_front_page,
        'authorities' => $used,
    ));
}

add_action('rest_api_init', function () {
    register_rest_route('ssi/v1', '/page-cache', array(
        array('methods' => WP_REST_Server::READABLE, 'callback' => 'genesis_ssi_page_cache_v1_discover', 'permission_callback' => 'genesis_ssi_page_cache_v1_permission'),
        array('methods' => WP_REST_Server::CREATABLE, 'callback' => 'genesis_ssi_page_cache_v1_purge', 'permission_callback' => 'genesis_ssi_page_cache_v1_permission'),
    ));
});