import {
  getAllAvailableModelProviderModels,
  getModelProviderConfig,
  getModelProviderConfigs,
  getModelProviderInfo,
  getModelProviderModels,
  getModelProviders,
} from '@/actions/llm';
import { useCallback, useRef } from 'react';
import { create } from 'zustand';

type ProviderModelInfo = NonNullable<Awaited<ReturnType<typeof getModelProviderModels>>['data']>[number];

export const useProvidersStore = create<{
  providerInfos: Awaited<ReturnType<typeof getModelProviders>>['data'];
  providerConfigs: Awaited<ReturnType<typeof getModelProviderConfigs>>['data'];
  availableModels: ProviderModelInfo[];
  refreshAvailableModels: () => Promise<void>;
  refreshProviderInfos: () => Promise<void>;
  refreshProviderConfigs: () => Promise<void>;
  getProviderInfo: (providerId: string) => Awaited<ReturnType<typeof getModelProviderInfo>>['data'];
  getProviderConfig: (providerId: string) => Awaited<ReturnType<typeof getModelProviderConfig>>['data'];
}>((set, get) => ({
  providerInfos: [],
  providerConfigs: [],
  availableModels: [],
  refreshAvailableModels: async () => {
    const res = await getAllAvailableModelProviderModels({});
    set({ availableModels: res.data || [] });
  },
  refreshProviderInfos: async () => {
    const res = await getModelProviders({});
    set({ providerInfos: res.data || [] });
  },
  refreshProviderConfigs: async () => {
    const res = await getModelProviderConfigs({});
    set({ providerConfigs: res.data || [] });
  },
  getProviderInfo: (providerId: string) => {
    return get().providerInfos?.find(info => info.provider === providerId);
  },
  getProviderConfig: (providerId: string) => {
    return get().providerConfigs?.find(config => config.provider === providerId);
  },
}));

export const useLLM = () => {
  const store = useProvidersStore();
  const initiated = useRef(false);

  const initiate = useCallback(() => {
    console.log('initiate-llm');
    if (initiated.current) {
      return;
    }
    Promise.allSettled([store.refreshAvailableModels(), store.refreshProviderInfos(), store.refreshProviderConfigs()]).then(() => {
      initiated.current = true;
    });
  }, [store.refreshAvailableModels, store.refreshProviderInfos, store.refreshProviderConfigs]);

  return { ...store, initiate, initiated: initiated.current };
};
