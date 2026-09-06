/**
 * Genesis SSI Elementor Document Leaf Authority v1
 *
 * Install with Code Snippets and run everywhere. Do not add a PHP opening tag.
 */

const GENESIS_SSI_ELEMENTOR_LEAF_V1_HOST = 'projectorenclosure.com';
const GENESIS_SSI_ELEMENTOR_LEAF_V1_PAGE_ID = 3810;
const GENESIS_SSI_ELEMENTOR_LEAF_V1_MAX_BYTES = 100000;
const GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS = array('98e1f56', '0ce76cb', 'e87d71c', '94e8256');

function genesis_ssi_elementor_leaf_v1_permission() {
    if (!is_user_logged_in()) return new WP_Error('genesis_elementor_leaf_unauthorized', 'Authentication is required.', array('status' => 401));
    $host = preg_replace('/^www\./', '', strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST)));
    if ($host !== GENESIS_SSI_ELEMENTOR_LEAF_V1_HOST) return new WP_Error('genesis_elementor_leaf_wrong_site', 'Wrong site.', array('status' => 403));
    if (!current_user_can('edit_others_pages')) return new WP_Error('genesis_elementor_leaf_forbidden', 'edit_others_pages is required.', array('status' => 403));
    if (!current_user_can('unfiltered_html')) return new WP_Error('genesis_elementor_leaf_html_forbidden', 'unfiltered_html is required to preserve HTML widget content.', array('status' => 403));
    return true;
}

function genesis_ssi_elementor_leaf_v1_hash($value) {
    return hash('sha256', (string) $value);
}

function genesis_ssi_elementor_leaf_v1_structure($nodes, $path = array()) {
    $rows = array();
    foreach ($nodes as $position => $node) {
        $id = isset($node['id']) ? (string) $node['id'] : '';
        $next = array_merge($path, array($id !== '' ? $id : (string) $position));
        $rows[] = array(
            'path' => implode('/', $next),
            'id' => $id,
            'elType' => isset($node['elType']) ? (string) $node['elType'] : '',
            'widgetType' => isset($node['widgetType']) ? (string) $node['widgetType'] : null,
        );
        if (!empty($node['elements']) && is_array($node['elements'])) {
            $rows = array_merge($rows, genesis_ssi_elementor_leaf_v1_structure($node['elements'], $next));
        }
    }
    return $rows;
}

function genesis_ssi_elementor_leaf_v1_find(&$nodes, $element_id, &$matches) {
    foreach ($nodes as &$node) {
        if (isset($node['id']) && $node['id'] === $element_id) $matches[] =& $node;
        if (!empty($node['elements']) && is_array($node['elements'])) genesis_ssi_elementor_leaf_v1_find($node['elements'], $element_id, $matches);
    }
}

function genesis_ssi_elementor_leaf_v1_context($page_id, $element_id) {
    if ($page_id !== GENESIS_SSI_ELEMENTOR_LEAF_V1_PAGE_ID || !in_array($element_id, GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS, true)) {
        return new WP_Error('genesis_elementor_leaf_target_forbidden', 'Only approved page 3810 HTML widgets are available.', array('status' => 403));
    }
    if (!current_user_can('edit_post', $page_id)) return new WP_Error('genesis_elementor_leaf_page_forbidden', 'Exact page edit permission is required.', array('status' => 403));
    if (!class_exists('Elementor\\Plugin')) return new WP_Error('genesis_elementor_leaf_unavailable', 'Elementor is unavailable.', array('status' => 503));
    if (get_post_meta($page_id, '_elementor_edit_mode', true) !== 'builder') return new WP_Error('genesis_elementor_leaf_not_builder', 'Page is not Elementor-managed.', array('status' => 409));
    $document = \Elementor\Plugin::$instance->documents->get($page_id);
    if (!$document || !$document->is_built_with_elementor() || !$document->is_editable_by_current_user()) return new WP_Error('genesis_elementor_leaf_document_unavailable', 'Editable Elementor document is unavailable.', array('status' => 409));
    $raw_json = (string) get_post_meta($page_id, '_elementor_data', true);
    $tree = json_decode($raw_json, true);
    if (!is_array($tree)) return new WP_Error('genesis_elementor_leaf_malformed', 'Elementor document JSON is malformed.', array('status' => 409));
    $matches = array();
    genesis_ssi_elementor_leaf_v1_find($tree, $element_id, $matches);
    if (count($matches) !== 1) return new WP_Error('genesis_elementor_leaf_non_unique', 'Element ID must resolve exactly once.', array('status' => 409));
    $element =& $matches[0];
    if (($element['elType'] ?? '') !== 'widget' || ($element['widgetType'] ?? '') !== 'html') return new WP_Error('genesis_elementor_leaf_wrong_widget', 'Only Elementor HTML widgets are mutable.', array('status' => 409));
    if (!isset($element['settings']['html']) || !is_string($element['settings']['html'])) return new WP_Error('genesis_elementor_leaf_missing', 'settings.html is unavailable.', array('status' => 409));
    $structure = genesis_ssi_elementor_leaf_v1_structure($tree);
    return array(
        'document' => $document,
        'tree' => &$tree,
        'element' => &$element,
        'documentHash' => genesis_ssi_elementor_leaf_v1_hash($raw_json),
        'leafHash' => genesis_ssi_elementor_leaf_v1_hash($element['settings']['html']),
        'structure' => $structure,
        'hierarchyHash' => genesis_ssi_elementor_leaf_v1_hash(wp_json_encode($structure)),
        'postContentHash' => genesis_ssi_elementor_leaf_v1_hash(get_post_field('post_content', $page_id, 'raw')),
    );
}

