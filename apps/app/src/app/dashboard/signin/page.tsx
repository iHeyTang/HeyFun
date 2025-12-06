'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function SignInPage() {
  const searchParams = useSearchParams();

  const redirectUrl = useMemo(() => {
    // 检查是否有桌面端认证参数
    const redirectUri = searchParams.get('redirect_uri');
    const codeChallenge = searchParams.get('code_challenge');
    const state = searchParams.get('state');

    if (redirectUri || codeChallenge || state) {
      // 构建桌面端认证 URL，包含所有参数
      const params = new URLSearchParams();
      if (redirectUri) params.set('redirect_uri', redirectUri);
      if (codeChallenge) params.set('code_challenge', codeChallenge);
      if (state) params.set('state', state);
      return `/auth/desktop?${params.toString()}`;
    }

    return '/dashboard';
  }, [searchParams]);

  return <SignIn forceRedirectUrl={redirectUrl} signUpUrl="/signup" />;
}
