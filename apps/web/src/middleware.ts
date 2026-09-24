import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  canEnterAdmin,
  canEnterPartners,
  canEnterSalesPartners,
  readAdminGateCookies,
  readPartnerGateCookies,
  readPortalGateCookies,
  readSalesPartnerGateCookies,
} from '@/lib/admin-session';
import { hostLooksRetail, isChannelExemptPath, isSalesPartnerPanelPath } from '@/lib/channel';
import { panelHostLockRedirect } from '@/lib/panel-host-lock';
import { lookupGscLegacyRedirect } from '@/lib/gsc-legacy-redirects';

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

/** Private trees must keep Next/no-store; do not clamp them to public ISR. */
function isPrivateStorefrontPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return (
    p.startsWith('/admin') ||
    p.startsWith('/portal') ||
    p.startsWith('/partners') ||
    isSalesPartnerPanelPath(p) ||
    p.startsWith('/confirm/sales-partner') ||
    p.startsWith('/api') ||
    p.startsWith('/checkout') ||
    p.startsWith('/account') ||
    p.startsWith('/payment') ||
    p.startsWith('/retail/checkout') ||
    p.startsWith('/retail/account') ||
    p.startsWith('/retail/payment')
  );
}

/**
 * Next ISR defaults to stale-while-revalidate ≈ 1 year. That lets .ir keep
 * serving HIT HTML long after CMS save. Cap SWR to match page revalidate.
 */
function clampStorefrontHtmlCache(res: NextResponse, pathname: string): NextResponse {
  if (isPrivateStorefrontPath(pathname)) return res;
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
  return res;
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

  const hostLock = panelHostLockRedirect({
    host: request.headers.get('host'),
    pathname,
    search: request.nextUrl.search,
  });
  if (hostLock) {
    return NextResponse.redirect(new URL(`${hostLock.pathname}${hostLock.search}`, hostLock.origin));
  }

  // Product slug aliases are resolved in the PDP (SKU/legacy map + seo_redirects)
  // so middleware cannot invert a later admin slug change back to an old SKU.

  // /retail/* is the internal App Router tree. Public URLs are rewritten via
  // next.config beforeFiles (no x-middleware-rewrite). Direct hits 301 to the
  // clean public path so crawlers never index the internal prefix.
  if (pathname === '/retail' || pathname.startsWith('/retail/')) {
    const stripped = pathname === '/retail' ? '/' : pathname.slice('/retail'.length) || '/';
    // #region agent log
    fetch('http://127.0.0.1:7386/ingest/441ee71b-11ea-467a-bcb4-b19ca7c41207',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'30acff'},body:JSON.stringify({sessionId:'30acff',location:'middleware.ts:retail-301',message:'direct /retail → 301',data:{pathname,stripped},timestamp:Date.now(),hypothesisId:'retail-301',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
    return redirectPublic(request, stripped);
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forceRetail =
    process.env.NEXT_PUBLIC_FORCE_RETAIL === '1' ||
    request.cookies.get('taranom_channel')?.value === 'retail' ||
    request.headers.get('x-taranom-channel') === 'RETAIL';

  // Production retail hosts use next.config host rewrites. Cookie/env force-retail
  // on a non-retail host still needs a middleware rewrite for local testing.
  if (forceRetail && !hostLooksRetail(host) && !isChannelExemptPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/retail' : `/retail${pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-taranom-channel', 'RETAIL');
    return clampStorefrontHtmlCache(res, pathname);
  }

  // Retail host storefront: config already rewrote; only stamp channel + cache clamp.
  if (hostLooksRetail(host) && !isChannelExemptPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set('x-taranom-channel', 'RETAIL');
    return clampStorefrontHtmlCache(res, pathname);
  }

  const adminPath = normalizePathname(pathname);
  const isAdminLogin = adminPath === '/admin/login';
  const isAdminRoute = adminPath.startsWith('/admin') && !isAdminLogin;
  const isPortalRoute = pathname.startsWith('/portal/dashboard');
  const isPartnerLogin = adminPath === '/partners/login';
  const isPartnerRoute = adminPath.startsWith('/partners') && !isPartnerLogin;
  const isSalesPartnerLogin = adminPath === '/sales-partners/login';
  const isSalesPartnerRoute = isSalesPartnerPanelPath(adminPath) && !isSalesPartnerLogin;

  if (isSalesPartnerLogin || isSalesPartnerRoute) {
    const withRobots = (res: NextResponse) => {
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    };
    if (isSalesPartnerLogin) {
      const res = withRobots(NextResponse.next());
      res.headers.set('Cache-Control', 'private, no-store');
      return res;
    }
    const session = readSalesPartnerGateCookies(request.cookies);
    if (!session.token || !canEnterSalesPartners(session.token)) {
      const loginUrl = new URL('/sales-partners/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return withRobots(NextResponse.redirect(loginUrl));
    }
    const res = withRobots(NextResponse.next());
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  }

  if (isPartnerLogin || isPartnerRoute) {
    const withRobots = (res: NextResponse) => {
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    };
    if (isPartnerLogin) {
      return withRobots(NextResponse.next());
    }
    const partnerSession = readPartnerGateCookies(request.cookies);
    if (!partnerSession.token || !canEnterPartners(partnerSession.token)) {
      const loginUrl = new URL('/partners/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return withRobots(NextResponse.redirect(loginUrl));
    }
    return withRobots(NextResponse.next());
  }

  if (!isAdminRoute && !isPortalRoute) {
    const res = NextResponse.next();
    res.headers.set(
      'x-taranom-channel',
      hostLooksRetail(host) || forceRetail ? 'RETAIL' : 'WHOLESALE',
    );
    return clampStorefrontHtmlCache(res, pathname);
  }

  const adminSession = isAdminRoute ? readAdminGateCookies(request.cookies) : null;
  const token = isAdminRoute
    ? adminSession?.token
    : readPortalGateCookies(request.cookies).token;
  const role = isAdminRoute
    ? adminSession?.role
    : readPortalGateCookies(request.cookies).role;

  if (!token) {
    const loginUrl = isAdminRoute
      ? new URL('/admin/login', request.url)
      : new URL('/portal/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !canEnterAdmin(token, role)) {
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
