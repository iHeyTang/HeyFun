'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function SignInPage() {
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

  return <SignIn forceRedirectUrl={redirectUrl} signUpUrl="/signup" />;
}
