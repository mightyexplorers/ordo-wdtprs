<?php
/**
 * HTML for the Ordo: day view, month grid and post cards. Markup is plain and classed
 * "wdtprs-ordo-*"; colors and fonts come from CSS custom properties a theme can override.
 */

defined( 'ABSPATH' ) || exit;

function wdtprs_ordo_url( $path = '' ) {
	$base = trailingslashit( home_url( wdtprs_ordo_option( 'page_slug', 'ordo' ) ) );
	return $path ? $base . trailingslashit( $path ) : $base;
}

function wdtprs_ordo_long_date( $date ) {
	return wp_date( 'l, F j, Y', strtotime( $date . ' 12:00:00 UTC' ), new DateTimeZone( 'UTC' ) );
}

function wdtprs_ordo_short_date( $date ) {
	return wp_date( 'M j, Y', strtotime( $date . ' 12:00:00 UTC' ), new DateTimeZone( 'UTC' ) );
}

function wdtprs_ordo_swatch( $color ) {
	if ( ! $color ) {
		return '';
	}
	return sprintf(
		'<span class="wdtprs-ordo-swatch" style="--lit:var(--ordo-%1$s)" title="%2$s"></span>',
		esc_attr( strtolower( $color ) ),
		esc_attr( wdtprs_ordo_color_name( $color ) )
	);
}

/** Groups post IDs so reposts of the same commentary sit under the newest copy. */
function wdtprs_ordo_collapse( array $ids ) {
	$info   = wdtprs_ordo_data( 'posts' );
	$groups = array();
	foreach ( $ids as $id ) {
		$i    = $info[ $id ] ?? array();
		$k    = ( $i['p'] ?? '' ) . '|' . ( $i['i'] ?? $id );
		if ( isset( $groups[ $k ] ) ) {
			$groups[ $k ]['reposts'][] = $id;
		} else {
			$groups[ $k ] = array( 'id' => $id, 'reposts' => array() );
		}
	}
	return array_values( $groups );
}

/** Excerpt without running the_content filters (cheap, and no shortcodes or embeds). */
function wdtprs_ordo_excerpt( WP_Post $post, $words = 55 ) {
	$text = $post->post_excerpt ? $post->post_excerpt : $post->post_content;
	$text = strip_shortcodes( $text );
	// Also drop shortcodes from plugins that are no longer active ([display_podcast] etc.).
	$text = preg_replace( '/\[\/?[a-z_][\w-]*(?:\s[^\]]*)?\]/i', ' ', $text );
	$text = preg_replace( '#<(blockquote|script|style)\b[^>]*>.*?</\1>#is', ' ', $text );
	return wp_trim_words( wp_strip_all_tags( $text ), $words, '…' );
}

function wdtprs_ordo_post_card( array $group, $compact = false ) {
	$post = get_post( $group['id'] );
	if ( ! $post ) {
		return '';
	}
	$info = wdtprs_ordo_data( 'posts' )[ $post->ID ] ?? array();
	$out  = '<article class="wdtprs-ordo-card">';
	$out .= '<div class="wdtprs-ordo-meta">';
	if ( ! empty( $info['p'] ) ) {
		$out .= '<span class="wdtprs-ordo-tag">' . esc_html( $info['p'] ) . '</span> ';
	}
	$out .= '<span>' . esc_html( get_the_date( 'M j, Y', $post ) ) . '</span></div>';
	$out .= '<h4 class="wdtprs-ordo-card-title"><a href="' . esc_url( get_permalink( $post ) ) . '">' . esc_html( get_the_title( $post ) ) . '</a></h4>';
	if ( ! $compact ) {
		if ( ! empty( $info['la'] ) ) {
			$out .= '<blockquote class="wdtprs-ordo-latin" lang="la">' . esc_html( $info['la'] ) . '</blockquote>';
		}
		if ( ! empty( $info['li'] ) ) {
			$out .= '<div class="wdtprs-ordo-literal"><span class="wdtprs-ordo-eyebrow">' . esc_html__( 'Literal rendering', 'wdtprs-ordo' ) . '</span><p>' . esc_html( $info['li'] ) . '</p></div>';
		}
		$out .= '<p class="wdtprs-ordo-excerpt">' . esc_html( wdtprs_ordo_excerpt( $post ) ) . '</p>';
	}
	$out .= '<a class="wdtprs-ordo-read" href="' . esc_url( get_permalink( $post ) ) . '">' . esc_html__( 'Read the post →', 'wdtprs-ordo' ) . '</a>';
	if ( $group['reposts'] ) {
		$links = array_map(
			fn( $id ) => '<a href="' . esc_url( get_permalink( $id ) ) . '">' . esc_html( get_the_date( 'M j, Y', $id ) ) . '</a>',
			$group['reposts']
		);
		$out .= '<p class="wdtprs-ordo-reposts">' . esc_html__( 'Also posted:', 'wdtprs-ordo' ) . ' ' . implode( ' · ', $links ) . '</p>';
	}
	return $out . '</article>';
}

