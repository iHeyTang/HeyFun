import { getChatModels, getAigcModels, getAigcVoiceList } from '@/actions/llm';
import { useCallback, useRef } from 'react';
import { create } from 'zustand';

type ProviderModelInfo = NonNullable<Awaited<ReturnType<typeof getChatModels>>['data']>[number];

export const useProvidersStore = create<{
  availableModels: ProviderModelInfo[];
  refreshAvailableModels: () => Promise<void>;
}>((set, get) => ({
  availableModels: [],
  refreshAvailableModels: async () => {
    const res = await getChatModels({});
    set({ availableModels: res.data || [] });
  },
}));

export const useLLM = () => {
  const store = useProvidersStore();
  const initiated = useRef(false);

  const initiate = useCallback(() => {
    if (initiated.current) {
      return;
    }
    Promise.allSettled([store.refreshAvailableModels()]).then(() => {
      initiated.current = true;
    });
  }, [store.refreshAvailableModels]);

  return { ...store, initiate, initiated: initiated.current };
};

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

type VoiceListData = Awaited<ReturnType<typeof getAigcVoiceList>>['data'];

const useAigcVoiceListStore = create<{
  voiceListMap: Record<string, VoiceListData>;
  refreshVoiceList: (provider: string, modelName: string) => Promise<void>;
}>((set, get) => ({
  voiceListMap: {},
  refreshVoiceList: async (provider: string, modelName: string) => {
    const key = `${provider}-${modelName}`;
    const res = await getAigcVoiceList({ provider, modelName });
    set({ voiceListMap: { ...get().voiceListMap, [key]: res.data || [] } });
  },
}));

export const useAigcVoiceList = (provider: string, modelName: string) => {
  const store = useAigcVoiceListStore();
  const initiated = useRef(false);
  const key = `${provider}-${modelName}`;
  const voiceList = store.voiceListMap[key] || [];

  const initiate = useCallback(() => {
    if (initiated.current) {
      return;
    }
    store.refreshVoiceList(provider, modelName).then(() => {
      initiated.current = true;
    });
  }, [provider, modelName, store.refreshVoiceList]);

  return {
    voiceList,
    refreshVoiceList: () => store.refreshVoiceList(provider, modelName),
    initiate,
    initiated: initiated.current,
  };
};
