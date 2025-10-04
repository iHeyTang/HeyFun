import { getPreferences } from '@/actions/settings';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

const LOCALE_COOKIE_KEY = 'NEXT_LOCALE';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch a user setting,
  // read from `cookies()`, `headers()`, etc.
  let locale: Locale = defaultLocale;

  try {
    // 1. 优先从用户偏好设置获取（已登录用户）
    const preferences = await getPreferences({});
    if (preferences.data?.language) {
      locale = preferences.data.language as Locale;
    }
  } catch (error) {
    // 2. 用户未登录或获取偏好失败，尝试从 cookie 获取
    try {
      const cookieStore = await cookies();
      const cookieValue = cookieStore.get(LOCALE_COOKIE_KEY);
      const cookieLocale = cookieValue?.value as Locale | undefined;

      if (cookieLocale && locales.includes(cookieLocale)) {
        locale = cookieLocale;
      } else {
        // 3. Cookie 中没有，则从浏览器语言获取
        const headersList = await headers();
        const acceptLanguage = headersList.get('accept-language');

        if (acceptLanguage) {
          // 解析 Accept-Language 头，例如 "zh-CN,zh;q=0.9,en;q=0.8"
          const browserLocale = acceptLanguage
            .split(',')
            .map(lang => {
              const part = lang.split(';')[0];
              return part ? part.trim() : '';
            })
            .filter((lang): lang is string => !!lang)
            .find(lang => {
              // 完全匹配，如 zh-CN
              if (locales.includes(lang as Locale)) return true;
              // 部分匹配，如 zh 匹配 zh-CN
              const parts = lang.split('-');
              const baseLang = parts[0];
              return baseLang ? locales.some(l => l.startsWith(baseLang)) : false;
            });

          if (browserLocale && locales.includes(browserLocale as Locale)) {
            locale = browserLocale as Locale;
          } else if (browserLocale) {
            // 查找基础语言匹配
            const parts = browserLocale.split('-');
            const baseLang = parts[0];
            if (baseLang) {
              const matchedLocale = locales.find(l => l.startsWith(baseLang));
              if (matchedLocale) {
                locale = matchedLocale;
              }
            }
          }
        }
      }
    } catch (e) {
      // 如果获取失败，使用默认语言
      locale = defaultLocale;
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
