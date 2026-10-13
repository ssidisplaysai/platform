/**
 * Genesis SSI Redirect Authority v1
 *
 * Install with Code Snippets and run everywhere. Do not add a PHP opening tag.
 */

const GENESIS_SSI_REDIRECT_V1_OPTION = 'genesis_ssi_redirect_registry_v1';
const GENESIS_SSI_REDIRECT_V1_LOCK = 'genesis_ssi_redirect_registry_v1_lock';
const GENESIS_SSI_REDIRECT_V1_HOST = 'projectorenclosure.com';
const GENESIS_SSI_REDIRECT_V1_LIMIT = 100;

function genesis_ssi_redirect_v1_site_allowed() {
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    return preg_replace('/^www\./', '', $host) === GENESIS_SSI_REDIRECT_V1_HOST;
}

function genesis_ssi_redirect_v1_permission() {
    if (!is_user_logged_in()) {
        return new WP_Error('genesis_redirect_unauthorized', 'Authentication is required.', array('status' => 401));
    }
    if (!genesis_ssi_redirect_v1_site_allowed()) {
        return new WP_Error('genesis_redirect_wrong_site', 'This redirect authority is not installed on its approved site.', array('status' => 403));
    }
    if (!current_user_can('edit_others_pages')) {
        return new WP_Error('genesis_redirect_forbidden', 'The edit_others_pages capability is required.', array('status' => 403));
    }
    return true;
}

function genesis_ssi_redirect_v1_normalize_path($value, $field) {
    if (!is_string($value)) {
        return new WP_Error('genesis_redirect_invalid_' . $field, ucfirst($field) . ' must be a relative path.', array('status' => 400));
    }
    $value = trim(wp_unslash($value));
    if ($value === '' || preg_match('/[\x00-\x1F\x7F]/', $value)) {
        return new WP_Error('genesis_redirect_invalid_' . $field, ucfirst($field) . ' is required and cannot contain control characters.', array('status' => 400));
    }
    $parts = wp_parse_url($value);
    if ($parts === false || isset($parts['scheme']) || isset($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['port']) || isset($parts['query']) || isset($parts['fragment'])) {
        return new WP_Error('genesis_redirect_invalid_' . $field, ucfirst($field) . ' must be a same-site relative path without query or fragment.', array('status' => 400));
    }
    $path = isset($parts['path']) ? rawurldecode((string) $parts['path']) : '';
    if ($path === '' || $path[0] !== '/' || strpos($path, '//') === 0 || strpos($path, '\\') !== false) {
        return new WP_Error('genesis_redirect_invalid_' . $field, ucfirst($field) . ' must start with one forward slash.', array('status' => 400));
    }
    if (!preg_match('#^/[A-Za-z0-9._~/-]+/?$#', $path) || preg_match('/[\*?\[\]{}()|^$+]/', $path)) {
        return new WP_Error('genesis_redirect_invalid_' . $field, ucfirst($field) . ' must be an exact path without regex, wildcard, or encoded syntax.', array('status' => 400));
    }
    $path = strtolower('/' . trim(preg_replace('#/+#', '/', $path), '/') . '/');
    if ($path === '//') {
        return new WP_Error('genesis_redirect_invalid_' . $field, 'The site root cannot be redirected.', array('status' => 400));
    }
    foreach (array('/wp-admin/', '/wp-json/', '/wp-login.php/', '/wp-cron.php/', '/xmlrpc.php/', '/feed/') as $reserved) {
        if (strpos($path, $reserved) === 0) {
            return new WP_Error('genesis_redirect_reserved_' . $field, ucfirst($field) . ' cannot target a WordPress system route.', array('status' => 400));
        }
    }
    return $path;
}

function genesis_ssi_redirect_v1_registry() {
    $registry = get_option(GENESIS_SSI_REDIRECT_V1_OPTION, array());
    return is_array($registry) ? $registry : array();
}

function genesis_ssi_redirect_v1_record($record) {
    return array(
        'ok' => true,
        'exists' => true,
        'id' => (string) $record['id'],
        'source' => (string) $record['source'],
        'destination' => (string) $record['destination'],
        'status' => 301,
        'created_at' => (string) $record['created_at'],
        'updated_at' => (string) $record['updated_at'],
    );
}

