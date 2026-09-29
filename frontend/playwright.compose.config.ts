import { defineConfig } from '@playwright/test'

// The Compose stack must already be healthy; exercise the compiled client and proxy.
export default defineConfig({
  testDir: './e2e-compose',
  workers: 1,
  use: { baseURL: process.env.COMPOSE_BASE_URL ?? 'http://127.0.0.1:5173', viewport: { width: 960, height: 540 } },
})
