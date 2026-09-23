import { NextRequest, NextResponse } from 'next/server';
import { API_URL, RETAIL_ORIGIN } from '@/lib/seo-origins';

const CODE = /^[a-z0-9]{8}$/;

function productRedirect(slug: string) {
  return NextResponse.redirect(new URL(`/products/${encodeURIComponent(slug)}`, RETAIL_ORIGIN), 302);
}

/** Records the partner click, then opens the retail product page. */
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

  let productId = '';
  let productSlug = safeSlug;
  try {
    const res = await fetch(
      `${API_URL}/sales-partner-links/${safeCode}/${encodeURIComponent(safeSlug)}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const body = (await res.json()) as { productId?: string; slug?: string };
      if (body.productId && body.slug) {
        productId = body.productId;
        productSlug = body.slug;
      }
    }
  } catch {
    productId = '';
  }

  const response = productRedirect(productSlug);
  response.headers.set('X-Robots-Tag', 'noindex');
  if (!productId) return response;

  const samePartner = request.cookies.get('taranom_sp')?.value === safeCode;
  const previous = samePartner ? request.cookies.get('taranom_sp_products')?.value || '' : '';
  const ids = [...new Set([...previous.split(',').filter(Boolean), productId])].slice(-12);
  const secure = request.nextUrl.protocol === 'https:';
  const cookie = { path: '/', maxAge: 60 * 60 * 24 * 14, sameSite: 'lax' as const, secure };
  response.cookies.set('taranom_sp', safeCode, cookie);
  response.cookies.set('taranom_sp_products', ids.join(','), cookie);
  return response;
}
