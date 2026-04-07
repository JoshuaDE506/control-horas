// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_PAGES = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-code',
  '/reset-password',
];

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sessionUserId = req.cookies.get('session_user_id')?.value;

  const isLoggedIn = Boolean(sessionUserId);
  const isDashboardRoute = pathname.startsWith('/dashboard');

  // Si no está logueado y entra a dashboard → login
  if (!isLoggedIn && isDashboardRoute) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya está logueado y entra a páginas de auth → dashboard
  if (isLoggedIn && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/verify-code',
    '/reset-password',
  ],
};
