/**
 * npx ts-node --transpile-only src/modules/product/product-slug-redirect.spec.ts
 */
import { BadRequestException } from '@nestjs/common';
import { normalizePublicSlug } from '../../common/public-slug';
import {
  changeProductSlug,
  normalizeProductLookupSlug,
  productPublicPath,
  type RedirectRow,
  type SlugChangeStore,
} from './product-slug-redirect';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

class FakeSlugStore implements SlugChangeStore {
  slug: string;
  taken = new Set<string>();
  redirects: RedirectRow[] = [];
  failOnUpsert = false;
  failOnCollapse = false;

  constructor(slug: string) {
    this.slug = slug;
    this.taken.add(slug);
  }

  async lockProduct() {
    return { id: 'p1', slug: this.slug };
  }
  async slugTaken(slug: string, excludeId: string) {
    void excludeId;
    return this.taken.has(slug) && slug !== this.slug;
  }
  async updateProductSlug(_id: string, slug: string) {
    this.taken.delete(this.slug);
    this.slug = slug;
    this.taken.add(slug);
  }
  async listActiveRedirects() {
    return this.redirects.filter((r) => r.isActive !== false);
  }
  async collapseDestination(channel: 'RETAIL' | 'WHOLESALE', oldDest: string, newDest: string) {
    if (this.failOnCollapse) throw new Error('collapse failed');
    for (const row of this.redirects) {
      if (String(row.channel).toUpperCase() === channel && row.destinationUrl === oldDest) {
        row.destinationUrl = newDest;
      }
    }
  }
  async upsertRedirect(row: {
    channel: 'RETAIL' | 'WHOLESALE';
    sourcePath: string;
    destinationUrl: string;
  }) {
    if (this.failOnUpsert) throw new Error('upsert failed');
    const existing = this.redirects.find(
      (r) => r.channel === row.channel && r.sourcePath === row.sourcePath,
    );
    if (existing) {
      existing.destinationUrl = row.destinationUrl;
      existing.isActive = true;
      return;
    }
    this.redirects.push({ ...row, isActive: true });
  }
}

async function withRollback(store: FakeSlugStore, fn: () => Promise<unknown>) {
  const snap = {
    slug: store.slug,
    taken: new Set(store.taken),
    redirects: store.redirects.map((r) => ({ ...r })),
  };
  try {
    await fn();
  } catch (err) {
    store.slug = snap.slug;
    store.taken = snap.taken;
    store.redirects = snap.redirects;
    throw err;
  }
}

async function main() {
  {
    const encoded = encodeURIComponent('blouses00001');
    assert(normalizeProductLookupSlug(encoded) === 'blouses00001', 'percent-encoded ascii slug');
    assert(productPublicPath('alpha') === '/products/alpha', 'product path');
  }

  {
    const store = new FakeSlugStore('alpha');
    const result = await changeProductSlug(store, 'beta');
    assert(result.from === 'alpha' && result.to === 'beta', 'A→B result');
    assert(store.slug === 'beta', 'canonical slug is B');
    assert(store.redirects.length === 2, 'both channels redirected');
    assert(
      store.redirects.every((r) => r.sourcePath === '/products/alpha' && r.destinationUrl === '/products/beta'),
      'A points at B',
    );
  }

  {
    const store = new FakeSlugStore('alpha');
    await changeProductSlug(store, 'beta');
    await changeProductSlug(store, 'gamma');
    assert(store.slug === 'gamma', 'canonical is C');
    const dests = store.redirects.map((r) => `${r.channel}:${r.sourcePath}->${r.destinationUrl}`).sort();
    assert(
      dests.includes('RETAIL:/products/alpha->/products/gamma') &&
        dests.includes('RETAIL:/products/beta->/products/gamma') &&
        dests.includes('WHOLESALE:/products/alpha->/products/gamma') &&
        dests.includes('WHOLESALE:/products/beta->/products/gamma'),
      `A and B collapse to C, got ${dests.join(' | ')}`,
    );
    assert(!store.redirects.some((r) => r.destinationUrl.includes('/beta')), 'no leftover hop to B');
  }

  {
    const store = new FakeSlugStore('alpha');
    store.redirects.push({
      channel: 'RETAIL',
      sourcePath: '/products/omega',
      destinationUrl: '/products/alpha',
      isActive: true,
    });
    store.redirects.push({
      channel: 'WHOLESALE',
      sourcePath: '/products/omega',
      destinationUrl: '/products/alpha',
      isActive: true,
    });
    await changeProductSlug(store, 'alpha');
    assert(store.redirects.every((r) => r.destinationUrl !== r.sourcePath), 'no self-redirect');
  }

  {
    let threw = false;
    try {
      normalizePublicSlug('products');
    } catch (e) {
      threw = e instanceof BadRequestException;
    }
    assert(threw, 'reserved slug rejected');
  }

  {
    const store = new FakeSlugStore('alpha');
    store.taken.add('taken-slug');
    let threw = false;
    try {
      await changeProductSlug(store, 'taken-slug');
    } catch (e) {
      threw = e instanceof BadRequestException;
      assert(store.slug === 'alpha', 'duplicate does not move slug');
    }
    assert(threw, 'duplicate slug rejected');
  }

  {
    const store = new FakeSlugStore('alpha');
    store.failOnUpsert = true;
    let threw = false;
    try {
      await withRollback(store, () => changeProductSlug(store, 'beta'));
    } catch {
      threw = true;
    }
    assert(threw, 'upsert failure throws');
    assert(store.slug === 'alpha', 'slug rolled back when redirect write fails');
    assert(store.redirects.length === 0, 'no partial redirects after rollback');
  }

  {
    const store = new FakeSlugStore('alpha');
    store.failOnCollapse = true;
    let threw = false;
    try {
      await withRollback(store, () => changeProductSlug(store, 'beta'));
    } catch {
      threw = true;
    }
    assert(threw, 'collapse failure throws (not swallowed)');
    assert(store.slug === 'alpha', 'collapse failure rolls back slug');
  }

  {
    const store = new FakeSlugStore('hidden-a');
    await changeProductSlug(store, 'hidden-b');
    assert(
      store.redirects.filter((r) => r.channel === 'RETAIL').length === 1 &&
        store.redirects.filter((r) => r.channel === 'WHOLESALE').length === 1,
      'channel-limited products still get both-channel 301s; PDP 404s after landing if hidden',
    );
  }

  {
    const fa = 'مانتو-نازگل';
    const encoded = encodeURIComponent(fa);
    assert(normalizeProductLookupSlug(encoded) === fa, 'persian percent-encoded lookup');
  }

  console.log('product-slug-redirect.spec.ts OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
