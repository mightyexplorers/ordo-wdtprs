#!/bin/sh
# One-time setup of the local test site.
set -e
wp() { docker compose run --rm cli wp "$@"; }
until docker compose exec -T db mariadb -uwp -pwp -e 'select 1' wp >/dev/null 2>&1; do sleep 2; done
wp core install --url=http://localhost:8085 --title="WDTPRS (local)" --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email
wp rewrite structure '/%year%/%monthnum%/%postname%/' --hard
wp eval-file /dev-scripts/import-posts.php
wp plugin activate wdtprs-ordo
