import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://mightyexplorers.github.io/ordo-wdtprs/
export default defineConfig({
  site: process.env.SITE_URL || 'https://mightyexplorers.github.io',
  base: process.env.BASE_PATH ?? '/ordo-wdtprs',
  trailingSlash: 'always',
  build: { concurrency: 4 },
});
