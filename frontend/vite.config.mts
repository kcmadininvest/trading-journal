import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';

/** Mode léger pour e2e / machines à faible RAM : pas de checker TS/ESLint en process. */
const e2eLight = process.env.VITE_E2E_LIGHT === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(!e2eLight
      ? [
          checker({
            typescript: true,
            eslint: {
              lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
              useFlatConfig: true,
            },
            overlay: { initialIsOpen: false },
          }),
        ]
      : []),
  ],
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['lightweight-charts'],
  },
  server: {
    port: 3000,
    headers: {
      // Qualif : éviter un cache HTTP agressif sur les assets d'icônes
      'Cache-Control': 'no-store',
    },
    watch: {
      ignored: [
        '**/node_modules.cra.backup/**',
        '**/build.cra.backup/**',
        '**/coverage/**',
      ],
    },
    proxy: {
      // Qualif Daphne écoute typiquement 8001 (voir start-daphne.sh)
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/media': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/admin': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_DEV_PROXY_WS_TARGET || 'ws://127.0.0.1:8001',
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'node_modules.cra.backup/**', 'build/**'],
  },
});
