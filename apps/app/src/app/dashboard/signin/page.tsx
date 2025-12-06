'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function SignInPage() {
  const searchParams = useSearchParams();

  const redirectUrl = useMemo(() => {
    const callback = searchParams.get('callback');
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