function genesis_ssi_elementor_leaf_v1_read(WP_REST_Request $request) {
    $page_id = absint($request->get_param('page_id'));
    $element_id = sanitize_key((string) $request->get_param('element_id'));
    $context = genesis_ssi_elementor_leaf_v1_context($page_id, $element_id);
    if (is_wp_error($context)) return $context;
    return rest_ensure_response(array(
        'ok' => true,
        'pageId' => $page_id,
        'elementId' => $element_id,
        'leaf' => 'settings.html',
        'documentSha256' => $context['documentHash'],
        'leafSha256' => $context['leafHash'],
        'postContentSha256' => $context['postContentHash'],
        'elementCount' => count($context['structure']),
        'hierarchySha256' => $context['hierarchyHash'],
        'widgetType' => 'html',
        'value' => $context['element']['settings']['html'],
    ));
}

function genesis_ssi_elementor_leaf_v1_write(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if (is_array($params) && array_key_exists('changes', $params)) {
        return genesis_ssi_elementor_leaf_v1_write_many($params);
    }
    $keys = is_array($params) ? array_keys($params) : array();
    sort($keys);
    $expected = array('element_id', 'expected_document_sha256', 'expected_leaf_sha256', 'leaf', 'page_id', 'reason', 'replacement');
    if ($keys !== $expected || ($params['leaf'] ?? '') !== 'settings.html' || !is_string($params['replacement'] ?? null)) {
        return new WP_Error('genesis_elementor_leaf_invalid_request', 'Exact document-leaf request is required.', array('status' => 400));
    }
    if (!in_array($params['reason'], array('certification', 'rollback', 'remediation'), true)) return new WP_Error('genesis_elementor_leaf_invalid_reason', 'Reason is not approved.', array('status' => 400));
    if (strlen($params['replacement']) > GENESIS_SSI_ELEMENTOR_LEAF_V1_MAX_BYTES) return new WP_Error('genesis_elementor_leaf_oversized', 'Replacement exceeds the byte limit.', array('status' => 413));
    $page_id = absint($params['page_id']);
    $element_id = sanitize_key((string) $params['element_id']);
    $context = genesis_ssi_elementor_leaf_v1_context($page_id, $element_id);
    if (is_wp_error($context)) return $context;
    if (!hash_equals($context['documentHash'], (string) $params['expected_document_sha256'])) return new WP_Error('genesis_elementor_leaf_stale_document', 'Document hash conflict.', array('status' => 409));
    if (!hash_equals($context['leafHash'], (string) $params['expected_leaf_sha256'])) return new WP_Error('genesis_elementor_leaf_stale_leaf', 'Leaf hash conflict.', array('status' => 409));
    $before_structure = $context['structure'];
    $before_other_leaves = array();
    foreach (GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS as $id) {
        if ($id === $element_id) continue;
        $matches = array();
        genesis_ssi_elementor_leaf_v1_find($context['tree'], $id, $matches);
        if (count($matches) !== 1 || ($matches[0]['widgetType'] ?? '') !== 'html' || !is_string($matches[0]['settings']['html'] ?? null)) return new WP_Error('genesis_elementor_leaf_structure_mismatch', 'Approved widget structure is incomplete.', array('status' => 409));
        $before_other_leaves[$id] = genesis_ssi_elementor_leaf_v1_hash($matches[0]['settings']['html']);
    }
    $context['element']['settings']['html'] = $params['replacement'];
    $saved = $context['document']->save(array('elements' => $context['tree']));
    if (!$saved) return new WP_Error('genesis_elementor_leaf_save_failed', 'Elementor document save failed.', array('status' => 500));
    $readback = genesis_ssi_elementor_leaf_v1_context($page_id, $element_id);
    if (is_wp_error($readback)) return $readback;
    if ($readback['leafHash'] !== genesis_ssi_elementor_leaf_v1_hash($params['replacement']) || $readback['hierarchyHash'] !== genesis_ssi_elementor_leaf_v1_hash(wp_json_encode($before_structure))) return new WP_Error('genesis_elementor_leaf_readback_failed', 'Exact Elementor readback failed.', array('status' => 500));
    foreach ($before_other_leaves as $id => $leaf_hash) {
        $matches = array();
        genesis_ssi_elementor_leaf_v1_find($readback['tree'], $id, $matches);
        if (count($matches) !== 1 || genesis_ssi_elementor_leaf_v1_hash($matches[0]['settings']['html']) !== $leaf_hash) return new WP_Error('genesis_elementor_leaf_collateral_change', 'A non-target HTML leaf changed.', array('status' => 500));
    }
    return rest_ensure_response(array(
        'ok' => true,
        'state' => 'SAVED',
        'saveAuthority' => 'Elementor\\Core\\Base\\Document::save',
        'pageId' => $page_id,
        'elementId' => $element_id,
        'leaf' => 'settings.html',
        'documentSha256' => $readback['documentHash'],
        'leafSha256' => $readback['leafHash'],
        'postContentSha256' => $readback['postContentHash'],
        'elementCount' => count($readback['structure']),
        'hierarchySha256' => $readback['hierarchyHash'],
    ));
}

