import { getModelProviderConfig, getModelProviderConfigs, getModelProviderInfo, getModelProviders } from '@/actions/llm';
import { create } from 'zustand';

export const useProvidersStore = create<{
  providerInfos: Awaited<ReturnType<typeof getModelProviders>>['data'];
  providerConfigs: Awaited<ReturnType<typeof getModelProviderConfigs>>['data'];
  refreshProviderInfos: () => Promise<void>;
  refreshProviderConfigs: () => Promise<void>;
  getProviderInfo: (providerId: string) => Awaited<ReturnType<typeof getModelProviderInfo>>['data'];
  getProviderConfig: (providerId: string) => Awaited<ReturnType<typeof getModelProviderConfig>>['data'];
}>((set, get) => ({
  providerInfos: [],
  providerConfigs: [],
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
