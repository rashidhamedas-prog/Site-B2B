/**
 * Wholesale /about (v3 scrollytelling) contract.
 *
 *   $env:NODE_PATH="$env:USERPROFILE\.cache\pw-runner\node_modules"
 *   & "$env:USERPROFILE\.cache\pw-runner\node_modules\.bin\playwright.cmd" test `
 *     -c apps/web/e2e/playwright.config.ts about-v3
 *
 * Production smoke (read-only): E2E_BASE_URL=https://poshaktaranom.com and `--grep @smoke`.
 *
 * Local (E2E_MODE=local): Chrome maps poshaktaranom.com / www.poshaktaranom.ir to the local
 * `next start`, which must run with API_INTERNAL_URL=http://127.0.0.1:4010/v1 (mock-api-server.cjs)
 * and NODE_OPTIONS=--require ./e2e/block-production-hosts.cjs.
 *
 * axe-core is not a repo dependency: it must sit next to @playwright/test in the runner cache
 * (npm i --prefix "$env:USERPROFILE\.cache\pw-runner" axe-core). A missing axe-core fails the test.
 *
 * Optional: E2E_MASTER_TITLE, E2E_MASTER_MAIN_TEXT_LEN (default 1500).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { MODE, captureCollect, mockApi } from './support.cjs';

const ORIGIN = process.env.E2E_WHOLESALE_ORIGIN || 'http://poshaktaranom.com';
const RETAIL_ORIGIN = process.env.E2E_RETAIL_ORIGIN || 'http://www.poshaktaranom.ir';
const ABOUT = '/about';
const CANONICAL = 'https://poshaktaranom.com/about';
const H1_TEXT = 'درباره پوشاک ترنم؛ تولیدی مستقیم مانتو در مشهد';
const H2_COUNT = 7;
const FOUNDER_ID = 'https://poshaktaranom.com/about/hamed-rashid#person';
const RETAIL_HOME = 'https://www.poshaktaranom.ir/';
const MIN_MAIN_TEXT = Number(process.env.E2E_MASTER_MAIN_TEXT_LEN || 1500) || 1500;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const SMALL = { width: 360, height: 740 };

type Viewport = { width: number; height: number };
type E2EWindow = Window & {
  __e2ePerf?: { lcp: { tag: string; url: string; hero: boolean }[]; cls: number; contentCls: number; shifts: string[] };
  __e2eLcpEl?: Element | null;
  __e2ePrevFocus?: Element | null;
  __e2eDialogOpens?: number;
  axe?: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }> };
};
type AxeViolation = { id: string; impact: string | null; help: string; nodes: { target: string[] }[] };
type JsonNode = Record<string, unknown>;

// ---------------------------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------------------------

type PageOptions = {
  viewport?: Viewport;
  javaScriptEnabled?: boolean;
  /** Needed for axe: production CSP would block the injected inline script. */
  bypassCSP?: boolean;
};

async function withPage(browser: Browser, opts: PageOptions, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({
    viewport: opts.viewport ?? DESKTOP,
    locale: 'fa-IR',
    baseURL: ORIGIN,
    serviceWorkers: 'block',
    javaScriptEnabled: opts.javaScriptEnabled ?? true,
    bypassCSP: opts.bypassCSP ?? false,
  });
  const page = await context.newPage();
  try {
    await captureCollect(page);
    // Prod: public GETs pass through, writes are mocked/aborted. Local: browser API calls are mocked.
    await mockApi(page, { passthroughGets: MODE === 'prod' });
    await fn(page);
  } finally {
    await context.close();
  }
}

async function gotoAndSettle(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'load' });
  expect(res?.status(), `GET ${url}`).toBe(200);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

