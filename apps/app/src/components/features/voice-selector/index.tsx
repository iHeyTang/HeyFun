'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Voice } from '@repo/llm/aigc';
import { Check, Mic, Play, Search } from 'lucide-react';
import { useImperativeHandle, useMemo, useState, forwardRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

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
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const t = useTranslations('common.voiceSelector');

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
    setLastClickedId(null);
    stopCurrentAudio();
  };

  const handleVoiceClick = async (voice: Voice) => {
    // 如果点击的是上次点击的音色（第二次点击），则选中它
    if (lastClickedId === voice.id) {
      handleVoiceSelect(voice.id);
      return;
    }

    // 停止当前播放的音频
    stopCurrentAudio();

    // 记录本次点击的音色
    setLastClickedId(voice.id);

    // 播放新的音频
    if (voice.audio) {
      const url = `/api/oss/${voice.audio}`;

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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // 关闭对话框时重置状态
      setLastClickedId(null);
      stopCurrentAudio();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            className="h-12 rounded-none border-0 pr-4 pl-12 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredVoices.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground text-sm">{t('noVoicesFound')}</div>
            </div>
          )}

          {filteredVoices.length > 0 &&
            filteredVoices.map((voice, index) => (
              <button
                key={voice.id}
                className={`hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left transition-all ${
                  lastClickedId === voice.id ? 'bg-primary/5' : value === voice.id ? 'bg-muted' : ''
                } ${index === filteredVoices.length - 1 ? '' : 'border-border/50 border-b'}`}
                onClick={() => handleVoiceClick(voice)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="hover:bg-primary/10 flex-shrink-0 rounded-full p-2">
                    {currentPlayingId === voice.id ? <Play className="text-primary h-3 w-3" /> : <Mic className="text-muted-foreground h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate font-normal">
                      <div>{voice.name}</div>
                      {voice.custom && <Badge variant="outline">{t('custom')}</Badge>}
                      {lastClickedId === voice.id && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                          {t('clickAgainToSelect')}
                        </Badge>
                      )}
                    </div>
                    {voice.description && <div className="text-muted-foreground truncate text-xs">{voice.description}</div>}
                  </div>
                </div>
                {value === voice.id && (
                  <div className="bg-primary text-primary-foreground ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});

VoiceSelectorDialog.displayName = 'VoiceSelectorDialog';
