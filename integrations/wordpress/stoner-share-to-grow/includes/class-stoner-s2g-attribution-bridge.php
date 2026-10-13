<?php
/**
 * STONER Share-to-Grow attribution bridge.
 *
 * Accepts signed Genesis attribution tokens from the query string, validates
 * token integrity and validity window, persists last qualified touch for 30
 * days, and maps canonical attribution metadata onto WooCommerce orders.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Stoner_S2G_Attribution_Bridge {

	const VERSION               = '1.0.1';
	const QUERY_KEY             = 'genesis_attribution';
	const SESSION_KEY           = 'genesis_share_to_grow_attribution';
	const COOKIE_NAME           = 'genesis_share_to_grow_attribution';
	const COOKIE_MAX_AGE        = 2592000; // 30 days.
	const DEFAULT_ORGANIZATION  = 'stoner';
	const DEFAULT_SHOPIFY_DESTINATION = 'https://shop.stonerusa.com/collections/all';
	const QUERY_ROUTE_PREFIX    = 'q';
	const META_TOUCH_ID         = '_genesis_touch_id';
	const META_TRACKING_ID      = '_genesis_tracking_identity_id';
	const META_PARTNER_ID       = '_genesis_partner_id';
	const META_CAMPAIGN_ID      = '_genesis_campaign_id';
	const SECRET_ENV            = 'GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET';

	public static function register() {
		add_action( 'init', array( __CLASS__, 'capture_from_request' ), 20 );
		add_action( 'template_redirect', array( __CLASS__, 'handle_durable_route' ), 1 );
		add_filter( 'allowed_redirect_hosts', array( __CLASS__, 'allow_shopify_redirect_host' ), 10, 2 );
		add_action( 'woocommerce_checkout_create_order', array( __CLASS__, 'attach_order_metadata' ), 20, 2 );
	}

	public static function expected_organization() {
		if ( defined( 'GENESIS_S2G_EXPECTED_ORGANIZATION' ) ) {
			$value = trim( (string) GENESIS_S2G_EXPECTED_ORGANIZATION );
			if ( '' !== $value ) {
				return $value;
			}
		}
		return self::DEFAULT_ORGANIZATION;
	}

	public static function signing_secret() {
		if ( defined( 'GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET' ) ) {
			$constant = trim( (string) GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET );
			if ( '' !== $constant ) {
				return $constant;
			}
		}
		$environment = getenv( self::SECRET_ENV );
		if ( false === $environment ) {
			return '';
		}
		return trim( (string) $environment );
	}


	public static function allow_shopify_redirect_host( $hosts, $host ) {
		$destination_host = wp_parse_url( self::destination_url(), PHP_URL_HOST );
		if ( is_string( $destination_host ) && '' !== $destination_host && ! in_array( $destination_host, $hosts, true ) ) {
			$hosts[] = $destination_host;
		}
		return $hosts;
	}

	public static function capture_from_request() {
		if ( empty( $_GET[ self::QUERY_KEY ] ) ) {
			return;
		}

		$token = wp_unslash( (string) $_GET[ self::QUERY_KEY ] );
		$secret = self::signing_secret();
		if ( '' === $secret ) {
			self::log( 'error', 'attribution token rejected: signing secret unavailable' );
			return;
		}

		$payload = self::verify_token(
			$token,
			$secret,
			gmdate( 'Y-m-d\TH:i:s\Z' ),
			self::expected_organization()
		);
		if ( is_wp_error( $payload ) ) {
			self::log( 'warning', 'attribution token rejected', array( 'code' => $payload->get_error_code() ) );
			return;
		}

		$session = self::normalize_session( $token, $payload );
		self::write_wc_session( $session );
		self::write_cookie( $session );
	}

	public static function handle_durable_route() {
		if ( ! isset( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}
		$path = wp_parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH );
		if ( ! is_string( $path ) ) {
			return;
		}
		$prefix = '/' . trim( self::QUERY_ROUTE_PREFIX, '/' ) . '/';
		if ( 0 !== strpos( $path, $prefix ) ) {
			return;
		}
		$slug = trim( substr( $path, strlen( $prefix ) ) );
		if ( '' === $slug || false !== strpos( $slug, '/' ) ) {
			return;
		}

		$identity = self::public_slug_map();
		$entry = isset( $identity[ $slug ] ) && is_array( $identity[ $slug ] ) ? $identity[ $slug ] : null;
		if ( null === $entry ) {
			self::log( 'warning', 'durable attribution route slug unresolved', array( 'slug' => $slug ) );
			return;
		}

		$secret = self::signing_secret();
		if ( '' === $secret ) {
			self::log( 'error', 'durable attribution route unavailable: signing secret missing', array( 'slug' => $slug ) );
			return;
		}

		$destination = self::destination_url();
		if ( '' === $destination ) {
			self::log( 'error', 'durable attribution route unavailable: destination missing', array( 'slug' => $slug ) );
			return;
		}

		$token = self::issue_token(
			array(
				'organizationId'     => self::expected_organization(),
				'touchId'            => self::new_touch_id( $slug ),
				'trackingIdentityId' => isset( $entry['trackingIdentityId'] ) ? (string) $entry['trackingIdentityId'] : '',
				'canonicalPartnerId' => isset( $entry['canonicalPartnerId'] ) ? (string) $entry['canonicalPartnerId'] : '',
				'campaignId'         => isset( $entry['campaignId'] ) ? (string) $entry['campaignId'] : '',
				'issuedAt'           => gmdate( 'Y-m-d\TH:i:s\Z' ),
				'expiresAt'          => gmdate( 'Y-m-d\TH:i:s\Z', time() + self::COOKIE_MAX_AGE ),
			),
			$secret
		);
		if ( is_wp_error( $token ) ) {
			self::log( 'error', 'durable attribution route token generation failed', array(
				'slug' => $slug,
				'code' => $token->get_error_code(),
			) );
			return;
		}

		$redirect_url = add_query_arg(
			array( self::QUERY_KEY => $token ),
			$destination
		);
		wp_safe_redirect( $redirect_url, 302 );
		if ( self::should_exit_after_redirect() ) {
			exit;
		}
	}

	public static function verify_token( $token, $secret, $now, $expected_organization ) {
		if ( '' === trim( (string) $secret ) ) {
			return new WP_Error( 'ATTRIBUTION_TOKEN_SECRET_REQUIRED', 'Missing attribution signing secret.' );
		}
		$parts = explode( '.', (string) $token );
		if ( 2 !== count( $parts ) || '' === $parts[0] || '' === $parts[1] ) {
			return new WP_Error( 'INVALID_ATTRIBUTION_TOKEN_FORMAT', 'Token must contain payload and signature.' );
		}
		$encoded_payload = (string) $parts[0];
		$supplied_signature = (string) $parts[1];
		$expected_signature = self::sign( $encoded_payload, $secret );
		if ( ! hash_equals( $expected_signature, $supplied_signature ) ) {
			return new WP_Error( 'INVALID_ATTRIBUTION_TOKEN_SIGNATURE', 'Token signature mismatch.' );
		}

		$decoded = self::base64url_decode( $encoded_payload );
		if ( false === $decoded ) {
			return new WP_Error( 'INVALID_ATTRIBUTION_TOKEN_PAYLOAD', 'Token payload is not valid base64url.' );
		}
		$payload = json_decode( $decoded, true );
		if ( ! is_array( $payload ) ) {
			return new WP_Error( 'INVALID_ATTRIBUTION_TOKEN_PAYLOAD', 'Token payload is not valid JSON.' );
		}
		if ( ! self::validate_payload( $payload ) ) {
			return new WP_Error( 'INVALID_WORDPRESS_ATTRIBUTION_TOKEN', 'Token payload missing required fields.' );
		}
		$issued = strtotime( (string) $payload['issuedAt'] );
		$expires = strtotime( (string) $payload['expiresAt'] );
		$current = strtotime( (string) $now );
		if ( false === $issued || false === $expires || false === $current || $expires <= $issued ) {
			return new WP_Error( 'INVALID_WORDPRESS_ATTRIBUTION_TOKEN_TIME', 'Token timestamps are invalid.' );
		}
		if ( $current < $issued || $current > $expires ) {
			return new WP_Error( 'ATTRIBUTION_TOKEN_EXPIRED', 'Token is expired or not yet valid.' );
		}
		if ( (string) $payload['organizationId'] !== (string) $expected_organization ) {
			return new WP_Error( 'ATTRIBUTION_TOKEN_ORGANIZATION_MISMATCH', 'Token organization mismatch.' );
		}

		return $payload;
	}

	public static function attach_order_metadata( $order, $data ) {
		$session = self::current_attribution();
		if ( empty( $session['payload'] ) || ! is_array( $session['payload'] ) ) {
			return;
		}
		$payload = $session['payload'];
		$order->update_meta_data( self::META_TOUCH_ID, (string) $payload['touchId'] );
		$order->update_meta_data( self::META_TRACKING_ID, (string) $payload['trackingIdentityId'] );
		$order->update_meta_data( self::META_PARTNER_ID, (string) $payload['canonicalPartnerId'] );
		if ( ! empty( $payload['campaignId'] ) ) {
			$order->update_meta_data( self::META_CAMPAIGN_ID, (string) $payload['campaignId'] );
		}
	}

	public static function current_attribution() {
		$session = self::read_wc_session();
		if ( ! empty( $session['token'] ) && ! empty( $session['payload'] ) ) {
			return $session;
		}

		$cookie = self::read_cookie();
		if ( empty( $cookie['token'] ) || empty( $cookie['payload'] ) ) {
			return null;
		}

		$verified = self::verify_token(
			(string) $cookie['token'],
			self::signing_secret(),
			gmdate( 'Y-m-d\TH:i:s\Z' ),
			self::expected_organization()
		);
		if ( is_wp_error( $verified ) ) {
			return null;
		}

		$normalized = self::normalize_session( (string) $cookie['token'], $verified );
		self::write_wc_session( $normalized );
		return $normalized;
	}

	public static function sign( $encoded_payload, $secret ) {
		$raw = hash_hmac( 'sha256', (string) $encoded_payload, (string) $secret, true );
		return self::base64url_encode( $raw );
	}

	public static function issue_token( $payload, $secret ) {
		if ( ! self::validate_payload( $payload ) ) {
			return new WP_Error( 'INVALID_WORDPRESS_ATTRIBUTION_TOKEN', 'Token payload missing required fields.' );
		}
		$issued = strtotime( (string) $payload['issuedAt'] );
		$expires = strtotime( (string) $payload['expiresAt'] );
		if ( false === $issued || false === $expires || $expires <= $issued ) {
			return new WP_Error( 'INVALID_WORDPRESS_ATTRIBUTION_TOKEN_TIME', 'Token timestamps are invalid.' );
		}
		$encoded = self::base64url_encode( wp_json_encode( $payload ) );
		return $encoded . '.' . self::sign( $encoded, $secret );
	}

	private static function validate_payload( $payload ) {
		$required = array(
			'organizationId',
			'touchId',
			'trackingIdentityId',
			'canonicalPartnerId',
			'issuedAt',
			'expiresAt',
		);
		foreach ( $required as $key ) {
			if ( ! isset( $payload[ $key ] ) || '' === trim( (string) $payload[ $key ] ) ) {
				return false;
			}
		}
		return true;
	}

	private static function normalize_session( $token, $payload ) {
		return array(
			'token'   => (string) $token,
			'payload' => array(
				'organizationId'    => (string) $payload['organizationId'],
				'touchId'           => (string) $payload['touchId'],
				'trackingIdentityId'=> (string) $payload['trackingIdentityId'],
				'canonicalPartnerId'=> (string) $payload['canonicalPartnerId'],
				'campaignId'        => isset( $payload['campaignId'] ) ? (string) $payload['campaignId'] : '',
				'issuedAt'          => (string) $payload['issuedAt'],
				'expiresAt'         => (string) $payload['expiresAt'],
			),
			'storedAt' => gmdate( 'Y-m-d\TH:i:s\Z' ),
		);
	}

	private static function destination_url() {
		if ( defined( 'GENESIS_S2G_SHOPIFY_DESTINATION_URL' ) ) {
			$configured = trim( (string) GENESIS_S2G_SHOPIFY_DESTINATION_URL );
			if ( '' !== $configured ) {
				return $configured;
			}
		}
		return self::DEFAULT_SHOPIFY_DESTINATION;
	}

	private static function public_slug_map() {
		if ( defined( 'GENESIS_S2G_PUBLIC_SLUG_MAP' ) && is_array( GENESIS_S2G_PUBLIC_SLUG_MAP ) ) {
			return GENESIS_S2G_PUBLIC_SLUG_MAP;
		}
		return array(
			'daniel-coffeen' => array(
				'trackingIdentityId' => 'tracking-stoner-gym-daniel-coffeen-v1',
				'canonicalPartnerId' => 'daniel-coffeen',
				'campaignId'         => 'STONER-GYM-PRODUCTION',
			),
		);
	}

	private static function new_touch_id( $slug ) {
		return 'touch-' . sanitize_key( (string) $slug ) . '-' . gmdate( 'YmdHis' );
	}

	private static function write_wc_session( $session ) {
		if ( ! function_exists( 'WC' ) ) {
			return;
		}
		$wc = WC();
		if ( ! $wc || ! isset( $wc->session ) || ! $wc->session || ! method_exists( $wc->session, 'set' ) ) {
			return;
		}
		$wc->session->set( self::SESSION_KEY, $session );
	}

	private static function read_wc_session() {
		if ( ! function_exists( 'WC' ) ) {
			return null;
		}
		$wc = WC();
		if ( ! $wc || ! isset( $wc->session ) || ! $wc->session || ! method_exists( $wc->session, 'get' ) ) {
			return null;
		}
		$value = $wc->session->get( self::SESSION_KEY );
		return is_array( $value ) ? $value : null;
	}

	private static function write_cookie( $session ) {
		$value = self::base64url_encode( wp_json_encode( $session ) );
		$secure = is_ssl();
		$options = array(
			'expires'  => time() + self::COOKIE_MAX_AGE,
			'path'     => '/',
			'domain'   => '',
			'secure'   => $secure,
			'httponly' => true,
			'samesite' => 'Lax',
		);
		if ( PHP_VERSION_ID >= 70300 ) {
			setcookie( self::COOKIE_NAME, $value, $options );
		} else {
			setcookie( self::COOKIE_NAME, $value, $options['expires'], $options['path'] . '; samesite=' . $options['samesite'], $options['domain'], $options['secure'], $options['httponly'] );
		}
	}

	private static function read_cookie() {
		if ( empty( $_COOKIE[ self::COOKIE_NAME ] ) ) {
			return null;
		}
		$decoded = self::base64url_decode( wp_unslash( (string) $_COOKIE[ self::COOKIE_NAME ] ) );
		if ( false === $decoded ) {
			return null;
		}
		$value = json_decode( $decoded, true );
		return is_array( $value ) ? $value : null;
	}

	private static function base64url_encode( $raw ) {
		return rtrim( strtr( base64_encode( (string) $raw ), '+/', '-_' ), '=' );
	}

	private static function base64url_decode( $value ) {
		$remainder = strlen( (string) $value ) % 4;
		$padded = (string) $value;
		if ( 0 !== $remainder ) {
			$padded .= str_repeat( '=', 4 - $remainder );
		}
		return base64_decode( strtr( $padded, '-_', '+/' ), true );
	}

	private static function log( $level, $message, $context = array() ) {
		if ( function_exists( 'wc_get_logger' ) ) {
			wc_get_logger()->log( $level, $message, array( 'source' => 'stoner-share-to-grow' ) + $context );
		}
	}

	private static function should_exit_after_redirect() {
		return ! ( defined( 'GENESIS_S2G_TEST_MODE' ) && GENESIS_S2G_TEST_MODE );
	}
}
