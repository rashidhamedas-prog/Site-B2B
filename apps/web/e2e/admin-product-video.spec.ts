/**
 * Admin product-video panel (UI-SPEC §1). All API + media requests are mocked with page.route,
 * so the browser never reaches production. Run with e2e/playwright.admin-video.config.ts.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const PID = '6f1c2a5e-8f9b-4c3d-9a7e-1b2c3d4e5f60';
const VID = '0d6c8f4e-2b1a-4c9d-8e7f-6a5b4c3d2e1f';
const MEDIA = 'https://media.e2e.test';
const IMAGES = [`${MEDIA}/products/a.webp`, `${MEDIA}/products/b.webp`, `${MEDIA}/products/c.webp`];
const CANDIDATES = [10, 50, 90].map((p) => `${MEDIA}/videos/${PID}/${VID}/poster-${p}.webp`);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const MSG = {
  BAD_TYPE: 'فرمت پشتیبانی نمی‌شود. فقط MP4، MOV یا WebM.',
  TOO_BIG: 'حجم فایل بیش از ۲۰۰ مگابایت است.',
  TOO_LONG: 'ویدیو بیش از ۶۰ ثانیه است. کوتاه‌ترش کنید.',
  PROCESSING_FAILED: 'پردازش ناموفق بود. دوباره تلاش کنید یا فایل دیگری بفرستید.',
  CONNECTION_LOST: 'اتصال قطع شد. آپلود از سر گرفته می‌شود.',
  DISK_LOW: 'فضای سرور کافی نیست.',
  PREPARING: 'در حال آماده‌سازی ویدیو… می‌توانید صفحه را ترک کنید',
  DELETE_CONFIRM: 'ویدیو و پوسترش حذف شود؟',
};

const PRODUCT = {
  id: PID,
  sku: 'E2E-VID-1',
  name: 'مانتو تست ویدیو',
  fabric: '',
  status: 'ACTIVE',
  isFeatured: false,
  isNew: false,
  wholesalePrice: 1_000_000,
  retailPrice: 1_500_000,
  minOrderQty: 1,
  images: IMAGES,
  variants: [],
  sizeType: 'FREE',
  categoryId: '11111111-2222-4333-8444-555555555555',
  categoryIds: ['11111111-2222-4333-8444-555555555555'],
};

type Row = Record<string, unknown>;

function videoRow(patch: Row = {}): Row {
  return {
    id: VID,
    product_id: PID,
    status: 'ready',
    error_code: null,
    duration_sec: 12.4,
    width: 720,
    height: 900,
    bytes_out: '3460300',
    mp4_720: `${MEDIA}/videos/${PID}/${VID}/720.mp4`,
    mp4_480: `${MEDIA}/videos/${PID}/${VID}/480.mp4`,
    webm_720: `${MEDIA}/videos/${PID}/${VID}/720.webm`,
    poster_candidates: CANDIDATES,
    poster: CANDIDATES[1],
    sort_order: 2,
    ...patch,
  };
}

class MockApi {
  calls: Array<{ method: string; path: string; body: unknown; headers: Record<string, string> }> = [];
  videoGets: number[] = [];
  afterUpload: Array<Row | null> = [videoRow({ status: 'processing', poster: null, poster_candidates: [] }), videoRow()];
  afterRetry: Array<Row | null> = [videoRow()];
  constructor(
    public seq: Array<Row | null> = [null],
    public uploadPlan: Array<'ok' | 'network' | 'slow'> = ['ok'],
  ) {}

  nextVideo(): Row | null {
    return this.seq.length > 1 ? (this.seq.shift() as Row | null) : (this.seq[0] ?? null);
  }

  setPoster(poster: string) {
    this.seq = this.seq.map((row) => (row ? { ...row, poster } : row));
  }

  count(method: string, path: string): number {
    return this.calls.filter((c) => c.method === method && c.path === path).length;
  }
}

function jwtWith(payload: Record<string, unknown>): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${json}.x`;
}

async function safe(fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    /* page closed or request aborted by the client */
  }
}

function json(route: Route, body: unknown, status = 200) {
  return safe(() =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: body === null ? '' : JSON.stringify(body),
    }),
  );
}

