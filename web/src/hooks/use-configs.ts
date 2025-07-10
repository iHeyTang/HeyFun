import { useEffect } from 'react';
import { create } from 'zustand';

type LlmConfig = {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  apiType: string;
};

const useLlmConfigsStore = create<{
  llmConfigs: LlmConfig[];
  loadingLlmConfigs: boolean;
  refreshLlmConfigs: () => Promise<void>;
}>(set => ({
  llmConfigs: [],
  loadingLlmConfigs: false,
  refreshLlmConfigs: async () => {
    set({ loadingLlmConfigs: true });
    const res = await fetch('/api/config/llm/all').then(res => res.json());
    set({ llmConfigs: res });
    set({ loadingLlmConfigs: false });
  },
}));

export const useLlmConfigs = () => {
  const { llmConfigs, loadingLlmConfigs, refreshLlmConfigs } = useLlmConfigsStore();
  useEffect(() => {
    refreshLlmConfigs();
  }, []);
  return { llmConfigs, loadingLlmConfigs, refreshLlmConfigs };
};

interface Preferences {
  language: string;
  theme: string;
}

const usePreferencesStore = create<{
  preferences: Preferences;
  loadingPreferences: boolean;
  refreshPreferences: () => Promise<void>;
}>(set => ({
  preferences: {
    language: 'en',
    theme: 'light',
  },
  loadingPreferences: false,
  refreshPreferences: async () => {
    set({ loadingPreferences: true });
    const res = await fetch('/api/config/preferences').then(res => res.json());
    set({ preferences: res });
    set({ loadingPreferences: false });
  },
}));

export const usePreferences = () => {
  const { preferences, loadingPreferences, refreshPreferences } = usePreferencesStore();
  return { preferences, loadingPreferences, refreshPreferences };
};
