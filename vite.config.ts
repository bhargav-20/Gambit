import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Project Pages live at https://<user>.github.io/<repo>/, so all asset URLs
  // need the repo name as a prefix. Vite uses this for both `index.html`
  // injection and `import.meta.env.BASE_URL`, which the Stockfish loader
  // reads — so don't change one without the other. The PWA manifest's
  // start_url and scope below also need the same prefix.
  base: '/Shatran/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' lets us show a user-facing "Update available" banner
      // instead of auto-reloading mid-move when a new SW takes over.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/Shatran/',
        name: 'Shatran — Chess Visualizer',
        short_name: 'Shatran',
        description:
          'Openings, puzzles, famous games, PvP, position editor, analysis, and video export — fully client-side.',
        start_url: '/Shatran/',
        scope: '/Shatran/',
        display: 'standalone',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        orientation: 'any',
        categories: ['games', 'entertainment', 'education'],
        icons: [
          // SVG is accepted by modern Chrome (113+) for install prompts and
          // scales to any size losslessly. `purpose: 'any maskable'` lets a
          // single asset cover both the regular and adaptive-icon slots —
          // the SVG already has a rounded background (favicon.svg) so the
          // mask just trims a corner radius, which looks fine.
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache the built shell + Stockfish so engine analysis works
        // fully offline. Excluding ffmpeg + the ~21 MB ONNX runtime that
        // ships with kokoro keeps install lean (~7 MB vs ~60 MB); both
        // get cache-on-use via runtimeCaching below.
        globPatterns: ['**/*.{js,css,html,svg,woff2,wasm}'],
        globIgnores: [
          '**/ffmpeg/**',
          // Vite hashes these — match by prefix.
          '**/assets/ort-wasm-*',
          '**/assets/kokoro-*',
        ],
        // Stockfish WASM is ~7 MB, well above Workbox's 2 MB default cap.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // HashRouter means every route serves the same shell — perfect for
        // a single-page navigation fallback.
        navigateFallback: '/Shatran/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // ffmpeg core (~31 MB) — cache on first use, keep forever-ish.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/Shatran/ffmpeg/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'shatran-ffmpeg',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            // Kokoro's JS bundle + the ONNX runtime WASM it depends on —
            // both hashed under /Shatran/assets/. Cache on first narration.
            // (Inline match below keeps `/assets/...` agnostic of base path.)
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/assets\/(ort-wasm-|kokoro-)/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'shatran-kokoro-runtime',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Kokoro TTS model from HuggingFace — large (~20 MB), pinned.
            urlPattern: /^https:\/\/huggingface\.co\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'shatran-kokoro-model',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts stylesheet — small and may rev URLs, SWR is right.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'shatran-google-fonts-css' },
          },
          {
            // Google Fonts woff2 binaries — long-lived, cache-first.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'shatran-google-fonts-files',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        // Keep dev server fast — verify PWA via `npm run preview`.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
