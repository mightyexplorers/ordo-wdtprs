<?php
/**
 * The Ordo lives on an ordinary WordPress page (default slug "ordo") containing [wdtprs_ordo].
 *   /ordo/             → forwards to today's date in the reader's own time zone
 *   /ordo/2026-10-08/  → day view
 *   /ordo/2026-10/     → month grid
 * Every URL is a normal page view, so the page cache serves repeat visits.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'wdtprs_ordo_add_rewrites' );
add_filter( 'query_vars', fn( $vars ) => array_merge( $vars, array( 'ordo_date' ) ) );
add_shortcode( 'wdtprs_ordo', 'wdtprs_ordo_shortcode' );

function wdtprs_ordo_add_rewrites() {
	$slug = preg_quote( wdtprs_ordo_option( 'page_slug', 'ordo' ), '#' );
	add_rewrite_rule( "^{$slug}/(\\d{4}-\\d{2}(?:-\\d{2})?)/?$", 'index.php?pagename=' . wdtprs_ordo_option( 'page_slug', 'ordo' ) . '&ordo_date=$matches[1]', 'top' );
}

/** The date or month being viewed, limited to the bundled range; null on the bare page. */
function wdtprs_ordo_requested() {
	$v = get_query_var( 'ordo_date' );
	if ( ! $v || ! preg_match( '/^(\d{4})-(\d{2})(?:-(\d{2}))?$/', $v, $m ) || ! checkdate( (int) $m[2], (int) ( $m[3] ?? 1 ), (int) $m[1] ) ) {
		return null;
	}
	list( $first, $last ) = wdtprs_ordo_range();
	$cmp = strlen( $v ) === 7 ? $v . '-01' : $v;
	return ( $cmp < substr( $first, 0, 7 ) . '-01' || $cmp > $last ) ? null : $v;
}

function wdtprs_ordo_shortcode() {
	wdtprs_ordo_enqueue();
	wp_enqueue_script( 'wdtprs-ordo', WDTPRS_ORDO_URL . 'assets/ordo.js', array(), WDTPRS_ORDO_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );
	$v = wdtprs_ordo_requested();
	if ( $v && strlen( $v ) === 10 ) {
		return wdtprs_ordo_render_day( $v );
	}
	if ( $v ) {
		return wdtprs_ordo_render_month( $v );
	}
	// Bare page: the script forwards to the reader's today; without JavaScript, show this month.
	$today = wdtprs_ordo_today();
	return '<div class="wdtprs-ordo-forward" data-base="' . esc_url( wdtprs_ordo_url() ) . '"></div>' . wdtprs_ordo_render_month( substr( $today, 0, 7 ) );
}

// Day and month views get their own titles and canonical URLs.
add_filter( 'document_title_parts', function ( $parts ) {
	$v = is_page( wdtprs_ordo_option( 'page_slug', 'ordo' ) ) ? wdtprs_ordo_requested() : null;
	if ( $v ) {
		$parts['title'] = strlen( $v ) === 10
			? wdtprs_ordo_long_date( $v )
			: wp_date( 'F Y', strtotime( $v . '-01 12:00 UTC' ), new DateTimeZone( 'UTC' ) );
	}
	return $parts;
} );
add_filter( 'get_canonical_url', function ( $url, $post ) {
	$v = wdtprs_ordo_requested();
	return ( $v && $post->post_name === wdtprs_ordo_option( 'page_slug', 'ordo' ) ) ? wdtprs_ordo_url( $v ) : $url;
}, 10, 2 );

// Search engines index about a year back and two years ahead; older and later days stay
// reachable for readers but are marked noindex, so crawlers don't churn through ~4,400 pages.
add_filter( 'wp_robots', function ( $robots ) {
	$v = wdtprs_ordo_requested();
	if ( $v ) {
		$date  = strlen( $v ) === 7 ? $v . '-01' : $v;
		$today = wdtprs_ordo_today();
		if ( $date < gmdate( 'Y-m-d', strtotime( "$today -1 year" ) ) || $date > gmdate( 'Y-m-d', strtotime( "$today +2 years" ) ) ) {
			$robots['noindex'] = true;
			$robots['follow']  = true;
		}
	}
	return $robots;
} );

// Dates outside the bundled years are 404s, so crawlers can't wander off the calendar.
add_action( 'template_redirect', function () {
	if ( get_query_var( 'ordo_date' ) && ! wdtprs_ordo_requested() ) {
		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
	}
} );
