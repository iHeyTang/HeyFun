import { getModelProviderConfigs, getModelProviderModels } from "@/actions/llm";
import { useCallback } from "react";
import { create } from "zustand";

type ProviderModelInfo = NonNullable<Awaited<ReturnType<typeof getModelProviderModels>>['data']>[number];

interface ModelProviderStore {
  availableModels: ProviderModelInfo[];
  setAvailableModels: (models: ProviderModelInfo[]) => void;
}

const useModelProviderStore = create<ModelProviderStore>((set, get) => ({
  availableModels: [],
  setAvailableModels: models => {
    set({ availableModels: models });
  },
}));

export const useModelProvider = () => {
  const { availableModels, setAvailableModels } = useModelProviderStore();

  const refreshAvailableModels = useCallback(() => {
    getModelProviderConfigs({}).then(p => {
      if (!p.data) {
        return;
      }
      const modelPromises = p.data.map(async config => {
        const models = await getModelProviderModels({ provider: config.provider });
        return models?.data?.map(model => ({ ...model, provider: config.provider, configId: config.id })) || [];
      });
      Promise.all(modelPromises).then(models => {
        setAvailableModels(models.flat());
      });
    });
  }, []);

  return { availableModels, refreshAvailableModels };
};
