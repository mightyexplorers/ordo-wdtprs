<?php
/**
 * "Today in the Liturgy" widget (classic widget, so it works in any sidebar).
 *
 * Built for a page-cached site: the widget carries a small table of the days around today
 * (±7) inside the page, and a few lines of JavaScript pick the reader's own date from it.
 * A cached page therefore stays correct for days, with no extra request per page view.
 * The table is built once a day (transient), with one term query for the commentary flags.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'widgets_init', fn() => register_widget( 'WDTPRS_Ordo_Today_Widget' ) );

/** Days around $center for the widget: date => [vo|no => [n, c, has]]. */
function wdtprs_ordo_window( $center, $span = 7 ) {
	$cache = 'wdtprs_ordo_window_' . $center;
	$win   = get_transient( $cache );
	if ( false !== $win ) {
		return $win;
	}
	$win  = array();
	$keys = array();
	for ( $i = -$span; $i <= $span; $i++ ) {
		$date = gmdate( 'Y-m-d', strtotime( "$center 12:00 UTC $i day" ) );
		$day  = wdtprs_ordo_day( $date );
		if ( ! $day ) {
			continue;
		}
		foreach ( array( 'vo', 'no' ) as $f ) {
			if ( ! empty( $day[ $f ] ) ) {
				$keys = array_merge( $keys, $day[ $f ]['k'] ?? array(), array_column( $day[ $f ]['a'] ?? array(), 0 ), array( $day[ $f ]['w'] ?? '' ) );
			}
		}
		$win[ $date ] = $day;
	}
	$have = array_flip( wdtprs_ordo_keys_with_posts( $keys ) );
	$out  = array();
	foreach ( $win as $date => $day ) {
		foreach ( array( 'vo', 'no' ) as $f ) {
			$e = $day[ $f ] ?? null;
			if ( ! $e ) {
				continue;
			}
			$own                = array_merge( $e['k'] ?? array(), array_column( $e['a'] ?? array(), 0 ) );
			$out[ $date ][ $f ] = array(
				'n' => $e['n'],
				'c' => strtolower( $e['c'] ?? '' ),
				'h' => (bool) array_intersect_key( array_flip( $own ), $have ) ? 2 : ( isset( $have[ $e['w'] ?? '' ] ) ? 1 : 0 ),
			);
		}
	}
	set_transient( $cache, $out, DAY_IN_SECONDS );
	return $out;
}

/** The widget/strip markup; also usable from a theme: echo wdtprs_ordo_today_html(); */
function wdtprs_ordo_today_html( $title = '' ) {
	wdtprs_ordo_enqueue();
	wp_enqueue_script( 'wdtprs-ordo', WDTPRS_ORDO_URL . 'assets/ordo.js', array(), WDTPRS_ORDO_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );
	$today = wdtprs_ordo_today();
	$win   = wdtprs_ordo_window( $today );
	$day   = $win[ $today ] ?? null;
	$forms = wdtprs_ordo_forms();

	$out = '<div class="wdtprs-ordo wdtprs-ordo-today" data-base="' . esc_url( wdtprs_ordo_url() ) . '" data-today="' . esc_attr( $today ) . '">';
	if ( $title ) {
		$out .= '<h3 class="wdtprs-ordo-today-title">' . esc_html( $title ) . '</h3>';
	}
	$out .= '<p class="wdtprs-ordo-today-date" data-slot="date">' . esc_html( wdtprs_ordo_long_date( $today ) ) . '</p>';
	foreach ( array( 'vo', 'no' ) as $f ) {
		$e    = $day[ $f ] ?? null;
		$out .= '<p class="wdtprs-ordo-today-row" data-slot="' . $f . '" style="--lit:var(--ordo-' . esc_attr( $e['c'] ?? 'none' ) . ')">';
		$out .= '<span class="wdtprs-ordo-swatch"></span>';
		$out .= '<span class="wdtprs-ordo-today-form">' . esc_html( $forms[ $f ]['short'] ) . '</span>';
		$out .= '<span class="wdtprs-ordo-today-text"><span class="wdtprs-ordo-today-name">' . esc_html( $e['n'] ?? '—' ) . '</span>';
		$out .= '<span class="wdtprs-ordo-today-has"' . ( empty( $e['h'] ) ? ' hidden' : '' ) . '> · ' . esc_html__( 'commentary', 'wdtprs-ordo' ) . '</span></span></p>';
	}
	$out .= '<a class="wdtprs-ordo-today-link" data-slot="link" href="' . esc_url( wdtprs_ordo_url( $today ) ) . '">' . esc_html__( 'Open today’s Ordo →', 'wdtprs-ordo' ) . '</a>';
	$out .= '<script type="application/json" class="wdtprs-ordo-window">' . wp_json_encode( $win ) . '</script>';
	return $out . '</div>';
}

class WDTPRS_Ordo_Today_Widget extends WP_Widget {
	public function __construct() {
		parent::__construct(
			'wdtprs_ordo_today',
			__( 'Today in the Liturgy (WDTPRS Ordo)', 'wdtprs-ordo' ),
			array( 'description' => __( 'Today’s day in the 1962 and current calendars, with its liturgical colors and a link to the Ordo.', 'wdtprs-ordo' ) )
		);
	}

	public function widget( $args, $instance ) {
		$title = $instance['title'] ?? __( 'Today in the Liturgy', 'wdtprs-ordo' );
		echo $args['before_widget'];
		if ( $title ) {
			echo $args['before_title'] . esc_html( apply_filters( 'widget_title', $title, $instance, $this->id_base ) ) . $args['after_title'];
		}
		echo wdtprs_ordo_today_html(); // Escaped in wdtprs_ordo_today_html().
		echo $args['after_widget'];
	}

	public function form( $instance ) {
		$title = $instance['title'] ?? __( 'Today in the Liturgy', 'wdtprs-ordo' );
		printf(
			'<p><label for="%1$s">%2$s</label><input class="widefat" id="%1$s" name="%3$s" type="text" value="%4$s"></p>',
			esc_attr( $this->get_field_id( 'title' ) ),
			esc_html__( 'Title:', 'wdtprs-ordo' ),
			esc_attr( $this->get_field_name( 'title' ) ),
			esc_attr( $title )
		);
	}

	public function update( $new, $old ) {
		return array( 'title' => sanitize_text_field( $new['title'] ?? '' ) );
	}
}
