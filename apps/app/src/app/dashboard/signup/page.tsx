'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function SignUpPage() {
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

  const signInUrl = useMemo(() => {
    const callback = searchParams.get('callback');
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