/** Installed before any page script: buffered LCP + CLS observers. */
function installPerfObservers() {
  const w = window as unknown as E2EWindow;
  const perf = (w.__e2ePerf = { lcp: [], cls: 0, contentCls: 0, shifts: [] } as NonNullable<E2EWindow['__e2ePerf']>);
  const describe = (node: Node | null | undefined) => {
    if (!node || !(node instanceof Element)) return String(node && node.nodeName);
    const id = node.id ? `#${node.id}` : '';
    const cls = typeof node.className === 'string' && node.className ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    return `${node.tagName.toLowerCase()}${id}${cls}`;
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { element?: Element | null; url?: string })[]) {
        w.__e2eLcpEl = entry.element ?? null;
        perf.lcp.push({
          tag: describe(entry.element),
          url: entry.url || '',
          hero: Boolean(entry.element && entry.element.hasAttribute('data-about-hero')),
        });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* unsupported */
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      })[]) {
        if (entry.hadRecentInput) continue;
        perf.cls += entry.value;
        const inContent = (entry.sources || []).some((s) => {
          const node = s.node;
          const el = node instanceof Element ? node : node?.parentElement;
          return Boolean(el?.closest('[data-about-v3]'));
        });
        if (inContent) perf.contentCls += entry.value;
        perf.shifts.push(`${entry.value.toFixed(5)} ${(entry.sources || []).map((s) => describe(s.node)).join(', ')}`);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* unsupported */
  }
}

/** Scrolls to the bottom in steps so lazy images and reveals trigger; re-reads height (pinning grows it). */
async function scrollThrough(page: Page, { step = 400, pause = 200, closeDialogs = true } = {}) {
  await page.evaluate(
    async ({ step, pause, closeDialogs }) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let y = window.scrollY;
      for (let i = 0; i < 400; i++) {
        if (closeDialogs) document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (y >= max) break;
        y = Math.min(y + step, max);
        window.scrollTo(0, y);
        await sleep(pause);
      }
      await sleep(pause * 3);
    },
    { step, pause, closeDialogs },
  );
}

async function scrollToSelector(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`missing ${sel}`);
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }, selector);
}

