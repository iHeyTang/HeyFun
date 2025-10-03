'use client';

import { getAigcVoiceList } from '@/actions/llm';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Voice } from '@repo/llm/aigc';
import { Check, Mic, Search } from 'lucide-react';
import { useImperativeHandle, useMemo, useState, forwardRef, useEffect } from 'react';

export type VoiceSelectorRef = {
  open: () => void;
};

interface VoiceSelectorProps {
  model: string | undefined;
  selectedVoice?: Voice | null;
  onVoiceSelect: (voice: Voice) => void;
}

export const VoiceSelectorDialog = forwardRef<VoiceSelectorRef, VoiceSelectorProps>(({ model, selectedVoice, onVoiceSelect }, ref) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
  }));

  useEffect(() => {
    if (!model || !open) return;

    setLoading(true);
    getAigcVoiceList({ modelName: model })
      .then(result => {
        setVoices(result.data || []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [model, open]);

  const filteredVoices = useMemo(() => {
    return voices.filter(
      v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.description?.toLowerCase() || '').includes(search.toLowerCase()),
    );
  }, [voices, search]);

  const handleVoiceSelect = (voice: Voice) => {
    onVoiceSelect(voice);
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
            placeholder="搜索音色..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-none border-0 pr-4 pl-12 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground text-sm">加载中...</div>
            </div>
          )}

          {!loading && filteredVoices.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground text-sm">未找到音色</div>
            </div>
          )}

          {!loading &&
            filteredVoices.map((voice, index) => (
              <button
                key={voice.id}
                className={`hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  selectedVoice?.id === voice.id ? 'bg-muted' : ''
                } ${index === filteredVoices.length - 1 ? '' : 'border-border/50 border-b'}`}
                onClick={() => handleVoiceSelect(voice)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Mic className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-normal">{voice.name}</div>
                    {voice.description && <div className="text-muted-foreground truncate text-xs">{voice.description}</div>}
                  </div>
                </div>
                {selectedVoice?.id === voice.id && <Check className="text-primary ml-2 h-4 w-4 flex-shrink-0" />}
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});

VoiceSelectorDialog.displayName = 'VoiceSelectorDialog';