function genesis_ssi_redirect_v1_save($registry) {
    if (count($registry) > GENESIS_SSI_REDIRECT_V1_LIMIT) {
        return new WP_Error('genesis_redirect_limit', 'The bounded redirect registry limit has been reached.', array('status' => 409));
    }
    if (get_option(GENESIS_SSI_REDIRECT_V1_OPTION, null) === null) {
        add_option(GENESIS_SSI_REDIRECT_V1_OPTION, $registry, '', true);
        return true;
    }
    update_option(GENESIS_SSI_REDIRECT_V1_OPTION, $registry, true);
    return true;
}

function genesis_ssi_redirect_v1_with_lock($callback) {
    $token = wp_generate_uuid4();
    $lock = array('token' => $token, 'expires' => time() + 20);
    if (!add_option(GENESIS_SSI_REDIRECT_V1_LOCK, $lock, '', false)) {
        $existing = get_option(GENESIS_SSI_REDIRECT_V1_LOCK, array());
        if (!is_array($existing) || empty($existing['expires']) || (int) $existing['expires'] >= time()) {
            return new WP_Error('genesis_redirect_locked', 'Redirect registry mutation is already in progress.', array('status' => 409));
        }
        delete_option(GENESIS_SSI_REDIRECT_V1_LOCK);
        if (!add_option(GENESIS_SSI_REDIRECT_V1_LOCK, $lock, '', false)) {
            return new WP_Error('genesis_redirect_locked', 'Redirect registry mutation is already in progress.', array('status' => 409));
        }
    }
    try {
        return call_user_func($callback);
    } finally {
        $current = get_option(GENESIS_SSI_REDIRECT_V1_LOCK, array());
        if (is_array($current) && isset($current['token']) && hash_equals($token, (string) $current['token'])) {
            delete_option(GENESIS_SSI_REDIRECT_V1_LOCK);
        }
    }
}

function genesis_ssi_redirect_v1_get(WP_REST_Request $request) {
    $source = genesis_ssi_redirect_v1_normalize_path($request->get_param('source'), 'source');
    if (is_wp_error($source)) {
        return $source;
    }
    $registry = genesis_ssi_redirect_v1_registry();
    if (!isset($registry[$source])) {
        return rest_ensure_response(array('ok' => true, 'exists' => false, 'source' => $source));
    }
    return rest_ensure_response(genesis_ssi_redirect_v1_record($registry[$source]));
}

function genesis_ssi_redirect_v1_post(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $source = genesis_ssi_redirect_v1_normalize_path(isset($params['source']) ? $params['source'] : null, 'source');
    $destination = genesis_ssi_redirect_v1_normalize_path(isset($params['destination']) ? $params['destination'] : null, 'destination');
    if (is_wp_error($source)) {
        return $source;
    }
    if (is_wp_error($destination)) {
        return $destination;
    }
    if (!isset($params['status']) || (string) $params['status'] !== '301') {
        return new WP_Error('genesis_redirect_invalid_status', 'Only permanent status 301 is supported.', array('status' => 400));
    }
    if ($source === $destination) {
        return new WP_Error('genesis_redirect_self_loop', 'Source and destination must differ.', array('status' => 409));
    }

    return genesis_ssi_redirect_v1_with_lock(function () use ($params, $source, $destination) {
        $registry = genesis_ssi_redirect_v1_registry();
        $existing = isset($registry[$source]) ? $registry[$source] : null;
        if ($existing && $existing['destination'] === $destination && (int) $existing['status'] === 301) {
            $response = genesis_ssi_redirect_v1_record($existing);
            $response['created'] = false;
            $response['updated'] = false;
            $response['idempotent'] = true;
            return rest_ensure_response($response);
        }
        if ($existing) {
            $expected_id = isset($params['expected_current_id']) ? (string) $params['expected_current_id'] : '';
            $expected_destination = genesis_ssi_redirect_v1_normalize_path(isset($params['expected_current_destination']) ? $params['expected_current_destination'] : null, 'expected_current_destination');
            if (is_wp_error($expected_destination) || !hash_equals((string) $existing['id'], $expected_id) || $existing['destination'] !== $expected_destination) {
                return new WP_Error('genesis_redirect_conflict', 'The source already has a different redirect. Exact current identity and destination are required to replace it.', array('status' => 409));
            }
        } elseif (count($registry) >= GENESIS_SSI_REDIRECT_V1_LIMIT) {
            return new WP_Error('genesis_redirect_limit', 'The bounded redirect registry limit has been reached.', array('status' => 409));
        }

        foreach ($registry as $registered_source => $record) {
            if ($registered_source === $source) {
                continue;
            }
            if ($registered_source === $destination || $record['destination'] === $source) {
                return new WP_Error('genesis_redirect_chain', 'Redirect chains and loops are not permitted.', array('status' => 409));
            }
        }

        $now = gmdate('c');
        $record = array(
            'id' => 'genesis-redirect-' . substr(hash('sha256', $source), 0, 24),
            'source' => $source,
            'destination' => $destination,
            'status' => 301,
            'created_at' => $existing ? $existing['created_at'] : $now,
            'updated_at' => $now,
        );
        $registry[$source] = $record;
        $saved = genesis_ssi_redirect_v1_save($registry);
        if (is_wp_error($saved)) {
            return $saved;
        }
        $response = genesis_ssi_redirect_v1_record($record);
        $response['created'] = !$existing;
        $response['updated'] = (bool) $existing;
        $response['idempotent'] = false;
        return new WP_REST_Response($response, $existing ? 200 : 201);
    });
}

