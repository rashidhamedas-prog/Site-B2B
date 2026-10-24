import { test, expect, type Page } from '@playwright/test';
import {
  CART_ITEM,
  MODE,
  RETAIL_GA4,
  TEST_TOKEN,
  WHOLESALE_GA4,
  captureCollect,
  describeHit,
  gtagEvents,
  gtagLog,
  hydrationErrors,
  installGtagSpy,
  mockApi,
  seedStorage,
  waitForGtag,
  watchPageErrors,
} from './support.cjs';

type Hit = Record<string, string>;
type GtagEvent = { name: string; params: Record<string, unknown> };

const LEAD_KEYS = ['lead_type', 'cta_location', 'business_type', 'referral', 'payment_type', 'send_to'];
const ECOMMERCE_KEYS = [
  'currency', 'value', 'items', 'transaction_id', 'shipping', 'shipping_tier', 'payment_type',
  'item_list_id', 'item_list_name', 'coupon', 'cart_fp', 'cart_age_days', 'cart_age_bucket', 'send_to',
];
const ITEM_KEYS = [
  'item_id', 'item_name', 'item_brand', 'item_category', 'item_variant', 'price', 'quantity', 'index', 'item_list_name',
];
const TOKEN_PATTERN = /authority|paymentid|trackingcode|token=|A000TEST|00000000-0000/i;
const PII_PATTERN = /09120000000|خیابان آزمون|کاربر آزمون|@/;

async function setup(page: Page, apiOpts: Record<string, unknown> = {}) {
  await page.addInitScript(installGtagSpy);
  const hits: Hit[] = await captureCollect(page);
  const api = await mockApi(page, apiOpts);
  const errors: string[] = watchPageErrors(page);
  return { hits, api, errors };
}

async function waitForEvent(page: Page, name: string, count = 1, timeout = 15_000) {
  await waitForGtag(
    page,
    (log: unknown[][]) => log.filter((a) => a[0] === 'event' && a[1] === name).length >= count,
    timeout,
  );
  return (await gtagEvents(page, name)) as GtagEvent[];
}

function expectOnlyKeys(event: GtagEvent, allowed: string[]) {
  const extra = Object.keys(event.params).filter((k) => !allowed.includes(k));
  expect(extra, `${event.name} has only allowlisted params`).toEqual([]);
  const items = (event.params.items as Record<string, unknown>[] | undefined) ?? [];
  for (const item of items) {
    expect(Object.keys(item).filter((k) => !ITEM_KEYS.includes(k)), `${event.name} item keys`).toEqual([]);
  }
  expect(JSON.stringify(event.params)).not.toMatch(PII_PATTERN);
  expect(JSON.stringify(event.params)).not.toMatch(TOKEN_PATTERN);
}

function annotateHits(hits: Hit[]) {
  const title = test.info().title;
  for (const hit of hits) console.log(`[ga-hit] ${title}: ${describeHit(hit)}`);
  if (!hits.length) console.log(`[ga-hit] ${title}: no /g/collect observed`);
}

test('initial load sends one page_view; SPA navigation sends exactly one more', async ({ page }) => {
  const { hits, errors } = await setup(page);
  await seedStorage(page, { token: TEST_TOKEN });
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible();
  let views = await waitForEvent(page, 'page_view');
  expect(views).toHaveLength(1);
  expect(views[0]!.params.page_path).toBe('/checkout');
  expect(views[0]!.params.send_to).toBe(WHOLESALE_GA4);

  await page.getByRole('link', { name: 'مشاهده محصولات' }).click();
  await expect(page).toHaveURL(/\/products$/, { timeout: 60_000 });
  views = await waitForEvent(page, 'page_view', 2, 60_000);
  await page.waitForTimeout(2_000);
  views = await gtagEvents(page, 'page_view');
  expect(views.map((v) => v.params.page_path)).toEqual(['/checkout', '/products']);
  expect(views.every((v) => v.params.send_to === WHOLESALE_GA4)).toBe(true);
  expect(hydrationErrors(errors)).toEqual([]);
  await page.waitForTimeout(2_000);
  annotateHits(hits);
  expect(hits.filter((h) => h.tid === RETAIL_GA4)).toHaveLength(0);
});

test('payment callback: page_location/page_path carry no gateway tokens', async ({ page }) => {
  const { hits, api } = await setup(page, { verify: { ok: false, cancelled: true } });
  await page.goto(
    '/payment/callback?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000',
  );
  await expect(page.getByRole('heading', { name: 'پرداخت لغو شد' })).toBeVisible({ timeout: 30_000 });
  expect(api.verifyBodies.length, 'verify API was mocked').toBeGreaterThan(0);
  const views = await waitForEvent(page, 'page_view');
  expect(views).toHaveLength(1);
  expect(views[0]!.params.page_path).toBe('/payment/callback');
  expect(String(views[0]!.params.page_location)).toMatch(/\/payment\/callback$/);
  const log = (await gtagLog(page)) as unknown[][];
  expect(JSON.stringify(log), 'no gtag command carries a gateway token').not.toMatch(TOKEN_PATTERN);
  annotateHits(hits);
});

