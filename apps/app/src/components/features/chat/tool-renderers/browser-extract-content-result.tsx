/**
 * Browser Extract Content 工具结果展示组件
 */

'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface BrowserExtractContentResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { content: string, contentType: 'text' | 'html' | 'markdown' }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  sessionId?: string;
}

interface BrowserExtractContentData {
  content?: string;
  contentType?: 'text' | 'html' | 'markdown';
  contentFile?: string;
  contentSize?: number;
  debug?: {
    pageUrl?: string;
    pageTitle?: string;
    hasContent?: boolean;
  };
}

export function BrowserExtractContentResult({ args, result, status, error, sessionId }: BrowserExtractContentResultProps) {
  const [showFullContent, setShowFullContent] = useState(false);

  // 解析结果数据
  const data: BrowserExtractContentData | null = result && status === 'success' ? result : null;
  const selector = args?.selector;
  const extractType = args?.extractType || data?.contentType || 'markdown';
  const content = data?.content || '';

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {selector && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3" />
            <span>
              选择器: <span className="text-foreground/80 font-mono text-xs">{selector}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '提取内容失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>正在提取内容{selector ? ` (${selector})` : ''}...</span>
      </div>
    );
  }

  // 成功状态但没有内容
  if (!content || content.trim().length === 0) {
    return (
      <div className="space-y-2">
        {selector && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3" />
            <span>
              选择器: <span className="text-foreground/80 font-mono text-xs">{selector}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">
          未提取到内容
          {data?.contentFile && <span className="mt-1 block">内容已保存到文件（大小: {data.contentSize || 0} 字节）</span>}
        </div>
        {data?.debug && (
          <div className="border-border/30 bg-muted/20 space-y-1 rounded border p-2 text-xs">
            <div className="text-muted-foreground/70 font-medium">调试信息:</div>
            {data.debug.pageUrl && (
              <div>
                <span className="text-muted-foreground/70">页面URL: </span>
                <span className="text-foreground/80 break-all font-mono">{data.debug.pageUrl}</span>
              </div>
            )}
            {data.debug.pageTitle && (
              <div>
                <span className="text-muted-foreground/70">页面标题: </span>
                <span className="text-foreground/80">{data.debug.pageTitle}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground/70">内容状态: </span>
              <span className={data.debug.hasContent ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                {data.debug.hasContent ? '有内容' : '无内容'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 内容预览长度
  const previewLength = 500;
  const shouldTruncate = content.length > previewLength;
  const displayContent = showFullContent || !shouldTruncate ? content : content.substring(0, previewLength) + '...';

  return (
    <div className="space-y-2">
      {/* 提取信息 */}
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <FileText className="h-3 w-3" />
        <span>
          提取类型: <span className="text-foreground/80 font-medium">{extractType}</span>
          {selector && (
            <>
              {' | '}
              选择器: <span className="text-foreground/80 font-mono">{selector}</span>
            </>
          )}
          {' | '}
          长度: <span className="text-foreground/80 font-medium">{content.length} 字符</span>
        </span>
      </div>

      {/* 调试信息（如果有） */}
      {data?.debug && (
        <div className="border-border/30 bg-muted/20 space-y-1 rounded border p-2 text-xs">
          <div className="text-muted-foreground/70 font-medium">调试信息:</div>
          {data.debug.pageUrl && (
            <div>
              <span className="text-muted-foreground/70">页面URL: </span>
              <span className="text-foreground/80 break-all font-mono text-xs">{data.debug.pageUrl}</span>
            </div>
          )}
          {data.debug.pageTitle && (
            <div>
              <span className="text-muted-foreground/70">页面标题: </span>
              <span className="text-foreground/80">{data.debug.pageTitle}</span>
            </div>
          )}
        </div>
      )}

      {/* 内容显示 */}
      <div className="border-border/30 bg-muted/20 rounded border p-2">
        {extractType === 'html' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: displayContent }} />
        ) : (
          <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed">{displayContent}</pre>
        )}
        {shouldTruncate && (
          <button
            type="button"
            onClick={() => setShowFullContent(!showFullContent)}
            className="text-muted-foreground/70 hover:text-foreground/80 mt-2 text-xs underline"
          >
            {showFullContent ? '收起' : '展开全部'}
          </button>
        )}
      </div>
    </div>
  );
}
