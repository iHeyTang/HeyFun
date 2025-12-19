import { useMemo, memo, useCallback } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { EnhancedTable } from './EnhancedTable';
import { MermaidEmbed } from './MermaidEmbed';
import { rehypeMermaid } from './rehype-mermaid';
import { rehypeNoteMention } from './rehype-note-mention';
import { ImagePreview } from '../preview/image-preview';
import { cn } from '@/lib/utils';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { parseNoteMention, type NoteMentionData } from '../chat-input/note-mention-extension';
import { FileText } from 'lucide-react';

interface MarkdownProps {
  children: string;
  className?: string;
  isStreaming?: boolean; // ✅ 是否正在流式输出
}

const MarkdownComponent = ({ children, className = '', isStreaming = false }: MarkdownProps) => {
  // 处理锚点链接点击（脚注跳转）
  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();

    let targetElement: HTMLElement | null = null;

    // 方法1: 先尝试通过 ID 查找
    const targetId = href.substring(1);
    targetElement = document.getElementById(targetId);

    if (!targetElement && !targetId.startsWith('user-content-')) {
      targetElement = document.getElementById(`user-content-${targetId}`);
    }

    if (!targetElement && targetId.startsWith('user-content-')) {
      targetElement = document.getElementById(targetId.replace('user-content-', ''));
    }

    // 方法2: 如果通过 ID 找不到，尝试查找包含该 href 的链接
    // 这种情况发生在返回链接时（正文中的引用可能没有 ID）
    if (!targetElement) {
      // 解析 href，提取脚注编号和引用索引
      // 格式：#user-content-fnref-1-2 表示脚注1的第2次引用
      const match = href.match(/fnref-(\d+)(?:-(\d+))?/);

      if (match) {
        const refIndex = match[2] ? parseInt(match[2]) : 1; // 引用索引（如 2、3，默认为1）

        // 查找所有链接到这个脚注的 sup 元素
        const targetHref = href.replace('fnref', 'fn').replace(/-\d+$/, '');
        const allSupsWithLinks = Array.from(document.querySelectorAll(`a[href="${targetHref}"]`))
          .map(link => link.parentElement)
          .filter(el => el?.tagName === 'SUP');

        // 如果找到了带链接的引用，取对应索引的那个
        if (allSupsWithLinks.length > 0 && refIndex <= allSupsWithLinks.length) {
          targetElement = allSupsWithLinks[refIndex - 1] as HTMLElement;
        }

        // 如果还没找到，可能是纯文本的引用（2、3等）
        // 查找包含该数字的 sup 元素
        if (!targetElement) {
          const allSups = Array.from(document.querySelectorAll('sup'));
          const matchingSups = allSups.filter(sup => {
            const text = sup.textContent?.trim();
            return text === refIndex.toString();
          });

          if (matchingSups.length > 0) {
            // 如果有多个匹配，选择最接近第一个引用的那个
            targetElement = matchingSups[0] as HTMLElement;
          }
        }
      }
    }

    if (!targetElement) {
      console.error('[Markdown] ❌ 找不到目标元素:', href);
      return;
    }

    if (targetElement) {
      // 查找包含 overflow-y-auto 的滚动容器
      // 从当前元素向上查找，直到找到可滚动的容器
      let scrollContainer: HTMLElement | null = null;
      let current: HTMLElement | null = targetElement;

      while (current && current !== document.body) {
        const computedStyle = window.getComputedStyle(current);
        const overflowY = computedStyle.overflowY;

        // 检查是否是可滚动容器
        if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
          scrollContainer = current;
          break;
        }

        current = current.parentElement;
      }

      if (scrollContainer) {
        console.log('[Markdown] 📦 找到滚动容器:', scrollContainer);

        // 在找到的容器内滚动
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;

        // 计算目标元素相对于容器的位置，使其居中
        const targetPosition = scrollTop + targetRect.top - containerRect.top - containerRect.height / 2 + targetRect.height / 2;

        console.log('[Markdown] 🎯 滚动参数:', {
          scrollTop,
          targetPosition: Math.max(0, targetPosition),
          containerHeight: containerRect.height,
          targetTop: targetRect.top,
        });

        scrollContainer.scrollTo({
          top: Math.max(0, targetPosition), // 确保不小于0
          behavior: 'smooth',
        });
      } else {
        console.warn('[Markdown] ⚠️ 未找到滚动容器');
      }

      // 添加临时高亮效果
      targetElement.style.transition = 'background-color 0.3s ease';
      targetElement.style.backgroundColor = 'rgba(var(--primary), 0.1)';

      setTimeout(() => {
        targetElement.style.backgroundColor = '';
      }, 1000);
    }
  }, []);

  // 允许knowledge协议的链接（react-markdown v10+使用urlTransform）
  const urlTransform = useCallback((url: string) => {
    // 保留所有协议，包括自定义的knowledge://
    return url;
  }, []);

  // 使用useMemo缓存components对象，避免每次渲染都重新创建
  const components = useMemo<Components>(
    () => ({
      // 只自定义必要的组件，其他使用默认
      code: ({ children, className }) => {
        if (className?.includes('language-json')) {
          return (
            <SyntaxHighlighter
              showLineNumbers
              PreTag={({ children }) => <div className="bg-transparent">{children}</div>}
              language="json"
              style={githubGist}
            >
              {JSON.stringify(JSON.parse(children as string), null, 2)}
            </SyntaxHighlighter>
          );
        }
        return <code className={className}>{children}</code>;
      },
      pre: ({ children }) => (
        <pre className="border-border my-4 w-full max-w-full overflow-x-auto border p-4">
          <div className="min-w-max">{children}</div>
        </pre>
      ),
      sup: ({ children }) => <sup className="text-primary ml-0.5 text-[10px] font-semibold">{children}</sup>,
      // 脚注区域样式
      section: ({ children, ...props }: any) => {
        // 检测是否是脚注区域（GFM 会添加 data-footnotes 属性）
        const isFootnotes = 'data-footnotes' in props || props.dataFootnotes !== undefined;

        if (isFootnotes) {
          return (
            <section {...props} className="border-border/50 mt-8 border-t pt-4">
              {children}
            </section>
          );
        }

        return <section {...props}>{children}</section>;
      },
      // 脚注列表样式
      ol: ({ children, ...props }: any) => {
        // 检测父元素是否有 data-footnotes 属性
        const hasFootnotesParent =
          props.className?.includes('footnotes') || (props.node?.parent && 'dataFootnotes' in (props.node.parent.properties || {}));

        if (hasFootnotesParent) {
          return (
            <ol className="space-y-2 text-sm" style={{ listStyle: 'decimal', paddingLeft: '1.5rem' }} {...props}>
              {children}
            </ol>
          );
        }

        return <ol {...props}>{children}</ol>;
      },
      hr: () => <hr className="border-border my-4" />,
      h4: ({ children }) => {
        // 检测是否是 "References:" 标题
        const text = typeof children === 'string' ? children : '';
        const isReferences = text.toLowerCase().includes('reference');

        return <h4 className={`mb-3 mt-6 text-sm font-semibold ${isReferences ? 'text-muted-foreground/80' : ''}`}>{children}</h4>;
      },
      table: ({ children }) => (
        <EnhancedTable>
          <table className="!m-0 w-full border-collapse">{children}</table>
        </EnhancedTable>
      ),
      thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
      tbody: ({ children }) => <tbody>{children}</tbody>,
      tr: ({ children }) => <tr className="transition-colors">{children}</tr>,
      th: ({ children }) => <th className="text-foreground text-left font-medium">{children}</th>,
      td: ({ children }) => <td className="text-muted-foreground">{children}</td>,
      // 自定义图片组件
      img: ({ src, alt, ...props }: any) => {
        // 判断 src 是否是 OSS key，如果是则转换为 /api/oss/ 路径
        // 如果 src 已经是完整的 URL（http/https/data:）或者是绝对路径（以 / 开头），则不需要转换
        return <ImagePreview src={src} alt={alt} className="my-4 block max-h-[200px] max-w-full rounded-lg object-contain" {...props} />;
      },
      // 自定义 Mermaid 组件
      'mermaid-container': ({ node, ...props }: any) => {
        const mermaidCode = props['data-mermaid'];
        if (!mermaidCode) return null;
        return <MermaidEmbed chart={mermaidCode} />;
      },
      // 自定义 Note Mention 组件
      span: ({ children, ...props }: any) => {
        // 支持两种属性命名方式：data-type 和 dataType（react-markdown 可能会转换）
        const dataType = props['data-type'] || props['dataType'];
        const mentionText = props['data-note-mention'] || props['dataNoteMention'];
        const noteId = props['data-note-id'] || props['dataNoteId'];
        const noteTitle = props['data-note-title'] || props['dataNoteTitle'];
        const noteContent = props['data-note-content'] || props['dataNoteContent'];

        // 如果是 note mention，使用自定义渲染
        if (dataType === 'note-mention' && mentionText) {
          const parsed = parseNoteMention(mentionText);
          if (parsed) {
            const { startLine, endLine, noteId: parsedNoteId, content } = parsed;
            let positionText = `:${startLine}`;
            if (endLine && endLine !== startLine) {
              positionText = `:${startLine}-${endLine}`;
            }
            // 优先使用 noteTitle（如果有），否则显示 noteId，最后显示"笔记"
            const displayTitle = noteTitle || parsedNoteId || '笔记';
            const displayNoteId = noteId || parsedNoteId || '';

            return (
              <span
                className={cn(
                  'mention group inline-flex items-center gap-1 px-2 text-[11px] font-medium',
                  'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-600/20',
                  'dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-400/30',
                  'hover:bg-blue-200 dark:hover:bg-blue-900/40',
                  'cursor-pointer rounded-md',
                  'px-[1px]',
                )}
                data-type="note-mention"
                data-note-mention={mentionText}
                data-note-id={displayNoteId}
                data-note-title={noteTitle}
                data-line={startLine}
                title={content ? `内容: ${content}` : undefined}
              >
                <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold">{displayTitle}</span>
                <span className="text-blue-700 dark:text-blue-400">{positionText}</span>
              </span>
            );
          }
        }
        // 默认渲染
        return <span {...props}>{children}</span>;
      },
    }),
    [],
  );

  return (
    <div
      className={`markdown-body prose prose-gray dark:prose-invert prose-sm markdown-compact max-w-none overflow-hidden rounded-md bg-transparent p-4 ${className} ${isStreaming ? 'streaming-cursor' : ''}`}
      data-streaming={isStreaming}
    >
      <ReactMarkdown
        remarkPlugins={[remarkCjkFriendly, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeNoteMention, rehypeMermaid, rehypeHighlight]}
        components={components}
        urlTransform={urlTransform}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

// 使用memo包裹组件，只在content、className或isStreaming变化时重新渲染
export const Markdown = memo(MarkdownComponent);
