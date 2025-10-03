'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { Voice } from '@repo/llm/aigc';
import { Check, Mic, Play, Search } from 'lucide-react';
import { useImperativeHandle, useMemo, useState, forwardRef, useEffect } from 'react';

export type VoiceSelectorRef = {
  open: () => void;
};

interface VoiceSelectorProps {
  voices: Voice[];
  value?: string | null;
  onChange: (value: string) => void;
}

export const VoiceSelectorDialog = forwardRef<VoiceSelectorRef, VoiceSelectorProps>(({ voices, value, onChange }, ref) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const { getSignedUrl } = useSignedUrl();

  const stopCurrentAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setCurrentPlayingId(null);
    setCurrentAudio(null);
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
  }));

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  const filteredVoices = useMemo(() => {
    return voices.filter(
      v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.description?.toLowerCase() || '').includes(search.toLowerCase()),
    );
  }, [voices, search]);

  const handleVoiceSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const handleVoicePreview = async (e: React.MouseEvent<HTMLElement>, voice: Voice) => {
    e.stopPropagation();

    // 如果点击的是当前正在播放的音色，则停止播放
    if (currentPlayingId === voice.id) {
      stopCurrentAudio();
      return;
    }

    // 停止当前播放的音频
    stopCurrentAudio();

    if (voice.audio) {
      const url = voice.audio.startsWith('http') ? voice.audio : await getSignedUrl(voice.audio);

      const audio = new Audio(url);

      // 设置播放状态
      setCurrentPlayingId(voice.id);
      setCurrentAudio(audio);

      // 播放音频
      audio.play().catch(error => {
        console.error('播放音频失败:', error);
        stopCurrentAudio();
      });

      // 监听播放结束事件
      audio.addEventListener('ended', () => {
        setCurrentPlayingId(null);
        setCurrentAudio(null);
      });

      // 监听播放错误事件
      audio.addEventListener('error', () => {
        stopCurrentAudio();
      });
    }
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
          {filteredVoices.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground text-sm">未找到音色</div>
            </div>
          )}

          {filteredVoices.length > 0 &&
            filteredVoices.map((voice, index) => (
              <button
                key={voice.id}
                className={`hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  value === voice.id ? 'bg-muted' : ''
                } ${index === filteredVoices.length - 1 ? '' : 'border-border/50 border-b'}`}
                onClick={e => handleVoicePreview(e, voice)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="hover:bg-primary/10 flex-shrink-0 rounded-full p-2">
                    {currentPlayingId === voice.id ? <Play className="text-primary h-3 w-3" /> : <Mic className="text-muted-foreground h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-normal">{voice.name}</div>
                    {voice.description && <div className="text-muted-foreground truncate text-xs">{voice.description}</div>}
                  </div>
                </div>
                <div
                  className={`ml-2 flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
                    value === voice.id
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                  }`}
                  onClick={e => {
                    e.stopPropagation();
                    handleVoiceSelect(voice.id);
                  }}
                >
                  <Check className="h-4 w-4" />
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});

VoiceSelectorDialog.displayName = 'VoiceSelectorDialog';
