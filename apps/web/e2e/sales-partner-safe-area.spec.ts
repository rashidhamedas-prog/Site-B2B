/**
 * iPhone WebKit: bottom nav respects safe-area and stays inside the viewport.
 *
 *   npx playwright test -c e2e/playwright.product-card.config.ts e2e/sales-partner-safe-area.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

function jwtWith(payload: Record<string, unknown>): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${json}.x`;
}

async function openGuide(page: Page) {
  const token = jwtWith({ purpose: 'sales_partner', role: 'SALES_PARTNER' });
  await page.context().addCookies([
    {
      name: 'taranom_sales_partner_token',
      value: token,
      url: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
      path: '/',
    },
  ]);
  await page.goto('/sales-partners/guide', { waitUntil: 'domcontentloaded' });
}

test.describe('sales partner safe area', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    // iPhone-like chrome; safe-area CSS still applies via env() defaults in browsers.
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('bottom nav last item is inside viewport and content has clearance', async ({ page }) => {
    test.skip(test.info().project.name !== 'webkit', 'iPhone safe-area check is WebKit-only');
    await openGuide(page);
    const nav = page.getByRole('navigation', { name: 'ناوبری پنل همکار بازاریاب' });
    await expect(nav).toBeVisible();
    const items = nav.locator('a');
    await expect(items).toHaveCount(4);
    const last = items.last();
    const box = await last.boundingBox();
    expect(box).toBeTruthy();
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0);

    const shellPad = await page.locator('div.pb-24').first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return Number.parseFloat(style.paddingBottom || '0');
    });
    expect(shellPad).toBeGreaterThanOrEqual(64);

    const navPad = await nav.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.paddingBottom;
    });
    expect(navPad).toMatch(/px|rem|env/);
  });
});