function genesis_ssi_redirect_v1_delete(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $source = genesis_ssi_redirect_v1_normalize_path(isset($params['source']) ? $params['source'] : null, 'source');
    $destination = genesis_ssi_redirect_v1_normalize_path(isset($params['destination']) ? $params['destination'] : null, 'destination');
    $id = isset($params['id']) ? trim((string) $params['id']) : '';
    if (is_wp_error($source)) {
        return $source;
    }
    if (is_wp_error($destination)) {
        return $destination;
    }
    if ($id === '') {
        return new WP_Error('genesis_redirect_identity_required', 'Exact redirect id, source, and destination are required.', array('status' => 400));
    }

    return genesis_ssi_redirect_v1_with_lock(function () use ($id, $source, $destination) {
        $registry = genesis_ssi_redirect_v1_registry();
        if (!isset($registry[$source])) {
            return rest_ensure_response(array('ok' => true, 'deleted' => false, 'exists' => false, 'source' => $source));
        }
        $record = $registry[$source];
        if (!hash_equals((string) $record['id'], $id) || $record['destination'] !== $destination || (int) $record['status'] !== 301) {
            return new WP_Error('genesis_redirect_delete_conflict', 'Exact redirect identity, source, and destination did not match.', array('status' => 409));
        }
        unset($registry[$source]);
        $saved = genesis_ssi_redirect_v1_save($registry);
        if (is_wp_error($saved)) {
            return $saved;
        }
        return rest_ensure_response(array(
            'ok' => true,
            'deleted' => true,
            'exists' => false,
            'id' => (string) $record['id'],
            'source' => $source,
            'destination' => $destination,
            'status' => 301,
        ));
    });
}

add_action('rest_api_init', function () {
    register_rest_route('ssi/v1', '/redirect', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'genesis_ssi_redirect_v1_get',
            'permission_callback' => 'genesis_ssi_redirect_v1_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'genesis_ssi_redirect_v1_post',
            'permission_callback' => 'genesis_ssi_redirect_v1_permission',
        ),
        array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'genesis_ssi_redirect_v1_delete',
            'permission_callback' => 'genesis_ssi_redirect_v1_permission',
        ),
    ));
});

add_action('template_redirect', function () {
    if (!genesis_ssi_redirect_v1_site_allowed() || is_admin() || wp_doing_ajax() || wp_doing_cron() || is_feed() || is_trackback()
        || (defined('REST_REQUEST') && REST_REQUEST) || (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST)
        || (defined('WP_CLI') && WP_CLI)) {
        return;
    }
    $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    $request_path = wp_parse_url($request_uri, PHP_URL_PATH);
    $source = genesis_ssi_redirect_v1_normalize_path(is_string($request_path) ? $request_path : '', 'source');
    if (is_wp_error($source)) {
        return;
    }
    $registry = genesis_ssi_redirect_v1_registry();
    if (!isset($registry[$source])) {
        return;
    }
    $record = $registry[$source];
    $destination = isset($record['destination']) ? (string) $record['destination'] : '';
    if ((int) $record['status'] !== 301 || $source === $destination || isset($registry[$destination])) {
        return;
    }
    wp_safe_redirect(home_url($destination), 301, 'Genesis SSI Redirect Authority v1');
    exit;
}, 0);