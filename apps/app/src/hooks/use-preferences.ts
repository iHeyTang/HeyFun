import { getPreferences, updatePreferences, UpdatePreferencesArgs } from '@/actions/settings';
import { useAsync } from './use-async';
import { useCallback } from 'react';

export const usePreferences = () => {
  const { data, isLoading, error, mutate } = useAsync(
    () =>
      getPreferences({}).then(res => {
        if (!res.data) {
          return {
            language: undefined,
            defaultChatbotModel: undefined,
            defaultAgentModel: undefined,
          };
        }
        return {
          language: res.data.language || undefined,
          defaultChatbotModel: res.data.defaultChatbotModel || undefined,
          defaultAgentModel: res.data.defaultAgentModel || undefined,
        };
      }),
    [],
    {
      cache: 'preferences',
    },
  );

  const update = useCallback(async (preferences: UpdatePreferencesArgs) => {
    const res = await updatePreferences(preferences);
    if (res.error) {
      throw new Error('Failed to update preferences');
    }
    mutate({
      language: preferences.language,
      defaultChatbotModel: preferences.defaultChatbotModel || undefined,
      defaultAgentModel: preferences.defaultAgentModel || undefined,
    });
    return res.data;
  }, []);

  return { data, isLoading, error, update };
};
