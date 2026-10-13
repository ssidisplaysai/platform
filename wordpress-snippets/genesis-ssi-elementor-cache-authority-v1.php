/**
 * Genesis SSI Elementor Cache Authority v1
 *
 * Install with SSI Snippets and run everywhere. Do not add a PHP opening tag.
 */

const GENESIS_SSI_ELEMENTOR_CACHE_V1_HOST = 'projectorenclosure.com';

function genesis_ssi_elementor_cache_v1_site_allowed() {
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    return preg_replace('/^www\./', '', $host) === GENESIS_SSI_ELEMENTOR_CACHE_V1_HOST;
}

function genesis_ssi_elementor_cache_v1_permission() {
    if (!is_user_logged_in()) {
        return new WP_Error(
            'genesis_elementor_cache_unauthorized',
            'Authentication is required.',
            array('status' => 401)
        );
    }
    if (!genesis_ssi_elementor_cache_v1_site_allowed()) {
        return new WP_Error(
            'genesis_elementor_cache_wrong_site',
            'This Elementor cache authority is not installed on its approved site.',
            array('status' => 403)
        );
    }
    if (!current_user_can('edit_others_pages')) {
        return new WP_Error(
            'genesis_elementor_cache_forbidden',
            'The edit_others_pages capability is required.',
            array('status' => 403)
        );
    }
    return true;
}

function genesis_ssi_elementor_cache_v1_clear(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if ($params !== null && !is_array($params)) {
        return new WP_Error(
            'genesis_elementor_cache_invalid_request',
            'The request body must be empty or a JSON object.',
            array('status' => 400)
        );
    }

    $params = is_array($params) ? $params : array();
    $keys = array_keys($params);
    sort($keys);
    if ($keys !== array() && $keys !== array('action')) {
        return new WP_Error(
            'genesis_elementor_cache_invalid_request',
            'Only the exact action field is accepted.',
            array('status' => 400)
        );
    }
    if (isset($params['action']) && $params['action'] !== 'clear') {
        return new WP_Error(
            'genesis_elementor_cache_invalid_action',
            'Only action clear is supported.',
            array('status' => 400)
        );
    }

    if (!class_exists('Elementor\\Plugin')) {
        return new WP_REST_Response(array(
            'ok' => false,
            'cleared' => false,
            'code' => 'elementor_cache_api_unavailable',
        ), 503);
    }

    $plugin = \Elementor\Plugin::$instance;
    if (!is_object($plugin) || !isset($plugin->files_manager) || !is_callable(array($plugin->files_manager, 'clear_cache'))) {
        return new WP_REST_Response(array(
            'ok' => false,
            'cleared' => false,
            'code' => 'elementor_cache_api_unavailable',
        ), 503);
    }

    try {
        $plugin->files_manager->clear_cache();
    } catch (Throwable $error) {
        return new WP_REST_Response(array(
            'ok' => false,
            'cleared' => false,
            'code' => 'elementor_cache_clear_failed',
        ), 500);
    }

    return rest_ensure_response(array(
        'ok' => true,
        'cleared' => true,
        'authority' => 'elementor_files_manager',
    ));
}

add_action('rest_api_init', function () {
    register_rest_route('ssi/v1', '/elementor-cache', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'genesis_ssi_elementor_cache_v1_clear',
        'permission_callback' => 'genesis_ssi_elementor_cache_v1_permission',
    ));
});
