import { BadRequestException } from '@nestjs/common';
import { normalizePublicSlug } from '../../common/public-slug';
import { wouldCreateRedirectLoop } from '../blog/blog-seo.util';

export type SalesChannel = 'RETAIL' | 'WHOLESALE';

export const PRODUCT_SLUG_CHANNELS: SalesChannel[] = ['RETAIL', 'WHOLESALE'];

export interface RedirectRow {
  channel: string;
  sourcePath: string;
  destinationUrl: string;
  isActive?: boolean;
}

export function productPublicPath(slug: string): string {
  return `/products/${String(slug || '').trim()}`;
}

export function normalizeProductLookupSlug(raw: string): string {
  let decoded = String(raw || '').trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* keep raw */
  }
  return decoded.trim();
}

export interface SlugChangeStore {
  lockProduct(): Promise<{ id: string; slug: string | null }>;
  slugTaken(slug: string, excludeId: string): Promise<boolean>;
  updateProductSlug(id: string, slug: string): Promise<void>;
  listActiveRedirects(): Promise<RedirectRow[]>;
  collapseDestination(channel: SalesChannel, oldDest: string, newDest: string): Promise<void>;
  upsertRedirect(row: {
    channel: SalesChannel;
    sourcePath: string;
    destinationUrl: string;
  }): Promise<void>;
}

export interface SlugChangeResult {
  from: string;
  to: string;
  wroteRedirects: boolean;
}

/**
 * Atomic slug change contract: callers MUST run this inside a DB transaction.
 * If upsert/collapse throws, the transaction must roll back the slug write.
 */
export async function changeProductSlug(
  store: SlugChangeStore,
  nextRaw: string,
): Promise<SlugChangeResult> {
  const product = await store.lockProduct();
  const from = String(product.slug || '').trim();
  const to = normalizePublicSlug(nextRaw);
  if (!from) {
    await store.updateProductSlug(product.id, to);
    return { from, to, wroteRedirects: false };
  }
  if (from === to) {
    return { from, to, wroteRedirects: false };
  }
  if (await store.slugTaken(to, product.id)) {
    throw new BadRequestException('این slug قبلاً استفاده شده است');
  }

  const existing = await store.listActiveRedirects();
  const sourcePath = productPublicPath(from);
  const destinationUrl = productPublicPath(to);

  for (const channel of PRODUCT_SLUG_CHANNELS) {
    const channelRows = existing.filter((r) => String(r.channel).toUpperCase() === channel);
    if (
      wouldCreateRedirectLoop(
        channelRows.map((r) => ({
          sourcePath: r.sourcePath,
          destinationUrl: r.destinationUrl,
          isActive: r.isActive,
        })),
        sourcePath,
        destinationUrl,
        '',
      )
    ) {
      throw new BadRequestException('تغییر slug باعث حلقه ریدایرکت می‌شود');
    }
  }

  await store.updateProductSlug(product.id, to);

  for (const channel of PRODUCT_SLUG_CHANNELS) {
    await store.collapseDestination(channel, sourcePath, destinationUrl);
    await store.upsertRedirect({ channel, sourcePath, destinationUrl });
  }

  return { from, to, wroteRedirects: true };
}
