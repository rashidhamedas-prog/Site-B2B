/* Shared e2e helpers (plain CommonJS so the repo tsconfig does not type-check them). */

const WHOLESALE_GA4 = 'G-YVT5DXZF5Z';
const RETAIL_GA4 = 'G-F2V7VSJMLE';
const MODE = process.env.E2E_MODE || 'local';
const ORIGIN = process.env.E2E_WHOLESALE_ORIGIN || 'http://poshaktaranom.com';

const SECRET_PARAMS = /((?:authority|paymentid|payment_id|trackingcode|tracking_code|token|refid|ref_id)=)[^&\s"]+/gi;

/** Redact gateway tokens before anything is printed. */
function redact(value) {
  return String(value ?? '').replace(SECRET_PARAMS, '$1***');
}

/**
 * Records every gtag command (Arguments objects) pushed to dataLayer, including after
 * GTM swaps in its own `push`. Runs before any page script.
 */
function installGtagSpy() {
  const w = window;
  if (w.__e2eGtag) return;
  const log = (w.__e2eGtag = []);
  const record = (entry) => {
    try {
      if (Object.prototype.toString.call(entry) !== '[object Arguments]') return;
      log.push(JSON.parse(JSON.stringify(Array.prototype.slice.call(entry))));
    } catch (e) {
      /* non-serialisable */
    }
  };
  w.__e2eDocLoads = (w.__e2eDocLoads || 0) + 1;
  const dl = (w.dataLayer = w.dataLayer || []);
  let current = Array.prototype.push;
  let depth = 0;
  // GTM wraps push and calls the previous one; re-entrant calls go straight to Array#push.
  const wrapper = function push() {
    if (depth > 0) return Array.prototype.push.apply(dl, arguments);
    for (let i = 0; i < arguments.length; i++) record(arguments[i]);
    depth++;
    try {
      return current.apply(dl, arguments);
    } finally {
      depth--;
    }
  };
  Object.defineProperty(dl, 'push', {
    configurable: true,
    get() {
      return wrapper;
    },
    set(fn) {
      if (fn !== wrapper) current = fn;
    },
  });
}

async function gtagLog(page) {
  return page.evaluate(() => window.__e2eGtag || []);
}

/** gtag('event', name, params) entries. */
async function gtagEvents(page, name) {
  const log = await gtagLog(page);
  return log
    .filter((args) => args[0] === 'event' && (!name || args[1] === name))
    .map((args) => ({ name: args[1], params: args[2] || {} }));
}

function parseHit(url, line) {
  const out = {};
  const q = new URL(url).searchParams;
  for (const [k, v] of q) out[k] = v;
  if (line) for (const [k, v] of new URLSearchParams(line)) out[k] = v;
  return out;
}

/**
 * Captures GA4 collect hits (query + batched body lines) and answers them locally
 * so test traffic never reaches the production property.
 */
async function captureCollect(page) {
  const hits = [];
  const handler = async (route) => {
    const req = route.request();
    const body = req.postData() || '';
    const lines = body.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) hits.push(parseHit(req.url(), ''));
    for (const line of lines) hits.push(parseHit(req.url(), line));
    await route.fulfill({ status: 204, body: '' });
  };
  await page.route(/\/g\/collect/, handler);
  await page.route(/\/mp\/collect/, handler);
  return hits;
}

