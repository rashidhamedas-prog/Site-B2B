import { NextRequest, NextResponse } from 'next/server';
import { API_URL, WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const safe = String(code || '').trim().toLowerCase();
  const target = new URL('/portal/register', WHOLESALE_ORIGIN);
  if (/^[a-z0-9]{8}$/.test(safe)) {
    target.searchParams.set('ref', safe);
    try {
      await fetch(`${API_URL}/boutique-referral/clicks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: safe }),
        cache: 'no-store',
      });
    } catch {
      // The invitation still opens. Click count is diagnostic only.
    }
  }
  const response = NextResponse.redirect(target, 302);
  if (/^[a-z0-9]{8}$/.test(safe)) {
    response.cookies.set('wr_code', safe, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: request.nextUrl.protocol === 'https:',
    });
  }
  return response;
}
