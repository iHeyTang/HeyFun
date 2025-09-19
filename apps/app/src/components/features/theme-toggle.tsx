'use client';

import * as React from 'react';
import { MoonIcon, SunIcon, LaptopIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'light') {
      return <SunIcon className="size-4" />;
    } else if (theme === 'dark') {
      return <MoonIcon className="size-4" />;
    } else {
      return <LaptopIcon className="size-4" />;
    }
  };

  // 在服务端渲染时显示默认图标，避免 hydration 不匹配
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-9">
        <LaptopIcon className="size-4" />
        <span className="sr-only">切换主题</span>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="icon" className="size-9" onClick={handleToggle}>
      {getIcon()}
      <span className="sr-only">切换主题</span>
    </Button>
  );
}
