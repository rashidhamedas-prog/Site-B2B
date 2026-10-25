/**
 * Product card click must reach /products/<slug> with no Illegal invocation.
 *
 * Run against a local Next build that includes this fix:
 *   $env:E2E_BASE_URL="http://127.0.0.1:3000"
 *   $env:NODE_PATH="$env:USERPROFILE\.cache\pw-runner\node_modules"
 *   & "$env:USERPROFILE\.cache\pw-runner\node_modules\.bin\playwright.cmd" test `
 *     -c apps/web/e2e/playwright.product-card.config.ts
 */
import { test, expect, type Page } from '@playwright/test';
import { mockApi, watchPageErrors, hydrationErrors } from './support.cjs';

const ORIGIN = (process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').replace('localhost', '127.0.0.1');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const CHANNELS = [
  {
    name: 'wholesale',
    listPath: '/products',
    retailCookie: false,
  },
  {
    name: 'retail',
    // Public retail listing is /products after middleware strips /retail.
    listPath: '/retail/products',
    retailCookie: true,
  },
] as const;

async function openListing(page: Page, listPath: string, retailCookie: boolean) {
  if (retailCookie) {
    await page.context().addCookies([
      {
        name: 'taranom_channel',
        value: 'retail',
        url: ORIGIN,
      },
    ]);
  }
  await mockApi(page, { passthroughGets: true });
  const errors = watchPageErrors(page);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err));
  });

  const res = await page.goto(listPath, { waitUntil: 'domcontentloaded' });
  expect(res?.ok() || (res?.status() ?? 0) < 400 || res?.status() === 304, `listing ${listPath}`).toBeTruthy();

  const card = page.locator('article.tn-card a[href^="/products/"]').first();
  await expect(card, 'at least one product card link').toBeVisible({ timeout: 60_000 });
  const href = await card.getAttribute('href');
  expect(href, 'card href').toMatch(/^\/products\/[^/?#]+/);

  await card.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#]|$)`), {
    timeout: 60_000,
  });
  expect(page.url()).toMatch(/\/products\/[^/?#]+/);
  expect(hydrationErrors(errors), 'no hydration errors').toEqual([]);
  const illegal = consoleErrors.filter((t) => /Illegal invocation/i.test(t));
  expect(illegal, 'no Illegal invocation during card navigation').toEqual([]);
  const pageExceptions = consoleErrors.filter((t) =>
    /TypeError|ReferenceError|SyntaxError/i.test(t),
  );
  expect(pageExceptions, 'no script exceptions during card navigation').toEqual([]);
}

for (const viewport of VIEWPORTS) {
  for (const channel of CHANNELS) {
    test(`${channel.name} ${viewport.name} card → /products/<slug>`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'fa-IR',
        baseURL: ORIGIN,
      });
      const page = await context.newPage();
      try {
        await openListing(page, channel.listPath, channel.retailCookie);
      } finally {
        await context.close();
      }
    });
  }
}
