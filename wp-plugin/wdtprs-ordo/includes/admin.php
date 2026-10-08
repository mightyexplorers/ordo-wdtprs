<?php
/**
 * Settings → WDTPRS Ordo: status, the one-time tag import (batched, resumable), removing all
 * Ordo tags, creating the Ordo page as a draft, and the post-box switch.
 */

defined( 'ABSPATH' ) || exit;

const WDTPRS_ORDO_BATCH = 50;

add_action( 'admin_menu', function () {
	add_options_page( __( 'WDTPRS Ordo', 'wdtprs-ordo' ), __( 'WDTPRS Ordo', 'wdtprs-ordo' ), 'manage_options', 'wdtprs-ordo', 'wdtprs_ordo_admin_page' );
} );

add_action( 'admin_init', function () {
	register_setting(
		'wdtprs_ordo',
		'wdtprs_ordo',
		array(
			'type'              => 'array',
			'sanitize_callback' => function ( $in ) {
				$old  = get_option( 'wdtprs_ordo', array() );
				$slug = sanitize_title( $in['page_slug'] ?? 'ordo' ) ?: 'ordo';
				if ( $slug !== ( $old['page_slug'] ?? 'ordo' ) ) {
					update_option( 'wdtprs_ordo_flush', 1 );
				}
				return array(
					'post_box'  => ! empty( $in['post_box'] ),
					'page_slug' => $slug,
				);
			},
		)
	);
} );

// Re-register rewrites after the page slug changes.
add_action( 'init', function () {
	if ( get_option( 'wdtprs_ordo_flush' ) ) {
		delete_option( 'wdtprs_ordo_flush' );
		flush_rewrite_rules();
	}
}, 99 );

/** One import batch: tags posts that have no Liturgical Day yet; never overrides hand-made tags. */
add_action( 'wp_ajax_wdtprs_ordo_import', function () {
	check_ajax_referer( 'wdtprs_ordo_import' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( 'forbidden', 403 );
	}
	$all    = wdtprs_ordo_data( 'assignments' );
	$ids    = array_keys( $all );
	$offset = max( 0, (int) ( $_POST['offset'] ?? 0 ) );
	$done   = array( 'tagged' => 0, 'skipped' => 0, 'missing' => 0 );
	foreach ( array_slice( $ids, $offset, WDTPRS_ORDO_BATCH ) as $post_id ) {
		if ( ! get_post( $post_id ) ) {
			++$done['missing'];
			continue;
		}
		if ( wp_get_object_terms( $post_id, WDTPRS_ORDO_TAX, array( 'fields' => 'ids' ) ) ) {
			++$done['skipped'];
			continue;
		}
		$terms = array_filter( array_map( 'wdtprs_ordo_ensure_term', $all[ $post_id ] ) );
		// Sets terms directly: no post update, so no save hooks, revisions or cache purges.
		wp_set_object_terms( $post_id, array_values( $terms ), WDTPRS_ORDO_TAX );
		++$done['tagged'];
	}
	$next = $offset + WDTPRS_ORDO_BATCH;
	wp_send_json_success( array_merge( $done, array( 'next' => $next < count( $ids ) ? $next : null, 'total' => count( $ids ) ) ) );
} );

/** Removes every Liturgical Day term (and so every Ordo tag), in batches. */
add_action( 'wp_ajax_wdtprs_ordo_remove', function () {
	check_ajax_referer( 'wdtprs_ordo_remove' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( 'forbidden', 403 );
	}
	$terms = get_terms( array( 'taxonomy' => WDTPRS_ORDO_TAX, 'hide_empty' => false, 'fields' => 'ids', 'number' => 100 ) );
	foreach ( $terms as $t ) {
		wp_delete_term( $t, WDTPRS_ORDO_TAX );
	}
	$left = (int) wp_count_terms( array( 'taxonomy' => WDTPRS_ORDO_TAX, 'hide_empty' => false ) );
	wp_send_json_success( array( 'removed' => count( $terms ), 'left' => $left ) );
} );

