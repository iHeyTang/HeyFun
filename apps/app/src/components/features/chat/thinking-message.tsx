'use client';

import LoadingDots from '@/components/block/loading/loading-dots';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLLM } from '@/hooks/use-llm';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { ModelIcon } from '../model-icon';

/**
 * ThinkingMessage 组件
 * 显示"思考中..."的加载状态消息，带有脉冲动画和跳跃加载点
 */
export function ThinkingMessage({ modelId, label = 'Thinking' }: { modelId?: string; label?: string }) {
  const { availableModels } = useLLM();

  // 根据 modelId 获取模型信息
  const modelInfo = useMemo(() => {
    if (!modelId) return null;
    return availableModels.find(m => m.id === modelId) || null;
  }, [modelId, availableModels]);
  return (
    <div className={cn('flex min-w-0 justify-start gap-3 px-4 py-1')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-white p-0">
          <ModelIcon modelId={modelInfo?.id} family={modelInfo?.family} className="h-8 w-8 border p-1" size={32} />
        </AvatarFallback>
      </Avatar>

      <div className={cn('group flex min-w-0 flex-1 flex-col items-start gap-1.5')}>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <div>{modelInfo?.name}</div>
        </div>

        {/* 思考中消息内容 */}
        <div className="bg-muted max-w-[70%] rounded-lg px-4 py-3">
          <LoadingDots label={label} />
        </div>
      </div>
    </div>
  );
}