async function handleApi(route: Route, api: MockApi, path: string) {
  const req = route.request();
  const method = req.method();
  let body: unknown = null;
  if (method !== 'GET' && !(req.headers()['content-type'] || '').startsWith('multipart/')) {
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
  }
  api.calls.push({ method, path, body, headers: req.headers() });

  if (method === 'GET' && path === '/products/admin') {
    return json(route, { data: [PRODUCT], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  }
  if (method === 'GET' && path === `/products/${PID}`) return json(route, PRODUCT);
  if (method === 'GET' && path === `/products/${PID}/video`) {
    api.videoGets.push(Date.now());
    return json(route, api.nextVideo());
  }
  if (method === 'POST' && path === '/upload/video') {
    const plan = api.uploadPlan.length > 1 ? api.uploadPlan.shift()! : api.uploadPlan[0];
    if (plan === 'network') return safe(() => route.abort('internetdisconnected'));
    if (plan === 'slow') await new Promise((r) => setTimeout(r, 8_000));
    else await new Promise((r) => setTimeout(r, 1_200));
    api.seq = [...api.afterUpload];
    return json(route, { id: VID, product_id: PID, status: 'queued', sort_order: 2 });
  }
  if (method === 'POST' && path === `/products/${PID}/video/retry`) {
    api.seq = [...api.afterRetry];
    return json(route, { id: VID, product_id: PID, status: 'queued', error_code: null });
  }
  if (method === 'PATCH' && path === `/products/${PID}/video/poster`) {
    const b = body as { key?: string; url?: string };
    const poster = String(b?.key ?? b?.url ?? '');
    api.setPoster(poster);
    return json(route, { poster });
  }
  if (method === 'PATCH' && path === `/products/${PID}/video/order`) {
    return json(route, { sort_order: (body as { sort_order: number }).sort_order });
  }
  if (method === 'DELETE' && path === `/products/${PID}/video`) return json(route, { deleted: true });
  if (method === 'POST' && path === '/upload/image') {
    return json(route, { url: `${MEDIA}/products/custom-poster.webp`, key: 'products/custom-poster.webp' });
  }
  if (method === 'PATCH' && path === `/products/${PID}`) return json(route, { id: PID });
  if (method === 'GET' && path === '/vendors') return json(route, { data: [] });
  if (method === 'GET') return json(route, []);
  return json(route, {});
}

async function openEditor(page: Page, api: MockApi) {
  await page.route('**/*', async (route) => {
    let url: URL;
    try {
      url = new URL(route.request().url());
    } catch {
      return safe(() => route.continue());
    }
    const host = url.hostname.toLowerCase();
    if (host === 'media.e2e.test') {
      if (/\.(webp|png|jpg)$/.test(url.pathname)) {
        return safe(() => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
      }
      return safe(() => route.fulfill({ status: 404, body: '' }));
    }
    const apiMatch = /^(?:\/api)?\/v1(\/.*)$/.exec(url.pathname);
    if (apiMatch) return handleApi(route, api, apiMatch[1]);
    if (host.endsWith('poshaktaranom.com') || host.endsWith('poshaktaranom.ir')) {
      return safe(() => route.abort());
    }
    return safe(() => route.continue());
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
    const w = window as unknown as {
      __e2eVideoDuration: number;
      __e2eRevoked: string[];
      __e2eStatusLog: string[];
    };
    w.__e2eVideoDuration = 12;
    w.__e2eRevoked = [];
    w.__e2eStatusLog = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (u: string) => {
      w.__e2eRevoked.push(u);
      revoke(u);
    };
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      get() {
        return desc.get!.call(this);
      },
      set(v: string) {
        if (typeof v === 'string' && v.startsWith('blob:')) {
          const d = w.__e2eVideoDuration;
          Object.defineProperty(this, 'duration', { configurable: true, get: () => d });
          setTimeout(() => (this as HTMLMediaElement).dispatchEvent(new Event('loadedmetadata')), 20);
          return;
        }
        desc.set!.call(this, v);
      },
    });
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="product-video-status"]');
      const text = el?.textContent?.trim() ?? '';
      const log = w.__e2eStatusLog;
      if (text && log[log.length - 1] !== text) log.push(text);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, token);

  await page.goto('/admin/products', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.getByRole('button', { name: `ویرایش ${PRODUCT.name}` }).first().click({ timeout: 60_000 });
  const card = page.getByTestId('product-video-card');
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.scrollIntoViewIfNeeded();
  return card;
}

const status = (page: Page) => page.getByTestId('product-video-status');

test('upload → queued → processing → ready, with progress, aria-live and auth header', async ({ page }) => {
  const api = new MockApi([null]);
  const card = await openEditor(page, api);
  await expect(status(page)).toHaveAttribute('aria-live', 'polite');
  await expect(status(page)).toHaveAttribute('role', 'status');

  await page.getByTestId('product-video-input').setInputFiles({
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(4096, 1),
  });
  const bar = card.getByRole('progressbar', { name: 'پیشرفت آپلود ویدیو' });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', /^\d+$/);
  await expect(card.getByRole('button', { name: 'لغو' })).toBeVisible();
  await expect(status(page)).toContainText('در حال آپلود');

  await expect(status(page)).toContainText('در صف پردازش');
  await expect(status(page)).toContainText(MSG.PREPARING);
  await expect(status(page)).toContainText('در حال پردازش', { timeout: 12_000 });
  await expect(status(page)).toContainText('آماده', { timeout: 12_000 });

  const upload = api.calls.find((c) => c.method === 'POST' && c.path === '/upload/video')!;
  expect(upload.headers['authorization']).toMatch(/^Bearer /);
  expect(upload.headers['content-type']).toMatch(/^multipart\/form-data/);

  const video = card.locator('video');
  await expect(video).toHaveAttribute('poster', CANDIDATES[1]);
  await expect(video).toHaveAttribute('preload', 'metadata');
  expect(await video.evaluate((v: HTMLVideoElement) => [v.muted, v.controls, v.playsInline])).toEqual([true, true, true]);
  await expect(card.getByTestId('product-video-duration')).toHaveText('۰:۱۲');
  await expect(card.getByTestId('product-video-size')).toContainText('مگابایت');

  const gets = api.videoGets.length;
  const gaps = api.videoGets.slice(1).map((t, i) => t - api.videoGets[i]);
  expect(gaps.slice(1).every((g) => g >= 4_500)).toBe(true);
  await page.waitForTimeout(6_000);
  expect(api.videoGets.length).toBe(gets);

  const log = await page.evaluate(() => (window as unknown as { __e2eStatusLog: string[] }).__e2eStatusLog);
  const order = ['در حال آپلود', 'در صف پردازش', 'در حال پردازش', 'آماده'].map((label) =>
    log.findIndex((entry) => entry.startsWith(`${label} —`)),
  );
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  const revoked = await page.evaluate(() => (window as unknown as { __e2eRevoked: string[] }).__e2eRevoked);
  expect(revoked.some((u) => u.startsWith('blob:'))).toBe(true);
});

test('network drop shows reconnect notice and restarts the upload automatically', async ({ page }) => {
  const api = new MockApi([null], ['network', 'ok']);
  await openEditor(page, api);
  await page.getByTestId('product-video-input').setInputFiles({
    name: 'clip.webm',
    mimeType: 'video/webm',
    buffer: Buffer.alloc(2048, 2),
  });
  await expect(status(page)).toContainText(MSG.CONNECTION_LOST);
  await expect(status(page)).toContainText('در صف پردازش', { timeout: 15_000 });
  expect(api.count('POST', '/upload/video')).toBe(2);
});

test('cancel aborts the upload and returns to the upload zone', async ({ page }) => {
  const api = new MockApi([null], ['slow']);
  const card = await openEditor(page, api);
  await page.getByTestId('product-video-input').setInputFiles({
    name: 'clip.mov',
    mimeType: 'video/quicktime',
    buffer: Buffer.alloc(2048, 3),
  });
  await card.getByRole('button', { name: 'لغو' }).click();
  await expect(status(page)).toContainText('آپلود لغو شد.');
  await expect(card.getByRole('progressbar')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'آپلود ویدیو' })).toBeVisible();
});