async function closeOpenDialogs(page: Page) {
  if ((await page.locator('dialog[open]').count()) > 0) {
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
}

/**
 * Server HTML before hydration. Prod: Node request. Local: the Node request would bypass Chrome's
 * host mapping and hit production, so fetch from inside the page (same origin, mapped to local).
 */
async function rawHtml(page: Page, request: APIRequestContext, pathname: string): Promise<string> {
  const url = new URL(pathname, ORIGIN).toString();
  if (MODE === 'prod') {
    const res = await request.get(url);
    expect(res.status(), `raw GET ${url}`).toBe(200);
    return res.text();
  }
  return page.evaluate(async (u) => {
    const res = await fetch(u, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error(`raw GET ${u} -> ${res.status}`);
    return res.text();
  }, url);
}

// ---------------------------------------------------------------------------------------------
// axe-core (resolved from the external runner via NODE_PATH; never skipped)
// ---------------------------------------------------------------------------------------------

let axeSourceCache: string | null = null;

function axeSource(): string {
  if (axeSourceCache) return axeSourceCache;
  const roots = [
    ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    path.join(os.homedir(), '.cache', 'pw-runner', 'node_modules'),
  ];
  let entry: string;
  try {
    entry = require.resolve('axe-core', { paths: roots });
  } catch {
    throw new Error(
      `axe-core could not be resolved (searched NODE_PATH + ${roots.join(', ')}). ` +
        'Install it into the external runner: npm i --prefix "%USERPROFILE%\\.cache\\pw-runner" axe-core',
    );
  }
  const file = path.join(path.dirname(entry), 'axe.min.js');
  if (!fs.existsSync(file)) throw new Error(`axe-core resolved to ${entry} but ${file} is missing`);
  axeSourceCache = fs.readFileSync(file, 'utf8');
  return axeSourceCache;
}

async function expectNoSeriousAxe(page: Page, label: string) {
  const source = axeSource();
  await page.addScriptTag({ content: source });
  const violations = await page.evaluate(async (tags) => {
    const axe = (window as unknown as E2EWindow).axe;
    if (!axe) throw new Error('axe failed to load in page');
    const result = await axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
  }, AXE_TAGS);
  for (const v of violations) console.log(`[axe] ${label}: ${v.impact} ${v.id} — ${v.help} :: ${v.nodes.join(' | ')}`);
  expect(violations, `${label}: no serious/critical axe violations`).toEqual([]);
}

// ---------------------------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------------------------

function flattenLd(value: unknown, out: JsonNode[] = []): JsonNode[] {
  if (Array.isArray(value)) {
    for (const v of value) flattenLd(v, out);
  } else if (value && typeof value === 'object') {
    const node = value as JsonNode;
    out.push(node);
    if (node['@graph']) flattenLd(node['@graph'], out);
  }
  return out;
}

function hasType(node: JsonNode, type: string) {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

// =============================================================================================
// T1 — document contract + raw HTML
// =============================================================================================

test.describe('T1 document + raw HTML', () => {
  test('T1 raw HTML @smoke', async ({ browser, request }) => {
    await withPage(browser, {}, async (page) => {
      await gotoAndSettle(page, ABOUT);

      await expect(page.locator('h1'), 'exactly one h1').toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(H1_TEXT);
      await expect(page.locator('article[data-about-v3]'), 'v3 root wrapper').toHaveCount(1);
      await expect(page.locator('main article[data-about-v3]'), 'v3 root lives inside <main>').toHaveCount(1);
      await expect(page.locator('[data-about-v3] h2'), `${H2_COUNT} h2 sections`).toHaveCount(H2_COUNT);

      const title = await page.title();
      console.log(`[about] title: ${title}`);
      if (process.env.E2E_MASTER_TITLE) {
        expect(title, 'title equals master').toBe(process.env.E2E_MASTER_TITLE);
      } else {
        expect(title, 'title keeps the master keyword').toContain('تولیدی مانتو در مشهد');
      }
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', CANONICAL);

      const html = await rawHtml(page, request, ABOUT);
      for (const needle of ['۱۳۹۴', 'حامد رشید', 'لینن و کتان', 'پلاک ۱۳۷', 'پلاک ۱۳۳']) {
        expect(html.includes(needle), `server HTML contains «${needle}»`).toBe(true);
      }

      const mainTextLen = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('article[data-about-v3]');
        return main ? (main as HTMLElement).innerText.replace(/\s+/g, ' ').trim().length : 0;
      });
      console.log(`[about] main text length: ${mainTextLen} (min ${MIN_MAIN_TEXT})`);
      expect(mainTextLen, 'main text length not below master').toBeGreaterThanOrEqual(MIN_MAIN_TEXT);
    });
  });
});

// =============================================================================================
// T2 — internal / external links
// =============================================================================================

const LINKS: { selector: string; text?: string }[] = [
  { selector: 'a[href="/wholesale"]', text: 'شرایط همکاری عمده با ترنم' },
  { selector: 'a[href="/products"]', text: 'کاتالوگ عمده مانتو و شومیز' },
  { selector: 'a[href="/contact"]', text: 'تماس با تیم فروش ترنم' },
  { selector: 'a[href="/about/hamed-rashid"]', text: 'آشنایی با حامد رشید، بنیان‌گذار ترنم' },
  { selector: 'a[href$="/category/winter-wear"]' },
  { selector: 'a[href$="/category/autumn"]' },
  { selector: 'a[href$="/category/bamber"]' },
  { selector: `a[href="${RETAIL_HOME}"]`, text: 'فروشگاه خرده‌فروشی پوشاک ترنم' },
];

test.describe('T2 links', () => {
  test('T2 required links and anchor texts', async ({ browser }) => {
    await withPage(browser, {}, async (page) => {
      await gotoAndSettle(page, ABOUT);
      for (const link of LINKS) {
        const locator = link.text ? page.locator(link.selector, { hasText: link.text }) : page.locator(link.selector);
        const count = await locator.count();
        expect(count, `${link.selector}${link.text ? ` «${link.text}»` : ''} present`).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================================================
// T3 — structured data
// =============================================================================================

test.describe('T3 JSON-LD', () => {
  test('T3 AboutPage + BreadcrumbList + Organization founder', async ({ browser }) => {
    await withPage(browser, {}, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const blocks = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => e.textContent || ''));
      expect(blocks.length, 'JSON-LD blocks present').toBeGreaterThan(0);

      const nodes: JsonNode[] = [];
      blocks.forEach((raw, i) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          throw new Error(`JSON-LD block #${i} does not parse: ${(error as Error).message}\n${raw.slice(0, 300)}`);
        }
        flattenLd(parsed, nodes);
      });
      console.log(`[about] JSON-LD types: ${nodes.map((n) => JSON.stringify(n['@type'])).join(', ')}`);

      expect(nodes.some((n) => hasType(n, 'AboutPage')), 'AboutPage node').toBe(true);
      expect(nodes.some((n) => hasType(n, 'BreadcrumbList')), 'BreadcrumbList node').toBe(true);

      const orgs = nodes.filter((n) => hasType(n, 'Organization'));
      expect(orgs.length, 'Organization node').toBeGreaterThan(0);
      const org = orgs.find((o) =>
        asArray(o.founder as JsonNode | JsonNode[]).some((f) => f && (f as JsonNode)['@id'] === FOUNDER_ID),
      );
      expect(org, `Organization with founder @id ${FOUNDER_ID}`).toBeTruthy();
      expect(org!.foundingDate, 'foundingDate').toBe('2015');
      expect(asArray(org!.sameAs as string | string[]), 'sameAs includes retail store').toContain(RETAIL_HOME);
    });
  });
});

// =============================================================================================
// T4 — images
// =============================================================================================

function watchImages(page: Page, patterns: string[]) {
  const seen: { url: string; status: number }[] = [];
  const failed: string[] = [];
  const matches = (url: string) => patterns.some((p) => url.includes(p));
  page.on('response', (res) => {
    if (matches(res.url())) seen.push({ url: res.url(), status: res.status() });
  });
  page.on('requestfailed', (req) => {
    if (matches(req.url())) failed.push(`${req.url()} (${req.failure()?.errorText})`);
  });
  return { seen, failed };
}

function expectAll200(label: string, watched: ReturnType<typeof watchImages>) {
  console.log(`[images] ${label}: ${watched.seen.length} responses`);
  const isMediaRange = (r: { url: string; status: number }) =>
    r.status === 206 && /\.(webm|mp4)(\?|$)/.test(r.url);
  const bad = watched.seen
    .filter((r) => r.status !== 200 && !isMediaRange(r))
    .map((r) => `${r.status} ${r.url}`);
  expect(bad, `${label}: every image response is 200`).toEqual([]);
  expect(watched.failed, `${label}: no failed image requests`).toEqual([]);
}

test.describe('T4 images', () => {
  test('T4 /about images load (200 + naturalWidth) @smoke', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP }, async (page) => {
      const watched = watchImages(page, ['/_next/image', '/about/v3/']);
      await gotoAndSettle(page, ABOUT);
      await scrollThrough(page, { step: 300, pause: 250 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

      // Lazy images inside display:none subtrees never load in Chrome; only rendered images are judged.
      await page
        .waitForFunction(
          () => Array.from(document.images).filter((i) => i.getClientRects().length > 0).every((i) => i.complete),
          undefined,
          { timeout: 15_000 },
        )
        .catch(() => undefined);
      const broken = await page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => img.getClientRects().length > 0)
          .filter((img) => !(img.complete && img.naturalWidth > 0))
          .map((img) => img.currentSrc || img.src || img.outerHTML.slice(0, 120)),
      );
      expect(broken, 'every rendered <img> decoded (naturalWidth > 0)').toEqual([]);
      expect(watched.seen.length, '/about requested optimized or v3 images').toBeGreaterThan(0);
      expectAll200('/about', watched);
    });
  });

  for (const target of [
    { name: 'wholesale home', url: `${ORIGIN}/` },
    { name: 'retail home', url: `${RETAIL_ORIGIN}/` },
  ]) {
    test(`T4 ${target.name} /_next/image responses are 200`, async ({ browser }) => {
      await withPage(browser, { viewport: DESKTOP }, async (page) => {
        const watched = watchImages(page, ['/_next/image']);
        await gotoAndSettle(page, target.url);
        await scrollThrough(page, { step: 500, pause: 200 });
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
        expectAll200(target.name, watched);
      });
    });
  }
});

