'use client';

import { updatePreferences } from '@/actions/settings';
import { usePreferences } from '@/hooks/use-preferences';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { defaultLocale, type Locale, localeNames, locales } from '@/i18n/config';
import { useAuth } from '@clerk/nextjs';
import { Check, Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

const LOCALE_COOKIE_KEY = 'NEXT_LOCALE';

// 设置 cookie
const setCookie = (name: string, value: string, days = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

// 获取 cookie
const getCookie = (name: string): string | null => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    const c = ca[i];
    if (!c) continue;
    let trimmed = c;
    while (trimmed.charAt(0) === ' ') trimmed = trimmed.substring(1, trimmed.length);
    if (trimmed.indexOf(nameEQ) === 0) return trimmed.substring(nameEQ.length, trimmed.length);
  }
  return null;
};

export function LanguageToggle() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { data: preferences } = usePreferences();
  const [currentLocale, setCurrentLocale] = React.useState<Locale>(defaultLocale);
  const [mounted, setMounted] = React.useState(false);
  const [isChanging, setIsChanging] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Load current language settings
    if (isSignedIn) {
      // 已登录用户：从 preferences store 加载
      const locale = (preferences?.language as Locale) || defaultLocale;
      setCurrentLocale(locale);
    } else {
      // 未登录用户：从 cookie 加载
      const savedLocale = getCookie(LOCALE_COOKIE_KEY) as Locale;
      if (savedLocale && locales.includes(savedLocale)) {
        setCurrentLocale(savedLocale);
      } else {
        setCurrentLocale(defaultLocale);
      }
    }
  }, [isSignedIn, preferences]);

  const handleLanguageChange = async (locale: Locale) => {
    if (isChanging || locale === currentLocale) return;

    setIsChanging(true);
    try {
      if (isSignedIn) {
        // 已登录用户：保存到 preferences
        await updatePreferences({ language: locale });
      } else {
        // 未登录用户：保存到 cookie
        setCookie(LOCALE_COOKIE_KEY, locale);
      }
      setCurrentLocale(locale);
      router.refresh();
    } catch (error) {
      toast.error('Failed to change language');
    } finally {
      setIsChanging(false);
    }
  };

  // Show default icon during server-side rendering to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-9">
        <Languages className="size-4" />
        <span className="sr-only">Toggle language</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" disabled={isChanging}>
          <Languages className="size-4" />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map(locale => (
          <DropdownMenuItem key={locale} onClick={() => handleLanguageChange(locale)} className="flex items-center justify-between gap-2">
            <span>{localeNames[locale]}</span>
            {currentLocale === locale && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
