'use client';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLLM } from '@/hooks/use-llm';
import { Bot, Check, Search } from 'lucide-react';
import { useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { Preferences } from '@prisma/client';
import { useTranslations } from 'next-intl';

export type ModelSelectorRef = {
  open: () => void;
};

export type ModelInfo = Preferences['defaultChatbotModel'] | Preferences['defaultAgentModel'];

interface ModelSelectorProps {
  selectedModel?: ModelInfo | null;
  onModelSelect: (model: ModelInfo) => void;
}

export const ModelSelectorDialog = forwardRef<ModelSelectorRef, ModelSelectorProps>(({ selectedModel, onModelSelect }, ref) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const t = useTranslations('common.modelSelector');

  const { availableModels } = useLLM();

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
  }));

  const handleModelSelect = (model: ModelInfo) => {
    onModelSelect(model);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTitle />
      <DialogContent className="max-w-lg p-0 pb-4" showCloseButton={false}>
        <div className="border-border/30 relative border-b">
          <div className="absolute inset-y-0 left-4 flex items-center">
            <Search className="text-muted-foreground h-4 w-4" />
          </div>
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-none border-0 pl-12 pr-4 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {availableModels.map((model, index) => (
            <button
              key={model?.id}
              className={`hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left transition-colors ${
                selectedModel?.id === model?.id ? 'bg-muted' : ''
              } ${index === availableModels.length - 1 ? 'border-b-0' : ''}`}
              onClick={() => handleModelSelect(model)}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Bot className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                <div className="truncate font-normal">{model?.name}</div>
              </div>
              {selectedModel?.id === model?.id && <Check className="text-primary ml-2 h-4 w-4 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});

ModelSelectorDialog.displayName = 'ModelSelectorDialog';
