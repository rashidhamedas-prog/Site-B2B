/**
 * Admin product-video panel (UI-SPEC §1). Every API call is mocked in the browser.
 *
 *   cd apps/web; npx next dev -p 3013 -H 127.0.0.1
 *   $env:E2E_BASE_URL="http://127.0.0.1:3013"
 *   npx playwright test -c apps/web/e2e/playwright.admin-video.config.ts   (from the repo root)
 * Use the repo's `playwright` package; mixing it with the external pw-runner loads two copies
 * of @playwright/test and no tests are collected.
 */
export default {
  testDir: '.',
  testMatch: /admin-product-video\.spec\.ts$/,
  outputDir: `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/taranom-e2e-admin-video`,
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
    viewport: { width: 1366, height: 900 },
    serviceWorkers: 'block',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
};