/** Posts for one calendar's side of a day, grouped: own, alternates, the week's Sunday, same prayer. */
function wdtprs_ordo_groups( $entry ) {
	if ( ! $entry ) {
		return array();
	}
	$seen   = array();
	$take   = function ( array $keys ) use ( &$seen ) {
		$ids = array_values( array_diff( wdtprs_ordo_posts_for_keys( $keys ), $seen ) );
		$seen = array_merge( $seen, $ids );
		return $ids;
	};
	$groups = array();
	$own    = $take( $entry['k'] ?? array() );
	if ( $own ) {
		$groups[] = array( 'title' => __( 'Commentary for this day', 'wdtprs-ordo' ), 'ids' => $own );
	}
	foreach ( $entry['a'] ?? array() as $alt ) {
		list( $key, $name, $kind ) = $alt;
		$ids = $take( array( $key ) );
		if ( $ids ) {
			$groups[] = array(
				/* translators: %s: name of a commemorated saint or feast */
				'title' => 'c' === $kind ? sprintf( __( 'Commemoration: %s', 'wdtprs-ordo' ), $name ) : $name,
				'note'  => 's' === $kind ? __( 'The 1962 calendar kept this day before the 2020 additions for the USA.', 'wdtprs-ordo' ) : '',
				'ids'   => $ids,
			);
		}
	}
	if ( ! empty( $entry['w'] ) ) {
		$ids = $take( array( $entry['w'] ) );
		if ( $ids ) {
			$groups[] = array(
				/* translators: %s: name of the preceding Sunday */
				'title' => sprintf( __( 'From %s', 'wdtprs-ordo' ), $entry['wn'] ),
				'note'  => __( 'On weekdays without their own proper, the Mass takes the Sunday’s prayers.', 'wdtprs-ordo' ),
				'ids'   => $ids,
			);
		}
	}
	// Posts about the same Latin prayer (often the same collect in the other Missal).
	$info     = wdtprs_ordo_data( 'posts' );
	$incipits = wdtprs_ordo_data( 'incipits' );
	$same     = array();
	foreach ( $seen as $id ) {
		foreach ( $incipits[ $info[ $id ]['i'] ?? '' ] ?? array() as $other ) {
			if ( ! in_array( $other, $seen, true ) && ! in_array( $other, $same, true ) && 'publish' === get_post_status( $other ) ) {
				$same[] = $other;
			}
		}
	}
	if ( $same ) {
		$groups[] = array( 'title' => __( 'The same prayer, discussed elsewhere', 'wdtprs-ordo' ), 'ids' => $same, 'compact' => true );
	}
	// Load every post on the page in one query instead of one per card.
	_prime_post_caches( array_merge( $seen, $same ), false, false );
	return $groups;
}

