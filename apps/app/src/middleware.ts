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
  const { userId } = await auth();
  const url = new URL(request.url);

  // 如果用户已登录，检查是否有回调参数需要处理
  if (userId) {
    const redirectUrl = url.searchParams.get('redirect_url');
    const callback = url.searchParams.get('callback');

    // 如果访问首页且有回调参数，重定向到回调页面
    if (url.pathname === '/' && (redirectUrl || callback)) {
      const params = new URLSearchParams();
      if (callback) params.set('callback', callback);
      if (redirectUrl && !callback) params.set('callback', redirectUrl);
      if (url.searchParams.get('app')) params.set('app', url.searchParams.get('app')!);

      return NextResponse.redirect(new URL(`/auth/callback?${params.toString()}`, request.url));
    }

    // 如果访问首页且没有回调参数，但来自 accounts.heyfun.ai，可能需要检查 referer
    // 这里我们主要依赖 URL 参数，因为 Clerk 应该通过 redirect_url 传递参数
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
