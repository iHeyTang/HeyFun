/**
 * AIGC Models 工具完整展示组件（包含参数和结果）
 */

'use client';

import { Bot, ImageIcon, Video, Music, Volume2, Sparkles } from 'lucide-react';

interface AigcModelsResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { models: Array, count: number, generationType: string }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

interface AigcModel {
  name: string;
  provider: string;
  displayName: string;
  description?: string;
  costDescription?: string;
  generationTypes: string[];
  tags?: string[];
  paramsSchema?: any;
}

interface AigcModelsData {
  models?: AigcModel[];
  count?: number;
  generationType?: string;
}

// 生成类型图标映射
const generationTypeIcons: Record<string, React.ReactNode> = {
  'text-to-image': <ImageIcon className="h-3 w-3" />,
  'image-to-image': <ImageIcon className="h-3 w-3" />,
  'text-to-video': <Video className="h-3 w-3" />,
  'image-to-video': <Video className="h-3 w-3" />,
  'video-to-video': <Video className="h-3 w-3" />,
  'keyframe-to-video': <Video className="h-3 w-3" />,
  'text-to-speech': <Volume2 className="h-3 w-3" />,
  'speech-to-text': <Volume2 className="h-3 w-3" />,
  'lip-sync': <Video className="h-3 w-3" />,
  music: <Music className="h-3 w-3" />,
};

// 生成类型标签映射
const generationTypeLabels: Record<string, string> = {
  'text-to-image': '文本生图',
  'image-to-image': '图生图',
  'text-to-video': '文本生视频',
  'image-to-video': '图生视频',
  'video-to-video': '视频生视频',
  'keyframe-to-video': '关键帧生视频',
  'text-to-speech': '文本转语音',
  'speech-to-text': '语音转文本',
  'lip-sync': '唇形同步',
  music: '音乐生成',
};

export function AigcModelsResult({ args, result, status, error }: AigcModelsResultProps) {
  // 解析结果数据
  const data: AigcModelsData | null = result && status === 'success' ? result : null;

  // 从参数或结果中获取生成类型
  const generationType = args?.generationType || data?.generationType;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {generationType && generationType !== 'all' && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            <span>
              生成类型: <span className="text-foreground/80 font-medium">{generationTypeLabels[generationType] || generationType}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '获取模型列表失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Sparkles className="h-3 w-3 animate-pulse" />
        <span>
          正在获取模型列表{generationType && generationType !== 'all' ? ` (${generationTypeLabels[generationType] || generationType})` : ''}...
        </span>
      </div>
    );
  }

  // 成功状态但没有结果
  if (!data || !data.models || data.models.length === 0) {
    return (
      <div className="space-y-1">
        {generationType && generationType !== 'all' && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            <span>
              生成类型: <span className="text-foreground/80 font-medium">{generationTypeLabels[generationType] || generationType}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">未找到可用模型</div>
      </div>
    );
  }

  // 成功状态，有结果
  return (
    <div className="space-y-2">
      {/* 生成类型和模型数量 */}
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Sparkles className="h-3 w-3" />
        <span>
          {generationType && generationType !== 'all' ? (
            <>
              生成类型: <span className="text-foreground/80 font-medium">{generationTypeLabels[generationType] || generationType}</span>
            </>
          ) : (
            '所有可用模型'
          )}
        </span>
        {data.count !== undefined && <span className="text-muted-foreground/50">({data.count} 个模型)</span>}
      </div>

      <div className="grid space-y-1.5 overflow-x-auto">
        {data.models.map((model, index) => (
          <div key={index} className="border-border/30 bg-muted/20 hover:bg-muted/30 whitespace-nowrap rounded border p-1.5 transition-colors">
            {/* 第一行：模型名称、提供商、模型ID */}
            <div className="mb-1 flex items-center gap-1.5">
              <Bot className="text-muted-foreground/50 h-3 w-3 flex-shrink-0" />
              <h4 className="text-foreground/90 flex-1 text-xs font-medium">{model.displayName || model.name}</h4>
              {model.provider && <span className="text-muted-foreground/50 bg-muted/30 rounded px-1 py-0.5 text-[10px]">{model.provider}</span>}
              <span className="text-muted-foreground/40 font-mono text-[10px]">{model.name}</span>
            </div>

            {/* 第二行：生成类型和标签（紧凑显示） */}
            <div className="flex flex-wrap items-center gap-1">
              {/* 支持的生成类型 */}
              {model.generationTypes && model.generationTypes.length > 0 && (
                <>
                  {model.generationTypes.map((type, typeIndex) => (
                    <div key={typeIndex} className="text-muted-foreground/70 bg-muted/20 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px]">
                      {generationTypeIcons[type] || <Sparkles className="h-2.5 w-2.5" />}
                      <span>{generationTypeLabels[type] || type}</span>
                    </div>
                  ))}
                </>
              )}
              {/* 标签 */}
              {model.tags && model.tags.length > 0 && (
                <>
                  {model.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="text-muted-foreground/50 bg-muted/10 rounded px-1 py-0.5 text-[10px]">
                      {tag}
                    </span>
                  ))}
                </>
              )}
            </div>

            {/* 第三行：描述和费用（如果有） */}
            {(model.description || model.costDescription) && (
              <div className="mt-1 flex items-start gap-2 text-[10px]">
                {model.description && <p className="text-muted-foreground/70 line-clamp-1 flex-1 leading-relaxed">{model.description}</p>}
                {model.costDescription && <span className="text-muted-foreground/60 flex-shrink-0">💰 {model.costDescription}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
