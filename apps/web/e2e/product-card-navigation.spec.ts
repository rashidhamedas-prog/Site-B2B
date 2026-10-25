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
  // /retail/products 301s to /products; wait for the catalog shell.
  await page.waitForLoadState('load');

  const card = page.locator('article.tn-card a[href^="/products/"]').first();
  try {
    await expect(card, 'at least one product card link').toBeVisible({ timeout: 30_000 });
  } catch {
    // Cookie/channel race on the redirect: land on /products with retail cookie.
    if (retailCookie) {
      await page.goto('/products', { waitUntil: 'domcontentloaded' });
    }
    await expect(card, 'at least one product card link after retry').toBeVisible({ timeout: 30_000 });
  }
  const href = await card.getAttribute('href');
  expect(href, 'card href').toMatch(/^\/products\/[^/?#]+/);

  // Warm SSR/dynamic compile for the destination so the 1.5s click budget
  // measures client navigation, not first-hit Next compile.
  await page.request.get(new URL(href!, ORIGIN).toString());

  // Warm the client route (hover on desktop, pointer/touch on mobile).
  await card.dispatchEvent('pointerenter');
  await card.dispatchEvent('touchstart');
  await card.hover({ force: true }).catch(() => undefined);
  await page.waitForTimeout(300);

  const clickAt = Date.now();
  await card.click({ force: true });

  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#]|$)`), {
    timeout: 1_500,
  });
  const urlMs = Date.now() - clickAt;
  expect(urlMs, `URL changed within 1500ms (took ${urlMs}ms)`).toBeLessThanOrEqual(1_500);

  const heading = page.locator('h1').first();
  await expect(heading, 'product h1 visible').toBeVisible({ timeout: Math.max(100, 1_500 - urlMs) });
  const totalMs = Date.now() - clickAt;
  expect(totalMs, `h1 visible within 1500ms (took ${totalMs}ms)`).toBeLessThanOrEqual(1_500);

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
}

for (const viewport of VIEWPORTS) {
  for (const channel of CHANNELS) {
    test(`${channel.name} ${viewport.name} card → /products/<slug> ≤1.5s`, async ({ browser }) => {
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

test('manifest icons respond 200', async ({ request }) => {
  for (const path of ['/icon-192.png', '/icon-512.png', '/manifest.json']) {
    const res = await request.get(new URL(path, ORIGIN).toString());
    expect(res.status(), path).toBe(200);
  }
});
