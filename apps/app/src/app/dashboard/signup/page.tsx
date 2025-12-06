'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function SignUpPage() {
  const searchParams = useSearchParams();

  const redirectUrl = useMemo(() => {
    // 优先使用 callback，如果没有则使用 redirect_url
    const callback = searchParams.get('callback') || searchParams.get('redirect_url');
    const app = searchParams.get('app');

    if (callback || app) {
      // 构建回调 URL，包含所有参数
      const params = new URLSearchParams();
      if (callback) params.set('callback', callback);
      if (app) params.set('app', app);
      return `/auth/callback?${params.toString()}`;
    }

    return '/dashboard';
  }, [searchParams]);

  const signInUrl = useMemo(() => {
    // 优先使用 callback，如果没有则使用 redirect_url
    const callback = searchParams.get('callback') || searchParams.get('redirect_url');
    const app = searchParams.get('app');

    if (callback || app) {
      // 在 signin 链接中也保留这些参数
      const params = new URLSearchParams();
      if (callback) params.set('callback', callback);
      if (app) params.set('app', app);
      return `/signin?${params.toString()}`;
    }

    return '/signin';
  }, [searchParams]);

  return <SignUp forceRedirectUrl={redirectUrl} signInUrl={signInUrl} />;
}
