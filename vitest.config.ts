import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      GATEWAY_DELAY_FACTOR: '0',
      COOKIE_SECRET: 'test-cookie-secret',
    },
  },
})
