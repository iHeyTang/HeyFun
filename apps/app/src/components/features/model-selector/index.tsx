'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLLM } from '@/hooks/use-llm';
import { ModelInfo } from '@repo/llm/chat';
import { Check, Code, Eye, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { ModelIcon } from '../model-icon';

export type ModelSelectorRef = {
  open: () => void;
};

interface ModelSelectorProps {
  selectedModel?: ModelInfo | null;
  onModelSelect: (model: ModelInfo) => void;
  type?: ModelInfo['type'];
}

export const ModelSelectorDialog = forwardRef<ModelSelectorRef, ModelSelectorProps>(({ selectedModel, onModelSelect, type }, ref) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const t = useTranslations('common.modelSelector');

  const { availableModels } = useLLM();

  const filteredModels = useMemo(() => {
    return availableModels.filter(model => (type ? model.type === type : true));
  }, [availableModels, type]);

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
          {filteredModels.map((model, index) => (
            <button
              key={model?.id}
              className={`hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left transition-colors ${
                selectedModel?.id === model?.id ? 'bg-muted' : ''
              } ${index === filteredModels.length - 1 ? 'border-b-0' : ''}`}
              onClick={() => handleModelSelect(model)}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <ModelIcon family={model?.family} className="h-8 w-8" />
                <div>
                  <div className="truncate font-normal">{model?.name}</div>
                  <div className="flex items-center gap-2">
                    {model?.supportsFunctionCalling && (
                      <div className="rounded border border-blue-500/20 bg-blue-500/10 px-1">
                        <Code className="h-3 w-3 text-blue-500" />
                      </div>
                    )}
                    {model?.supportsVision && (
                      <div className="rounded border border-green-500/20 bg-green-500/10 px-1">
                        <Eye className="h-3 w-3 text-green-500" />
                      </div>
                    )}
                  </div>
                </div>
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
