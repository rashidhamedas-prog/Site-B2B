import { test, expect } from '@playwright/test';
import {
  CART_ITEM,
  RETAIL_GA4,
  TEST_TOKEN,
  WHOLESALE_GA4,
  captureCollect,
  describeHit,
  gtagEvents,
  hydrationErrors,
  installGtagSpy,
  mockApi,
  seedStorage,
  waitForGtag,
  watchPageErrors,
} from './support.cjs';

type Hit = Record<string, string>;
type GtagEvent = { name: string; params: Record<string, unknown> };

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript(installGtagSpy);
  const hits: Hit[] = await captureCollect(page);
  const api = await mockApi(page);
  const errors: string[] = watchPageErrors(page);
  return { hits, api, errors };
}

function checkoutPageViews(events: GtagEvent[]) {
  return events.filter((e) => String(e.params.page_path || '').split('?')[0] === '/checkout');
}

async function assertSinglePageView(page: import('@playwright/test').Page, hits: Hit[]) {
  await waitForGtag(page, (log: unknown[][]) =>
    log.some((a) => a[0] === 'event' && a[1] === 'page_view'),
  );
  const pageViews: GtagEvent[] = await gtagEvents(page, 'page_view');
  const forCheckout = checkoutPageViews(pageViews);
  expect(forCheckout, 'exactly one gtag page_view for /checkout').toHaveLength(1);
  expect(forCheckout[0]!.params.send_to).toBe(WHOLESALE_GA4);
  const all: GtagEvent[] = await gtagEvents(page);
  expect(all.filter((e) => e.params.send_to === RETAIL_GA4), 'no events to the retail stream').toHaveLength(0);

  // Network: never the retail stream. Hit counts are asserted in tracking.spec (GTM container check).
  await page.waitForTimeout(1_000);
  for (const hit of hits) {
    console.log(`[ga-hit] ${test.info().title}: ${describeHit(hit)}`);
  }
  expect(hits.filter((h) => h.tid === RETAIL_GA4), 'no collect hits to retail tid').toHaveLength(0);
}

test.describe('direct /checkout load', () => {
  test('server HTML (JS disabled) is a visible shell, never blank', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    const res = await page.goto('/checkout');
    expect(res?.status()).toBe(200);
    await expect(page.getByText('در حال بارگذاری…')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(1);
    await context.close();
  });

  test('guest (empty storage) sees a visible message and is sent to login', async ({ page }) => {
    const { hits, errors } = await setup(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __e2eSawGuest?: boolean };
      const check = () => {
        if (document.body?.innerText.includes('در حال انتقال به صفحه ورود')) w.__e2eSawGuest = true;
      };
      new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/portal\/login\?redirect=(%2F|\/)checkout/, { timeout: 30_000 });
    const sawGuest = await page.evaluate(() => (window as unknown as { __e2eSawGuest?: boolean }).__e2eSawGuest === true);
    expect(sawGuest, 'guest message was rendered before redirect').toBe(true);
    expect(hydrationErrors(errors), 'no hydration error').toEqual([]);
    await assertSinglePageView(page, hits);
  });

  test('logged-in + empty cart shows the empty state with a /products link', async ({ page }) => {
    const { hits, errors } = await setup(page);
    await seedStorage(page, { token: TEST_TOKEN });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'مشاهده محصولات' })).toHaveAttribute('href', '/products');
    await expect(page).toHaveURL(/\/checkout$/);
    expect(hydrationErrors(errors), 'no React #418').toEqual([]);
    await assertSinglePageView(page, hits);
  });

  test('logged-in + saved cart renders checkout UI and keeps the cart', async ({ page }) => {
    const { hits, errors } = await setup(page);
    await seedStorage(page, { token: TEST_TOKEN, cart: [CART_ITEM] });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'تسویه حساب عمده' })).toBeVisible();
    await expect(page.getByText(CART_ITEM.productName).first()).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('taranom_cart'));
    expect(JSON.parse(stored || '[]'), 'saved cart not wiped on hydrate').toHaveLength(1);
    expect(hydrationErrors(errors), 'no React #418').toEqual([]);
    await assertSinglePageView(page, hits);
  });
});
