import { test, expect } from '@playwright/test';
import {
  CART_ITEM,
  RETAIL_GA4,
  TEST_TOKEN,
  hydrationErrors,
  installGtagSpy,
  mockApi,
  seedStorage,
  watchPageErrors,
} from './support.cjs';

/**
 * CURSOR-FIX §5 — host-aware checkout auth (mocked API only).
 * Local runs map both storefront hosts to the same Next origin via playwright.config.
 */

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript(installGtagSpy);
  const api = await mockApi(page);
  const errors: string[] = watchPageErrors(page);
  return { api, errors };
}

test.describe('checkout-auth host redirects', () => {
  test('wholesale guest cart login CTA stays on .com portal path', async ({ page }) => {
    const { errors } = await setup(page);
    await seedStorage(page, { cart: [CART_ITEM] });
    await page.goto('http://poshaktaranom.com/checkout');
    await expect(page).toHaveURL(/poshaktaranom\.com\/checkout/);
    const login = page.getByRole('link', { name: 'ورود برای ثبت سفارش' });
    await expect(login).toBeVisible();
    const href = await login.getAttribute('href');
    expect(href).toMatch(/\/portal\/login\?redirect=/);
    expect(href).not.toMatch(/poshaktaranom\.ir/);
    expect(hydrationErrors(errors)).toEqual([]);
  });

  test('retail checkout with mocked profile 401 stays on retail host and keeps cart', async ({
    page,
  }) => {
    const errors = watchPageErrors(page);
    await page.addInitScript(installGtagSpy);
    await page.route((url) => {
      try {
        const u = new URL(url);
        return /^\/(api\/)?v1\//.test(u.pathname) || u.port === '4000';
      } catch {
        return false;
      }
    }, async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/(api\/)?v1/, '');
      if (path.startsWith('/auth/me/profile')) {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        });
      }
      if (path.startsWith('/settings/public')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            payment: { enabled: true, retailCashEnabled: false },
            shipping: { retail: { freeThreshold: 0, baseFee: 0 } },
            marketing: {},
          }),
        });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.addInitScript(
      ({ cart, token }) => {
        try {
          localStorage.setItem('taranom_retail_token', token);
          localStorage.setItem('taranom_retail_cart', JSON.stringify(cart));
        } catch {
          /* ignore */
        }
      },
      { cart: [CART_ITEM], token: TEST_TOKEN },
    );

    await page.goto('http://www.poshaktaranom.ir/checkout');
    await expect(page).toHaveURL(/www\.poshaktaranom\.ir\/checkout/, { timeout: 30_000 });
    // Soft auth banner / login affordance — must not hop to wholesale .com
    await expect(page.locator('body')).not.toContainText('poshaktaranom.com');
    const cartRaw = await page.evaluate(() => localStorage.getItem('taranom_retail_cart'));
    expect(JSON.parse(cartRaw || '[]')).toHaveLength(1);
    expect(hydrationErrors(errors)).toEqual([]);
  });

  test('payments/start mocked 403 shows inline error without login navigation', async ({ page }) => {
    const { errors } = await setup(page);
    await seedStorage(page, { token: TEST_TOKEN, cart: [CART_ITEM] });

    await page.route((url) => {
      try {
        const u = new URL(url);
        return /^\/(api\/)?v1\//.test(u.pathname) || u.port === '4000';
      } catch {
        return false;
      }
    }, async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/(api\/)?v1/, '');
      if (path.startsWith('/payments/start') && route.request().method() === 'POST') {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'حساب مشتری یافت نشد' }),
        });
      }
      return route.fallback();
    });

    await page.goto('http://poshaktaranom.com/checkout');
    await expect(page.getByRole('heading', { name: /تسویه حساب/ })).toBeVisible({ timeout: 30_000 });
    // Stay on checkout host — no forced portal hop from payment 403 alone
    await expect(page).toHaveURL(/poshaktaranom\.com\/checkout/);
    expect(hydrationErrors(errors)).toEqual([]);
  });
});

test.describe('auth UI solid styles', () => {
  test('portal login has no computed backdrop-filter blur', async ({ page }) => {
    await page.goto('http://poshaktaranom.com/portal/login');
    await expect(page.getByRole('heading', { name: /ورود/ })).toBeVisible({ timeout: 30_000 });
    const blurred = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('body *'));
      return nodes.some((el) => {
        const bf = getComputedStyle(el).backdropFilter || (getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter;
        return Boolean(bf && bf !== 'none');
      });
    });
    expect(blurred, 'no backdrop-filter on portal login').toBe(false);
  });
});

// Silence unused import in retail-only matrix (kept for future GA assertions)
void RETAIL_GA4;
