export default {
  testDir: '.',
  testMatch: /product-video\.spec\.ts$/,
  outputDir: `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/taranom-e2e-product-video`,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3104',
    headless: true,
    locale: 'fa-IR',
    serviceWorkers: 'block',
    trace: 'off',
  },
  webServer: [
    {
      command: 'node product-video-mock-api.cjs',
      url: 'http://127.0.0.1:4014/v1/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm --prefix .. run dev -- --hostname 0.0.0.0 --port 3104',
      url: 'http://127.0.0.1:3104/products/video-product',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_INTERNAL_URL: 'http://127.0.0.1:4014/v1',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4014/v1',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--no-proxy-server',
            '--host-resolver-rules=MAP localhost.ir 127.0.0.1',
            '--proxy-bypass-list=localhost.ir;127.0.0.1',
          ],
        },
      },
    },
  ],
};