/**
 * Network layer, end to end through GTM. Fails while the GTM container's own Google Tag sends an
 * automatic page_view built from the raw URL (container config, not app code).
 */
for (const path of [
  '/payment/callback?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000',
  '/checkout',
]) {
  test(`network: one page_view hit, no tokens in dl/dp/dr (${path.split('?')[0]})`, async ({ page }) => {
    const { hits } = await setup(page, { verify: { ok: false, cancelled: true } });
    await seedStorage(page, { token: TEST_TOKEN });
    await page.goto(path);
    await waitForEvent(page, 'page_view');
    // GTM is injected after load + paint (hard cap 8s); GA batches hits for a few seconds.
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && !hits.some((h) => h.en === 'page_view')) await page.waitForTimeout(500);
    await page.waitForTimeout(4_000);
    annotateHits(hits);
    expect(hits.length, 'GA hits observed (GTM unreachable? set E2E_PROXY) — this gate must not skip').toBeGreaterThan(0);
    for (const hit of hits) {
      expect(`${hit.dl ?? ''} ${hit.dp ?? ''} ${hit.dr ?? ''}`, `${hit.en}: no gateway token`).not.toMatch(TOKEN_PATTERN);
      expect(hit.tid).toBe(WHOLESALE_GA4);
    }
    expect(hits.filter((h) => h.en === 'page_view'), 'exactly one page_view hit').toHaveLength(1);
  });
}

test('network: hard redirect callback → /portal/login: one app page_view, dr carries no tokens', async ({ page }) => {
  const { hits } = await setup(page);
  const callback = `${process.env.E2E_WHOLESALE_ORIGIN}/payment/callback?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000`;
  await page.goto('/portal/login', { referer: callback });
  expect(await page.evaluate(() => document.referrer)).toContain('Authority=');
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !hits.some((h) => h.en === 'page_view')) await page.waitForTimeout(500);
  await page.waitForTimeout(3_000);
  annotateHits(hits);
  expect(hits.length, 'GA hits observed (GTM unreachable? set E2E_PROXY)').toBeGreaterThan(0);
  for (const hit of hits) {
    expect(`${hit.dl ?? ''} ${hit.dp ?? ''} ${hit.dr ?? ''}`, `${hit.en}: no gateway token`).not.toMatch(TOKEN_PATTERN);
  }
  const views = hits.filter((h) => h.en === 'page_view');
  expect(views, 'exactly one page_view on /portal/login').toHaveLength(1);
  expect(views[0]!.tid).toBe(WHOLESALE_GA4);
  expect(views[0]!.dr).toMatch(/\/payment\/callback$/);
});

for (const [referer, approved] of [
  ['https://web.mydigipay.com/', true],
  ['https://sep.shaparak.ir/pg/Pay', true],
  ['https://evil.example/', false],
] as const) {
  test(`ignore_referrer only for approved gateway referrer (${new URL(referer).host})`, async ({ page }) => {
    await setup(page, { verify: { ok: false, cancelled: true } });
    await page.goto('/payment/callback?paymentId=e2e-ref', { referer });
    await waitForEvent(page, 'page_view');
    const log = (await gtagLog(page)) as unknown[][];
    const ignore = log.filter((a) => a[0] === 'set' && a[1] === 'ignore_referrer' && a[2] === true);
    expect(ignore.length > 0).toBe(approved);
    const pageReferrer = log
      .filter((a) => a[0] === 'set' && a[1] && typeof a[1] === 'object')
      .map((a) => (a[1] as Record<string, unknown>).page_referrer)
      .find(Boolean);
    if (approved) expect(String(pageReferrer)).toMatch(new RegExp(`^${new URL(referer).origin}/`));
  });
}

