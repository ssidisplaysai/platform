<?php
/**
 * Plugin Name: STONER Share-to-Grow Attribution Bridge
 * Description: Verifies Genesis attribution tokens, persists attribution, supports durable collaborator routes, and writes canonical metadata when Woo checkout is active.
 * Version: 1.0.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/includes/class-stoner-s2g-attribution-bridge.php';

add_action( 'plugins_loaded', array( 'Stoner_S2G_Attribution_Bridge', 'register' ), 20 );
