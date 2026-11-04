/**
 * npx ts-node --transpile-only src/modules/basalam/basalam.service.spec.ts
 */
import { BasalamService } from './basalam.service';
import { isDryRun } from './basalam.controller';
import type { BasalamHttp, BasalamHttpRequest } from './basalam-http';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const TOKEN = 'SECRET-TOKEN-do-not-leak-123';

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    sku: 'COATS00015',
    name: 'کت اریکا',
    status: 'ACTIVE',
    showOnRetail: true,
    showOnWholesale: true,
    retailPrice: 8_900_000,
    wholesalePrice: 6_000_000,
    description: '<p>پارچه لینن</p>',
    retailFullContent: null,
    images: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    variants: [
      { size: 'M', color: 'مشکی', retailStock: 2, wholesaleStock: 40, stock: 99 },
      { size: 'L', color: 'مشکی', retailStock: 3, wholesaleStock: 50, stock: 99 },
    ],
    ...overrides,
  };
}

function harness(opts: { map?: Record<string, number>; enabled?: boolean; rows?: any[] } = {}) {
  const marketing = {
    basalamEnabled: opts.enabled ?? true,
    basalamAccessToken: TOKEN,
    basalamVendorId: '78910',
    basalamProductMap: { ...(opts.map || {}) },
  };
  const settingsWrites: unknown[] = [];
  const settings: any = {
    marketing: async () => marketing,
    get: async () => marketing,
    set: async (_key: string, value: unknown) => settingsWrites.push(value),
  };
  const repo: any = { find: async () => opts.rows ?? [product()] };
  const calls: BasalamHttpRequest[] = [];
  const downloads: string[] = [];
  const http: BasalamHttp = {
    request: async (req) => {
      calls.push(req);
      if (req.url.endsWith('/categories')) {
        return { ok: true, status: 200, json: { data: [{ id: 390, title: 'پوشاک زنانه' }] } };
      }
      return { ok: true, status: 200, json: { data: [], id: 555 } };
    },
    download: async (url) => {
      downloads.push(url);
      return { ok: true, status: 200, contentType: 'image/jpeg', bytes: new Uint8Array(64) };
    },
  };
  const svc = new BasalamService(repo, settings, http);
  return { svc, calls, downloads, settingsWrites, marketing };
}

async function captureOutput<T>(fn: () => Promise<T>): Promise<{ result: T; output: string }> {
  let output = '';
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  (process.stdout as any).write = (chunk: any, ...rest: any[]) => {
    output += String(chunk);
    return out(chunk, ...rest);
  };
  (process.stderr as any).write = (chunk: any, ...rest: any[]) => {
    output += String(chunk);
    return err(chunk, ...rest);
  };
  try {
    return { result: await fn(), output };
  } finally {
    (process.stdout as any).write = out;
    (process.stderr as any).write = err;
  }
}

async function main() {
  let globalFetchCalls = 0;
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    globalFetchCalls += 1;
    throw new Error('network forbidden in spec');
  };

  try {
    assert(isDryRun('1') && isDryRun('true') && !isDryRun('0') && !isDryRun(undefined), 'isDryRun parsing');

    // push-catalog dry-run: payload built, zero network, map untouched, token absent.
    {
      const h = harness();
      const mapBefore = JSON.stringify(h.marketing.basalamProductMap);
      const { result, output } = await captureOutput(() => h.svc.pushCatalog(8, { dryRun: true }));
      const res: any = result;
      assert(h.calls.length === 0 && h.downloads.length === 0, 'dry-run push: zero BasalamHttp calls');
      assert(h.settingsWrites.length === 0, 'dry-run push: no settings/map write');
      assert(JSON.stringify(h.marketing.basalamProductMap) === mapBefore, 'dry-run push: map unchanged');
      assert(res.dryRun === true && res.wouldCreate === 1, 'dry-run push: one create');
      const body = res.items[0].request.body;
      assert(body.primary_price === 8_900_000, 'dry-run push: primary_price in Rial');
      assert(body.stock === 5, 'dry-run push: retail stock sum (wholesale/legacy ignored)');
      assert(body.photo === 'https://cdn.example/a.jpg', 'dry-run push: main photo as URL');
      assert(Array.isArray(body.photos) && body.photos[0] === 'https://cdn.example/b.jpg', 'dry-run push: photos as URLs');
      assert(body.category_id === null, 'dry-run push: category resolved at push time');
      const variants = res.items[0].variants;
      assert(variants.length === 2 && variants[0].retailStock === 2 && variants[1].retailStock === 3, 'dry-run push: variants');
      assert(!('wholesaleStock' in variants[0]), 'dry-run push: no wholesale stock exposed');
      assert(res.config.hasToken === true && res.config.vendorId === 78910, 'dry-run push: config summary');
      assert(!JSON.stringify(res).includes(TOKEN), 'dry-run push: token not in response');
      assert(!output.includes(TOKEN), 'dry-run push: token not in logs');
    }

    // dry-run works even when integration is disabled (preview before enabling).
    {
      const h = harness({ enabled: false });
      const res: any = await h.svc.pushCatalog(8, { dryRun: true });
      assert(res.config.enabled === false && h.calls.length === 0, 'dry-run allowed while disabled');
    }

    // dry-run: product without photos reported as fail, still no network.
    {
      const h = harness({ rows: [product({ images: [] })] });
      const res: any = await h.svc.pushCatalog(8, { dryRun: true });
      assert(res.wouldFail === 1 && res.ok === false && h.calls.length === 0, 'dry-run push: missing photo reported');
    }

    // sync-inventory dry-run: bulk body returned, no call.
    {
      const h = harness({ map: { p1: 24018670 } });
      const { result, output } = await captureOutput(() => h.svc.syncInventory(50, { dryRun: true }));
      const res: any = result;
      assert(h.calls.length === 0, 'dry-run sync: zero BasalamHttp calls');
      assert(res.dryRun === true && res.updated === 0 && res.wouldUpdate === 1, 'dry-run sync: counts');
      assert(res.request.method === 'PATCH' && String(res.request.url).includes('/vendors/78910/'), 'dry-run sync: request');
      const item = res.request.body.data[0];
      assert(item.id === 24018670 && item.primary_price === 8_900_000 && item.stock === 5, 'dry-run sync: Rial + retail stock');
      assert(!('price' in item), 'dry-run sync: legacy price field gone');
      assert(!JSON.stringify(res).includes(TOKEN) && !output.includes(TOKEN), 'dry-run sync: token not leaked');
    }

    // real sync goes through the injected port with primary_price (Rial).
    {
      const h = harness({ map: { p1: 24018670 } });
      const res: any = await h.svc.syncInventory(50);
      assert(res.ok === true && res.updated === 1, 'real sync ok');
      assert(h.calls.length === 1 && h.calls[0].method === 'PATCH', 'real sync: one bulk PATCH via port');
      const body: any = h.calls[0].body;
      assert(body.data[0].primary_price === 8_900_000 && body.data[0].stock === 5, 'real sync: body');
    }

    // real push uploads via port, creates, persists map.
    {
      const h = harness();
      const res: any = await h.svc.pushCatalog(8);
      assert(res.created === 1, 'real push: created');
      const create = h.calls.find((c) => c.method === 'POST' && c.url.endsWith('/vendors/78910/products'));
      assert(create && (create.body as any).primary_price === 8_900_000, 'real push: create body in Rial');
      assert(h.settingsWrites.length === 1, 'real push: map persisted');
    }

    assert(globalFetchCalls === 0, 'global fetch never called');
  } finally {
    (globalThis as any).fetch = realFetch;
  }
  console.log('basalam.service.spec.ts: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