function fakeJwt(payload) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.e2e-signature`;
}

const TEST_CUSTOMER = 'cust-e2e-0001';
const TEST_TOKEN = fakeJwt({
  sub: 'user-e2e',
  customerId: TEST_CUSTOMER,
  role: 'CUSTOMER',
  purpose: 'wholesale',
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const CART_ITEM = {
  productId: 'prod-e2e-1',
  productName: 'مانتو آزمون',
  sku: 'E2E-SKU-1',
  unitPrice: 12_000_000,
  minOrderQty: 1,
  quantity: 2,
};

/** Fake profile used only inside mocked responses (never real customer data). */
const TEST_PROFILE = {
  customerId: TEST_CUSTOMER,
  ownerName: 'کاربر آزمون',
  businessName: 'فروشگاه آزمون',
  phone: '09120000000',
  addresses: [
    {
      recipient: 'کاربر آزمون',
      mobile: '09120000000',
      province: 'تهران',
      city: 'تهران',
      street: 'خیابان آزمون',
      isDefault: true,
    },
  ],
};

async function seedStorage(page, { token, cart, cohortSinceDaysAgo } = {}) {
  await page.addInitScript(
    ({ token, cart, cohortSinceDaysAgo }) => {
      try {
        if (sessionStorage.getItem('__e2eSeeded')) return;
        sessionStorage.setItem('__e2eSeeded', '1');
        if (token) {
          localStorage.setItem('taranom_wholesale_token', token);
          localStorage.setItem('taranom_wholesale_role', 'CUSTOMER');
        }
        if (cart) localStorage.setItem('taranom_cart', JSON.stringify(cart));
        if (typeof cohortSinceDaysAgo === 'number') {
          localStorage.setItem(
            'taranom_ga4_cart_cohort',
            JSON.stringify({ fp: '', since: Date.now() - cohortSinceDaysAgo * 86_400_000 }),
          );
        }
      } catch (e) {
        /* storage blocked */
      }
    },
    { token, cart, cohortSinceDaysAgo },
  );
}

function isApiUrl(url) {
  if (/google|doubleclick|gstatic/.test(url.hostname)) return false;
  return /^\/(api\/)?v1\//.test(url.pathname) || url.port === '4000';
}

/**
 * Browser-side API mock. Writes are always mocked (or aborted when unknown) so a run against
 * production can never create orders/payments. `passthroughGets` lets public reads hit prod.
 */
async function mockApi(page, opts = {}) {
  const state = {
    orderStatus: opts.orderStatus ?? 200,
    orderPosts: [],
    blocked: [],
    verifyBodies: [],
  };
  const json = (route, status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // Registered first so it runs last: any write to a site/API host that no mock handled is aborted.
  await page.route(
    (url) => /(^|\.)poshaktaranom\.(com|ir)$/.test(url.hostname) || url.port === '4000',
    async (route) => {
      const method = route.request().method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.fallback();
      state.blocked.push(`${method} ${redact(new URL(route.request().url()).pathname)}`);
      return route.abort('blockedbyclient');
    },
  );

  await page.route(isApiUrl, async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/(api\/)?v1/, '');

    if (path.startsWith('/auth/me/profile')) return json(route, 200, TEST_PROFILE);
    if (path.startsWith('/auth/me')) return json(route, 200, { id: 'user-e2e', customerId: TEST_CUSTOMER, role: 'CUSTOMER' });
    if (path.startsWith('/shipping/methods')) {
      return json(route, 200, [
        { id: 'TIPAX', label: 'تیپاکس' },
        { id: 'PISHTAZ', label: 'پست پیشتاز' },
      ]);
    }
    if (path.startsWith('/settings/public') && !opts.passthroughGets) {
      return json(route, 200, {
        installments: { minDownPaymentPercent: 0, minDownPaymentAmount: 0, maxMonths: 6 },
        payment: { enabled: false, wholesaleCashEnabled: true },
        shipping: { wholesale: { freeThreshold: 50_000_000, baseFee: 1_500_000 } },
        marketing: {},
      });
    }
    if (path.startsWith('/orders/quote-discounts')) return json(route, 200, { discount: 0 });
    if (path.startsWith('/orders/installment-eligibility')) return json(route, 200, { eligible: false });
    if (path === '/orders' && method === 'POST') {
      state.orderPosts.push(1);
      if (state.orderStatus >= 400) return json(route, state.orderStatus, { message: 'e2e mocked failure' });
      return json(route, 200, { id: 'order-e2e-1', orderNumber: 'WS-E2E-0001', total: 24_000_000 });
    }
    if (path.startsWith('/payments/verify')) {
      state.verifyBodies.push(1);
      return json(route, 200, opts.verify ?? { ok: false, cancelled: true });
    }
    if (path.startsWith('/payments/start')) return json(route, 200, { redirectUrl: '/payment/callback?paymentId=e2e' });
    if (/^\/(cart\/heartbeat|storefront\/marketing\/checkout-intent|web-vitals|rum|analytics)/.test(path)) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      state.blocked.push(`${method} ${redact(path)}`);
      return route.abort('blockedbyclient');
    }
    if (opts.passthroughGets) return route.continue();
    return json(route, 200, {});
  });
  return state;
}

const PRODUCTION_HOST = /(^|\.)poshaktaranom\.(com|ir)$/i;
const MOCK_API_BASE = (
  process.env.E2E_MOCK_API_URL ||
  `http://127.0.0.1:${process.env.E2E_MOCK_API_PORT || '4010'}/v1`
).replace(/\/$/, '');

