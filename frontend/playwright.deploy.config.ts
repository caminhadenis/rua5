import { defineConfig } from '@playwright/test'

// Run against an already healthy cloud image, with production authentication enabled.
export default defineConfig({
  testDir: './e2e-deploy',
  workers: 1,
  use: { baseURL: process.env.DEPLOY_BASE_URL ?? 'http://127.0.0.1:5176', viewport: { width: 960, height: 540 } },
})
