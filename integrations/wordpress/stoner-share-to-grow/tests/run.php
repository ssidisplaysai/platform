<?php
/**
 * Dependency-free tests for STONER Share-to-Grow attribution bridge.
 * Run: php integrations/wordpress/stoner-share-to-grow/tests/run.php
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

class Stub_Logger {
	public function log( $level, $message, $context = array() ) {
		$GLOBALS['t']['logs'][] = array( 'level' => $level, 'message' => $message, 'context' => $context );
	}
}

class Stub_WC_Session {
	private $data = array();
	public function set( $key, $value ) {
		$this->data[ $key ] = $value;
	}
	public function get( $key ) {
		return isset( $this->data[ $key ] ) ? $this->data[ $key ] : null;
	}
}

class Stub_WC_Order {
	public $meta = array();
	public function update_meta_data( $key, $value ) {
		$this->meta[ $key ] = $value;
	}
}

class Stub_WC_Context {
	public $session;
	public function __construct() {
		$this->session = new Stub_WC_Session();
	}
}

function add_action( $hook, $cb, $priority = 10, $args = 1 ) {
	$GLOBALS['t']['actions'][ $hook ] = array( $cb, $priority, $args );
}
function wp_unslash( $value ) {
	return $value;
}
function wp_json_encode( $value ) {
	return json_encode( $value );
}
function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}
function wc_get_logger() {
	return new Stub_Logger();
}
function is_ssl() {
	return true;
}
function WC() {
	return $GLOBALS['t']['wc'];
}

require_once __DIR__ . '/../includes/class-stoner-s2g-attribution-bridge.php';

const SECRET = 'stoner-s2g-test-secret';
const ORG    = 'stoner';

function reset_state() {
	$GLOBALS['t'] = array(
		'actions' => array(),
		'logs'    => array(),
		'wc'      => new Stub_WC_Context(),
	);
	$_GET = array();
	$_COOKIE = array();
}

function make_token( $payload, $secret ) {
	$encoded = rtrim( strtr( base64_encode( json_encode( $payload ) ), '+/', '-_' ), '=' );
	$signature = rtrim( strtr( base64_encode( hash_hmac( 'sha256', $encoded, $secret, true ) ), '+/', '-_' ), '=' );
	return $encoded . '.' . $signature;
}

$passed = 0;
$failed = 0;
function check( $name, $condition ) {
	global $passed, $failed;
	if ( $condition ) {
		$passed++;
		echo "PASS $name\n";
		return;
	}
	$failed++;
	echo "FAIL $name\n";
}

reset_state();
Stoner_S2G_Attribution_Bridge::register();
check( 'registers init capture hook', isset( $GLOBALS['t']['actions']['init'] ) );
check( 'registers checkout metadata hook', isset( $GLOBALS['t']['actions']['woocommerce_checkout_create_order'] ) );

$now = gmdate( 'Y-m-d\TH:i:s\Z', time() );
$future = gmdate( 'Y-m-d\TH:i:s\Z', time() + 1800 );
$payload = array(
	'organizationId'    => ORG,
	'touchId'           => 'touch-daniel-001',
	'trackingIdentityId'=> 'tracking-stoner-gym-daniel-coffeen-v1',
	'canonicalPartnerId'=> 'daniel-coffeen',
	'campaignId'        => 'STONER-GYM',
	'issuedAt'          => $now,
	'expiresAt'         => $future,
);
$token = make_token( $payload, SECRET );

$verified = Stoner_S2G_Attribution_Bridge::verify_token( $token, SECRET, $now, ORG );
check( 'valid token verifies', is_array( $verified ) && $verified['canonicalPartnerId'] === 'daniel-coffeen' );

$tampered = make_token( array_merge( $payload, array( 'canonicalPartnerId' => 'attacker' ) ), 'other-secret' );
$invalid = Stoner_S2G_Attribution_Bridge::verify_token( $tampered, SECRET, $now, ORG );
check( 'wrong signature fails closed', is_wp_error( $invalid ) && 'INVALID_ATTRIBUTION_TOKEN_SIGNATURE' === $invalid->get_error_code() );

$expired_payload = $payload;
$expired_payload['issuedAt'] = gmdate( 'Y-m-d\TH:i:s\Z', time() - 7200 );
$expired_payload['expiresAt'] = gmdate( 'Y-m-d\TH:i:s\Z', time() - 3600 );
$expired = Stoner_S2G_Attribution_Bridge::verify_token( make_token( $expired_payload, SECRET ), SECRET, $now, ORG );
check( 'expired token fails closed', is_wp_error( $expired ) && 'ATTRIBUTION_TOKEN_EXPIRED' === $expired->get_error_code() );

$wrong_org = Stoner_S2G_Attribution_Bridge::verify_token( $token, SECRET, $now, 'other-org' );
check( 'wrong organization fails closed', is_wp_error( $wrong_org ) && 'ATTRIBUTION_TOKEN_ORGANIZATION_MISMATCH' === $wrong_org->get_error_code() );

putenv( 'GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET=' . SECRET );
$_GET[ Stoner_S2G_Attribution_Bridge::QUERY_KEY ] = $token;
Stoner_S2G_Attribution_Bridge::capture_from_request();
$session = WC()->session->get( Stoner_S2G_Attribution_Bridge::SESSION_KEY );
check( 'capture writes Woo session', is_array( $session ) && $session['payload']['canonicalPartnerId'] === 'daniel-coffeen' );

$order = new Stub_WC_Order();
Stoner_S2G_Attribution_Bridge::attach_order_metadata( $order, array() );
check( 'order meta touch key set', isset( $order->meta['_genesis_touch_id'] ) && $order->meta['_genesis_touch_id'] === 'touch-daniel-001' );
check( 'order meta tracking key set', isset( $order->meta['_genesis_tracking_identity_id'] ) && $order->meta['_genesis_tracking_identity_id'] === 'tracking-stoner-gym-daniel-coffeen-v1' );
check( 'order meta partner key set', isset( $order->meta['_genesis_partner_id'] ) && $order->meta['_genesis_partner_id'] === 'daniel-coffeen' );
check( 'order meta campaign key set', isset( $order->meta['_genesis_campaign_id'] ) && $order->meta['_genesis_campaign_id'] === 'STONER-GYM' );

if ( 0 !== $failed ) {
	echo "\n$passed passed, $failed failed\n";
	exit( 1 );
}
echo "\n$passed passed, 0 failed\n";
