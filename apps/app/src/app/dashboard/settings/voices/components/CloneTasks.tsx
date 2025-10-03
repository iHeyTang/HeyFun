'use client';

import { getVoiceCloneTasks } from '@/actions/voices';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { VoiceCloneTask } from '../types';

// 定义支持的providers（写死在代码中）
const VOICE_PROVIDERS = [
  { id: 'minimax', name: 'Minimax', supportCloning: true },
  { id: 'openai', name: 'OpenAI', supportCloning: false },
  { id: 'elevenlabs', name: 'ElevenLabs', supportCloning: true },
  { id: 'azure', name: 'Azure TTS', supportCloning: false },
];

const PAGE_SIZE = 20;

interface CloneTasksProps {
  refreshTrigger?: number;
}

export function CloneTasks({ refreshTrigger }: CloneTasksProps) {
  const t = useTranslations('voices');
  const [cloneTasks, setCloneTasks] = useState<VoiceCloneTask[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 重置列表
  useEffect(() => {
    setCloneTasks([]);
    setPage(0);
    setHasMore(true);
  }, [refreshTrigger]);

  // 加载数据
  useEffect(() => {
    if (hasMore && !isLoading) {
      loadCloneTasks();
    }
  }, [page, refreshTrigger]);

  const loadCloneTasks = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await getVoiceCloneTasks({
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });

      if (result.data) {
        const newTasks = result.data;
        setCloneTasks(prev => (page === 0 ? newTasks : [...prev, ...newTasks]));
        setHasMore(newTasks.length === PAGE_SIZE);
      }
    } catch (error) {
      toast.error(t('toast.loadCloneTasksFailed'));
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

  const getProviderName = (providerId: string) => {
    return VOICE_PROVIDERS.find(p => p.id === providerId)?.name || providerId;
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {cloneTasks.map(task => (
          <div
            key={task.id}
            className="group bg-card/50 hover:border-border hover:bg-card/80 relative overflow-hidden rounded-lg border backdrop-blur-sm transition-all duration-200"
          >
            <div className="px-5 py-4">
              {/* 顶部：标题 + provider + 状态 + 时间 */}
              <div className="flex items-center gap-3">
                <h3 className="text-foreground text-[15px] leading-tight font-medium">{task.name}</h3>
                <span className="text-muted-foreground flex-shrink-0 text-[11px] font-medium">{getProviderName(task.provider)}</span>
                <span
                  className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    task.status === 'completed'
                      ? 'bg-muted text-muted-foreground'
                      : task.status === 'failed'
                        ? 'bg-muted text-muted-foreground'
                        : task.status === 'processing'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t(`status.${task.status}`)}
                </span>
                <span className="text-muted-foreground ml-auto flex-shrink-0 text-[11px]">
                  {new Date(task.createdAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* 描述 */}
              {task.description && <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">{task.description}</p>}

              {/* 错误信息 */}
              {task.error && (
                <div className="bg-muted/50 text-muted-foreground mt-3 rounded-md border px-3 py-2 text-[12px] leading-relaxed">{task.error}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {cloneTasks.length === 0 && !isLoading && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.cloneTasks')}</p>
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
