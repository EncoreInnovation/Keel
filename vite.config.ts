import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'COLOSSUS',
        short_name: 'COLOSSUS',
        description: 'Personal training OS',
        theme_color: '#08080A',
        background_color: '#08080A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          // Raster sizes first: iOS/Android home-screen install doesn't
          // reliably rasterize the SVG for a touch icon, so a bare SVG-only
          // manifest silently produces a blank icon on install. The SVG stays
          // last as a crisp fallback for browsers that do support it.
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // The catalog and its imagery must be available on the gym floor with
        // no signal — and so must posture scan's pose model and WASM
        // runtime, vendored under public/mediapipe/ specifically so this
        // feature doesn't depend on a CDN being reachable at scan time.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,wasm,task}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
