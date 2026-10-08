<?php
// Local testing only: appends query count, query time and build time to each front-end page.
add_action( 'shutdown', function () {
	if ( is_admin() || wp_doing_ajax() || ! defined( 'SAVEQUERIES' ) ) return;
	global $wpdb;
	$t = 0; foreach ( (array) $wpdb->queries as $q ) $t += $q[1];
	printf( "\n<!-- perf: queries=%d query_ms=%.1f total_ms=%.1f -->", count( (array) $wpdb->queries ), $t * 1000, ( microtime( true ) - $_SERVER['REQUEST_TIME_FLOAT'] ) * 1000 );
}, 9999 );
