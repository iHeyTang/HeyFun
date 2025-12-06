'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  // 获取 token
  useEffect(() => {
    if (isLoaded) {
      getToken()
        .then(t => {
          setToken(t);
        })
        .catch(error => {
          console.error('Failed to get token:', error);
        });
    }
  }, [isLoaded, getToken]);

  useEffect(() => {
    // 等待 token 加载完成
    if (!isLoaded || token === null) {
      return;
    }

    const callback = searchParams.get('callback');
    const app = searchParams.get('app');

    if (callback) {
      // 解码 callback URL
      const decodedCallback = decodeURIComponent(callback);

      // 检查是否是自定义协议（如 okey://）
      const isCustomProtocol = decodedCallback.match(/^[a-z]+:\/\//i);

      // 构建最终的 callback URL
      let finalCallbackUrl: string;

      if (isCustomProtocol) {
        // 对于自定义协议（如 okey://），使用更安全的方式：
        // 1. 传递 API 端点 URL，让 Electron 应用自己获取 cookies
        // 2. 或者传递 token（如果需要立即使用）
        const separator = decodedCallback.includes('?') ? '&' : '?';
        const apiBaseUrl = window.location.origin;
        // 传递 API 端点信息，让 Electron 应用通过 HTTP 请求获取 cookies
        finalCallbackUrl = `${decodedCallback}${separator}apiUrl=${encodeURIComponent(apiBaseUrl)}&token=${encodeURIComponent(token)}`;
      } else {
        // 对于标准 HTTP/HTTPS URL，使用 URL 对象处理
        try {
          const callbackUrl = new URL(decodedCallback);
          callbackUrl.searchParams.set('token', token);
          finalCallbackUrl = callbackUrl.toString();
        } catch (error) {
          // 如果 URL 解析失败，尝试直接拼接
          console.warn('Failed to parse callback URL, trying direct concatenation:', error);
          const separator = decodedCallback.includes('?') ? '&' : '?';
          finalCallbackUrl = `${decodedCallback}${separator}token=${encodeURIComponent(token)}`;
        }
      }

      // 执行跳转
      if (isCustomProtocol) {
        // 尝试跳转到自定义协议（带 token）
        window.location.href = finalCallbackUrl;

        // 如果跳转失败（比如没有对应的应用），3秒后跳转到 dashboard
        const timeout = setTimeout(() => {
          router.push('/dashboard');
        }, 3000);

        return () => clearTimeout(timeout);
      } else {
        // 如果不是自定义协议，直接跳转（带 token）
        window.location.href = finalCallbackUrl;
      }
    } else {
      // 没有 callback 参数，跳转到 dashboard
      router.push('/dashboard');
    }
  }, [searchParams, router, token, isLoaded]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg">正在跳转...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-lg">正在跳转...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