test('client validation: bad type, >200MB (drag&drop) and >60s never reach the API', async ({ page }) => {
  const api = new MockApi([null]);
  const card = await openEditor(page, api);
  const input = page.getByTestId('product-video-input');

  await input.setInputFiles({ name: 'clip.avi', mimeType: 'video/x-msvideo', buffer: Buffer.alloc(64) });
  await expect(status(page)).toContainText(MSG.BAD_TYPE);
  await input.setInputFiles({ name: 'clip.mp4', mimeType: 'video/webm', buffer: Buffer.alloc(64) });
  await expect(status(page)).toContainText(MSG.BAD_TYPE);

  await page.evaluate(() => {
    const zone = document.querySelector('[data-testid="product-video-dropzone"]')!;
    const big = new File([new Uint8Array(201 * 1024 * 1024)], 'big.mp4', { type: 'video/mp4' });
    const dt = new DataTransfer();
    dt.items.add(big);
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(status(page)).toContainText(MSG.TOO_BIG);

  await page.evaluate(() => {
    (window as unknown as { __e2eVideoDuration: number }).__e2eVideoDuration = 75;
  });
  await input.setInputFiles({ name: 'long.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(64) });
  await expect(status(page)).toContainText(MSG.TOO_LONG);
  const revoked = await page.evaluate(() => (window as unknown as { __e2eRevoked: string[] }).__e2eRevoked);
  expect(revoked.length).toBeGreaterThanOrEqual(1);

  expect(api.count('POST', '/upload/video')).toBe(0);
  await expect(card.getByRole('button', { name: 'آپلود ویدیو' })).toBeVisible();
});

for (const [code, message] of [
  ['TRANSCODE_FAILED', MSG.PROCESSING_FAILED],
  ['TOO_LONG', MSG.TOO_LONG],
  ['DISK_LOW', MSG.DISK_LOW],
] as const) {
  test(`failed (${code}) shows Persian cause with retry and delete`, async ({ page }) => {
    const api = new MockApi([videoRow({ status: 'failed', error_code: code, poster: null })]);
    const card = await openEditor(page, api);
    await expect(status(page)).toContainText('خطا');
    await expect(status(page)).toContainText(message);
    await expect(card.getByRole('button', { name: 'تلاش مجدد' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'حذف' })).toBeVisible();
  });
}

test('failed → retry → queued → ready', async ({ page }) => {
  const api = new MockApi([videoRow({ status: 'failed', error_code: 'TIMEOUT', poster: null })]);
  api.afterRetry = [videoRow({ status: 'processing', poster: null, poster_candidates: [] }), videoRow()];
  const card = await openEditor(page, api);
  await expect(status(page)).toContainText(MSG.PROCESSING_FAILED);
  await card.getByRole('button', { name: 'تلاش مجدد' }).click();
  expect(api.count('POST', `/products/${PID}/video/retry`)).toBe(1);
  await expect(status(page)).toContainText('در صف پردازش');
  await expect(status(page)).toContainText('آماده', { timeout: 15_000 });
});

test('delete: accessible confirm, soft delete until save, focus returns to upload button', async ({ page }) => {
  const api = new MockApi([videoRow()]);
  const card = await openEditor(page, api);
  const deleteButton = card.getByRole('button', { name: 'حذف' });

  await deleteButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: MSG.DELETE_CONFIRM });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('button', { name: 'انصراف' })).toBeFocused();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(deleteButton).toBeFocused();

  await deleteButton.click();
  await dialog.getByRole('button', { name: 'حذف' }).click();
  await expect(dialog).toHaveCount(0);
  const uploadButton = card.getByRole('button', { name: 'آپلود ویدیو' });
  await expect(uploadButton).toBeFocused();
  await expect(status(page)).toContainText('در انتظار حذف');
  expect(api.count('DELETE', `/products/${PID}/video`)).toBe(0);

  await card.getByRole('button', { name: 'بازگردانی' }).click();
  await expect(status(page)).toContainText('آماده');
  await card.getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'حذف' }).click();
  await expect(uploadButton).toBeFocused();

  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect.poll(() => api.count('DELETE', `/products/${PID}/video`)).toBe(1);
  expect(api.count('PATCH', `/products/${PID}`)).toBe(1);
});

