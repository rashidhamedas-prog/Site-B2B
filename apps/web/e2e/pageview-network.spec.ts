import { test, expect, type Page } from '@playwright/test';
import {
  RETAIL_GA4,
  TEST_TOKEN,
  WHOLESALE_GA4,
  captureCollect,
  describeHit,
  installGtagSpy,
  mockApi,
  seedStorage,
} from './support.cjs';

/**
 * Network-level page_view proof per domain, through the published GTM container
 * (Google tag `send_page_view=false`): exactly one page_view per load and per SPA
 * navigation, right stream, no gateway token in dl/dp/dr. Collect hits are answered locally.
 */
type Hit = Record<string, string>;

const TOKEN_PATTERN = /authority|paymentid|trackingcode|token=|A000TEST|00000000-0000/i;
const CALLBACK = '/payment/callback?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000';

const DOMAINS = [
  {
    name: 'wholesale',
    origin: process.env.E2E_WHOLESALE_ORIGIN!,
    tid: WHOLESALE_GA4,
    other: RETAIL_GA4,
    spaStart: '/checkout',
    spaLink: (page: Page) => page.getByRole('link', { name: 'مشاهده محصولات' }),
    spaTarget: /\/products$/,
  },
  {
    name: 'retail',
    origin: process.env.E2E_RETAIL_ORIGIN!,
    tid: RETAIL_GA4,
    other: WHOLESALE_GA4,
    spaStart: '/',
    spaLink: (page: Page) => page.locator('a[href="/products"]:visible').first(),
    spaTarget: /\/products$/,
  },
] as const;

async function setup(page: Page) {
  await page.addInitScript(installGtagSpy);
  const hits: Hit[] = await captureCollect(page);
  const api = await mockApi(page, { passthroughGets: true, verify: { ok: false, cancelled: true } });
  return { hits, api };
}

const pageViews = (hits: Hit[]) => hits.filter((h) => h.en === 'page_view');

async function waitForPageViews(page: Page, hits: Hit[], count: number) {
  // GTM is injected after load + paint (hard cap 8s); GA batches hits for a few seconds.
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline && pageViews(hits).length < count) await page.waitForTimeout(500);
  await page.waitForTimeout(4_000);
}

function assertHits(hits: Hit[], tid: string, other: string) {
  const title = test.info().title;
  for (const hit of hits) console.log(`[ga-hit] ${title}: ${describeHit(hit)}`);
  expect(hits.length, 'GA hits observed (GTM unreachable? set E2E_PROXY) — this gate must not skip').toBeGreaterThan(0);
  for (const hit of hits) {
    expect(`${hit.dl ?? ''} ${hit.dp ?? ''} ${hit.dr ?? ''}`, `${hit.en}: no gateway token`).not.toMatch(TOKEN_PATTERN);
  }
  expect(hits.filter((h) => h.tid === other), 'no hit to the other stream').toHaveLength(0);
  expect(pageViews(hits).every((h) => h.tid === tid)).toBe(true);
}

for (const d of DOMAINS) {
  test.describe(`${d.name} (${d.origin})`, () => {
    test('initial load + SPA navigation: exactly one page_view each', async ({ page }) => {
      const { hits } = await setup(page);
      await seedStorage(page, { token: d.name === 'wholesale' ? TEST_TOKEN : undefined });
      await page.goto(`${d.origin}${d.spaStart}`);
      await waitForPageViews(page, hits, 1);
      expect(pageViews(hits), 'initial load: one page_view hit').toHaveLength(1);

      const link = d.spaLink(page);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page).toHaveURL(d.spaTarget, { timeout: 60_000 });
      await waitForPageViews(page, hits, 2);
      expect(await page.evaluate(() => (window as unknown as { __e2eDocLoads: number }).__e2eDocLoads), 'client-side navigation').toBe(1);

      assertHits(hits, d.tid, d.other);
      const views = pageViews(hits);
      expect(views, 'load + one SPA navigation = two page_view hits').toHaveLength(2);
      expect(new URL(views[1]!.dl!).pathname).toMatch(d.spaTarget);
    });

    test('payment callback: one page_view, no gateway token in dl/dp/dr', async ({ page }) => {
      const { hits } = await setup(page);
      await page.goto(`${d.origin}${CALLBACK}`);
      await waitForPageViews(page, hits, 1);
      assertHits(hits, d.tid, d.other);
      const views = pageViews(hits);
      expect(views, 'exactly one page_view hit').toHaveLength(1);
      expect(new URL(views[0]!.dl!).pathname).toBe('/payment/callback');
      expect(new URL(views[0]!.dl!).search).toBe('');
    });
  });
}