function wdtprs_ordo_column( $form, $entry, $date ) {
	$forms = wdtprs_ordo_forms();
	$out   = '<section class="wdtprs-ordo-column" style="--lit:var(--ordo-' . esc_attr( strtolower( $entry['c'] ?? 'none' ) ) . ')">';
	$out  .= '<header class="wdtprs-ordo-column-head"><div class="wdtprs-ordo-eyebrow">' . esc_html( $forms[ $form ]['label'] . ' · ' . $forms[ $form ]['sub'] ) . '</div>';
	if ( ! $entry ) {
		return $out . '<h3>' . esc_html__( 'Not available', 'wdtprs-ordo' ) . '</h3></header></section>';
	}
	$out .= '<h3 class="wdtprs-ordo-day-name">' . wdtprs_ordo_swatch( $entry['c'] ?? '' ) . ' ' . esc_html( $entry['n'] ) . '</h3>';
	// romcal ranks come as "OPT_MEMORIAL"; 1962 ranks as "III class".
	$rank = $entry['r'] ?? '';
	if ( 'no' === $form && $rank ) {
		$rank = ucfirst( strtolower( str_replace( '_', ' ', $rank ) ) );
	}
	$bits = array_filter( array( $rank, $entry['cn'] ?? wdtprs_ordo_color_name( $entry['c'] ?? '' ), $entry['s'] ?? '', $entry['y'] ?? '' ) );
	$out .= '<p class="wdtprs-ordo-details">' . esc_html( implode( ' · ', $bits ) ) . '</p>';
	if ( ! empty( $entry['x'] ) ) {
		$out .= '<p class="wdtprs-ordo-details">' . esc_html__( 'Also:', 'wdtprs-ordo' ) . ' ' . esc_html( implode( '; ', $entry['x'] ) ) . '</p>';
	}
	foreach ( $entry['a'] ?? array() as $alt ) {
		$label = 'c' === $alt[2] ? __( 'Commemoration of', 'wdtprs-ordo' ) : __( 'In the 1962 calendar before the 2020 additions:', 'wdtprs-ordo' );
		$out  .= '<p class="wdtprs-ordo-details">' . esc_html( $label . ' ' . $alt[1] ) . '</p>';
	}
	$link = 'vo' === $form
		? array( $entry['l'] ?? '', __( 'Mass texts at Divinum Officium ↗', 'wdtprs-ordo' ) )
		: array( sprintf( 'https://bible.usccb.org/bible/readings/%s.cfm', gmdate( 'mdy', strtotime( $date . ' 12:00 UTC' ) ) ), __( 'Readings at USCCB ↗', 'wdtprs-ordo' ) );
	if ( $link[0] ) {
		$out .= '<p class="wdtprs-ordo-links"><a href="' . esc_url( $link[0] ) . '" rel="noopener">' . esc_html( $link[1] ) . '</a></p>';
	}
	$out .= '</header>';

	$groups = wdtprs_ordo_groups( $entry );
	foreach ( $groups as $g ) {
		$out .= '<div class="wdtprs-ordo-group"><h4 class="wdtprs-ordo-group-title">' . esc_html( $g['title'] ) . '</h4>';
		if ( ! empty( $g['note'] ) ) {
			$out .= '<p class="wdtprs-ordo-note">' . esc_html( $g['note'] ) . '</p>';
		}
		foreach ( wdtprs_ordo_collapse( $g['ids'] ) as $group ) {
			$out .= wdtprs_ordo_post_card( $group, ! empty( $g['compact'] ) );
		}
		$out .= '</div>';
	}
	if ( ! $groups ) {
		$out .= '<p class="wdtprs-ordo-empty">' . esc_html__( 'No commentary is linked to this day yet.', 'wdtprs-ordo' ) . '</p>';
	}
	return $out . '</section>';
}

function wdtprs_ordo_render_day( $date ) {
	$day                 = wdtprs_ordo_day( $date );
	list( $first, $last ) = wdtprs_ordo_range();
	$prev                = gmdate( 'Y-m-d', strtotime( $date . ' -1 day' ) );
	$next                = gmdate( 'Y-m-d', strtotime( $date . ' +1 day' ) );

	$out  = '<div class="wdtprs-ordo wdtprs-ordo-dayview">';
	$out .= '<div class="wdtprs-ordo-head"><div><div class="wdtprs-ordo-eyebrow">' . esc_html__( 'Ordo for', 'wdtprs-ordo' ) . '</div>';
	$out .= '<h2 class="wdtprs-ordo-date">' . esc_html( wdtprs_ordo_long_date( $date ) ) . '</h2></div><nav class="wdtprs-ordo-nav">';
	if ( $prev >= $first ) {
		$out .= '<a class="wdtprs-ordo-button" href="' . esc_url( wdtprs_ordo_url( $prev ) ) . '">' . esc_html__( '← Previous day', 'wdtprs-ordo' ) . '</a>';
	}
	$out .= '<a class="wdtprs-ordo-button" href="' . esc_url( wdtprs_ordo_url( substr( $date, 0, 7 ) ) ) . '">' . esc_html__( 'Month', 'wdtprs-ordo' ) . '</a>';
	$out .= '<input type="date" class="wdtprs-ordo-jump" aria-label="' . esc_attr__( 'Jump to date', 'wdtprs-ordo' ) . '" value="' . esc_attr( $date ) . '" min="' . esc_attr( $first ) . '" max="' . esc_attr( $last ) . '" data-base="' . esc_url( wdtprs_ordo_url() ) . '">';
	if ( $next <= $last ) {
		$out .= '<a class="wdtprs-ordo-button" href="' . esc_url( wdtprs_ordo_url( $next ) ) . '">' . esc_html__( 'Next day →', 'wdtprs-ordo' ) . '</a>';
	}
	$out .= '</nav></div>';
	if ( ! $day ) {
		return $out . '<p>' . esc_html__( 'This date is outside the calendar years included in the Ordo.', 'wdtprs-ordo' ) . '</p></div>';
	}
	$out .= '<div class="wdtprs-ordo-columns">' . wdtprs_ordo_column( 'vo', $day['vo'] ?? null, $date ) . wdtprs_ordo_column( 'no', $day['no'] ?? null, $date ) . '</div>';
	return $out . '</div>';
}

