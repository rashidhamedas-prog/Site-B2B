import { NextRequest, NextResponse } from 'next/server';
import { API_URL, RETAIL_ORIGIN } from '@/lib/seo-origins';

const CODE = /^[a-z0-9]{8}$/;
const SESSION_TTL = 60 * 60 * 24 * 14;

function productRedirect(slug: string) {
  const response = NextResponse.redirect(new URL(`/products/${encodeURIComponent(slug)}`, RETAIL_ORIGIN), 302);
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

function clearLegacy(response: NextResponse) {
  const gone = { path: '/', maxAge: 0 };
  response.cookies.set('taranom_sp', '', gone);
  response.cookies.set('taranom_sp_products', '', gone);
}

/** Validates the partner link on the server, then stores a signed session. */
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

  const previousToken = request.cookies.get('taranom_sp_session')?.value || '';
  let token = '';
  let productSlug = safeSlug;
  try {
    const res = await fetch(
      `${API_URL}/sales-partner-links/${safeCode}/${encodeURIComponent(safeSlug)}/click`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousToken: previousToken || undefined }),
      },
    );
    if (res.ok) {
      const body = (await res.json()) as { token?: string; slug?: string };
      if (body.token && body.slug) {
        token = body.token;
        productSlug = body.slug;
      }
    }
  } catch {
    token = '';
  }

  const response = productRedirect(productSlug);
  clearLegacy(response);
  if (!token) return response;
  const secure = request.nextUrl.protocol === 'https:';
  const cookie = { path: '/', maxAge: SESSION_TTL, sameSite: 'lax' as const, secure };
  response.cookies.set('taranom_sp_session', token, cookie);
  response.cookies.set('taranom_sp_lock', '1', cookie);
  return response;
}
