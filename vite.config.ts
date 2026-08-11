import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
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
