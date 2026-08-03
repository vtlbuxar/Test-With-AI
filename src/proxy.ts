import { NextRequest, NextResponse } from 'next/server';
// Routes that require authentication
const PROTECTED_ROUTES = ['/', '/dashboard'];

// Routes that should redirect to home if already authenticated
const AUTH_ROUTES = ['/login', '/signup', '/verify'];

// Edge-compatible middleware for UX redirects
// Real token verification happens in Node.js API routes
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('auth_token')?.value;
  const isAuthenticated = !!token;

  // Check if it's a protected route
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Check if it's an auth-only route (login, signup, verify)
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Unauthenticated user trying to access protected route -> redirect to welcome
  if (isProtected && !isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = '/welcome';
    return NextResponse.redirect(url);
  }

  // Authenticated user trying to access auth pages -> redirect to app
  if (isAuthRoute && isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