test('poster: 3 candidates as keyboard radios, default 50%, custom upload', async ({ page }) => {
  const api = new MockApi([videoRow()]);
  const card = await openEditor(page, api);
  const group = card.getByRole('radiogroup', { name: 'انتخاب پوستر ویدیو' });
  const radios = group.getByRole('radio');
  await expect(radios).toHaveCount(3);
  await expect(group.getByRole('radio', { name: 'فریم ۵۰٪' })).toHaveAttribute('aria-checked', 'true');
  await expect(group.getByRole('radio', { name: 'فریم ۱۰٪' })).toHaveAttribute('tabindex', '-1');

  await group.getByRole('radio', { name: 'فریم ۵۰٪' }).focus();
  await page.keyboard.press('ArrowLeft');
  const r90 = group.getByRole('radio', { name: 'فریم ۹۰٪' });
  await expect(r90).toBeFocused();
  await expect(r90).toHaveAttribute('aria-checked', 'true');
  const posterCalls = () => api.calls.filter((c) => c.path === `/products/${PID}/video/poster`);
  expect(posterCalls().at(-1)?.body).toEqual({ key: CANDIDATES[2] });

  await group.getByRole('radio', { name: 'فریم ۱۰٪' }).click();
  await expect(group.getByRole('radio', { name: 'فریم ۱۰٪' })).toHaveAttribute('aria-checked', 'true');

  await card.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'poster.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(group.getByRole('radio', { name: 'تصویر دلخواه' })).toHaveAttribute('aria-checked', 'true');
  expect(posterCalls().at(-1)?.body).toEqual({ url: `${MEDIA}/products/custom-poster.webp` });
  expect(api.count('POST', '/upload/image')).toBe(1);
});

