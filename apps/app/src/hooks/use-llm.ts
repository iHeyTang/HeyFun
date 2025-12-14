import { getChatModels, getAigcModels, getAigcVoiceList } from '@/actions/llm';
import { useCallback, useRef, useState } from 'react';
import { create } from 'zustand';

type ProviderModelInfo = NonNullable<Awaited<ReturnType<typeof getChatModels>>['data']>[number];

export const useProvidersStore = create<{
  availableModels: ProviderModelInfo[];
  initiated: boolean;
  initiating: boolean;
  refreshAvailableModels: () => Promise<void>;
}>((set, get) => ({
  availableModels: [],
  initiated: false,
  initiating: false,
  refreshAvailableModels: async () => {
    const res = await getChatModels({});
    set({ availableModels: res.data || [] });
  },
}));

export const useLLM = () => {
  const { availableModels, initiated, refreshAvailableModels } = useProvidersStore();

  const initiate = useCallback(() => {
    const state = useProvidersStore.getState();
    // 如果已经初始化完成或正在初始化，直接返回
    if (state.initiated || state.initiating) {
      return;
    }
    // 设置 initiating 为 true，防止并发调用
    useProvidersStore.setState({ initiating: true });
    Promise.allSettled([refreshAvailableModels()]).then(() => {
      // 完成后设置 initiated 为 true，initiating 为 false
      useProvidersStore.setState({ initiated: true, initiating: false });
    });
  }, [refreshAvailableModels]);

  return { availableModels, refreshAvailableModels, initiate, initiated };
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
  const [initiatedState, setInitiatedState] = useState(false);

  const initiate = useCallback(() => {
    console.log('initiate-aigc');
    if (initiated.current) {
      return;
    }
    store.refreshAvailableModels().then(() => {
      initiated.current = true;
      setInitiatedState(true);
    });
  }, [store]);

  return { ...store, initiate, initiated: initiatedState };
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
  const [initiatedState, setInitiatedState] = useState(false);
  const key = `${provider}-${modelName}`;
  const voiceList = store.voiceListMap[key] || [];

  const initiate = useCallback(() => {
    if (initiated.current) {
      return;
    }
    store.refreshVoiceList(provider, modelName).then(() => {
      initiated.current = true;
      setInitiatedState(true);
    });
  }, [provider, modelName, store]);

  return {
    voiceList,
    refreshVoiceList: () => store.refreshVoiceList(provider, modelName),
    initiate,
    initiated: initiatedState,
  };
};
