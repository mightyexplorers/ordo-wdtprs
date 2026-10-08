<?php
/**
 * Optional box at the end of tagged prayer posts (off by default; Settings → WDTPRS Ordo):
 *   "This commentary is for: 1962 · 17th Sunday after Pentecost — next on Sep 12, 2027 · Open in the Ordo"
 * Uses the post's own terms (already loaded for the page) and the bundled dates; no extra queries.
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'the_content', function ( $content ) {
	if ( ! wdtprs_ordo_option( 'post_box' ) || ! is_singular( 'post' ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}
	$keys = wdtprs_ordo_post_keys( get_the_ID() );
	if ( ! $keys ) {
		return $content;
	}
	wdtprs_ordo_enqueue();
	$forms = wdtprs_ordo_forms();
	$today = wdtprs_ordo_today();
	$rows  = '';
	foreach ( $keys as $key ) {
		$info = wdtprs_ordo_key( $key );
		if ( ! $info ) {
			continue;
		}
		$next  = wdtprs_ordo_next_date( $key, $today );
		$rows .= '<li><span class="wdtprs-ordo-tag">' . esc_html( $forms[ $info['f'] ]['short'] ) . '</span> <strong>' . esc_html( $info['n'] ) . '</strong>';
		if ( $next ) {
			$label = $next >= $today ? __( 'next on', 'wdtprs-ordo' ) : __( 'last on', 'wdtprs-ordo' );
			$rows .= ' — ' . esc_html( $label ) . ' <a href="' . esc_url( wdtprs_ordo_url( $next ) ) . '">' . esc_html( wdtprs_ordo_short_date( $next ) ) . '</a>';
		}
		$rows .= '</li>';
	}
	if ( ! $rows ) {
		return $content;
	}
	return $content . '<aside class="wdtprs-ordo wdtprs-ordo-postbox"><p class="wdtprs-ordo-eyebrow">' .
		esc_html__( 'This commentary is for', 'wdtprs-ordo' ) . '</p><ul>' . $rows . '</ul><a href="' . esc_url( wdtprs_ordo_url() ) . '">' .
		esc_html__( 'Open the WDTPRS Ordo →', 'wdtprs-ordo' ) . '</a></aside>';
}, 20 );
