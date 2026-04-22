import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', '*.png'],
      manifest: {
        name: '밀론 — 히브리어 단어장',
        short_name: '밀론',
        description: '히브리어 단어 암기, 퀴즈, 학습 분석',
        theme_color: '#17161C',
        background_color: '#17161C',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'ko',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // 캐시할 파일 패턴
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // 오프라인 시 fallback
        navigateFallback: '/index.html',
        // 큰 파일도 캐시 (현재 App.js가 큼 — 3단계에서 개선)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Firebase API 요청 캐시 (네트워크 우선)
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Google Fonts 캐시
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 3000,
  },
})
