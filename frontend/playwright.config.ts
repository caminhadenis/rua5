import { defineConfig } from '@playwright/test'

const backendPort = process.env.E2E_BACKEND_PORT ?? '8080'
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '5174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: `http://127.0.0.1:${frontendPort}`, viewport: { width: 960, height: 540 } },
  webServer: [...(process.env.E2E_REUSE_BACKEND === '1' ? [] : [{
    command: '../backend/gradlew -p ../backend bootRun',
    url: `http://127.0.0.1:${backendPort}/health`,
    env: { SERVER_PORT: backendPort },
    reuseExistingServer: false,
    timeout: 120_000,
  }]), {
    command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: `http://127.0.0.1:${frontendPort}`,
    env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
    reuseExistingServer: false,
  }],
})
