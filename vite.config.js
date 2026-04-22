import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// 2단계에서 PWA 플러그인 추가 예정
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({ ... })  ← 2단계에서 추가
  ],
  esbuild: {
    // .js 파일 안에 JSX 문법이 있어도 처리 (CRA와 달리 Vite는 기본적으로 .jsx만 처리)
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'dist',
    // 청크 크기 경고 기준 (현재는 모노리스라 크게 나옴 — 3단계에서 개선)
    chunkSizeWarningLimit: 2000,
  },
  // Vercel api/ 폴더는 Vite가 건드리지 않음 — 그대로 작동
  server: {
    port: 3000,
  },
})
