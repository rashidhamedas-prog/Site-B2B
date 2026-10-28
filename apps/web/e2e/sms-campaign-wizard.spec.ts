/**
 * Bulk wizard must fit 360×800 and 1440 without a horizontal page scroll.
 * API calls stay mocked so the browser never reaches production.
 */
import { test, expect, type Page } from '@playwright/test';

function jwtWith(payload: Record<string, unknown>): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${json}.x`;
}

async function openWizard(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.route('**/*', async (route) => {
    let hostname = '';
    let pathname = '';
    try {
      const parsed = new URL(route.request().url());
      hostname = parsed.hostname.toLowerCase();
      pathname = parsed.pathname;
    } catch {
      await route.continue();
      return;
    }
    const isProd =
      hostname === 'poshaktaranom.com' ||
      hostname === 'www.poshaktaranom.com' ||
      hostname === 'api.poshaktaranom.com';
    const isApi = pathname === '/api/v1' || pathname.startsWith('/api/v1/') || pathname.startsWith('/v1/');
    if (isProd || isApi) {
      const body = pathname.includes('/credit')
        ? { amount: 10 }
        : pathname.includes('/settings')
          ? { unitPricePerPart: null, creditWarnThreshold: 500, promoWindowStart: '08:00', promoWindowEnd: '21:00' }
          : pathname.includes('/preview')
            ? { final: 0, unitPricePerPart: null }
            : pathname.includes('/templates')
              ? []
              : {};
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
      return;
    }
    await route.continue();
  });

  const token = jwtWith({ purpose: 'admin', role: 'ADMIN' });
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
  await page.context().addCookies([
    { name: 'taranom_admin_token', value: token, url: base },
    { name: 'taranom_admin_role', value: 'ADMIN', url: base },
  ]);
  await page.addInitScript((value) => {
    localStorage.setItem('taranom_admin_token', value);
    localStorage.setItem('taranom_admin_role', 'ADMIN');
  }, token);
  await page.goto('/admin/sms/campaigns/new', { waitUntil: 'domcontentloaded' });
}

async function assertFits(page: Page, width: number) {
  await expect(page.getByRole('group', { name: 'منابع مخاطب' })).toBeVisible();
  const metrics = await page.evaluate((viewport) => {
    const offenders = [...document.querySelectorAll('body *')].filter((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return rect.right > viewport + 1;
    }).length;
    const boxes = [...document.querySelectorAll('.sms-src-check')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    });
    return { scrollWidth: document.documentElement.scrollWidth, offenders, boxes };
  }, width);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
  expect(metrics.offenders).toBe(0);
  expect(metrics.boxes).toHaveLength(4);
  const first = metrics.boxes[0];
  for (const box of metrics.boxes) {
    expect(Math.abs(box.w - first.w)).toBeLessThan(1);
    expect(Math.abs(box.h - first.h)).toBeLessThan(1);
    expect(box.w).toBeGreaterThanOrEqual(22);
    expect(box.w).toBeLessThanOrEqual(24);
  }
}

test('bulk wizard fits 360 and 1440', async ({ page }) => {
  await openWizard(page, 360, 800);
  await assertFits(page, 360);
  await page.setViewportSize({ width: 1440, height: 800 });
  await assertFits(page, 1440);
});
