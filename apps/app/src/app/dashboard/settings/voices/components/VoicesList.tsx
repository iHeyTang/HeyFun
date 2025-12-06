'use client';

import { deleteVoiceFromModel, getVoices } from '@/actions/voices';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mic, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Voice } from '../types';

// 定义支持的providers（写死在代码中）
const VOICE_PROVIDERS = [
  { id: 'minimax', name: 'Minimax', supportCloning: true },
  { id: 'openai', name: 'OpenAI', supportCloning: false },
  { id: 'elevenlabs', name: 'ElevenLabs', supportCloning: true },
  { id: 'azure', name: 'Azure TTS', supportCloning: false },
];

const PAGE_SIZE = 20;

interface VoicesListProps {
  onCloneClick: () => void;
  refreshTrigger?: number;
}

export function VoicesList({ onCloneClick, refreshTrigger }: VoicesListProps) {
  const t = useTranslations('voices');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 重置列表
  useEffect(() => {
    setVoices([]);
    setPage(0);
    setHasMore(true);
  }, [selectedProvider, refreshTrigger]);

  // 加载数据
  useEffect(() => {
    if (hasMore && !isLoading) {
      loadVoices();
    }
  }, [page, selectedProvider, refreshTrigger]);

  const loadVoices = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await getVoices({
        provider: selectedProvider === 'all' ? undefined : selectedProvider,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });

      if (result.data) {
        const newVoices = result.data;
        setVoices(prev => (page === 0 ? newVoices : [...prev, ...newVoices]));
        setHasMore(newVoices.length === PAGE_SIZE);
      }
    } catch (error) {
      toast.error(t('toast.loadVoicesFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 设置 IntersectionObserver 监听滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading]);

  const handleDeleteVoice = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const result = await deleteVoiceFromModel({ id });
      if (result.data?.success) {
        toast.success(t('toast.voiceDeleted'));
        // 从列表中移除该音色
        setVoices(prev => prev.filter(v => v.id !== id));
      } else {
        toast.error(result.data?.error || t('toast.deleteVoiceFailed'));
      }
    } catch (error) {
      toast.error(t('toast.deleteVoiceFailed'));
    }
  };

  const getProviderName = (providerId: string) => {
    return VOICE_PROVIDERS.find(p => p.id === providerId)?.name || providerId;
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="bg-card/50 hover:border-border hover:bg-card/80 w-[160px] text-[13px] backdrop-blur-sm transition-colors">
            <SelectValue placeholder={t('providers.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[13px]">
              {t('providers.all')}
            </SelectItem>
            {VOICE_PROVIDERS.map(provider => (
              <SelectItem key={provider.id} value={provider.id} className="text-[13px]">
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={onCloneClick}
          variant="outline"
          size="sm"
          className="bg-card/50 hover:border-border hover:bg-card/80 text-[13px] backdrop-blur-sm transition-colors"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {t('actions.cloneVoice')}
        </Button>
      </div>

      {/* Voice Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {voices.map(voice => {
          return (
            <div
              key={voice.id}
              className="bg-card/50 hover:border-border hover:bg-card/80 group relative overflow-hidden rounded-lg border backdrop-blur-sm transition-all duration-200"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <div className="bg-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
                      <Mic className="text-muted-foreground h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <h3 className="text-foreground text-[14px] font-medium leading-tight">{voice.name}</h3>
                        {voice.description && <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">{voice.description}</p>}
                      </div>
                      <span className="text-muted-foreground inline-block text-[11px] font-medium">{getProviderName(voice.provider)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteVoice(voice.id)}
                    className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="text-muted-foreground h-3.5 w-3.5" />
                  </Button>
                </div>

                {voice.previewAudio && (
                  <div className="mt-3 border-t pt-3">
                    <audio controls className="w-full" src={`/api/oss/${voice.previewAudio}`} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {voices.length === 0 && !isLoading && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.voices')}</p>
        </div>
      )}

      {/* 加载指示器 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {/* 无限滚动触发器 */}
      <div ref={observerTarget} className="h-4" />
    </div>
  );
}
