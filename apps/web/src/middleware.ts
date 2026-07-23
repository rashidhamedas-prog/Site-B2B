import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hostLooksRetail, isChannelExemptPath } from '@/lib/channel';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');
  const forceRetail =
    process.env.NEXT_PUBLIC_FORCE_RETAIL === '1' ||
    request.cookies.get('taranom_channel')?.value === 'retail';
  const retailHost = hostLooksRetail(host) || forceRetail;

  // On retail host, rewrite public URLs into /retail/* (URL bar stays clean)
  if (retailHost && !isChannelExemptPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/retail' : `/retail${pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-taranom-channel', 'RETAIL');
    return res;
  }

  const isAdminRoute = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isPortalRoute = pathname.startsWith('/portal/dashboard');

  if (!isAdminRoute && !isPortalRoute) {
    const res = NextResponse.next();
    res.headers.set(
      'x-taranom-channel',
      pathname.startsWith('/retail') || retailHost ? 'RETAIL' : 'WHOLESALE',
    );
    return res;
  }

  const token = request.cookies.get('taranom_token')?.value;
  const role = request.cookies.get('taranom_role')?.value;

  if (!token) {
    const loginUrl = isAdminRoute
      ? new URL('/admin/login', request.url)
      : new URL('/portal/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico)$).*)',
  ],
};
