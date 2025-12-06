import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/signin(.*)',
  '/signup(.*)',
  '/auth/desktop(.*)',
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
  const { userId } = await auth();
  const url = new URL(request.url);

  // 如果用户已登录，检查是否有桌面端认证参数需要处理
  if (userId) {
    const redirectUri = url.searchParams.get('redirect_uri');
    const codeChallenge = url.searchParams.get('code_challenge');
    const state = url.searchParams.get('state');

    // 如果访问首页且有桌面端认证参数，重定向到桌面端认证页面
    if (url.pathname === '/' && (redirectUri || codeChallenge || state)) {
      const params = new URLSearchParams();
      if (redirectUri) params.set('redirect_uri', redirectUri);
      if (codeChallenge) params.set('code_challenge', codeChallenge);
      if (state) params.set('state', state);

      return NextResponse.redirect(new URL(`/auth/desktop?${params.toString()}`, request.url));
    }
  }

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
