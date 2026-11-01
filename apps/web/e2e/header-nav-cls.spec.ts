/**
 * Wholesale chrome must not shift: total CLS = 0 after load + full scroll on
 * the home, /about and the catalog at mobile and desktop widths.
 *
 * Production sources this guards (TASK-20261102-header-nav-cls):
 * - category nav streamed into a `fallback={null}` Suspense slot pushed `MegaNav`
 * - floating contact moved with `bottom` when the home boutique bar opened
 * - Enamad seal reserved 1:1 for a 125×136 logo
 */
import { test, expect } from '@playwright/test';
import { guardProductionHosts, mockApi } from './support.cjs';

const PATHS = ['/', '/about', '/products'] as const;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

type ClsWindow = Window & { __cls?: { total: number; shifts: string[] } };

for (const viewport of VIEWPORTS) {
  for (const path of PATHS) {
    test(`CLS 0 on ${path} at ${viewport.width}x${viewport.height}`, async ({ browser, browserName }) => {
      test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium-only');
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await mockApi(page);
      const productionLeaks = await guardProductionHosts(page);
      // Registered after the guard so it wins: the cart heartbeat is not a mock endpoint.
      await page.route('**/cart/heartbeat', (route) => route.fulfill({ status: 204, body: '' }));

      await page.addInitScript(() => {
        const w = window as ClsWindow;
        const state = (w.__cls = { total: 0, shifts: [] as string[] });
        const describe = (node: Node | null | undefined) => {
          if (!node || node.nodeType !== 1) return String(node?.nodeName);
          const el = node as Element;
          const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
          return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
        };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Array<{
            value: number;
            hadRecentInput: boolean;
            sources?: Array<{ node?: Node | null }>;
          }>) {
            if (entry.hadRecentInput) continue;
            state.total += entry.value;
            state.shifts.push(`${entry.value.toFixed(6)} ${(entry.sources ?? []).map((s) => describe(s.node)).join(',')}`);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });

      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 100));
        }
      });
      await page.waitForTimeout(1200);

      const cls = await page.evaluate(() => (window as ClsWindow).__cls ?? { total: -1, shifts: [] });
      console.log(`[cls] ${viewport.width} ${path} total=${cls.total} ${cls.shifts.join(' | ')}`);
      expect(cls.total, `${path} @${viewport.width} shifts: ${cls.shifts.join(' | ')}`).toBe(0);
      expect(productionLeaks).toEqual([]);
      await context.close();
    });
  }
}
