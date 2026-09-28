// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
    // Static output; deployed to Cloudflare Pages (build: `npm run build`, output: `dist`).
    output: 'static',
    trailingSlash: 'ignore',
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
