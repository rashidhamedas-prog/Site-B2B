import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  canonicalMismatchPath,
  decodeIncomingSlug,
  legacyMapRedirectPath,
  productPublicPath,
} from '@/lib/product-slug-canonical';
import { lookupProductSlugRedirect } from '@/lib/product-slug-redirects';
import { fetchProductBySlug } from '@/lib/server-api';
import { redirectIfMatched } from '@/lib/seo-redirect';

export const loadCanonicalStorefrontProduct = cache(async function loadCanonicalStorefrontProduct(
  incomingRaw: string,
  channel: 'RETAIL' | 'WHOLESALE',
): Promise<Record<string, unknown>> {
  const incoming = decodeIncomingSlug(incomingRaw);
  const product = await fetchProductBySlug(incoming, channel);
  if (product) {
    const mismatch = canonicalMismatchPath(incoming, String(product.slug || ''));
    if (mismatch) permanentRedirect(mismatch);
    return product;
  }

  const staticTarget = lookupProductSlugRedirect(incoming);
  if (staticTarget) {
    const mapped = await fetchProductBySlug(staticTarget, channel);
    const dest = legacyMapRedirectPath(
      incoming,
      staticTarget,
      mapped ? String(mapped.slug || '') : null,
    );
    if (dest) permanentRedirect(dest);
  }

  await redirectIfMatched(channel, productPublicPath(incoming));
  notFound();
});
