import { getLlmConfigsApiConfigLlmGet, getPreferencesApiConfigPreferencesGet, LlmConfigResponse, PreferencesResponse } from '@/server';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { create } from 'zustand';

type LlmConfig = LlmConfigResponse;

const useLlmConfigsStore = create<{
  llmConfigs: LlmConfig[];
  loadingLlmConfigs: boolean;
  refreshLlmConfigs: () => Promise<void>;
}>(set => ({
  llmConfigs: [],
  loadingLlmConfigs: false,
  refreshLlmConfigs: async () => {
    set({ loadingLlmConfigs: true });
    const res = await getLlmConfigsApiConfigLlmGet({});
    if (!res.data) return;
    set({ llmConfigs: res.data });
    set({ loadingLlmConfigs: false });
  },
}));

export const useLlmConfigs = () => {
  const { llmConfigs, loadingLlmConfigs, refreshLlmConfigs } = useLlmConfigsStore();

  const loadingRef = useRef(false);

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    refreshLlmConfigs().finally(() => {
      loadingRef.current = false;
    });
  }, []);

  return { llmConfigs, loadingLlmConfigs, refreshLlmConfigs };
};

type Preferences = Pick<PreferencesResponse, 'language'> & {
  theme: string;
};

const usePreferencesStore = create<{
  preferences: Preferences;
  loadingPreferences: boolean;
  refreshPreferences: () => Promise<void>;
}>(set => ({
  preferences: { language: 'en', theme: 'light' },
  loadingPreferences: false,
  refreshPreferences: async () => {
    set({ loadingPreferences: true });
    const res = await getPreferencesApiConfigPreferencesGet({});
    if (!res.data) return;
    set({ preferences: { ...res.data, theme: 'light' } });
    set({ loadingPreferences: false });
  },
}));

export const usePreferences = () => {
  const { preferences, loadingPreferences, refreshPreferences } = usePreferencesStore();
  return { preferences, loadingPreferences, refreshPreferences };
};