add_action( 'admin_post_wdtprs_ordo_create_page', function () {
	check_admin_referer( 'wdtprs_ordo_create_page' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'forbidden' );
	}
	$slug = wdtprs_ordo_option( 'page_slug', 'ordo' );
	$page = get_page_by_path( $slug );
	if ( ! $page ) {
		$id = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'draft',
				'post_title'   => __( 'WDTPRS Ordo', 'wdtprs-ordo' ),
				'post_name'    => $slug,
				'post_content' => '<!-- wp:shortcode -->[wdtprs_ordo]<!-- /wp:shortcode -->',
			)
		);
	}
	wp_safe_redirect( admin_url( 'post.php?action=edit&post=' . ( $page->ID ?? $id ) ) );
	exit;
} );

function wdtprs_ordo_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	list( $first, $last ) = wdtprs_ordo_range();
	$assign               = wdtprs_ordo_data( 'assignments' );
	$terms                = (int) wp_count_terms( array( 'taxonomy' => WDTPRS_ORDO_TAX, 'hide_empty' => false ) );
	$tagged               = (int) ( new WP_Query( array( 'post_type' => 'post', 'post_status' => 'any', 'fields' => 'ids', 'posts_per_page' => 1, 'tax_query' => array( array( 'taxonomy' => WDTPRS_ORDO_TAX, 'operator' => 'EXISTS' ) ) ) ) )->found_posts;
	$slug                 = wdtprs_ordo_option( 'page_slug', 'ordo' );
	$page                 = get_page_by_path( $slug );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'WDTPRS Ordo', 'wdtprs-ordo' ); ?></h1>

		<h2><?php esc_html_e( 'Status', 'wdtprs-ordo' ); ?></h2>
		<table class="widefat striped" style="max-width:720px">
			<tr><td><?php esc_html_e( 'Calendar years included', 'wdtprs-ordo' ); ?></td><td><?php echo esc_html( substr( $first, 0, 4 ) . '–' . substr( $last, 0, 4 ) ); ?></td></tr>
			<tr><td><?php esc_html_e( 'Posts the matcher placed on a day', 'wdtprs-ordo' ); ?></td><td><?php echo esc_html( number_format_i18n( count( $assign ) ) ); ?></td></tr>
			<tr><td><?php esc_html_e( 'Posts tagged with a Liturgical Day', 'wdtprs-ordo' ); ?></td><td><?php echo esc_html( number_format_i18n( $tagged ) ); ?> (<?php echo esc_html( sprintf( _n( '%s day', '%s days', $terms, 'wdtprs-ordo' ), number_format_i18n( $terms ) ) ); ?>)</td></tr>
			<tr><td><?php esc_html_e( 'Ordo page', 'wdtprs-ordo' ); ?></td><td>
				<?php if ( $page ) : ?>
					<a href="<?php echo esc_url( get_edit_post_link( $page ) ); ?>"><?php echo esc_html( get_the_title( $page ) ); ?></a> (<?php echo esc_html( get_post_status( $page ) ); ?>)
					<?php if ( 'publish' === $page->post_status ) : ?> · <a href="<?php echo esc_url( wdtprs_ordo_url() ); ?>"><?php esc_html_e( 'View', 'wdtprs-ordo' ); ?></a><?php endif; ?>
				<?php else : ?>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="wdtprs_ordo_create_page"><?php wp_nonce_field( 'wdtprs_ordo_create_page' ); ?>
						<?php submit_button( __( 'Create the Ordo page (as a draft)', 'wdtprs-ordo' ), 'secondary', 'submit', false ); ?>
					</form>
				<?php endif; ?>
			</td></tr>
		</table>

		<h2><?php esc_html_e( '1. Tag the posts', 'wdtprs-ordo' ); ?></h2>
		<p><?php esc_html_e( 'Adds the Liturgical Day tags the matcher found. Posts that already have a Liturgical Day are left alone, so corrections made by hand are never overwritten. Runs in small batches and only sets tags (no post updates, no cache purges); it is safe to stop and run again.', 'wdtprs-ordo' ); ?></p>
		<p><button type="button" class="button button-primary" id="wdtprs-ordo-import"><?php esc_html_e( 'Tag posts', 'wdtprs-ordo' ); ?></button> <span id="wdtprs-ordo-import-status"></span></p>

		<h2><?php esc_html_e( '2. Settings', 'wdtprs-ordo' ); ?></h2>
		<form method="post" action="options.php">
			<?php settings_fields( 'wdtprs_ordo' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php esc_html_e( 'Ordo page address', 'wdtprs-ordo' ); ?></th>
					<td><code><?php echo esc_html( trailingslashit( home_url() ) ); ?></code><input name="wdtprs_ordo[page_slug]" value="<?php echo esc_attr( $slug ); ?>" class="regular-text" style="width:10em"><code>/</code>
					<p class="description"><?php esc_html_e( 'Must match the slug of the page that contains [wdtprs_ordo].', 'wdtprs-ordo' ); ?></p></td></tr>
				<tr><th scope="row"><?php esc_html_e( 'Box on prayer posts', 'wdtprs-ordo' ); ?></th>
					<td><label><input type="checkbox" name="wdtprs_ordo[post_box]" value="1" <?php checked( wdtprs_ordo_option( 'post_box' ) ); ?>> <?php esc_html_e( 'At the end of tagged posts, show the liturgical day(s) and the next date each falls on.', 'wdtprs-ordo' ); ?></label></td></tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<h2><?php esc_html_e( '3. Widget', 'wdtprs-ordo' ); ?></h2>
		<p><?php esc_html_e( 'Appearance → Widgets → “Today in the Liturgy (WDTPRS Ordo)”. A theme can also print it with wdtprs_ordo_today_html().', 'wdtprs-ordo' ); ?></p>

		<h2><?php esc_html_e( 'Undo', 'wdtprs-ordo' ); ?></h2>
		<p><label><input type="checkbox" id="wdtprs-ordo-remove-ok"> <?php esc_html_e( 'Remove every Liturgical Day tag from every post (posts themselves are not changed).', 'wdtprs-ordo' ); ?></label></p>
		<p><button type="button" class="button" id="wdtprs-ordo-remove" disabled><?php esc_html_e( 'Remove all Ordo tags', 'wdtprs-ordo' ); ?></button> <span id="wdtprs-ordo-remove-status"></span></p>
	</div>
	<script>
	(() => {
		const post = (action, nonce, body = {}) => fetch(ajaxurl, {
			method: 'POST', credentials: 'same-origin',
			body: new URLSearchParams({ action, _ajax_nonce: nonce, ...body }),
		}).then((r) => r.json());
		const imp = document.getElementById('wdtprs-ordo-import');
		const impStatus = document.getElementById('wdtprs-ordo-import-status');
		imp.addEventListener('click', async () => {
			imp.disabled = true;
			const sum = { tagged: 0, skipped: 0, missing: 0 };
			let offset = 0;
			try {
				while (offset !== null) {
					const r = await post('wdtprs_ordo_import', <?php echo wp_json_encode( wp_create_nonce( 'wdtprs_ordo_import' ) ); ?>, { offset });
					if (!r.success) throw new Error(r.data || 'failed');
					for (const k in sum) sum[k] += r.data[k];
					offset = r.data.next;
					impStatus.textContent = `${Math.min(offset ?? r.data.total, r.data.total)} / ${r.data.total} — tagged ${sum.tagged}, already tagged ${sum.skipped}, not found ${sum.missing}`;
				}
				impStatus.textContent += ' ✓';
			} catch (e) { impStatus.textContent += ` — stopped: ${e.message}. Click again to continue.`; imp.disabled = false; }
		});
		const ok = document.getElementById('wdtprs-ordo-remove-ok');
		const rm = document.getElementById('wdtprs-ordo-remove');
		const rmStatus = document.getElementById('wdtprs-ordo-remove-status');
		ok.addEventListener('change', () => { rm.disabled = !ok.checked; });
		rm.addEventListener('click', async () => {
			rm.disabled = true;
			let left = 1;
			while (left > 0) {
				const r = await post('wdtprs_ordo_remove', <?php echo wp_json_encode( wp_create_nonce( 'wdtprs_ordo_remove' ) ); ?>);
				if (!r.success) { rmStatus.textContent = 'stopped'; return; }
				left = r.data.removed ? r.data.left : 0;
				rmStatus.textContent = `${left} left`;
			}
			rmStatus.textContent = 'All Ordo tags removed ✓';
		});
	})();
	</script>
	<?php
}
