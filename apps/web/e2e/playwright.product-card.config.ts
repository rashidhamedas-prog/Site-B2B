/**
 * Chromium + WebKit matrix for product-card navigation.
 * No `channel: 'chrome'` so WebKit can launch.
 *
 *   $env:E2E_BASE_URL="http://127.0.0.1:3000"
 *   $env:NODE_PATH="$env:USERPROFILE\.cache\pw-runner\node_modules"
 *   & "$env:USERPROFILE\.cache\pw-runner\node_modules\.bin\playwright.cmd" test `
 *     -c apps/web/e2e/playwright.product-card.config.ts
 */
export default {
  testDir: '.',
  testMatch: /product-card-navigation\.spec\.ts$/,
  outputDir: `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/taranom-e2e-product-card`,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
    headless: true,
    locale: 'fa-IR',
    serviceWorkers: 'block',
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
};
