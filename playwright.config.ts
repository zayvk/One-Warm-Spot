import { defineConfig } from '@playwright/test';

const PORT = 5180;

/**
 * End-to-end tests drive the real game (React + PixiJS canvas) in the locally
 * installed Google Chrome. Specs live in `e2e/*.e2e.ts` so Vitest never picks them up.
 * The viewport matches the 1376×768 stage art, so normalized scene coords map 1:1.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    viewport: { width: 1376, height: 768 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    launchOptions: {
      /* Let Web Audio run without a real user gesture prompt */
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
