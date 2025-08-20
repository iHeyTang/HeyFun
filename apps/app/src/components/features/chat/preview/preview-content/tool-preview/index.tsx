import { Markdown } from '@/components/block/markdown/markdown';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import useAgentTools from '@/hooks/use-tools';
import { Message } from '@/lib/browser/chat-messages/types';
import { getImageUrl } from '@/lib/browser/image';
import { cn } from '@/lib/utils';
import { ToolResult } from '@repo/agent';
import { LoaderIcon, PackageIcon } from 'lucide-react';

interface ToolPreviewProps {
  messages: Message[];
  executionId: string;
  className?: string;
}

export const ToolPreview = ({ messages, executionId, className }: ToolPreviewProps) => {
  const { getToolByPrefix } = useAgentTools();

  const executionStart = messages.find(m => m.type === 'agent:lifecycle:step:act:tool:execute:start' && m.content.id === executionId);
  const executionComplete = messages.find(m => m.type === 'agent:lifecycle:step:act:tool:execute:complete' && m.content.id === executionId);

  const tool = getToolByPrefix(executionStart?.content.name || '');
  const args = executionStart?.content.args;
  const result = executionComplete?.content.result as ToolResult | undefined;
  const isExecuting = executionStart && !executionComplete;

  return (
    <div className={cn('h-full flex-col overflow-auto', className)}>
      <Popover>
        <PopoverTrigger>
          <Badge className="cursor-pointer font-mono text-xs">
            <div className="flex items-center gap-1">
              <PackageIcon className="h-3.5 w-3.5" />
              {tool.toolName} {tool.functionName}
            </div>
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-full">
          <code className="text-xs whitespace-nowrap">ID: {executionId}</code>
        </PopoverContent>
      </Popover>
      
      <div className="flex-1 space-y-4 overflow-auto p-2">
        {args && Object.keys(args).length > 0 && (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm font-medium">Parameters</div>
            <div className="bg-silver-gradient space-y-2 rounded-md p-3">
              {Object.entries(args).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1">
                  <div className="text-muted-foreground text-xs font-medium">{key}</div>
                  <Badge variant="outline" className="font-mono break-all whitespace-normal">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(result?.content) ? (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm font-medium">Result</div>
            <div className={cn('bg-silver-gradient text-foreground overflow-hidden rounded-md p-2')}>
              <Markdown>
                {result.content
                  .map((r, index) => {
                    if (r.type === 'text') {
                      return r.text;
                    }
                    if (r.type === 'image') {
                      const title = r.data.includes('/') ? `<div style="font-size: 10px;">${r.data}</div>` : '';
                      return `![${tool.toolName} ${tool.functionName} Image ${index}](${getImageUrl(r.data)})\n${title}`;
                    }
                    if (r.type === 'resource') {
                      return `[${r.resource.uri}](${r.resource.uri})`;
                    }
                    if (r.type === 'resource_link') {
                      return `[${r.uri}](${r.uri})`;
                    }
                    if (r.type === 'audio') {
                      return <audio src={r.data} controls />;
                    }
                  })
                  .join('\n\n')}
              </Markdown>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm font-medium">Result</div>
            <div className={cn('bg-silver-gradient text-foreground overflow-hidden rounded-md')}>
              <Markdown className="text-xs">{typeof result === 'object' ? JSON.stringify(result, null, 2) : result}</Markdown>
            </div>
          </div>
        ) : (
          isExecuting && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm font-medium">Result</div>
              <div className="bg-muted/40 flex items-center justify-center rounded-md p-6">
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <LoaderIcon className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Processing...</span>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};