function isKnownStorefrontApi(pathname) {
  const path = pathname.replace(/^\/api(?=\/)/, '').replace(/^\/v1(?=\/|$)/, '') || '/';
  return /^\/(products|settings|categories|collections|cms|blog)(\/|$)/.test(path);
}

function toMockApiUrl(raw) {
  const url = new URL(raw);
  let path = url.pathname.replace(/^\/api(?=\/)/, '');
  if (path === '/v1') path = '/v1/';
  if (!path.startsWith('/v1/') && path !== '/v1') {
    path = `/v1${path.startsWith('/') ? path : `/${path}`}`;
  }
  const suffix = path.replace(/^\/v1/, '') || '/';
  return `${MOCK_API_BASE}${suffix}${url.search}`;
}

/**
 * Browser requests to the production store must never leave the machine.
 * Known catalog/settings reads are answered by the local mock. Anything else
 * is aborted and recorded so the spec can fail.
 * Register this AFTER mockApi — Playwright runs the newest route first.
 */
async function guardProductionHosts(page) {
  const leaks = [];
  await page.route(
    (url) => PRODUCTION_HOST.test(url.hostname),
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method();
      const known = isKnownStorefrontApi(url.pathname);
      const safeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'POST';
      if (!known || !safeMethod) {
        leaks.push(`${method} ${url.hostname}${url.pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      const target = new URL(toMockApiUrl(req.url()));
      const lib = target.protocol === 'https:' ? require('https') : require('http');
      const body = req.postDataBuffer();
      try {
        const upstream = await new Promise((resolve, reject) => {
          const upstreamReq = lib.request(
            {
              protocol: target.protocol,
              hostname: target.hostname,
              port: target.port,
              path: `${target.pathname}${target.search}`,
              method,
              headers: { accept: 'application/json' },
            },
            (upstreamRes) => {
              const chunks = [];
              upstreamRes.on('data', (chunk) => chunks.push(chunk));
              upstreamRes.on('end', () => {
                resolve({
                  status: upstreamRes.statusCode || 502,
                  body: Buffer.concat(chunks),
                });
              });
            },
          );
          upstreamReq.on('error', reject);
          if (body && method !== 'GET' && method !== 'HEAD') upstreamReq.write(body);
          upstreamReq.end();
        });
        await route.fulfill({
          status: upstream.status,
          contentType: 'application/json',
          body: upstream.body,
        });
      } catch (error) {
        leaks.push(`${method} ${url.hostname}${url.pathname} (mock failed: ${error && error.message ? error.message : error})`);
        await route.abort('failed');
      }
    },
  );
  return leaks;
}

/** Collect page errors; React #418 is a hydration mismatch. */
function watchPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
  return errors;
}

function hydrationErrors(errors) {
  return errors.filter((m) => /#418|#423|#425|Hydration|did not match/i.test(m));
}

/** Short printable evidence line for a GA hit or a gtag event. */
function describeHit(hit) {
  return redact(
    JSON.stringify({ tid: hit.tid, en: hit.en, dl: hit.dl, dp: hit.dp, dr: hit.dr, ir: hit.ir }),
  );
}

async function waitForGtag(page, predicate, timeout = 15_000) {
  const started = Date.now();
  for (;;) {
    const log = await gtagLog(page);
    if (predicate(log)) return log;
    if (Date.now() - started > timeout) return log;
    await page.waitForTimeout(250);
  }
}

module.exports = {
  CART_ITEM,
  MODE,
  ORIGIN,
  RETAIL_GA4,
  TEST_PROFILE,
  TEST_TOKEN,
  WHOLESALE_GA4,
  captureCollect,
  describeHit,
  gtagEvents,
  gtagLog,
  hydrationErrors,
  installGtagSpy,
  guardProductionHosts,
  mockApi,
  redact,
  seedStorage,
  waitForGtag,
  watchPageErrors,
};
