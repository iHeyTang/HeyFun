import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Add paths that don't require authentication
const publicPaths = ['/signin', '/signup', '/api/auth', '/share', '/api/share'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    // Skip auth for public API routes
    if (publicPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }
    const sessionCookie = getSessionCookie(request);

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
    return NextResponse.next();
  }

  // Handle page routes
  // Check if the path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Handle private paths
  if (!isPublicPath) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
