import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ProviderModelInfo } from '@repo/llm/chat';
import { Bot, Check, Search } from 'lucide-react';
import { useImperativeHandle, useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ModelSelectorRef = {
  open: () => void;
};

interface InputModelConfigDialog {
  ref: React.RefObject<ModelSelectorRef | null>;
  availableModels: ProviderModelInfo[];
}

interface InputModelConfigStore {
  selectedModel: ProviderModelInfo | null;
  setSelectedModel: (model: ProviderModelInfo | null) => void;
}

export const useInputModelConfig = create<InputModelConfigStore>()(
  persist(
    set => ({
      selectedModel: null,
      setSelectedModel: model => {
        set({ selectedModel: model });
      },
    }),
    {
      name: 'input-config-model-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        selectedModel: state.selectedModel,
      }),
    },
  ),
);

export default function InputModelConfigDialog({ ref, availableModels }: InputModelConfigDialog) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { selectedModel, setSelectedModel } = useInputModelConfig();

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
  }));

  const grouped = useMemo(() => {
    const filtered = availableModels.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    const group: Record<string, ProviderModelInfo[]> = {};
    filtered.forEach(m => {
      const groupKey = `${m.provider}`;
      if (!group[groupKey]) group[groupKey] = [];
      group[groupKey].push(m);
    });
    return group;
  }, [availableModels, search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTitle />
      <DialogContent className="max-w-lg p-0 pb-4" showCloseButton={false}>
        <div className="border-border/30 relative border-b">
          <div className="absolute inset-y-0 left-4 flex items-center">
            <Search className="text-muted-foreground h-4 w-4" />
          </div>
          <Input
            placeholder="Search model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-none border-0 pr-4 pl-12 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {Object.keys(grouped).length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground text-sm">No models found</div>
            </div>
          )}

          {Object.entries(grouped).map(([provider, items]) => {
            return (
              <div key={provider} className="border-border/50 border-b last:border-b-0">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {provider}
                  </Badge>
                </div>

                {items.map((model, index) => (
                  <button
                    key={model.id}
                    className={`hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left transition-colors ${
                      selectedModel?.id === model.id ? 'bg-muted' : ''
                    } ${index === items.length - 1 ? 'border-b-0' : ''}`}
                    onClick={() => {
                      setSelectedModel(model);
                      setOpen(false);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Bot className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                      <div className="truncate font-normal">{model.name}</div>
                    </div>
                    {selectedModel?.id === model.id && <Check className="text-primary ml-2 h-4 w-4 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
