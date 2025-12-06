import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/signin(.*)',
  '/signup(.*)',
  '/auth/callback(.*)',
  '/api/auth/(.*)',
  '/share(.*)',
  '/api/share(.*)',
  '/api/webhooks/(.*)',
  '/api/tools/refresh-stars',
  '/api/queue/(.*)',
  '/api/workflow/(.*)',
  '/api/system/(.*)',
  '/api/ai-gateway/(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