test('checkout funnel: begin/shipping/payment only on submit, deduped; order_request only on 200', async ({ page }) => {
  const { hits, api, errors } = await setup(page, { orderStatus: 500 });
  await seedStorage(page, { token: TEST_TOKEN, cart: [CART_ITEM], cohortSinceDaysAgo: 2 });
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'تسویه حساب عمده' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /تیپاکس/ })).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(await gtagEvents(page, 'begin_checkout'), 'no begin_checkout on mount').toHaveLength(0);

  await page.getByRole('radio', { name: /بعداً با فروشگاه حساب کن/ }).click();
  const submit = page.getByRole('button', { name: 'ثبت نهایی سفارش نقدی' }).locator('visible=true').first();

  await submit.click();
  await expect.poll(() => api.orderPosts.length).toBe(1);
  await expect(page.locator('#checkout-payment [role="alert"]')).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => api.orderPosts.length, '/orders called twice (mocked 500)').toBe(2);
  await expect(submit).toBeEnabled();

  let begin = await gtagEvents(page, 'begin_checkout');
  let shipping = await gtagEvents(page, 'add_shipping_info');
  let payment = await gtagEvents(page, 'add_payment_info');
  expect(begin, 'begin_checkout once per cart fp').toHaveLength(1);
  expect(shipping).toHaveLength(1);
  expect(payment).toHaveLength(1);
  expect(shipping[0]!.params.shipping_tier).toBe('TIPAX');
  expect(payment[0]!.params.payment_type).toBe('CASH');
  expect(await gtagEvents(page, 'wholesale_order_request'), 'no lead on 500').toHaveLength(0);

  const fp = begin[0]!.params.cart_fp;
  expect(fp).toMatch(/^[a-z0-9]{1,16}$/);
  expect(shipping[0]!.params.cart_fp).toBe(fp);
  expect(payment[0]!.params.cart_fp).toBe(fp);
  expect(begin[0]!.params.cart_age_days).toBe(2);
  expect(begin[0]!.params.cart_age_bucket).toBe('1_3_days');
  for (const e of [...begin, ...shipping, ...payment]) {
    expect(e.params.send_to).toBe(WHOLESALE_GA4);
    expectOnlyKeys(e, ECOMMERCE_KEYS);
  }

  await page.getByRole('radio', { name: /پست پیشتاز/ }).click();
  await submit.click();
  await expect.poll(() => api.orderPosts.length).toBe(3);
  await expect(submit).toBeEnabled();
  begin = await gtagEvents(page, 'begin_checkout');
  shipping = await gtagEvents(page, 'add_shipping_info');
  payment = await gtagEvents(page, 'add_payment_info');
  expect(begin).toHaveLength(1);
  expect(shipping.map((e) => e.params.shipping_tier)).toEqual(['TIPAX', 'PISHTAZ']);
  expect(payment).toHaveLength(1);

  api.orderStatus = 200;
  await submit.click();
  await expect(page.getByRole('heading', { name: 'سفارش ثبت شد!' })).toBeVisible();
  const lead = await waitForEvent(page, 'wholesale_order_request');
  expect(lead).toHaveLength(1);
  expect(lead[0]!.params).toMatchObject({
    lead_type: 'wholesale_order_request',
    cta_location: 'checkout_submit',
    payment_type: 'cash',
    send_to: WHOLESALE_GA4,
  });
  expectOnlyKeys(lead[0]!, LEAD_KEYS);
  expect(api.blocked, 'no un-mocked writes').toEqual([]);
  expect(hydrationErrors(errors)).toEqual([]);
  await page.waitForTimeout(3_000);
  annotateHits(hits);
  for (const hit of hits) expect(JSON.stringify(hit)).not.toMatch(PII_PATTERN);
});

test('tel / wa.me / t.me clicks send lead events with allowlisted params only', async ({ page }) => {
  await setup(page);
  await seedStorage(page, { token: TEST_TOKEN });
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible();
  await waitForEvent(page, 'page_view');
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.setAttribute('data-cta-location', 'floating_contact');
    box.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#fff';
    for (const [id, href] of [
      ['e2e-tel', 'tel:+989120000000'],
      ['e2e-wa', 'https://wa.me/989120000000?text=09120000000'],
      ['e2e-tg', 'https://t.me/taranom_e2e'],
    ]) {
      const a = document.createElement('a');
      a.id = id;
      a.href = href;
      a.textContent = id;
      box.appendChild(a);
    }
    box.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(box);
  });
  for (const [id, name] of [
    ['e2e-tel', 'phone_click'],
    ['e2e-wa', 'whatsapp_click'],
    ['e2e-tg', 'telegram_click'],
  ] as const) {
    await page.locator(`#${id}`).click();
    const events = await waitForEvent(page, name);
    expect(events, `${name} once`).toHaveLength(1);
    expect(events[0]!.params).toMatchObject({ lead_type: name, cta_location: 'floating_contact', send_to: WHOLESALE_GA4 });
    expectOnlyKeys(events[0]!, LEAD_KEYS);
  }
});

test('wholesale PDP: product card click → select_item; PDP → exactly one view_item', async ({ page }) => {
  await setup(page, { passthroughGets: MODE === 'prod' });
  await page.goto('/products');
  const card = page.locator('a[href^="/products/"]').first();
  if (!(await card.count())) {
    test.skip(true, `no product cards rendered on /products in ${MODE} mode (no catalog API)`);
  }
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page).toHaveURL(/\/products\/[^/?]+/, { timeout: 60_000 });
  const select = await waitForEvent(page, 'select_item');
  expect(select).toHaveLength(1);
  expectOnlyKeys(select[0]!, ECOMMERCE_KEYS);
  const view = await waitForEvent(page, 'view_item');
  await page.waitForTimeout(3_000);
  expect(await gtagEvents(page, 'view_item'), 'view_item exactly once').toHaveLength(1);
  expect(view[0]!.params.send_to).toBe(WHOLESALE_GA4);
  expectOnlyKeys(view[0]!, ECOMMERCE_KEYS);
});
