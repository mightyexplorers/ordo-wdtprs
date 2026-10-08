<?php
// wp eval-file: imports data/raw/posts.json (the real wdtprs.com prayer posts) with their real IDs.
$raw = json_decode( file_get_contents( '/import/posts.json' ), true );
kses_remove_filters();
$n = 0;
foreach ( $raw['posts'] as $p ) {
	if ( get_post( $p['id'] ) ) continue;
	$id = wp_insert_post( array(
		'import_id'    => $p['id'],
		'post_title'   => wp_specialchars_decode( $p['title']['rendered'], ENT_QUOTES ),
		'post_content' => $p['content']['rendered'],
		'post_date'    => str_replace( 'T', ' ', $p['date'] ),
		'post_status'  => 'publish',
		'post_author'  => 1,
	), true );
	if ( ! is_wp_error( $id ) ) $n++;
}
echo "imported $n posts\n";
