import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isPortalRoute = pathname.startsWith('/portal/dashboard');

  if (!isAdminRoute && !isPortalRoute) {
    return NextResponse.next();
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

  // Non-admins must never land on the customer portal when opening /admin —
  // send them to the admin login so they can authenticate with an admin account.
  if (isAdminRoute && role !== 'ADMIN') {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/portal/dashboard', '/portal/dashboard/:path*'],
};
