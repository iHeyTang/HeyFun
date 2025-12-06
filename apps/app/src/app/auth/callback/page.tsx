'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const callback = searchParams.get('callback');
    const app = searchParams.get('app');

    if (callback) {
      // 解码 callback URL
      const decodedCallback = decodeURIComponent(callback);

      // 检查是否是自定义协议（如 okey://）
      if (decodedCallback.match(/^[a-z]+:\/\//i)) {
        try {
          // 尝试跳转到自定义协议
          window.location.href = decodedCallback;

          // 如果跳转失败（比如没有对应的应用），3秒后跳转到 dashboard
          const timeout = setTimeout(() => {
            router.push('/dashboard');
          }, 3000);

          return () => clearTimeout(timeout);
        } catch (error) {
          console.error('Failed to redirect to custom protocol:', error);
          router.push('/dashboard');
        }
      } else {
        // 如果不是自定义协议，直接跳转
        window.location.href = decodedCallback;
      }
    } else {
      // 没有 callback 参数，跳转到 dashboard
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg">正在跳转...</p>
      </div>
    </div>
  );
}
