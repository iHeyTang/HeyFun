/**
 * 片段检索微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { Search } from 'lucide-react';

interface FragmentRetrievalResult {
  fragmentIds?: string[];
  fragments?: Array<{ id: string; name: string }>;
  confidence?: number;
  reasons?: string[];
  retrievalStrategy?: 'tag' | 'keyword' | 'vector' | 'llm' | 'hybrid';
  query?: string;
  keywords?: string[];
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

interface FragmentRetrieverRendererProps {
  data: FragmentRetrievalResult;
}

export const FragmentRetrieverRenderer = memo(function FragmentRetrieverRenderer({
  data,
}: FragmentRetrieverRendererProps) {
  const confidence = data.confidence ?? 0;
  const fragmentIds = data.fragmentIds || [];
  const fragments = data.fragments || [];
  const reasons = data.reasons || [];
  const query = data.query;
  const keywords = data.keywords || [];

  // 创建片段名称映射
  const fragmentNameMap = new Map(fragments.map(f => [f.id, f.name]));

  // 调试：打印接收到的数据
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[FragmentRetrieverRenderer] 接收到的数据:', { query, keywords, data });
  }

  return (
    <div className="space-y-1.5">
      {/* 查询文本 - 始终显示，即使为空也显示提示 */}
      <div className="flex items-start gap-1.5">
        <Search className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-[10px] font-medium text-gray-700">检索查询</div>
          <div className="text-[10px] text-gray-600 break-words">
            {query && query.trim() ? query : '(未提供查询文本)'}
          </div>
        </div>
      </div>

      {/* 关键词 */}
      {keywords.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">提取关键词</div>
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 10).map((keyword, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px]"
              >
                {keyword}
              </span>
            ))}
            {keywords.length > 10 && (
              <span className="px-1.5 py-0.5 text-gray-500 text-[10px]">
                +{keywords.length - 10}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 检索策略 */}
      {data.retrievalStrategy && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">检索策略</div>
          <div className="text-[10px] text-gray-600">
            {data.retrievalStrategy === 'tag' && '标签匹配'}
            {data.retrievalStrategy === 'keyword' && '关键词搜索'}
            {data.retrievalStrategy === 'vector' && '向量搜索'}
            {data.retrievalStrategy === 'llm' && 'LLM选择'}
            {data.retrievalStrategy === 'hybrid' && '混合检索'}
          </div>
        </div>
      )}

      {/* 匹配片段 */}
      {fragmentIds.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">
            匹配片段 ({fragmentIds.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {fragmentIds.slice(0, 5).map((id, idx) => {
              const name = fragmentNameMap.get(id) || id.substring(0, 8) + '...';
              return (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]"
                  title={id}
                >
                  {name}
                </span>
              );
            })}
            {fragmentIds.length > 5 && (
              <span className="px-1.5 py-0.5 text-gray-500 text-[10px]">
                +{fragmentIds.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 置信度 */}
      {confidence > 0 && (
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-medium text-gray-700">置信度</div>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-500">{(confidence * 100).toFixed(0)}%</div>
        </div>
      )}

      {/* 分析原因 */}
      {reasons.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">分析原因</div>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            {reasons.map((reason, idx) => (
              <div key={idx}>• {reason}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

