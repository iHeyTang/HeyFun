import { getAvailableModels, getModelProviderConfigs, getModelsByProvider, getModelProviders, getAigcModels } from '@/actions/llm';
import { useCallback, useRef } from 'react';
import { create } from 'zustand';

type ProviderModelInfo = NonNullable<Awaited<ReturnType<typeof getModelsByProvider>>['data']>[number];

export const useProvidersStore = create<{
  providerInfos: Awaited<ReturnType<typeof getModelProviders>>['data'];
  providerConfigs: Awaited<ReturnType<typeof getModelProviderConfigs>>['data'];
  availableModels: ProviderModelInfo[];
  refreshAvailableModels: () => Promise<void>;
  refreshProviderInfos: () => Promise<void>;
  refreshProviderConfigs: () => Promise<void>;
}>((set, get) => ({
  providerInfos: [],
  providerConfigs: [],
  availableModels: [],
  refreshAvailableModels: async () => {
    const res = await getAvailableModels({});
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
}));

export const useAigcStore = create<{
  availableModels: Awaited<ReturnType<typeof getAigcModels>>['data'];
  refreshAvailableModels: () => Promise<void>;
}>((set, get) => ({
  availableModels: [],
  refreshAvailableModels: async () => {
    const res = await getAigcModels({});
    set({ availableModels: res.data || [] });
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

export const useAigc = () => {
  const store = useAigcStore();
  const initiated = useRef(false);

  const initiate = useCallback(() => {
    console.log('initiate-aigc');
    if (initiated.current) {
      return;
    }
    store.refreshAvailableModels().then(() => {
      initiated.current = true;
    });
  }, [store.refreshAvailableModels]);

  return { ...store, initiate, initiated: initiated.current };
};
