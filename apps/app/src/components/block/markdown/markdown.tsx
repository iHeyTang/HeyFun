import { cn } from '@/lib/utils';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useAsync } from '@/hooks/use-async';
import { createThemeCodeStyle } from '@/styles/code-theme';

export const Markdown: React.FC<{ src?: string; children?: string | null; className?: string }> = ({ src, children, className }) => {
  const { data: content, isLoading } = useAsync(
    async () => {
      if (src) {
        const response = await fetch(src, {
          cache: 'default',
        });
        return await response.text();
      }
      return children;
    },
    [],
    { deps: [src, children] },
  );

  const MarkdownSkeleton = () => (
    <div className={cn('markdown-body mt-2 flex min-h-40 items-center justify-center rounded-md bg-transparent p-4', className)}>
      <div className="w-full max-w-2xl space-y-4">
        <div className="bg-muted/60 mx-auto h-7 w-48 animate-pulse rounded" />

        <div className="space-y-3">
          <div className="bg-muted/40 h-5 w-full animate-pulse rounded" />
          <div className="bg-muted/40 mx-auto h-5 w-4/5 animate-pulse rounded" />
          <div className="bg-muted/40 mx-auto h-5 w-5/6 animate-pulse rounded" />
        </div>

        <div className="bg-muted/50 mx-auto h-6 w-32 animate-pulse rounded" />

        <div className="space-y-3">
          <div className="bg-muted/40 h-5 w-full animate-pulse rounded" />
          <div className="bg-muted/40 mx-auto h-5 w-3/4 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <MarkdownSkeleton />;
  }

  return (
    <div className={cn('markdown-body mt-2 rounded-md bg-transparent p-4', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        urlTransform={url => url}
        components={{
          a: ({ href, children }) => {
            return (
              <code className="break-all">
                <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono">
                  {children}
                </a>
              </code>
            );
          },
          code: ({ children, className }) => {
            if (className?.includes('language-json')) {
              return (
                <SyntaxHighlighter
                  showLineNumbers
                  PreTag={({ children }) => <div className="bg-transparent">{children}</div>}
                  language="json"
                  style={createThemeCodeStyle()}
                >
                  {JSON.stringify(JSON.parse(children as string), null, 2)}
                </SyntaxHighlighter>
              );
            }
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
