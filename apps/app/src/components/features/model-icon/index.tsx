import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * 图标类型定义
 */
type IconType = 'image';

/**
 * 模型图标配置
 */
interface ModelIconConfig {
  type: IconType;
  src: string; // 图片路径（相对于public目录）
}

/**
 * 模型图标映射
 * 支持按模型ID和家族映射图标
 */
const MODEL_ICONS: Record<string, ModelIconConfig> = {
  // 具体模型图标 (优先级最高)
  'openai/gpt-5': { type: 'image', src: '/icons/gpt-5.svg' },
  'openai/gpt-5-mini': { type: 'image', src: '/icons/gpt-5-mini.svg' },
  'anthropic/claude-sonnet-4.5': { type: 'image', src: '/icons/claude-sonnet-4-5.svg' },
  'gemma3:1b': { type: 'image', src: '/icons/gemma3.svg' },

  // 家族图标 (中等优先级)
  openai: { type: 'image', src: '/icons/openai.svg' },
  anthropic: { type: 'image', src: '/icons/anthropic.svg' },
  gemma: { type: 'image', src: '/icons/gemma.svg' },
  ollama: { type: 'image', src: '/icons/ollama.svg' },
  gemini: { type: 'image', src: '/icons/gemini.svg' },
  vercel: { type: 'image', src: '/icons/vercel.svg' },
  google: { type: 'image', src: '/icons/google.svg' },
  openrouter: { type: 'image', src: '/icons/openrouter.svg' },
  qwen: { type: 'image', src: '/icons/qwen.svg' },
  claude: { type: 'image', src: '/icons/claude.svg' },
  alibaba: { type: 'image', src: '/icons/alibabacloud.svg' },
  deepseek: { type: 'image', src: '/icons/deepseek.svg' },
  moonshotai: { type: 'image', src: '/icons/kimi.svg' },
  grok: { type: 'image', src: '/icons/grok.svg' },
  zai: { type: 'image', src: '/icons/zhipu.svg' },
  xai: { type: 'image', src: '/icons/xai.svg' },

  // 默认图标 (最低优先级)
  default: { type: 'image', src: '/icons/model-default.svg' },
};

/**
 * 获取模型的图标配置
 * @param modelId 模型ID（如 'openai/gpt-5'）
 * @param family 模型家族名称（如 'openai'）
 * @returns 图标配置
 */
function getModelIconConfig(modelId?: string, family?: string): ModelIconConfig {
  // 优先使用具体模型的图标
  if (modelId && MODEL_ICONS[modelId]) {
    return MODEL_ICONS[modelId];
  }

  // 其次使用家族图标
  if (family) {
    const normalizedFamily = family.toLowerCase();
    if (MODEL_ICONS[normalizedFamily]) {
      return MODEL_ICONS[normalizedFamily];
    }
  }

  // 最后使用默认图标
  return MODEL_ICONS.default!;
}

/**
 * 图片图标组件（带错误处理）
 */
function ImageIcon({ src, alt, className, size }: { src: string; alt: string; className?: string; size?: number }) {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  // 当 src prop 变化时，重置状态
  useEffect(() => {
    // 使用 requestAnimationFrame 避免同步 setState
    requestAnimationFrame(() => {
      setImgSrc(src);
      setHasError(false);
    });
  }, [src]);

  const handleError = () => {
    if (imgSrc !== MODEL_ICONS.default!.src) {
      // 如果当前不是默认图标，尝试使用默认图标
      setImgSrc(MODEL_ICONS.default!.src);
      setHasError(false);
    } else {
      // 如果默认图标也加载失败，显示占位符
      setHasError(true);
    }
  };

  if (hasError) {
    // 图片加载失败时显示默认的 Lucide 图标
    return (
      <div style={size ? { width: size, height: size } : undefined} className="flex items-center justify-center">
        <Bot className={className} />
      </div>
    );
  }

  const imgProps = {
    src: imgSrc,
    alt,
    className,
    style: size ? { width: size, height: size } : undefined,
    onError: handleError,
  };

  return <Image {...imgProps} width={size || 16} height={size || 16} />;
}

/**
 * 渲染模型图标
 * @param modelId 模型ID（如 'openai/gpt-5'）
 * @param family 模型家族名称（如 'openai'）
 * @param className CSS类名
 * @param size 图标大小（可选）
 */
export function ModelIcon({ modelId, family, className, size }: { modelId?: string; family?: string; className?: string; size?: number }) {
  const config = getModelIconConfig(modelId, family);
  return (
    <div className={cn('flex h-6 w-6 items-center justify-center rounded-full bg-[#ffffff]', className)}>
      <ImageIcon src={config.src} alt={`${modelId || family || 'default'} icon`} className={cn('h-full w-full p-1')} size={size} />
    </div>
  );
}
