import { test, expect, type Page } from '@playwright/test';

const CHANNELS = [
  { name: 'wholesale', origin: 'http://127.0.0.1:3104' },
  { name: 'retail', origin: 'http://localhost.ir:3104' },
] as const;

type PerfWindow = Window & {
  __productVideoPerf?: { cls: number; lcpTag: string; lcpInHero: boolean; lcpIsVideo: boolean };
  __videoPauseCalls?: number;
};

async function prepare(page: Page) {
  const videoRequests: string[] = [];
  await page.route(
    (url) => url.hostname === 'localhost.ir',
    (route) => {
      const target = new URL(route.request().url());
      target.hostname = '127.0.0.1';
      return route.fallback({
        url: target.toString(),
        headers: {
          ...route.request().headers(),
          'x-taranom-channel': 'RETAIL',
        },
      });
    },
  );
  await page.route('**/video/poster.webp', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960"><rect width="720" height="960" fill="#28483e"/></svg>',
    }),
  );
  await page.route(/\.(?:mp4|webm)(?:\?|$)/, async (route) => {
    videoRequests.push(route.request().url());
    await route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => {
    const w = window as PerfWindow;
    w.__videoPauseCalls = 0;
    const nativePause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function play() {
      this.dataset.playCalled = 'true';
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      w.__videoPauseCalls = (w.__videoPauseCalls || 0) + 1;
      this.dataset.pauseCalled = 'true';
      try {
        nativePause.call(this);
      } catch {
        // Test browser may not have a decodable fixture source.
      }
      this.dispatchEvent(new Event('pause'));
    };
    w.__productVideoPerf = { cls: 0, lcpTag: '', lcpInHero: false, lcpIsVideo: false };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { element?: Element | null })[]) {
          const element = entry.element;
          if (!element) continue;
          w.__productVideoPerf!.lcpTag = element.tagName.toLowerCase();
          w.__productVideoPerf!.lcpInHero = Boolean(element.closest('[data-tn-hero]'));
          w.__productVideoPerf!.lcpIsVideo = Boolean(element.closest('[data-product-video-slide]'));
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) w.__productVideoPerf!.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });
  return videoRequests;
}

async function tabToVideoThumbnail(page: Page) {
  const thumbnail = page.locator('[data-product-video-thumbnail]');
  await thumbnail.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(
      () => document.activeElement?.hasAttribute('data-product-video-thumbnail') ?? false,
    ),
  ).toBe(true);
}

for (const channel of CHANNELS) {
  test(`${channel.name}: desktop poster-only, keyboard play, 720/WebM, pause and error`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const videoRequests = await prepare(page);
    const response = await page.goto(`${channel.origin}/products/video-product`, { waitUntil: 'load' });
    const html = response ? await response.text() : '';
    expect(response?.status(), html || 'no response').toBe(200);
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('مانتو آزمون ویدیو');

    await expect(page.locator('[data-product-video-thumbnail]')).toHaveCount(1);
    await expect(page.locator('video[data-product-video]')).toHaveCount(0);
    expect(videoRequests).toEqual([]);

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join('\n')).not.toContain('VideoObject');

    await tabToVideoThumbnail(page);
    await page.keyboard.press('Enter');
    const player = page.locator('video[data-product-video]');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('preload', 'none');
    await expect(player).toHaveAttribute('data-play-called', 'true');
    const sources = await player.locator('source').evaluateAll((nodes) =>
      nodes.map((node) => ({
        src: (node as HTMLSourceElement).getAttribute('src'),
        type: (node as HTMLSourceElement).type,
      })),
    );
    expect(sources).toEqual([
      { src: 'http://127.0.0.1:3104/video/product-720.webm', type: 'video/webm; codecs="vp9"' },
      { src: 'http://127.0.0.1:3104/video/product-720.mp4', type: 'video/mp4' },
    ]);

    await page.locator('button[aria-label^="تصویر"]').first().click();
    await expect.poll(() => page.evaluate(() => (window as PerfWindow).__videoPauseCalls || 0)).toBeGreaterThan(0);

    await page.locator('[data-product-video-thumbnail]').click();
    await expect(player).toBeVisible();
    await player.dispatchEvent('error');
    await expect(page.getByText('پخش ویدیو ممکن نشد')).toBeVisible();
    await expect(page.locator('[data-product-video-slide] img')).toBeVisible();
  });

  test(`${channel.name}: mobile keeps first image LCP, CLS zero and selects 480 MP4`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const videoRequests = await prepare(page);
    const response = await page.goto(`${channel.origin}/products/video-product`, { waitUntil: 'load' });
    const html = response ? await response.text() : '';
    expect(response?.status(), html || 'no response').toBe(200);
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('مانتو آزمون ویدیو');
    await page.waitForTimeout(500);

    expect(videoRequests).toEqual([]);
    const perfBefore = await page.evaluate(() => (window as PerfWindow).__productVideoPerf);
    expect(perfBefore?.lcpTag).toBe('img');
    expect(perfBefore?.lcpInHero).toBe(true);
    expect(perfBefore?.lcpIsVideo).toBe(false);

    await page.locator('[data-product-video-dot]').click();
    const player = page.locator('video[data-product-video]');
    await expect(player).toBeVisible();
    const sources = await player.locator('source').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLSourceElement).getAttribute('src')),
    );
    expect(sources).toEqual(['http://127.0.0.1:3104/video/product-480.mp4']);
    const cls = await page.evaluate(() => (window as PerfWindow).__productVideoPerf?.cls ?? -1);
    expect(cls).toBe(0);
  });

  test(`${channel.name}: product without video has no slide, thumbnail or dot`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    const response = await page.goto(`${channel.origin}/products/no-video`, { waitUntil: 'load' });
    const html = response ? await response.text() : '';
    expect(response?.status(), html || 'no response').toBe(200);
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('مانتو بدون ویدیو');
    await expect(page.locator('[data-product-video-slide]')).toHaveCount(0);
    await expect(page.locator('[data-product-video-thumbnail]')).toHaveCount(0);
    await expect(page.locator('[data-product-video-dot]')).toHaveCount(0);
  });
}
