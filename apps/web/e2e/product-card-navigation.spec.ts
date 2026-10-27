/**
 * Product card click must reach /products/<slug> quickly with no Illegal invocation.
 *
 * Run against a local Next build that includes this fix:
 *   $env:E2E_BASE_URL="http://127.0.0.1:3000"
 *   $env:NODE_PATH="$env:USERPROFILE\.cache\pw-runner\node_modules"
 *   & "$env:USERPROFILE\.cache\pw-runner\node_modules\.bin\playwright.cmd" test `
 *     -c apps/web/e2e/playwright.product-card.config.ts
 */
import { test, expect, type Page } from '@playwright/test';
import { guardProductionHosts, mockApi, watchPageErrors, hydrationErrors } from './support.cjs';

const ORIGIN = (process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').replace('localhost', '127.0.0.1');
// Retail storefront is selected by host (next.config beforeFiles), same as
// production .ir. Cookie-only rewrite on 127.0.0.1 301s through /retail and
// comes back as wholesale. localhost.ir is the repo's local retail host.
const RETAIL_ORIGIN = process.env.E2E_RETAIL_ORIGIN || 'http://localhost.ir:3000';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const CHANNELS = [
  {
    name: 'wholesale',
    listPath: '/products',
    retailCookie: false,
    origin: ORIGIN,
  },
  {
    name: 'retail',
    listPath: '/products',
    retailCookie: true,
    origin: RETAIL_ORIGIN,
  },
] as const;

const NAV_BUDGET_MS = 1_500;

async function openListing(page: Page, listPath: string, retailCookie: boolean, origin: string) {
  const hostname = new URL(origin).hostname;
  await page.context().addCookies([
    {
      name: 'taranom_channel',
      value: retailCookie ? 'retail' : 'wholesale',
      domain: hostname,
      path: '/',
      sameSite: 'Lax',
      secure: false,
      httpOnly: false,
    },
  ]);
  await mockApi(page);
  const productionLeaks = await guardProductionHosts(page);
  const errors = watchPageErrors(page);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err));
  });

  await page.addInitScript(() => {
    const w = window as unknown as {
      __tnVtFinishedMs?: number | null;
      __tnVtStarted?: boolean;
    };
    w.__tnVtFinishedMs = null;
    w.__tnVtStarted = false;
    const proto = Document.prototype as Document & {
      startViewTransition?: (cb: () => void | Promise<void>) => {
        finished: Promise<void>;
        skipTransition?: () => void;
      };
    };
    const original = proto.startViewTransition;
    if (typeof original !== 'function') return;
    proto.startViewTransition = function patched(this: Document, cb) {
      w.__tnVtStarted = true;
      const t0 = performance.now();
      const transition = original.call(this, cb);
      void transition.finished.finally(() => {
        w.__tnVtFinishedMs = performance.now() - t0;
      });
      return transition;
    };
  });

  const res = await page.goto(listPath, { waitUntil: 'domcontentloaded' });
  expect(res?.ok() || (res?.status() ?? 0) < 400 || res?.status() === 304, `listing ${listPath}`).toBeTruthy();
  await page.waitForLoadState('load');

  // Wholesale puts tn-media on the link. Retail puts the link inside .tn-media.
  const card = page
    .locator(
      'article.tn-card a.tn-media[href^="/products/"], article.tn-card .tn-media a[href^="/products/"]',
    )
    .first();
  await expect(card, 'at least one product card media link').toBeVisible();
  const href = await card.getAttribute('href');
  expect(href, 'card href').toMatch(/^\/products\/[^/?#]+/);

  // Warm SSR/dynamic compile for the destination so the click budget
  // measures client navigation, not first-hit Next compile.
  await page.request.get(new URL(href!, origin).toString());

  const path = href!.split(/[?#]/)[0]!;
  await card.dispatchEvent('pointerenter');
  await card.dispatchEvent('touchstart');
  await card.hover({ force: true }).catch(() => undefined);
  // Prefetch is the signal the card route is warm. Resource timing is already
  // populated when Next prefetched the in-view link during load.
  await page
    .waitForFunction(
      (productPath) =>
        performance.getEntriesByType('resource').some((entry) => entry.name.includes(productPath)),
      path,
      { timeout: 3_000 },
    )
    .catch(() => undefined);

  const clickAt = Date.now();
  const urlPattern = new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#]|$)`);
  await Promise.all([
    page.waitForURL(urlPattern, { timeout: NAV_BUDGET_MS }),
    card.click({ force: true }),
  ]);
  const urlMs = Date.now() - clickAt;
  expect(urlMs, `URL changed within ${NAV_BUDGET_MS}ms (took ${urlMs}ms)`).toBeLessThanOrEqual(NAV_BUDGET_MS);
  await expect(page).toHaveURL(urlPattern);

  const heading = page.locator('h1:visible', { hasText: 'مانتو آزمون کتان' }).first();
  await expect(heading, 'product h1 visible').toBeVisible({ timeout: Math.max(100, NAV_BUDGET_MS - urlMs) });
  const totalMs = Date.now() - clickAt;
  expect(totalMs, `h1 visible within ${NAV_BUDGET_MS}ms (took ${totalMs}ms)`).toBeLessThanOrEqual(NAV_BUDGET_MS);

  const vt = await page.evaluate(() => {
    const w = window as unknown as { __tnVtStarted?: boolean; __tnVtFinishedMs?: number | null };
    return { started: Boolean(w.__tnVtStarted), finishedMs: w.__tnVtFinishedMs ?? null };
  });
  if (vt.started && vt.finishedMs != null) {
    expect(vt.finishedMs, `VT finished under 1000ms (was ${vt.finishedMs}ms)`).toBeLessThan(1_000);
  }

  expect(hydrationErrors(errors), 'no hydration errors').toEqual([]);
  const illegal = consoleErrors.filter((t) => /Illegal invocation/i.test(t));
  expect(illegal, 'no Illegal invocation during card navigation').toEqual([]);
  const pageExceptions = consoleErrors.filter((t) =>
    /TypeError|ReferenceError|SyntaxError/i.test(t),
  );
  expect(pageExceptions, 'no script exceptions during card navigation').toEqual([]);
  expect(productionLeaks, 'no browser request reached poshaktaranom.com').toEqual([]);
}

for (const viewport of VIEWPORTS) {
  for (const channel of CHANNELS) {
    test(`${channel.name} ${viewport.name} card → /products/<slug> ≤1.5s`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'fa-IR',
        baseURL: channel.origin,
      });
      const page = await context.newPage();
      try {
        await openListing(page, channel.listPath, channel.retailCookie, channel.origin);
      } finally {
        await context.close();
      }
    });
  }
}

test('manifest icons respond 200', async ({ request }) => {
  for (const path of ['/icon-192.png', '/icon-512.png', '/manifest.json']) {
    const res = await request.get(new URL(path, ORIGIN).toString());
    expect(res.status(), path).toBe(200);
  }
});
