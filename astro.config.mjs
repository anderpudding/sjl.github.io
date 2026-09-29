// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
    // Static output; deployed to Cloudflare Pages (build: `npm run build`, output: `dist`).
    output: 'static',
    // Absolute base for og:url / og:image (link previews need full URLs).
    site: 'https://lee.sungjun-dev.workers.dev',
    trailingSlash: 'ignore',
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