function genesis_ssi_elementor_leaf_v1_write_many($params) {
    $keys = is_array($params) ? array_keys($params) : array();
    sort($keys);
    if ($keys !== array('changes', 'expected_document_sha256', 'page_id', 'reason') || !is_array($params['changes']) || $params['changes'] === array()) {
        return new WP_Error('genesis_elementor_leaves_invalid_request', 'Exact multi-leaf request is required.', array('status' => 400));
    }
    if (!in_array($params['reason'], array('rollback', 'remediation'), true)) return new WP_Error('genesis_elementor_leaf_invalid_reason', 'Reason is not approved.', array('status' => 400));
    if (count($params['changes']) > count(GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS)) return new WP_Error('genesis_elementor_leaves_too_many', 'Too many leaf changes.', array('status' => 400));
    $page_id = absint($params['page_id']);
    $requested_ids = array();
    foreach ($params['changes'] as $change) {
        $change_keys = is_array($change) ? array_keys($change) : array();
        sort($change_keys);
        if ($change_keys !== array('element_id', 'expected_leaf_sha256', 'leaf', 'replacement') || ($change['leaf'] ?? '') !== 'settings.html' || !is_string($change['replacement'] ?? null)) {
            return new WP_Error('genesis_elementor_leaves_invalid_change', 'Every change must identify one exact HTML leaf.', array('status' => 400));
        }
        if (strlen($change['replacement']) > GENESIS_SSI_ELEMENTOR_LEAF_V1_MAX_BYTES) return new WP_Error('genesis_elementor_leaf_oversized', 'Replacement exceeds the byte limit.', array('status' => 413));
        $requested_ids[] = sanitize_key((string) $change['element_id']);
    }
    if (count(array_unique($requested_ids)) !== count($requested_ids)) return new WP_Error('genesis_elementor_leaves_duplicate', 'Element IDs must be unique.', array('status' => 409));
    $expected_order = array_values(array_filter(GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS, function ($id) use ($requested_ids) { return in_array($id, $requested_ids, true); }));
    if ($requested_ids !== $expected_order) return new WP_Error('genesis_elementor_leaves_order', 'Changes must follow the approved deterministic widget order.', array('status' => 409));

    $context = genesis_ssi_elementor_leaf_v1_context($page_id, $requested_ids[0]);
    if (is_wp_error($context)) return $context;
    if (!hash_equals($context['documentHash'], (string) $params['expected_document_sha256'])) return new WP_Error('genesis_elementor_leaf_stale_document', 'Document hash conflict.', array('status' => 409));
    $before_structure = $context['structure'];
    $before_leaf_hashes = array();
    $targets = array();
    foreach (GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS as $id) {
        $matches = array();
        genesis_ssi_elementor_leaf_v1_find($context['tree'], $id, $matches);
        if (count($matches) !== 1 || ($matches[0]['elType'] ?? '') !== 'widget' || ($matches[0]['widgetType'] ?? '') !== 'html' || !is_string($matches[0]['settings']['html'] ?? null)) {
            return new WP_Error('genesis_elementor_leaf_structure_mismatch', 'Approved widget structure is incomplete.', array('status' => 409));
        }
        $before_leaf_hashes[$id] = genesis_ssi_elementor_leaf_v1_hash($matches[0]['settings']['html']);
        $targets[$id] =& $matches[0];
    }
    foreach ($params['changes'] as $change) {
        $id = sanitize_key((string) $change['element_id']);
        if (!isset($targets[$id])) return new WP_Error('genesis_elementor_leaf_target_forbidden', 'Only approved page 3810 HTML widgets are available.', array('status' => 403));
        if (!hash_equals($before_leaf_hashes[$id], (string) $change['expected_leaf_sha256'])) return new WP_Error('genesis_elementor_leaf_stale_leaf', 'Leaf hash conflict.', array('status' => 409));
    }
    foreach ($params['changes'] as $change) {
        $id = sanitize_key((string) $change['element_id']);
        $targets[$id]['settings']['html'] = $change['replacement'];
    }
    $saved = $context['document']->save(array('elements' => $context['tree']));
    if (!$saved) return new WP_Error('genesis_elementor_leaf_save_failed', 'Elementor document save failed.', array('status' => 500));

    $readback = genesis_ssi_elementor_leaf_v1_context($page_id, $requested_ids[0]);
    if (is_wp_error($readback) || $readback['hierarchyHash'] !== genesis_ssi_elementor_leaf_v1_hash(wp_json_encode($before_structure))) return new WP_Error('genesis_elementor_leaf_readback_failed', 'Exact Elementor readback failed.', array('status' => 500));
    $after_leaf_hashes = array();
    foreach (GENESIS_SSI_ELEMENTOR_LEAF_V1_ALLOWED_IDS as $id) {
        $matches = array();
        genesis_ssi_elementor_leaf_v1_find($readback['tree'], $id, $matches);
        if (count($matches) !== 1) return new WP_Error('genesis_elementor_leaf_readback_failed', 'Exact Elementor readback failed.', array('status' => 500));
        $after_leaf_hashes[$id] = genesis_ssi_elementor_leaf_v1_hash($matches[0]['settings']['html']);
        if (!in_array($id, $requested_ids, true) && $after_leaf_hashes[$id] !== $before_leaf_hashes[$id]) return new WP_Error('genesis_elementor_leaf_collateral_change', 'A non-target HTML leaf changed.', array('status' => 500));
    }
    return rest_ensure_response(array(
        'ok' => true,
        'state' => 'SAVED',
        'saveAuthority' => 'Elementor\\Core\\Base\\Document::save',
        'saveCount' => 1,
        'pageId' => $page_id,
        'changedElementIds' => $requested_ids,
        'documentSha256' => $readback['documentHash'],
        'leafSha256' => $after_leaf_hashes,
        'postContentSha256' => $readback['postContentHash'],
        'elementCount' => count($readback['structure']),
        'hierarchySha256' => $readback['hierarchyHash'],
    ));
}

add_action('rest_api_init', function () {
    register_rest_route('ssi/v1', '/elementor-document-leaf', array(
        array('methods' => WP_REST_Server::READABLE, 'callback' => 'genesis_ssi_elementor_leaf_v1_read', 'permission_callback' => 'genesis_ssi_elementor_leaf_v1_permission'),
        array('methods' => WP_REST_Server::CREATABLE, 'callback' => 'genesis_ssi_elementor_leaf_v1_write', 'permission_callback' => 'genesis_ssi_elementor_leaf_v1_permission'),
    ));
});