import { getPreferences, updatePreferences, UpdatePreferencesArgs } from '@/actions/settings';
import { ModelInfo } from '@repo/llm/chat';
import { useCallback } from 'react';
import { create } from 'zustand';

type PreferencesData = {
  language?: string;
  defaultChatbotModel?: ModelInfo;
  defaultAgentModel?: ModelInfo;
};

export const usePreferencesStore = create<{
  data: PreferencesData | undefined;
  isLoading: boolean;
  error: Error | undefined;
  initiated: boolean;
  initiating: boolean;
  loadPreferences: () => Promise<void>;
  setPreferences: (data: PreferencesData | undefined) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | undefined) => void;
}>((set, get) => ({
  data: undefined,
  isLoading: false,
  error: undefined,
  initiated: false,
  initiating: false,
  loadPreferences: async () => {
    const state = get();
    // 如果已经初始化完成或正在初始化，直接返回
    if (state.initiated || state.initiating) {
      return;
    }
    // 设置 initiating 为 true，防止并发调用
    set({ initiating: true, isLoading: true, error: undefined });
    try {
      const res = await getPreferences({});
      const preferencesData: PreferencesData = res.data
        ? {
            language: res.data.language || undefined,
            defaultChatbotModel: res.data.defaultChatbotModel as ModelInfo | undefined,
            defaultAgentModel: res.data.defaultAgentModel as ModelInfo | undefined,
          }
        : {
            language: undefined,
            defaultChatbotModel: undefined,
            defaultAgentModel: undefined,
          };
      set({ data: preferencesData, initiated: true, initiating: false, isLoading: false });
    } catch (err) {
      set({ error: err as Error, initiated: true, initiating: false, isLoading: false });
    }
  },
  setPreferences: (data: PreferencesData | undefined) => {
    set({ data });
  },
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  setError: (error: Error | undefined) => {
    set({ error });
  },
}));

export const usePreferences = () => {
  const { data, isLoading, error, loadPreferences, setPreferences } = usePreferencesStore();

  const update = useCallback(
    async (preferences: UpdatePreferencesArgs) => {
      const res = await updatePreferences(preferences);
      if (res.error) {
        throw new Error('Failed to update preferences');
      }
      const updatedData: PreferencesData = {
        language: preferences.language,
        defaultChatbotModel: preferences.defaultChatbotModel || undefined,
        defaultAgentModel: preferences.defaultAgentModel || undefined,
      };
      setPreferences(updatedData);
      return res.data;
    },
    [setPreferences],
  );

  return { data, isLoading, error, update, loadPreferences };
};
