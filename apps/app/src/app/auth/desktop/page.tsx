'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useAuth, useUser, SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

function DesktopAuthContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading');
  const hasRedirectedRef = useRef(false);

  // 从 URL 获取 PKCE 参数
  const codeChallenge = searchParams.get('code_challenge');
  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri') || 'okey://auth-callback';

  useEffect(() => {
    async function handleAuth() {
      if (!isLoaded) return;
      if (hasRedirectedRef.current) return; // 防止重复执行

      if (isSignedIn && user) {
        try {
          setStatus('redirecting');

          // 优先使用长期 token API，如果失败则使用 Clerk session token
          let token: string | null = null;
          let expiresAt: number = Date.now() + 7 * 24 * 60 * 60 * 1000;

          try {
            const response = await fetch('/api/auth/desktop-token', { method: 'POST' });
            if (response.ok) {
              const data = await response.json();
              token = data.token;
              expiresAt = data.expiresAt;
            }
          } catch (error) {
            console.warn('Failed to get desktop token, falling back to session token:', error);
          }

          // 如果长期 token API 失败，使用 Clerk session token
          if (!token) {
            token = await getToken();
            if (!token) {
              setStatus('error');
              return;
            }
            // Clerk token 默认 60 秒，这里设置为 7 天用于桌面端
            expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
          }

          // 构建回调 URL
          // 检查是否是自定义协议（如 okey://）
          const isCustomProtocol = redirectUri.match(/^[a-z]+:\/\//i);

          let callbackUrl: string;

          if (isCustomProtocol) {
            // 对于自定义协议，手动构建 URL
            const separator = redirectUri.includes('?') ? '&' : '?';
            const params = new URLSearchParams();
            params.set('token', token);
            params.set('userId', user.id);
            params.set('email', user.primaryEmailAddress?.emailAddress || '');
            params.set('expiresAt', expiresAt.toString());
            if (state) {
              params.set('state', state);
            }
            callbackUrl = `${redirectUri}${separator}${params.toString()}`;
          } else {
            // 对于标准 HTTP/HTTPS URL，使用 URL 对象
            try {
              const url = new URL(redirectUri);
              url.searchParams.set('token', token);
              url.searchParams.set('userId', user.id);
              url.searchParams.set('email', user.primaryEmailAddress?.emailAddress || '');
              url.searchParams.set('expiresAt', expiresAt.toString());
              if (state) {
                url.searchParams.set('state', state);
              }
              callbackUrl = url.toString();
            } catch (error) {
              // 如果 URL 解析失败，尝试直接拼接
              console.warn('Failed to parse redirect URI, trying direct concatenation:', error);
              const separator = redirectUri.includes('?') ? '&' : '?';
              const params = new URLSearchParams();
              params.set('token', token);
              params.set('userId', user.id);
              params.set('email', user.primaryEmailAddress?.emailAddress || '');
              params.set('expiresAt', expiresAt.toString());
              if (state) {
                params.set('state', state);
              }
              callbackUrl = `${redirectUri}${separator}${params.toString()}`;
            }
          }

          // 标记已重定向，防止重复执行
          hasRedirectedRef.current = true;

          // 重定向到 Electron app
          window.location.href = callbackUrl;

          // 尝试关闭窗口（如果是通过 window.open 打开的）
          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 1000);
        } catch (error) {
          console.error('Auth error:', error);
          setStatus('error');
        }
      }
    }

    handleAuth();
  }, [isLoaded, isSignedIn, user, redirectUri, state, getToken]);

  // 未登录时显示登录组件
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <h1 className="mb-6 text-2xl font-bold">登录到 Okey</h1>
        <p className="mb-8 text-gray-600">登录后将自动返回桌面应用</p>
        <SignIn afterSignInUrl={`/auth/desktop?${searchParams.toString()}`} redirectUrl={`/auth/desktop?${searchParams.toString()}`} />
      </div>
    );
  }

  // 已登录，显示状态
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {status === 'redirecting' && (
        <>
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
          <p className="text-lg">正在返回 Okey 应用...</p>
          <p className="mt-2 text-sm text-gray-500">如果没有自动跳转，请手动打开 Okey</p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-lg text-red-600">认证失败</p>
          <p className="mt-2 text-sm text-gray-500">请关闭此页面并重试</p>
        </>
      )}
    </div>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
        </div>
      }
    >
      <DesktopAuthContent />
    </Suspense>
  );
}
