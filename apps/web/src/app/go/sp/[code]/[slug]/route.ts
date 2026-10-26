import { NextRequest, NextResponse } from 'next/server';
import { API_URL, RETAIL_ORIGIN } from '@/lib/seo-origins';

const CODE = /^[a-z0-9]{8}$/;

function productRedirect(slug: string) {
  return NextResponse.redirect(new URL(`/products/${encodeURIComponent(slug)}`, RETAIL_ORIGIN), 302);
}

/** Records the partner click, then opens the retail product page. Last-click wins. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string; slug: string }> },
) {
  const { code, slug } = await context.params;
  const safeCode = String(code || '').trim().toLowerCase();
  const safeSlug = String(slug || '').trim();
  if (!CODE.test(safeCode) || !safeSlug || safeSlug.includes('..') || safeSlug.includes('/')) {
    return productRedirect(safeSlug || '');
  }

  const samePartner = request.cookies.get('taranom_sp')?.value === safeCode;
  const previous = samePartner ? request.cookies.get('taranom_sp_products')?.value || '' : '';
  const priorIds = previous.split(',').filter(Boolean).slice(-12);

  let productId = '';
  let productSlug = safeSlug;
  let attributionToken = '';
  let productIds: string[] = [];
  try {
    const qs = priorIds.length ? `?prior=${encodeURIComponent(priorIds.join(','))}` : '';
    const res = await fetch(
      `${API_URL}/sales-partner-links/${safeCode}/${encodeURIComponent(safeSlug)}${qs}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        productId?: string;
        slug?: string;
        attributionToken?: string;
        productIds?: string[];
      };
      if (body.productId && body.slug) {
        productId = body.productId;
        productSlug = body.slug;
        attributionToken = String(body.attributionToken || '');
        productIds = Array.isArray(body.productIds) ? body.productIds : [body.productId];
      }
    }
  } catch {
    productId = '';
  }

  const response = productRedirect(productSlug);
  response.headers.set('X-Robots-Tag', 'noindex');
  if (!productId || !attributionToken) return response;

  const ids = productIds.length
    ? productIds
    : [...new Set([...priorIds, productId])].slice(-12);
  const secure = request.nextUrl.protocol === 'https:';
  const cookie = { path: '/', maxAge: 60 * 60 * 24 * 14, sameSite: 'lax' as const, secure };
  response.cookies.set('taranom_sp', safeCode, cookie);
  response.cookies.set('taranom_sp_products', ids.join(','), cookie);
  response.cookies.set('taranom_sp_token', attributionToken, cookie);
  return response;
}
