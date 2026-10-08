<?php
/**
 * Plugin Name: WDTPRS Ordo
 * Description: Arranges "What Does The Prayer Really Say?" commentary by liturgical day, in the 1962 (2020 USA) and current calendars: an Ordo page, a "Today in the Liturgy" widget and an optional box on prayer posts.
 * Version: 0.1.0
 * Requires PHP: 8.0
 * Requires at least: 6.4
 * Author: Dan O'Reilly
 * License: GPL-2.0-or-later
 * Text Domain: wdtprs-ordo
 *
 * Nothing shows on the site until the Ordo page is published, the widget is placed, or the
 * post box is switched on (Settings → WDTPRS Ordo). Calendar data ships in data/ as PHP
 * arrays, so page views make no outside requests and no extra database work beyond a
 * couple of small taxonomy queries on uncached pages.
 */

defined( 'ABSPATH' ) || exit;

define( 'WDTPRS_ORDO_VERSION', '0.1.0' );
define( 'WDTPRS_ORDO_DIR', plugin_dir_path( __FILE__ ) );
define( 'WDTPRS_ORDO_URL', plugin_dir_url( __FILE__ ) );
define( 'WDTPRS_ORDO_TAX', 'liturgical_day' );

require_once WDTPRS_ORDO_DIR . 'includes/data.php';
require_once WDTPRS_ORDO_DIR . 'includes/taxonomy.php';
require_once WDTPRS_ORDO_DIR . 'includes/render.php';
require_once WDTPRS_ORDO_DIR . 'includes/routes.php';
require_once WDTPRS_ORDO_DIR . 'includes/widget.php';
require_once WDTPRS_ORDO_DIR . 'includes/post-box.php';
if ( is_admin() ) {
	require_once WDTPRS_ORDO_DIR . 'includes/admin.php';
}

register_activation_hook( __FILE__, function () {
	wdtprs_ordo_register_taxonomy();
	wdtprs_ordo_add_rewrites();
	flush_rewrite_rules();
} );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

function wdtprs_ordo_option( $name, $default = null ) {
	$opts = get_option( 'wdtprs_ordo', array() );
	return $opts[ $name ] ?? $default;
}

function wdtprs_ordo_enqueue() {
	wp_enqueue_style( 'wdtprs-ordo', WDTPRS_ORDO_URL . 'assets/ordo.css', array(), WDTPRS_ORDO_VERSION );
}