// =============================================================================================
// T5 — hero + LCP
// =============================================================================================

test.describe('T5 hero + LCP', () => {
  for (const viewport of [DESKTOP, MOBILE]) {
    test(`T5 hero is the LCP at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      await withPage(browser, { viewport }, async (page) => {
        await page.addInitScript(installPerfObservers);
        const heroResponses: string[] = [];
        page.on('response', (res) => {
          if (res.url().includes('about-hero-')) heroResponses.push(`${res.status()} ${res.url()}`);
        });
        await gotoAndSettle(page, ABOUT);
        await page.waitForTimeout(1_500);

        const hero = page.locator('img[data-about-hero]');
        await expect(hero, 'single hero image').toHaveCount(1);
        await expect(page.locator('picture img[data-about-hero]'), 'hero inside <picture>').toHaveCount(1);
        const medias = await page
          .locator('picture:has(img[data-about-hero]) source')
          .evaluateAll((els) => els.map((e) => (e.getAttribute('media') || '').replace(/\s+/g, '')));
        expect(medias, 'desktop <source media="(min-width:768px)">').toContain('(min-width:768px)');
        await expect(hero).toHaveAttribute('fetchpriority', 'high');
        expect(await hero.getAttribute('loading'), 'hero not lazy').not.toBe('lazy');
        await expect
          .poll(() => hero.evaluate((el) => getComputedStyle(el).opacity), { message: 'hero opacity 1' })
          .toBe('1');

        const lcp = await page.evaluate(() => {
          const w = window as unknown as E2EWindow;
          return { entries: w.__e2ePerf?.lcp ?? [], isHero: Boolean(w.__e2eLcpEl?.matches('img[data-about-hero]')) };
        });
        console.log(`[lcp] ${viewport.width}: ${JSON.stringify(lcp.entries)}`);
        expect(lcp.entries.length, 'LCP entries observed').toBeGreaterThan(0);
        expect(lcp.isHero, 'LCP element is img[data-about-hero]').toBe(true);

        console.log(`[hero] ${viewport.width}: ${heroResponses.join(' | ')}`);
        expect(heroResponses, 'exactly one hero file downloaded').toHaveLength(1);
      });
    });
  }
});

// =============================================================================================
// T6 — CLS
// =============================================================================================

test.describe('T6 CLS', () => {
  for (const viewport of [DESKTOP, MOBILE]) {
    test(`T6 layout shift at ${viewport.width}x${viewport.height} @smoke`, async ({ browser }) => {
      await withPage(browser, { viewport }, async (page) => {
        await page.addInitScript(installPerfObservers);
        await gotoAndSettle(page, ABOUT);
        await page.waitForTimeout(2_000);
        const readCls = () =>
          page.evaluate(
            () => (window as unknown as E2EWindow).__e2ePerf ?? { cls: -1, contentCls: -1, shifts: [] as string[] },
          );

        for (const phase of ['after load', 'after full scroll'] as const) {
          if (phase === 'after full scroll') {
            await scrollThrough(page, { step: 300, pause: 300 });
            await page.waitForTimeout(1_000);
          }
          const perf = await readCls();
          console.log(`[cls] ${viewport.width} ${phase}: total=${perf.cls} content=${perf.contentCls} ${perf.shifts.join(' | ')}`);
          // Site chrome (header) budget is tracked separately; the /about content itself must not move.
          expect(perf.contentCls, `/about content CLS ${phase}`).toBe(0);
          expect(perf.cls, `page CLS ${phase}`).toBeLessThanOrEqual(0.001);
        }
      });
    });
  }
});

// =============================================================================================
// T7 — CTA dialog
// =============================================================================================

test.describe('T7 CTA dialog', () => {
  test('T7 dialog opens once at #cta, never on exit intent, Escape restores focus', async ({ browser }) => {
    test.setTimeout(120_000);
    await withPage(browser, { viewport: DESKTOP, bypassCSP: true }, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const dialog = page.locator('dialog#about-cta-dialog');
      const openDialog = page.locator('dialog[open]');
      await expect(dialog).toHaveCount(1);

      const labelledBy = await dialog.getAttribute('aria-labelledby');
      expect(labelledBy, 'dialog has aria-labelledby').toBeTruthy();
      await expect(page.locator(`[id="${labelledBy}"]`), 'aria-labelledby target exists').toHaveCount(1);

      await dialog.evaluate((el) => {
        const w = window as unknown as E2EWindow;
        const d = el as HTMLDialogElement;
        w.__e2eDialogOpens = 0;
        let wasOpen = d.open;
        new MutationObserver(() => {
          if (d.open && !wasOpen) w.__e2eDialogOpens = (w.__e2eDialogOpens || 0) + 1;
          wasOpen = d.open;
        }).observe(d, { attributes: true, attributeFilter: ['open'] });
      });
      const opens = () => page.evaluate(() => (window as unknown as E2EWindow).__e2eDialogOpens ?? 0);

      // Dwell + exit intent must not open it.
      await page.evaluate(() => window.scrollTo(0, 360));
      await page.waitForTimeout(13_000);
      await page.mouse.move(720, 400);
      await page.mouse.move(720, 0, { steps: 10 });
      await page.evaluate(() => {
        const init = { bubbles: true, clientX: 720, clientY: -1, relatedTarget: null };
        document.documentElement.dispatchEvent(new MouseEvent('mouseout', init));
        document.dispatchEvent(new MouseEvent('mouseleave', init));
      });
      await page.waitForTimeout(1_500);
      await expect(openDialog, 'no dialog after dwell + exit intent').toHaveCount(0);

      // Focus a known element so focus restoration is observable.
      const rail = page.locator('[data-about-rail]');
      await rail.focus();
      await page.evaluate(() => {
        (window as unknown as E2EWindow).__e2ePrevFocus = document.activeElement;
      });

      await scrollToSelector(page, 'section#cta');
      await expect(openDialog, 'dialog opens at #cta').toHaveCount(1, { timeout: 8_000 });
      await expect(dialog).toHaveAttribute('open', '');
      expect(await opens(), 'opened exactly once').toBe(1);

      await expectNoSeriousAxe(page, 'dialog open 1440');

      await page.keyboard.press('Escape');
      await expect(openDialog, 'Escape closes the dialog').toHaveCount(0);
      await page
        .waitForFunction(() => document.activeElement === (window as unknown as E2EWindow).__e2ePrevFocus, undefined, { timeout: 3_000 })
        .catch(() => undefined);
      const focusRestored = await page.evaluate(() => document.activeElement === (window as unknown as E2EWindow).__e2ePrevFocus);
      expect(focusRestored, 'focus returns to the element focused before opening').toBe(true);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1_000);
      await scrollToSelector(page, 'section#cta');
      await page.waitForTimeout(2_500);
      await expect(openDialog, 'stays closed after revisiting #cta').toHaveCount(0);
      expect(await opens(), 'still opened only once').toBe(1);
    });
  });
});

// =============================================================================================
// T8 — motion tiers
// =============================================================================================

test.describe('T8 motion', () => {
  test('T8 reduced motion: no GSAP, reveals static, video paused @smoke', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP }, async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await gotoAndSettle(page, ABOUT);
      await scrollThrough(page);

      const motion = await page.evaluate(() => document.documentElement.dataset.aboutMotion ?? null);
      console.log(`[motion] reduced: data-about-motion=${motion}`);
      expect(motion, 'no GSAP tier under reduced motion').not.toBe('gsap');

      const animated = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.reveal'))
          .map((el) => ({ el: el.outerHTML.slice(0, 80), name: getComputedStyle(el).animationName }))
          .filter((r) => r.name !== 'none'),
      );
      expect(animated, 'every .reveal has animation-name none').toEqual([]);

      const video = page.locator('video[data-about-video]');
      await expect(video).toHaveCount(1);
      expect(await video.evaluate((v) => (v as HTMLVideoElement).paused), 'video paused').toBe(true);
    });
  });

  test('T8 mobile 390: GSAP tier not loaded', async ({ browser }) => {
    await withPage(browser, { viewport: MOBILE }, async (page) => {
      const scripts: string[] = [];
      page.on('request', (req) => {
        if (req.resourceType() === 'script') scripts.push(req.url());
      });
      await gotoAndSettle(page, ABOUT);
      await scrollThrough(page);

      const motion = await page.evaluate(() => document.documentElement.dataset.aboutMotion ?? null);
      console.log(`[motion] 390: data-about-motion=${motion}; ${scripts.length} scripts`);
      for (const url of scripts) console.log(`[motion] 390 script: ${url}`);
      expect(motion, 'no GSAP tier at 390').not.toBe('gsap');
      expect(scripts.filter((u) => /gsap|ScrollTrigger/i.test(u)), 'no gsap/ScrollTrigger script URL').toEqual([]);
    });
  });

  test('T8 desktop 1440: GSAP tier active after scroll', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP }, async (page) => {
      await gotoAndSettle(page, ABOUT);
      await scrollThrough(page);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.aboutMotion ?? null), {
          message: 'data-about-motion=gsap at 1440',
        })
        .toBe('gsap');
    });
  });
});

// =============================================================================================
// T9 — video + no-JS
// =============================================================================================

test.describe('T9 video + no-JS', () => {
  test('T9 video attributes, pauses off-screen, toggle flips aria-pressed', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP }, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const video = page.locator('video[data-about-video]');
      await expect(video).toHaveCount(1);
      expect(await video.evaluate((v) => (v as HTMLVideoElement).muted), 'muted property').toBe(true);
      expect(await video.evaluate((v) => v.hasAttribute('playsinline')), 'playsinline attribute').toBe(true);
      expect(await video.evaluate((v) => v.hasAttribute('autoplay')), 'no autoplay attribute').toBe(false);

      await scrollToSelector(page, 'video[data-about-video]');
      await page.waitForTimeout(1_500);
      console.log(`[video] in view paused=${await video.evaluate((v) => (v as HTMLVideoElement).paused)}`);

      // Move well away from the video, whichever side has room.
      await video.evaluate((v) => {
        const top = v.getBoundingClientRect().top + window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, top > window.innerHeight * 1.5 ? 0 : max);
      });
      await expect
        .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused), { message: 'paused when out of view' })
        .toBe(true);

      await scrollToSelector(page, 'video[data-about-video]');
      await page.waitForTimeout(800);
      const toggle = page.locator('button[data-about-video-toggle]');
      await expect(toggle).toHaveCount(1);
      const before = await toggle.getAttribute('aria-pressed');
      expect(['true', 'false'], 'toggle exposes aria-pressed').toContain(before);
      await toggle.click();
      await expect(toggle, 'aria-pressed flips').toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
    });
  });

  test('T9 without JavaScript: content, poster, image sources', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP, javaScriptEnabled: false }, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const poster = await page.locator('video[data-about-video]').getAttribute('poster');
      expect(poster, 'video has poster').toBeTruthy();

      const h2 = page.locator('[data-about-v3] h2');
      await expect(h2).toHaveCount(H2_COUNT);
      for (let i = 0; i < H2_COUNT; i++) await expect(h2.nth(i), `h2 #${i + 1} visible without JS`).toBeVisible();

      const missingSrc = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-about-v3] img'))
          .filter((img) => !img.getAttribute('src'))
          .map((img) => img.outerHTML.slice(0, 120)),
      );
      expect(missingSrc, 'every img in [data-about-v3] has a src attribute').toEqual([]);

      await expect
        .poll(() => page.locator('img[data-about-hero]').evaluate((img) => (img as HTMLImageElement).naturalWidth), {
          message: 'hero decoded without JS',
        })
        .toBeGreaterThan(0);
    });
  });
});

