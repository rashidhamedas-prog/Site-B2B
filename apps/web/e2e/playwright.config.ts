/**
 * GA4 / checkout e2e. `@playwright/test` is NOT a repo dependency; run with an external runner:
 *   $env:NODE_PATH="$env:USERPROFILE\.cache\pw-runner\node_modules"
 *   & "$env:USERPROFILE\.cache\pw-runner\node_modules\.bin\playwright.cmd" test -c apps/web/e2e/playwright.config.ts
 *
 * E2E_BASE_URL (default http://localhost:3000):
 * - local origin → Chrome maps poshaktaranom.com / www.poshaktaranom.ir to it, so host-gated GA runs
 *   against local code. Every API call is mocked in the browser.
 * - https://poshaktaranom.com → production, read-only: non-GET API calls are mocked or aborted.
 * GA collect hits are captured and answered locally (never forwarded to Google).
 */
const base = new URL(process.env.E2E_BASE_URL || 'http://localhost:3000');
const isLocal = ['localhost', '127.0.0.1'].includes(base.hostname);
const localTarget = `127.0.0.1:${base.port || '80'}`;
// Optional VPN proxy for Google hosts only (e.g. http://127.0.0.1:10808); site hosts always go direct.
const proxy = process.env.E2E_PROXY;
const proxyArgs = proxy
  ? [
      `--proxy-server=${proxy}`,
      '--proxy-bypass-list=poshaktaranom.com;*.poshaktaranom.com;www.poshaktaranom.ir;*.poshaktaranom.ir;localhost;127.0.0.1',
    ]
  : ['--no-proxy-server'];

process.env.E2E_MODE = isLocal ? 'local' : 'prod';
process.env.E2E_WHOLESALE_ORIGIN = isLocal ? 'http://poshaktaranom.com' : base.origin;

export default {
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/taranom-e2e-results`,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WHOLESALE_ORIGIN,
    channel: 'chrome',
    headless: true,
    locale: 'fa-IR',
    viewport: { width: 1366, height: 900 },
    serviceWorkers: 'block',
    trace: 'off',
    launchOptions: {
      args: isLocal
        ? [
            `--host-resolver-rules=MAP poshaktaranom.com ${localTarget}, MAP www.poshaktaranom.ir ${localTarget}`,
            ...proxyArgs,
          ]
        : proxyArgs,
    },
  },
};
