<?php
/**
 * Dependency-free unit tests for the Genesis Share-to-Grow refund bridge.
 * Run: php integrations/wordpress/genesis-share-to-grow/tests/run.php
 */

define( 'ABSPATH', __DIR__ . '/' );

$GLOBALS['t'] = array();

class WP_Error {
	private $code;
	public function __construct( $code = '', $message = '' ) {
		$this->code = $code;
	}
	public function get_error_code() {
		return $this->code;
	}
}
class Stub_Date {
	private $ts;
	public function __construct( $ts ) {
		$this->ts = $ts;
	}
	public function getTimestamp() {
		return $this->ts;
	}
}
class Stub_Item {
	public $id, $qty, $total, $meta;
	public function __construct( $id, $qty, $total, $meta ) {
		$this->id = $id; $this->qty = $qty; $this->total = $total; $this->meta = $meta;
	}
	public function get_id() { return $this->id; }
	public function get_quantity() { return $this->qty; }
	public function get_total() { return $this->total; }
	public function get_meta( $key ) { return isset( $this->meta[ $key ] ) ? $this->meta[ $key ] : ''; }
}
class WC_Order_Refund {
	public $id, $parent, $ts, $amount, $items, $meta = array(), $saves = 0;
	public function __construct( $id, $parent, $ts, $amount, $items ) {
		$this->id = $id; $this->parent = $parent; $this->ts = $ts; $this->amount = $amount; $this->items = $items;
	}
	public function get_id() { return $this->id; }
	public function get_parent_id() { return $this->parent; }
	public function get_date_created() { return new Stub_Date( $this->ts ); }
	public function get_amount() { return $this->amount; }
	public function get_items( $type ) { return $this->items; }
	public function get_meta( $key ) { return isset( $this->meta[ $key ] ) ? $this->meta[ $key ] : ''; }
	public function update_meta_data( $key, $value ) { $this->meta[ $key ] = $value; }
	public function save_meta_data() { $this->saves++; }
}
class WC_Webhook {
	public $name, $topic, $url, $status, $secret;
	public function __construct( $name, $topic, $url, $status, $secret ) {
		$this->name = $name; $this->topic = $topic; $this->url = $url; $this->status = $status; $this->secret = $secret;
	}
	public function get_name() { return $this->name; }
	public function get_topic() { return $this->topic; }
	public function get_delivery_url() { return $this->url; }
	public function get_status() { return $this->status; }
	public function get_secret() { return $this->secret; }
}
class WC_Data_Store {
	public static function load( $name ) { return new self(); }
	public function search_webhooks( $args ) { return array_keys( $GLOBALS['t']['webhooks'] ); }
}
class Stub_Logger {
	public function log( $level, $message, $context = array() ) {
		$GLOBALS['t']['logs'][] = $level . ' ' . $message;
	}
}

