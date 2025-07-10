import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch a user setting,
  // read from `cookies()`, `headers()`, etc.
  const locale = await fetch('/api/configs/preferences')
    .then(res => res.json())
    .then(res => res.data?.language || 'en')
    .catch(() => 'en');

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
