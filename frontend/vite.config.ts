import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  server: { proxy: { '/api': loadEnv(mode, '.', 'VITE_').VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8080' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
