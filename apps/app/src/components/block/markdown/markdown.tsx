import { cn } from '@/lib/utils';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { useAsync } from '@/hooks/use-async';
import { LoaderIcon } from 'lucide-react';

const checkJson = (text: string | null) => {
  if (!text) return false;

  try {
    JSON.parse(text);
    return true;
  } catch (error) {
    return false;
  }
};

export const Markdown: React.FC<{ src?: string; children?: string | null; className?: string }> = ({ src, children, className }) => {
  const { data: content, isLoading } = useAsync(
    async () => {
      if (src) {
        const response = await fetch(src);
        return await response.text();
      }
      return children;
    },
    [],
    { deps: [src, children] },
  );

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderIcon className="text-primary h-5 w-5 animate-spin" />
      </div>
    );
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
                  style={githubGist}
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