function add_action( $hook, $cb, $priority = 10, $args = 1 ) { $GLOBALS['t']['actions'][ $hook ] = array( $cb, $priority, $args ); }
function home_url() { return $GLOBALS['t']['home']; }
function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }
function wp_json_encode( $data, $flags = 0 ) { return json_encode( $data, $flags ); }
function wc_get_price_decimals() { return 2; }
function wc_format_decimal( $value, $dp ) { return number_format( (float) $value, $dp, '.', '' ); }
function wc_get_order( $id ) { return isset( $GLOBALS['t']['orders'][ $id ] ) ? $GLOBALS['t']['orders'][ $id ] : false; }
function wc_get_webhook( $id ) { return $GLOBALS['t']['webhooks'][ $id ]; }
function wc_get_logger() { return new Stub_Logger(); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_remote_post( $url, $args ) {
	$GLOBALS['t']['posts'][] = array( 'url' => $url, 'args' => $args );
	return $GLOBALS['t']['response'];
}
function wp_remote_retrieve_response_code( $response ) { return $response['code']; }
function as_enqueue_async_action( $hook, $args, $group ) { $GLOBALS['t']['async'][] = array( $hook, $args, $group ); }
function as_has_scheduled_action( $hook, $args, $group ) {
	foreach ( $GLOBALS['t']['async'] as $entry ) {
		if ( $entry[0] === $hook && $entry[1] === $args && $entry[2] === $group ) { return true; }
	}
	return false;
}
function as_schedule_single_action( $time, $hook, $args, $group ) { $GLOBALS['t']['scheduled'][] = array( $time, $hook, $args, $group ); }

require_once __DIR__ . '/../includes/class-genesis-s2g-refund-bridge.php';

const SECRET = 'super-secret-webhook-value';

function reset_state( $refund = null ) {
	$GLOBALS['t'] = array(
		'home'      => 'https://staging.stonerusa.com',
		'logs'      => array(),
		'posts'     => array(),
		'async'     => array(),
		'scheduled' => array(),
		'actions'   => array(),
		'response'  => array( 'code' => 200 ),
		'orders'    => array(),
		'webhooks'  => array(
			1 => new WC_Webhook( Genesis_S2G_Refund_Bridge::WEBHOOK_NAME, 'order.updated', Genesis_S2G_Refund_Bridge::DEFAULT_TARGET_URL, 'active', SECRET ),
		),
	);
	$refund = $refund ? $refund : two_line_refund();
	$GLOBALS['t']['orders'][ $refund->id ] = $refund;
	return $refund;
}

// Items are deliberately listed out of id order; two different original order lines.
function two_line_refund() {
	return new WC_Order_Refund(
		9001, 812, 1791338400, '25.50',
		array(
			new Stub_Item( 102, -1, '-20.00', array( '_refunded_item_id' => '2' ) ),
			new Stub_Item( 101, -1, '-5.50', array( '_refunded_item_id' => '3' ) ),
		)
	);
}

$passed = 0;
$failed = 0;
function check( $name, $condition ) {
	global $passed, $failed;
	if ( $condition ) { $passed++; echo "PASS $name\n"; } else { $failed++; echo "FAIL $name\n"; }
}

$golden = trim( file_get_contents( __DIR__ . '/fixtures/two-line-refund.json' ) );
$B      = 'Genesis_S2G_Refund_Bridge';

// Serialization
$refund = reset_state();
$body   = $B::encode_payload( $B::build_payload( $refund ) );
check( 'two-line refund serializes byte-exact to the golden fixture', $body === $golden );
$decoded = json_decode( $body, true );
check( 'refund id and parent order id', 9001 === $decoded['id'] && 812 === $decoded['parent_id'] );
check( 'GMT created timestamp', '2026-10-07T02:00:00Z' === $decoded['date_created_gmt'] );
check( 'both refund lines preserved and sorted', 2 === count( $decoded['line_items'] ) && 101 === $decoded['line_items'][0]['id'] );
check( 'original line mapping: 101 -> 3, 102 -> 2',
	'3' === $decoded['line_items'][0]['meta_data'][0]['value'] && '2' === $decoded['line_items'][1]['meta_data'][0]['value'] );
check( 'negative refund totals as Woo represents them', '-5.50' === $decoded['line_items'][0]['total'] && '-20.00' === $decoded['line_items'][1]['total'] );
check( 'serialization is deterministic', $body === $B::encode_payload( $B::build_payload( $refund ) ) );

// Signature and delivery id
check( 'HMAC matches the Genesis verification vector', 'H19jdkTt0bdVHJbmH87mtfSa7ud+merMEAWsvbbRGkY=' === $B::sign( '{"id":1}', 'test-secret' ) );
check( 'delivery id is deterministic', 'woo-refund-812-9001' === $B::delivery_id( 812, 9001 ) && $B::delivery_id( 812, 9001 ) === $B::delivery_id( 812, 9001 ) );
check( 'backoff is bounded and deterministic', array( 60, 300, 900, 3600 ) === array_map( array( $B, 'backoff_seconds' ), array( 1, 2, 3, 4 ) ) );

// Registration uses the real WooCommerce refund hook
reset_state();
$B::register();
check( 'listens to woocommerce_refund_created', isset( $GLOBALS['t']['actions']['woocommerce_refund_created'] ) && 2 === $GLOBALS['t']['actions']['woocommerce_refund_created'][2] );

// Successful delivery
$refund = reset_state();
$B::deliver( 812, 9001, 1 );
$post = $GLOBALS['t']['posts'][0];
check( 'posts once to the Genesis URL', 1 === count( $GLOBALS['t']['posts'] ) && $B::DEFAULT_TARGET_URL === $post['url'] );
check( 'headers carry topic, delivery id and signature',
	'refund.created' === $post['args']['headers']['X-WC-Webhook-Topic']
	&& 'woo-refund-812-9001' === $post['args']['headers']['X-WC-Webhook-Delivery-ID']
	&& $B::sign( $post['args']['body'], SECRET ) === $post['args']['headers']['X-WC-Webhook-Signature'] );
check( 'posted body is exactly the golden payload', $golden === $post['args']['body'] );
check( 'bounded timeout and no redirects', 10 === $post['args']['timeout'] && 0 === $post['args']['redirection'] );
check( '2xx marks the refund delivered', 1 === $refund->get_meta( $B::DELIVERED_META ) );
$B::deliver( 812, 9001, 1 );
check( 'duplicate execution does not re-post', 1 === count( $GLOBALS['t']['posts'] ) );

// Non-2xx: logged safely, bounded retry
$refund = reset_state();
$GLOBALS['t']['response'] = array( 'code' => 500 );
$B::deliver( 812, 9001, 1 );
check( 'non-2xx schedules attempt 2 after 60s', 1 === count( $GLOBALS['t']['scheduled'] ) && array( 812, 9001, 2 ) === $GLOBALS['t']['scheduled'][0][2] );
check( 'non-2xx is logged with status and ids', false !== strpos( implode( "\n", $GLOBALS['t']['logs'] ), 'HTTP_500' ) && false !== strpos( implode( "\n", $GLOBALS['t']['logs'] ), '9001' ) );
check( 'failure does not mark delivered', '' === $refund->get_meta( $B::DELIVERED_META ) );
check( 'no secret in logs', false === strpos( implode( "\n", $GLOBALS['t']['logs'] ), SECRET ) );

$refund = reset_state();
$GLOBALS['t']['response'] = array( 'code' => 502 );
$B::deliver( 812, 9001, 5 );
check( 'final attempt does not reschedule and records failure', 0 === count( $GLOBALS['t']['scheduled'] ) && 'HTTP_502' === $refund->get_meta( $B::FAILED_META ) );

$reset = reset_state();
$GLOBALS['t']['response'] = new WP_Error( 'http_request_failed', 'cURL error' );
$B::deliver( 812, 9001, 1 );
check( 'transport error logged by code and retried', 1 === count( $GLOBALS['t']['scheduled'] ) && false !== strpos( implode( "\n", $GLOBALS['t']['logs'] ), 'TRANSPORT_ERROR:http_request_failed' ) );

// Webhook / secret resolution
reset_state();
$GLOBALS['t']['webhooks'][1]->url = 'https://example.invalid/hook';
$B::deliver( 812, 9001, 1 );
check( 'unmatched webhook means no post and a bounded retry', 0 === count( $GLOBALS['t']['posts'] ) && 1 === count( $GLOBALS['t']['scheduled'] ) );
reset_state();
$GLOBALS['t']['webhooks'][1]->status = 'paused';
$B::deliver( 812, 9001, 1 );
check( 'paused webhook is not used', 0 === count( $GLOBALS['t']['posts'] ) );

// Environment gate
reset_state();
$GLOBALS['t']['home'] = 'https://www.stonerusa.com';
$B::on_refund_created( 9001, array() );
$B::deliver( 812, 9001, 1 );
check( 'fails closed on an unexpected host', 0 === count( $GLOBALS['t']['async'] ) && 0 === count( $GLOBALS['t']['posts'] ) );

// Hook handling and idempotent scheduling
reset_state();
$B::on_refund_created( 9001, array() );
$B::on_refund_created( 9001, array() );
check( 'duplicate hook invocation schedules one delivery', 1 === count( $GLOBALS['t']['async'] ) && array( 812, 9001, 1 ) === $GLOBALS['t']['async'][0][1] );

// Fail closed when a line cannot be tied to an original line
$refund = reset_state( new WC_Order_Refund( 9002, 812, 1791338400, '5.00', array( new Stub_Item( 103, -1, '-5.00', array() ) ) ) );
$B::deliver( 812, 9002, 1 );
check( 'refund line without original item id is never sent', 0 === count( $GLOBALS['t']['posts'] ) && 'PAYLOAD_INVALID' === $refund->get_meta( $B::FAILED_META ) );

echo "\n$passed passed, $failed failed\n";
exit( $failed > 0 ? 1 : 0 );
