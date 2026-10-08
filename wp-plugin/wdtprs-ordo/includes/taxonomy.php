<?php
/**
 * The "Liturgical Day" taxonomy: each prayer post is tagged with the day(s) it comments on.
 * Term slugs are derived from the bundled keys ("vo:Tempora/Pent17-0" → "ld-vo-tempora-pent17-0"),
 * so pages find posts with plain taxonomy queries on indexed tables.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'wdtprs_ordo_register_taxonomy' );

function wdtprs_ordo_register_taxonomy() {
	register_taxonomy(
		WDTPRS_ORDO_TAX,
		'post',
		array(
			'labels'            => array(
				'name'          => __( 'Liturgical Days', 'wdtprs-ordo' ),
				'singular_name' => __( 'Liturgical Day', 'wdtprs-ordo' ),
				'menu_name'     => __( 'Liturgical Days', 'wdtprs-ordo' ),
				'search_items'  => __( 'Search liturgical days', 'wdtprs-ordo' ),
				'add_new_item'  => __( 'Add liturgical day', 'wdtprs-ordo' ),
			),
			'description'       => __( 'The liturgical day(s) a prayer post comments on, used by the WDTPRS Ordo.', 'wdtprs-ordo' ),
			'hierarchical'      => false,
			// No public archive pages (yet): the Ordo pages are the public view.
			'public'            => false,
			'publicly_queryable' => false,
			'rewrite'           => false,
			'show_ui'           => true,
			'show_in_menu'      => true,
			'show_admin_column' => true,
			'show_in_rest'      => true,
			'show_tagcloud'     => false,
		)
	);
}

/** Term slug for a key. */
function wdtprs_ordo_term_slug( $key ) {
	return 'ld-' . strtolower( trim( preg_replace( '/[^A-Za-z0-9]+/', '-', $key ), '-' ) );
}

/** Term name for a key: "1962: 17th Sunday after Pentecost". */
function wdtprs_ordo_term_name( $key ) {
	$info  = wdtprs_ordo_key( $key );
	$forms = wdtprs_ordo_forms();
	$form  = $info['f'] ?? ( str_starts_with( $key, 'vo:' ) ? 'vo' : 'no' );
	return $forms[ $form ]['short'] . ': ' . ( $info['n'] ?? $key );
}

/** Slug → key, for posts tagged by hand. */
function wdtprs_ordo_key_for_slug( $slug ) {
	static $map;
	if ( null === $map ) {
		$map = array();
		foreach ( array_keys( wdtprs_ordo_data( 'keys' ) ) as $key ) {
			$map[ wdtprs_ordo_term_slug( $key ) ] = $key;
		}
	}
	return $map[ $slug ] ?? null;
}

/** Term ID for a key, creating the term if needed. */
function wdtprs_ordo_ensure_term( $key ) {
	$slug = wdtprs_ordo_term_slug( $key );
	$term = get_term_by( 'slug', $slug, WDTPRS_ORDO_TAX );
	if ( $term ) {
		return (int) $term->term_id;
	}
	$made = wp_insert_term( wdtprs_ordo_term_name( $key ), WDTPRS_ORDO_TAX, array( 'slug' => $slug ) );
	return is_wp_error( $made ) ? 0 : (int) $made['term_id'];
}

/**
 * Published post IDs tagged with any of the keys, newest first, plus how many posts each key has.
 * One query for the terms and one per group of posts; results are cached briefly.
 */
function wdtprs_ordo_posts_for_keys( array $keys, $limit = 40 ) {
	$keys = array_values( array_unique( array_filter( $keys ) ) );
	if ( ! $keys ) {
		return array();
	}
	$cache_key = 'posts_' . md5( implode( '|', $keys ) );
	$found     = wp_cache_get( $cache_key, 'wdtprs_ordo' );
	if ( false !== $found ) {
		return $found;
	}
	$q     = new WP_Query(
		array(
			'post_type'              => 'post',
			'post_status'            => 'publish',
			'posts_per_page'         => $limit,
			'orderby'                => 'date',
			'order'                  => 'DESC',
			'fields'                 => 'ids',
			'no_found_rows'          => true,
			'ignore_sticky_posts'    => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
			'tax_query'              => array(
				array(
					'taxonomy' => WDTPRS_ORDO_TAX,
					'field'    => 'slug',
					'terms'    => array_map( 'wdtprs_ordo_term_slug', $keys ),
				),
			),
		)
	);
	$found = array_map( 'intval', $q->posts );
	wp_cache_set( $cache_key, $found, 'wdtprs_ordo', 10 * MINUTE_IN_SECONDS );
	return $found;
}

/** Which of the keys have at least one tagged post (one term query). */
function wdtprs_ordo_keys_with_posts( array $keys ) {
	$keys = array_values( array_unique( array_filter( $keys ) ) );
	if ( ! $keys ) {
		return array();
	}
	$slugs = array_map( 'wdtprs_ordo_term_slug', $keys );
	$terms = get_terms(
		array(
			'taxonomy'   => WDTPRS_ORDO_TAX,
			'slug'       => $slugs,
			'hide_empty' => true,
			'fields'     => 'id=>slug',
		)
	);
	if ( is_wp_error( $terms ) ) {
		return array();
	}
	$have = array_flip( $terms );
	return array_values( array_filter( $keys, fn( $k ) => isset( $have[ wdtprs_ordo_term_slug( $k ) ] ) ) );
}

/** Keys a post is tagged with. */
function wdtprs_ordo_post_keys( $post_id ) {
	$terms = get_the_terms( $post_id, WDTPRS_ORDO_TAX );
	if ( ! $terms || is_wp_error( $terms ) ) {
		return array();
	}
	return array_values( array_filter( array_map( fn( $t ) => wdtprs_ordo_key_for_slug( $t->slug ), $terms ) ) );
}

// Clear the short-lived lookups when tags change.
add_action( 'set_object_terms', function ( $object_id, $terms, $tt_ids, $taxonomy ) {
	if ( WDTPRS_ORDO_TAX === $taxonomy ) {
		wp_cache_flush_group( 'wdtprs_ordo' );
		delete_transient( 'wdtprs_ordo_window_' . wdtprs_ordo_today() );
	}
}, 10, 4 );