test('missing poster blocks publishing (ACTIVE) until a poster is chosen', async ({ page }) => {
  const api = new MockApi([videoRow({ poster: null })]);
  const card = await openEditor(page, api);
  const save = page.getByRole('button', { name: 'ذخیره', exact: true });
  await expect(status(page)).toContainText('بدون پوستر ویدیو منتشر نمی‌شود');
  await expect(save).toBeDisabled();
  await expect(page.locator('#product-video-publish-hint')).toBeVisible();
  await expect(save).toHaveAttribute('aria-describedby', 'product-video-publish-hint');
  await card.getByRole('radio', { name: 'فریم ۵۰٪' }).click();
  await expect(save).toBeEnabled();
});

test('order: slot 1 locked, drag + keyboard move, persisted on save', async ({ page }) => {
  const api = new MockApi([videoRow()]);
  const card = await openEditor(page, api);
  const label = card.locator('#product-video-order-label');
  await expect(label).toContainText('جایگاه در گالری: ۲');
  await expect(card.locator('li[aria-label^="تصویر ۱"]')).toContainText('۱');
  await expect(card.getByRole('button', { name: 'انتقال ویدیو به جایگاه قبلی' })).toBeDisabled();

  const videoSlot = card.getByTestId('product-media-video-slot');
  await videoSlot.dragTo(card.locator('li[aria-label="تصویر · جایگاه ۴"]'));
  await expect(label).toContainText('جایگاه در گالری: ۴');
  await expect(card.getByRole('button', { name: 'انتقال ویدیو به جایگاه بعدی' })).toBeDisabled();

  await card.getByTestId('product-media-video-slot').dragTo(card.locator('li[aria-label^="تصویر ۱"]'));
  await expect(label).toContainText('جایگاه در گالری: ۴');

  await card.getByRole('button', { name: 'انتقال ویدیو به جایگاه قبلی' }).focus();
  await page.keyboard.press('Enter');
  await expect(label).toContainText('جایگاه در گالری: ۳');
  expect(api.count('PATCH', `/products/${PID}/video/order`)).toBe(0);

  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect.poll(() => api.count('PATCH', `/products/${PID}/video/order`)).toBe(1);
  const call = api.calls.find((c) => c.path === `/products/${PID}/video/order`)!;
  expect(call.body).toEqual({ sort_order: 3 });
});

test('keyboard: every ready-state control is reachable with Tab and shows a focus ring', async ({ page }) => {
  const api = new MockApi([videoRow()]);
  const card = await openEditor(page, api);
  await card.getByRole('radio', { name: 'فریم ۵۰٪' }).focus();
  const seen: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const inCard = !!el.closest('[data-testid="product-video-card"]');
      return {
        name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName,
        inCard,
        ring: getComputedStyle(el).boxShadow,
      };
    });
    if (!info.inCard) break;
    seen.push(info.name);
    if (i > 0) expect(info.ring).not.toBe('none');
    await page.keyboard.press('Tab');
  }
  expect(seen).toEqual([
    'فریم ۵۰٪',
    'آپلود تصویر دلخواه',
    'حذف',
    'انتقال ویدیو به جایگاه بعدی',
  ]);
});

test('polling pauses while the tab is hidden and resumes on visibility', async ({ page }) => {
  const api = new MockApi([videoRow({ status: 'processing', poster: null, poster_candidates: [] })]);
  await openEditor(page, api);
  await expect(status(page)).toContainText('در حال پردازش');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = api.videoGets.length;
  await page.waitForTimeout(7_000);
  expect(api.videoGets.length).toBe(before);
  api.seq = [videoRow()];
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(status(page)).toContainText('آماده', { timeout: 3_000 });
});
