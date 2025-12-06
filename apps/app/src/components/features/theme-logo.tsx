'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeLogoProps {
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
}

export function ThemeLogo({ width = 64, height = 64, alt = 'HeyFun', className, priority = false }: ThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 避免服务端渲染时的hydration不匹配
  useEffect(() => {
    // 使用 requestAnimationFrame 避免同步 setState
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  // 在客户端挂载之前，显示默认logo
  if (!mounted) {
    return <Image src="/logo.png" alt={alt} width={width} height={height} className={className} priority={priority} />;
  }

  // 根据主题选择logo
  // resolvedTheme 会返回实际生效的主题（light/dark），而不是 system
  const logoSrc = resolvedTheme === 'dark' ? '/logo-white.png' : '/logo.png';

  return <Image src={logoSrc} alt={alt} width={width} height={height} className={className} priority={priority} />;
}