// =============================================================================================
// T10 — accessibility + layout
// =============================================================================================

test.describe('T10 accessibility + layout', () => {
  for (const viewport of [MOBILE, DESKTOP]) {
    test(`T10 axe at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      await withPage(browser, { viewport, bypassCSP: true }, async (page) => {
        await gotoAndSettle(page, ABOUT);
        await scrollThrough(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        await closeOpenDialogs(page);
        await expectNoSeriousAxe(page, `about ${viewport.width}`);
      });
    });
  }

  test('T10 illustration alts; story figure never names the founder', async ({ browser }) => {
    await withPage(browser, {}, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const alts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-about-v3] img')).map((img) => img.getAttribute('alt')),
      );
      expect(alts.filter((a) => a === null), 'every img has an alt attribute').toEqual([]);
      const unlabeled = alts.filter((a): a is string => !!a && a.trim() !== '' && !a.includes('تصویرسازی'));
      expect(unlabeled, 'non-decorative alts disclose «تصویرسازی»').toEqual([]);

      const story = await page.evaluate(() => ({
        alts: Array.from(document.querySelectorAll('[data-about-story] img')).map((i) => i.getAttribute('alt') || ''),
        captions: Array.from(document.querySelectorAll('[data-about-story] figcaption')).map((f) => f.textContent || ''),
      }));
      expect(story.alts.length, 'story figure image present').toBeGreaterThan(0);
      for (const text of [...story.alts, ...story.captions]) {
        expect(text, 'story figure alt/caption does not mention «حامد»').not.toContain('حامد');
      }
    });
  });

  for (const viewport of [SMALL, MOBILE, DESKTOP]) {
    test(`T10 no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      await withPage(browser, { viewport }, async (page) => {
        await gotoAndSettle(page, ABOUT);
        const measure = () =>
          page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
        const top = await measure();
        expect(top.scrollWidth, `scrollWidth ${top.scrollWidth} <= ${top.innerWidth} at top`).toBeLessThanOrEqual(top.innerWidth);
        await scrollThrough(page);
        const bottom = await measure();
        expect(bottom.scrollWidth, `scrollWidth ${bottom.scrollWidth} <= ${bottom.innerWidth} after scroll`).toBeLessThanOrEqual(
          bottom.innerWidth,
        );
      });
    });
  }

  test('T10 rail is keyboard focusable and labelled', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP }, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const rail = page.locator('[data-about-rail]');
      await expect(rail).toHaveCount(1);
      await expect(rail).toHaveAttribute('tabindex', '0');
      expect((await rail.getAttribute('aria-label'))?.trim(), 'rail aria-label').toBeTruthy();
      await rail.focus();
      expect(await rail.evaluate((el) => document.activeElement === el), 'rail receives focus').toBe(true);
    });
  });

  test('T10 scroll-driven rules keep a non-zero animation-duration', async ({ browser }) => {
    await withPage(browser, { viewport: DESKTOP }, async (page) => {
      await gotoAndSettle(page, ABOUT);
      const report = await page.evaluate(() => {
        const offenders: string[] = [];
        let timelineRules = 0;
        let readableSheets = 0;
        const visit = (rules: CSSRuleList) => {
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule) {
              const timeline = rule.style.getPropertyValue('animation-timeline').trim();
              if (timeline && timeline !== 'auto' && timeline !== 'initial') {
                timelineRules++;
                const duration = rule.style.getPropertyValue('animation-duration').trim();
                if (!duration || duration === '0s') offenders.push(`${rule.selectorText} {timeline:${timeline}; duration:${duration || '∅'}}`);
              }
            }
            // CSSMediaRule / CSSSupportsRule / CSSLayerBlockRule / nested style rules.
            const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
            if (nested) visit(nested);
          }
        };
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            visit(sheet.cssRules);
            readableSheets++;
          } catch {
            /* cross-origin sheet */
          }
        }
        return { offenders, timelineRules, readableSheets };
      });
      console.log(`[css] sheets=${report.readableSheets} animation-timeline rules=${report.timelineRules}`);
      expect(report.readableSheets, 'at least one readable stylesheet').toBeGreaterThan(0);
      expect(report.offenders, 'animation-timeline rules must set animation-duration (not 0s/empty)').toEqual([]);
    });
  });
});
