'use client';

import { updatePreferences } from '@/actions/settings';
import { usePreferences } from '@/hooks/use-preferences';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { localeNames, locales } from '@/i18n/config';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function PreferencesPage() {
  const t = useTranslations('config');
  const router = useRouter();
  const { data: preferences, update } = usePreferences();

  const { setTheme, theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const selectedLanguage = preferences?.language || '';

  const handleLanguageChange = async (value: string) => {
    setLoading(true);
    try {
      await update({ language: value });
      toast.success(t('toast.updateSuccess'));
      router.refresh();
    } catch (error) {
      toast.error(t('toast.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppearanceChange = async (value: string) => {
    setTheme(value);
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="mb-10">
        <h1 className="text-lg font-bold">{t('preferences')}</h1>
        <p className="text-muted-foreground text-sm">{t('preferencesDescription')}</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language" className="flex items-center gap-1">
            {t('language')}
          </Label>
          <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('languageSelectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {locales.map(language => (
                <SelectItem key={language} value={language}>
                  {localeNames[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="appearance" className="flex items-center gap-1">
            {t('appearance')}
          </Label>
          <Select value={theme} onValueChange={handleAppearanceChange} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('apperanceThemes.light')}</SelectItem>
              <SelectItem value="dark">{t('apperanceThemes.dark')}</SelectItem>
              <SelectItem value="system">{t('apperanceThemes.system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
