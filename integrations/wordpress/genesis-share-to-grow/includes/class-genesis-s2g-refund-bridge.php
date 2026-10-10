<?php
/**
 * Genesis Share-to-Grow refund bridge.
 *
 * WooCommerce has no `refund.created` webhook topic, so this bridge listens to
 * WooCommerce's real refund lifecycle hook and posts the real refund object to
 * the existing Genesis webhook endpoint with the same HMAC contract
 * WooCommerce itself uses. It reuses the secret of the existing
 * "Genesis Share-to-Grow Staging" WooCommerce webhook; the secret is read from
 * WooCommerce at delivery time and never stored, logged or hard-coded.
 *
 * Hook (verified against wc-order-functions.php, wc_create_refund):
 *   do_action( 'woocommerce_refund_created', $refund->get_id(), $args );
 * It fires after the refund and its line items are saved.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Genesis_S2G_Refund_Bridge {

	const WEBHOOK_NAME        = 'Genesis Share-to-Grow Staging';
	const WEBHOOK_TOPIC       = 'order.updated';
	const DEFAULT_TARGET_URL  = 'https://staging.glwplatform.com/api/share-to-grow/woocommerce/webhook';
	const DEFAULT_ALLOWED_HOST = 'staging.stonerusa.com';
	const ACTION              = 'genesis_s2g_deliver_refund';
	const GROUP               = 'genesis-share-to-grow';
	const LOG_SOURCE          = 'genesis-share-to-grow';
	const MAX_ATTEMPTS        = 5;
	const TIMEOUT_SECONDS     = 10;
	const DELIVERED_META      = '_genesis_s2g_refund_delivered';
	const FAILED_META         = '_genesis_s2g_refund_delivery_failed';
	const REFUNDED_ITEM_META  = '_refunded_item_id';

	public static function register() {
		add_action( 'woocommerce_refund_created', array( __CLASS__, 'on_refund_created' ), 20, 2 );
		add_action( self::ACTION, array( __CLASS__, 'deliver' ), 10, 3 );
	}

	/** Hosts on which the bridge may run. Fails closed on any other host. */
	public static function allowed_hosts() {
		if ( defined( 'GENESIS_S2G_ALLOWED_HOSTS' ) ) {
			$configured = GENESIS_S2G_ALLOWED_HOSTS;
			$hosts      = is_array( $configured ) ? $configured : explode( ',', (string) $configured );
			return array_values( array_filter( array_map( 'trim', $hosts ) ) );
		}
		return array( self::DEFAULT_ALLOWED_HOST );
	}

	public static function target_url() {
		return defined( 'GENESIS_S2G_TARGET_URL' ) ? (string) GENESIS_S2G_TARGET_URL : self::DEFAULT_TARGET_URL;
	}

	public static function environment_allowed() {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		return is_string( $host ) && in_array( strtolower( $host ), array_map( 'strtolower', self::allowed_hosts() ), true );
	}

	/** Stable, request-independent identity: the same refund always yields the same id. */
	public static function delivery_id( $order_id, $refund_id ) {
		return 'woo-refund-' . (int) $order_id . '-' . (int) $refund_id;
	}

	/** HMAC-SHA256, base64: identical to WooCommerce's X-WC-Webhook-Signature. */
	public static function sign( $body, $secret ) {
		return base64_encode( hash_hmac( 'sha256', $body, $secret, true ) );
	}

	public static function backoff_seconds( $completed_attempts ) {
		$schedule = array( 60, 300, 900, 3600 );
		$index    = max( 0, min( (int) $completed_attempts, count( $schedule ) ) - 1 );
		return $schedule[ $index ];
	}

	/**
	 * Serialises a real refund to the shape the Genesis refund parser expects.
	 * Returns null (and the caller fails closed) when a refund line cannot be
	 * tied to its original order line.
	 */
	public static function build_payload( $refund ) {
		$order_id = (int) $refund->get_parent_id();
		if ( $order_id <= 0 ) {
			return null;
		}
		$created = $refund->get_date_created();
		if ( ! $created ) {
			return null;
		}
		$decimals = wc_get_price_decimals();
		$lines    = array();
		foreach ( $refund->get_items( 'line_item' ) as $item ) {
			$original = (int) $item->get_meta( self::REFUNDED_ITEM_META );
			if ( $original <= 0 ) {
				return null;
			}
			$lines[] = array(
				'id'        => (int) $item->get_id(),
				'quantity'  => (int) $item->get_quantity(),
				'total'     => wc_format_decimal( $item->get_total(), $decimals ),
				'meta_data' => array(
					array(
						'key'   => self::REFUNDED_ITEM_META,
						'value' => (string) $original,
					),
				),
			);
		}
		usort(
			$lines,
			static function ( $a, $b ) {
				return $a['id'] <=> $b['id'];
			}
		);

		return array(
			'id'               => (int) $refund->get_id(),
			'parent_id'        => $order_id,
			'date_created_gmt' => gmdate( 'Y-m-d\TH:i:s\Z', $created->getTimestamp() ),
			'amount'           => wc_format_decimal( $refund->get_amount(), $decimals ),
			'line_items'       => $lines,
		);
	}

	public static function encode_payload( array $payload ) {
		return wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	}

	/** Finds the existing Genesis webhook by name, topic and delivery URL (not by numeric id). */
	public static function resolve_webhook() {
		$store = WC_Data_Store::load( 'webhook' );
		$ids   = $store->search_webhooks( array( 'status' => 'active', 'limit' => 100 ) );
		foreach ( (array) $ids as $id ) {
			$webhook = wc_get_webhook( $id );
			if ( ! $webhook ) {
				continue;
			}
			if ( self::WEBHOOK_NAME === $webhook->get_name()
				&& self::WEBHOOK_TOPIC === $webhook->get_topic()
				&& self::target_url() === $webhook->get_delivery_url()
				&& 'active' === $webhook->get_status() ) {
				return $webhook;
			}
		}
		return null;
	}

	public static function on_refund_created( $refund_id, $args = array() ) {
		if ( ! self::environment_allowed() ) {
			self::log( 'warning', 'bridge disabled: host not allowed', array( 'refund_id' => (int) $refund_id ) );
			return;
		}
		$refund = wc_get_order( $refund_id );
		if ( ! $refund || ! is_a( $refund, 'WC_Order_Refund' ) ) {
			return;
		}
		$order_id = (int) $refund->get_parent_id();
		$params   = array( $order_id, (int) $refund_id, 1 );

		if ( function_exists( 'as_enqueue_async_action' ) ) {
			if ( function_exists( 'as_has_scheduled_action' ) && as_has_scheduled_action( self::ACTION, $params, self::GROUP ) ) {
				return;
			}
			as_enqueue_async_action( self::ACTION, $params, self::GROUP );
			return;
		}
		// Action Scheduler ships with WooCommerce; without it a single bounded attempt is made.
		self::deliver( $order_id, (int) $refund_id, self::MAX_ATTEMPTS );
	}

	public static function deliver( $order_id, $refund_id, $attempt = 1 ) {
		$order_id  = (int) $order_id;
		$refund_id = (int) $refund_id;
		$attempt   = max( 1, (int) $attempt );
		$ctx       = array( 'order_id' => $order_id, 'refund_id' => $refund_id, 'attempt' => $attempt );

		if ( ! self::environment_allowed() ) {
			self::log( 'warning', 'delivery skipped: host not allowed', $ctx );
			return;
		}
		$refund = wc_get_order( $refund_id );
		if ( ! $refund || ! is_a( $refund, 'WC_Order_Refund' ) || (int) $refund->get_parent_id() !== $order_id ) {
			self::log( 'error', 'delivery aborted: refund not found for order', $ctx );
			return;
		}
		if ( $refund->get_meta( self::DELIVERED_META ) ) {
			return;
		}
		$payload = self::build_payload( $refund );
		if ( null === $payload ) {
			self::log( 'error', 'delivery aborted: refund line not tied to an original order line', $ctx );
			$refund->update_meta_data( self::FAILED_META, 'PAYLOAD_INVALID' );
			$refund->save_meta_data();
			return;
		}
		$webhook = self::resolve_webhook();
		$secret  = $webhook ? (string) $webhook->get_secret() : '';
		if ( '' === $secret ) {
			self::fail_or_retry( $refund, $ctx, 'WEBHOOK_SECRET_UNAVAILABLE' );
			return;
		}

		$body     = self::encode_payload( $payload );
		$response = wp_remote_post(
			self::target_url(),
			array(
				'timeout'     => self::TIMEOUT_SECONDS,
				'redirection' => 0,
				'blocking'    => true,
				'headers'     => array(
					'Content-Type'              => 'application/json',
					'X-WC-Webhook-Topic'        => 'refund.created',
					'X-WC-Webhook-Signature'    => self::sign( $body, $secret ),
					'X-WC-Webhook-Delivery-ID'  => self::delivery_id( $order_id, $refund_id ),
				),
				'body'        => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			self::fail_or_retry( $refund, $ctx, 'TRANSPORT_ERROR:' . $response->get_error_code() );
			return;
		}
		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( $status >= 200 && $status < 300 ) {
			$refund->update_meta_data( self::DELIVERED_META, 1 );
			$refund->save_meta_data();
			self::log( 'info', 'refund delivered', $ctx + array( 'http_status' => $status ) );
			return;
		}
		self::fail_or_retry( $refund, $ctx, 'HTTP_' . $status );
	}

	private static function fail_or_retry( $refund, array $ctx, $reason ) {
		$ctx['reason'] = $reason;
		if ( $ctx['attempt'] < self::MAX_ATTEMPTS && function_exists( 'as_schedule_single_action' ) ) {
			$delay = self::backoff_seconds( $ctx['attempt'] );
			as_schedule_single_action(
				time() + $delay,
				self::ACTION,
				array( $ctx['order_id'], $ctx['refund_id'], $ctx['attempt'] + 1 ),
				self::GROUP
			);
			self::log( 'warning', 'refund delivery failed; retry scheduled', $ctx + array( 'retry_in_seconds' => $delay ) );
			return;
		}
		$refund->update_meta_data( self::FAILED_META, $reason );
		$refund->save_meta_data();
		self::log( 'error', 'refund delivery failed; retries exhausted', $ctx );
	}

	/** Context carries only order/refund ids, attempt, status and reason codes; never secrets or bodies. */
	private static function log( $level, $message, array $context = array() ) {
		if ( ! function_exists( 'wc_get_logger' ) ) {
			return;
		}
		wc_get_logger()->log( $level, $message . ' ' . wp_json_encode( $context ), array( 'source' => self::LOG_SOURCE ) );
	}
}