function wdtprs_ordo_render_month( $ym ) {
	list( $first, $last ) = wdtprs_ordo_range();
	$start                = $ym . '-01';
	$days_in              = (int) gmdate( 't', strtotime( $start . ' 12:00 UTC' ) );
	$lead                 = (int) gmdate( 'w', strtotime( $start . ' 12:00 UTC' ) );
	$prev                 = gmdate( 'Y-m', strtotime( $start . ' -1 month' ) );
	$next                 = gmdate( 'Y-m', strtotime( $start . ' +1 month' ) );

	// One term query for the whole month: which days have commentary.
	$keys = array();
	$days = array();
	for ( $d = 1; $d <= $days_in; $d++ ) {
		$date          = sprintf( '%s-%02d', $ym, $d );
		$days[ $date ] = wdtprs_ordo_day( $date );
		foreach ( array( 'vo', 'no' ) as $f ) {
			$e = $days[ $date ][ $f ] ?? null;
			if ( $e ) {
				$keys = array_merge( $keys, $e['k'] ?? array(), array_column( $e['a'] ?? array(), 0 ) );
			}
		}
	}
	$have = array_flip( wdtprs_ordo_keys_with_posts( $keys ) );
	$has  = fn( $e ) => $e && ( array_intersect_key( array_flip( array_merge( $e['k'] ?? array(), array_column( $e['a'] ?? array(), 0 ) ) ), $have ) );

	$out  = '<div class="wdtprs-ordo wdtprs-ordo-monthview">';
	$out .= '<div class="wdtprs-ordo-head"><h2 class="wdtprs-ordo-date">' . esc_html( wp_date( 'F Y', strtotime( $start . ' 12:00 UTC' ), new DateTimeZone( 'UTC' ) ) ) . '</h2><nav class="wdtprs-ordo-nav">';
	if ( $prev . '-01' >= substr( $first, 0, 8 ) . '01' ) {
		$out .= '<a class="wdtprs-ordo-button" href="' . esc_url( wdtprs_ordo_url( $prev ) ) . '" aria-label="' . esc_attr__( 'Previous month', 'wdtprs-ordo' ) . '">←</a>';
	}
	if ( $next . '-01' <= $last ) {
		$out .= '<a class="wdtprs-ordo-button" href="' . esc_url( wdtprs_ordo_url( $next ) ) . '" aria-label="' . esc_attr__( 'Next month', 'wdtprs-ordo' ) . '">→</a>';
	}
	$out .= '</nav></div>';
	$out .= '<p class="wdtprs-ordo-legend">' . esc_html__( 'Top bar: 1962 color · bottom bar: current calendar color · ● commentary for the day', 'wdtprs-ordo' ) . '</p>';
	$out .= '<div class="wdtprs-ordo-grid">';
	foreach ( array( 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ) as $w ) {
		$out .= '<div class="wdtprs-ordo-dow">' . esc_html( $w ) . '</div>';
	}
	$out .= str_repeat( '<div class="wdtprs-ordo-cell is-blank"></div>', $lead );
	foreach ( $days as $date => $day ) {
		$vo   = $day['vo'] ?? null;
		$no   = $day['no'] ?? null;
		$out .= sprintf(
			'<a class="wdtprs-ordo-cell" href="%s" data-date="%s" style="--vo:var(--ordo-%s);--no:var(--ordo-%s)">',
			esc_url( wdtprs_ordo_url( $date ) ),
			esc_attr( $date ),
			esc_attr( strtolower( $vo['c'] ?? 'none' ) ),
			esc_attr( strtolower( $no['c'] ?? 'none' ) )
		);
		$out .= '<span class="wdtprs-ordo-num">' . (int) substr( $date, 8 ) . '</span>';
		if ( $vo ) {
			$out .= '<span class="wdtprs-ordo-name is-vo">' . ( $has( $vo ) ? '<i class="wdtprs-ordo-dot is-vo"></i>' : '' ) . esc_html( $vo['n'] ) . '</span>';
		}
		if ( $no ) {
			$out .= '<span class="wdtprs-ordo-name is-no">' . ( $has( $no ) ? '<i class="wdtprs-ordo-dot is-no"></i>' : '' ) . esc_html( $no['n'] ) . '</span>';
		}
		$out .= '</a>';
	}
	return $out . '</div></div>';
}
