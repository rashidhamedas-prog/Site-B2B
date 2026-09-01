import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hostLooksRetail, isChannelExemptPath } from '@/lib/channel';
import { lookupGscLegacyRedirect } from '@/lib/gsc-legacy-redirects';
import { isStaffRole } from '@/lib/staff-access';

/** Legacy wholesale category aliases → public `/category/{slug}` (no UUID). */
const WHOLESALE_CATEGORY_ALIASES: Record<string, string> = {
  '/wholesale/manto': '/category/women-manto',
  '/wholesale/shomiz': '/category/shomiz',
  '/wholesale/coats': '/category/women-coats',
  '/wholesale/pants': '/category/women-pants',
  '/wholesale/winter-wear': '/category/winter-wear',
  '/wholesale/linen': '/category/linen-collection',
  '/wholesale/cotton': '/category/cotton-collection',
};

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '');
  }
  return pathname;
}

/** Legacy WordPress-era paths that are permanently gone (no replacement). */
const GONE_PREFIXES = [
  '/product/', // old WP /product/<id>/<persian-slug>/
  '/wp-content/',
  '/wp-admin/',
  '/wp-includes/',
  '/wp-json/',
  '/uploads/',
];

function isLegacyFeedPath(pathname: string): boolean {
  // Old WP feeds: /feed, /comments/feed, /blog/feed, /<anything>/feed
  // Current valid feed is /blog/feed.xml (does not match these).
  return pathname === '/feed' || pathname.endsWith('/feed');
}

function goneResponse(): NextResponse {
  return new NextResponse(
    '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>410</title></head><body><h1>410 Gone</h1><p>این آدرس برای همیشه حذف شده است.</p></body></html>',
    {
      status: 410,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex',
      },
    },
  );
}

function redirectPublic(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url, 301);
}

/** Handle retired/legacy URLs before any channel rewrite. Returns null when not legacy. */
function handleLegacyPaths(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  const gscTarget = lookupGscLegacyRedirect(pathname);
  if (gscTarget) {
    return redirectPublic(request, gscTarget);
  }

  // Old WP shop URLs (incl. /shop/?filter_color=..., /shop/<cat>/<item>.html)
  if (pathname === '/shop' || pathname.startsWith('/shop/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/products';
    url.search = '';
    return NextResponse.redirect(url, 301);
  }

  // Old /search?q=... → current listing search (noindex,follow state)
  if (pathname === '/search') {
    const url = request.nextUrl.clone();
    url.pathname = '/products';
    const q = request.nextUrl.searchParams.get('q');
    url.search = q ? `?q=${encodeURIComponent(q)}` : '';
    return NextResponse.redirect(url, 301);
  }

  if (
    GONE_PREFIXES.some((p) => pathname === p.slice(0, -1) || pathname.startsWith(p)) ||
    isLegacyFeedPath(pathname)
  ) {
    return goneResponse();
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacy = handleLegacyPaths(request);
  if (legacy) return legacy;

  const aliasTarget = WHOLESALE_CATEGORY_ALIASES[normalizePathname(pathname)];
  if (aliasTarget) {
    const url = request.nextUrl.clone();
    url.pathname = aliasTarget;
    url.search = '';
    return NextResponse.redirect(url, 301);
  }

  // Product slug aliases are resolved in the PDP (SKU/legacy map + seo_redirects)
  // so middleware cannot invert a later admin slug change back to an old SKU.

  // /retail/* is the internal App Router tree. A 301 back to the public
  // /products/... URL ping-pongs with `x-middleware-rewrite` and causes
  // TooManyRedirects for extractors that follow that header (Torob).
  // Serve 200 + noindex; PDP canonical still points at the public URL.
  if (pathname === '/retail' || pathname.startsWith('/retail/')) {
    const res = NextResponse.next();
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    res.headers.set('x-taranom-channel', 'RETAIL');
    return res;
  }

  const host = request.headers.get('host');
  const forceRetail =
    process.env.NEXT_PUBLIC_FORCE_RETAIL === '1' ||
    request.cookies.get('taranom_channel')?.value === 'retail';
  const retailHost = hostLooksRetail(host) || forceRetail;
  const isPublicCategoryPath =
    pathname === '/category' || pathname.startsWith('/category/');

  // Middleware rewrite of /category/{slug} → /retail/category/{slug} makes
  // Next skip ISR (public .ir stays no-store). Host rewrite in next.config
  // keeps the public URL static. Cookie/env force-retail on a non-retail
  // host still uses the middleware rewrite below.
  if (retailHost && hostLooksRetail(host) && isPublicCategoryPath) {
    const res = NextResponse.next();
    res.headers.set('x-taranom-channel', 'RETAIL');
    return res;
  }

  // On retail host, rewrite public URLs into /retail/* (URL bar stays clean).
  // Child sitemaps and merchant feeds stay on shared routes (not /retail/...).
  if (retailHost && !isChannelExemptPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/retail' : `/retail${pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-taranom-channel', 'RETAIL');
    return res;
  }

  const adminPath = normalizePathname(pathname);
  const isAdminLogin = adminPath === '/admin/login';
  const isAdminRoute = adminPath.startsWith('/admin') && !isAdminLogin;
  const isPortalRoute = pathname.startsWith('/portal/dashboard');

  if (!isAdminRoute && !isPortalRoute) {
    const res = NextResponse.next();
    res.headers.set(
      'x-taranom-channel',
      pathname.startsWith('/retail') || retailHost ? 'RETAIL' : 'WHOLESALE',
    );
    return res;
  }

  const token = isAdminRoute
    ? request.cookies.get('taranom_admin_token')?.value || request.cookies.get('taranom_token')?.value
    : request.cookies.get('taranom_token')?.value;
  const role = isAdminRoute
    ? request.cookies.get('taranom_admin_role')?.value || request.cookies.get('taranom_role')?.value
    : request.cookies.get('taranom_role')?.value;

  if (!token) {
    const loginUrl = isAdminRoute
      ? new URL('/admin/login', request.url)
      : new URL('/portal/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !isStaffRole(role)) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico)$).*)',
  ],
};
