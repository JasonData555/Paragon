import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'paragon_admin_session';
const SESSION_DURATION_MS = 8 * 3600 * 1000;

// Protected admin paths (login page /admin itself is NOT protected)
const PROTECTED_PATHS = [
  '/admin/dashboard',
  '/admin/upload',
  '/admin/manage',
  '/admin/audit',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token || !isTokenValid(token)) {
    const loginUrl = new URL('/admin', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

function isTokenValid(token: string): boolean {
  const parts = token.split(':');
  if (parts.length < 2) return false;
  const timestamp = parseInt(parts[parts.length - 1], 10);
  if (isNaN(timestamp)) return false;
  return Date.now() - timestamp < SESSION_DURATION_MS;
}

export const config = {
  matcher: ['/admin/:path+'],
};
