<?php
/**
 * Plugin Name: Genesis Share-to-Grow Refund Bridge
 * Description: Sends real WooCommerce refunds to the Genesis Share-to-Grow webhook as refund.created. Staging-host gated.
 * Version: 1.0.0
 * Requires Plugins: woocommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/includes/class-genesis-s2g-refund-bridge.php';

add_action( 'plugins_loaded', array( 'Genesis_S2G_Refund_Bridge', 'register' ), 20 );
