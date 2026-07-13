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

  // prevent non-admins from accessing admin panel
  if (isAdminRoute && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/portal/dashboard', '/portal/dashboard/:path*'],
};
