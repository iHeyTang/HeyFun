import { formatContextLength } from '@/lib/shared/number';
import { cn } from '@/lib/utils';
import { ModelDefinition } from '@repo/llm/chat';
import { ImageIcon, MessageCircle, MessageCircleIcon, Notebook } from 'lucide-react';
import { ReactNode } from 'react';
import { ModelIcon } from '../model-icon';

interface ModelCardProps {
  model: ModelDefinition;
  onClick?: () => void;
  className?: string;
  rightContent?: ReactNode;
}

const formatPrice = (price: number | undefined | null) => {
  if (price === undefined || price === null) return '';
  return `$${((price || 0) * 1000000).toFixed(2)}/M`;
};

/**
 * 可复用的模型信息卡片组件
 * 支持两种显示模式：
 * 1. 简洁模式（用于模型选择页面）- 显示基本信息、能力标签和价格
 * 2. 详细模式（用于 Provider 管理页面）- 显示完整信息包括 ID 和上下文长度
 */
export function ModelCard({ model, onClick, className = '', rightContent }: ModelCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn('group relative w-full cursor-default select-none rounded-lg px-4 py-3 text-left transition-all', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* 模型图标 */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fafafa] shadow">
            <ModelIcon family={model.family} className="text-foreground h-4 w-4" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* 模型名称 */}
            <div className="items-baseline gap-2">
              <div className="text-foreground text-[14px] font-medium">{model.name}</div>
              {/* 详细模式：显示模型 ID */}
              <div className="text-muted-foreground font-mono text-[11px]">{model.id.replace(`${model.provider}/`, '')}</div>
            </div>

            {/* 价格信息 */}
            {model.pricing && (model.pricing.input !== undefined || model.pricing.output !== undefined) && (
              <div className="text-muted-foreground flex items-center text-[11px]">
                {model.pricing.input !== undefined && <span>输入: {formatPrice(model.pricing.input)}</span>}
                {model.pricing.input !== undefined && model.pricing.output !== undefined && <span className="mx-1">·</span>}
                {model.pricing.output !== undefined && <span>输出: {formatPrice(model.pricing.output)}</span>}
              </div>
            )}

            {/* 能力标签 */}
            <div className="flex flex-wrap gap-1.5">
              {model.type === 'language' && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/50 bg-purple-50/60 px-2 py-0.5 text-[11px] font-medium text-purple-600/90 dark:border-purple-800/30 dark:bg-purple-950/25 dark:text-purple-400/80">
                  <MessageCircle className="h-3 w-3" />
                  对话模型
                </span>
              )}
              {model.type === 'embedding' && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/50 bg-purple-50/60 px-2 py-0.5 text-[11px] font-medium text-purple-600/90 dark:border-purple-800/30 dark:bg-purple-950/25 dark:text-purple-400/80">
                  <Notebook className="h-3 w-3" />
                  向量模型
                </span>
              )}
              {model.type === 'image' && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/50 bg-purple-50/60 px-2 py-0.5 text-[11px] font-medium text-purple-600/90 dark:border-purple-800/30 dark:bg-purple-950/25 dark:text-purple-400/80">
                  <ImageIcon className="h-3 w-3" />
                  图像模型
                </span>
              )}
              {model.type !== 'language' && model.type !== 'embedding' && model.type && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/50 bg-purple-50/60 px-2 py-0.5 text-[11px] font-medium text-purple-600/90 dark:border-purple-800/30 dark:bg-purple-950/25 dark:text-purple-400/80">
                  <MessageCircleIcon className="h-3 w-3" />
                  {model.type}
                </span>
              )}
              {!!model.supportsStreaming && (
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-200/50 bg-blue-50/60 px-2 py-0.5 text-[11px] font-medium text-blue-600/90 dark:border-blue-800/30 dark:bg-blue-950/25 dark:text-blue-400/80">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  流式输出
                </span>
              )}
              {!!model.supportsFunctionCalling && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200/50 bg-purple-50/60 px-2 py-0.5 text-[11px] font-medium text-purple-600/90 dark:border-purple-800/30 dark:bg-purple-950/25 dark:text-purple-400/80">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  函数调用
                </span>
              )}
              {!!model.supportsVision && (
                <span className="inline-flex items-center gap-1 rounded-md border border-green-200/50 bg-green-50/60 px-2 py-0.5 text-[11px] font-medium text-green-600/90 dark:border-green-800/30 dark:bg-green-950/25 dark:text-green-400/80">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  视觉识别
                </span>
              )}
              {!!model.contextLength && (
                <span className="inline-flex items-center gap-1 rounded-md border border-orange-200/50 bg-orange-50/60 px-2 py-0.5 text-[11px] font-medium text-orange-600/90 dark:border-orange-800/30 dark:bg-orange-950/25 dark:text-orange-400/80">
                  {formatContextLength(model.contextLength)} 上下文
                </span>
              )}
            </div>

            {/* 模型描述 */}
            {model.description && <div className="text-muted-foreground mb-2 line-clamp-2 text-[13px]">{model.description}</div>}
          </div>
        </div>
        {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
      </div>
    </div>
  );
}
