import { Markdown } from '@/components/block/markdown/markdown';
import { Badge } from '@/components/ui/badge';
import { AggregatedMessage, Message } from '@/lib/browser/chat-messages/types';
import { formatNumber } from '@/lib/utils';
import '@/styles/animations.css';
import { StepBadge } from './step';
import { ToolMessageContent } from './tools';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatMessageProps {
  messages: AggregatedMessage[];
}

const UserMessage = ({ message }: { message: Message<{ request: string }> }) => <Markdown className="chat">{message.content.request}</Markdown>;

const PrepareMessage = ({ message }: { message: AggregatedMessage & { type: 'agent:lifecycle:prepare' } }) => {
  const prepareCompleteMessage = message.messages.find(msg => msg.type === 'agent:lifecycle:prepare:complete') as
    | (AggregatedMessage & { type: 'agent:lifecycle:prepare:complete' })
    | undefined;

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-2 text-lg font-bold">✨ FunMax</div>
      {!prepareCompleteMessage ? (
        <div className="text-muted-foreground mt-2 mb-2 font-mono text-xs">
          <Badge
            variant={prepareCompleteMessage ? 'outline' : 'default'}
            className={cn('cursor-pointer font-mono text-xs', prepareCompleteMessage && 'text-muted-foreground')}
          >
            <span className="spinning-animation">⚙️ </span>
            <span>Preparing...</span>
          </Badge>
        </div>
      ) : (
        <Badge variant="outline" className="cursor-pointer font-mono">
          ⚙️ Prepared
        </Badge>
      )}
    </div>
  );
};

const PlanMessage = ({ message }: { message: AggregatedMessage & { type: 'agent:lifecycle:plan' } }) => {
  const planCompleteMessage = message.messages.find(msg => msg.type === 'agent:lifecycle:plan:complete') as
    | (AggregatedMessage & { type: 'agent:lifecycle:plan:complete' })
    | undefined;

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-2 text-lg font-bold">✨ FunMax</div>
      {planCompleteMessage ? (
        <div className="space-y-2">
          <div className="text-muted-foreground mt-2 mb-2 font-mono text-xs">
            <Badge variant="outline" className="cursor-pointer font-mono text-xs">
              <span>📝 Plan Completed</span>
            </Badge>
          </div>
          <Markdown className="chat">{planCompleteMessage?.content.plan}</Markdown>
        </div>
      ) : (
        <div className="text-muted-foreground mt-2 mb-2 font-mono text-xs">
          <Badge className="cursor-pointer font-mono text-xs">
            <span className="thinking-animation">📝</span>
            <span>Planning...</span>
          </Badge>
        </div>
      )}
    </div>
  );
};

interface CompletionMessageProps {
  message: Message<{ results: string[]; total_input_tokens: number; total_completion_tokens: number }>;
}

const CompletionMessage = ({ message }: CompletionMessageProps) => {
  const showTokenCount = message.content.total_input_tokens || message.content.total_completion_tokens;
  return (
    <Badge className="cursor-pointer font-mono">
      🎉 Awesome! Task Completed{' '}
      {showTokenCount && (
        <>
          (
          <span>
            {formatNumber(message.content.total_input_tokens || 0, { autoUnit: true })} input;{' '}
            {formatNumber(message.content.total_completion_tokens || 0, { autoUnit: true })} completion
          </span>
          )
        </>
      )}
    </Badge>
  );
};

interface TerminatedMessageProps {
  message: Message<{ total_input_tokens?: number; total_completion_tokens?: number }>;
}

const TerminatedMessage = ({ message }: TerminatedMessageProps) => {
  const showTokenCount = message.content.total_input_tokens || message.content.total_completion_tokens;
  return (
    <Badge className="cursor-pointer font-mono">
      🚫 Task Terminated By User{' '}
      {showTokenCount && (
        <>
          (
          <span>
            {formatNumber(message.content.total_input_tokens || 0, { autoUnit: true })} input;{' '}
            {formatNumber(message.content.total_completion_tokens || 0, { autoUnit: true })} completion
          </span>
          )
        </>
      )}
    </Badge>
  );
};

const ErrorMessage = ({ message }: { message: Message<{ error: string; total_input_tokens?: number; total_completion_tokens?: number }> }) => {
  const showTokenCount = message.content.total_input_tokens || message.content.total_completion_tokens;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="cursor-pointer font-mono">
            🚫 Oops! something went wrong{' '}
            {showTokenCount && (
              <>
                (
                <span>
                  {formatNumber(message.content.total_input_tokens || 0, { autoUnit: true })} input;{' '}
                  {formatNumber(message.content.total_completion_tokens || 0, { autoUnit: true })} completion
                </span>
                )
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-80 break-words">{message.content.error}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const StepMessage = ({ message }: { message: AggregatedMessage & { type: 'agent:lifecycle:step' } }) => {
  if (!('messages' in message)) return null;

  const thinkMessage = message.messages.find(msg => msg.type === 'agent:lifecycle:step:think') as
    | (AggregatedMessage & { type: 'agent:lifecycle:step:think' })
    | undefined;

  const toolSelectedMessage = thinkMessage?.messages.find(
    (msg): msg is Message => 'type' in msg && msg.type === 'agent:lifecycle:step:think:tool:selected',
  ) as (AggregatedMessage & { type: 'agent:lifecycle:step:think:tool:selected' }) | undefined;

  return (
    <div className="group mb-4 space-y-4">
      {thinkMessage && (
        <div className="space-y-2">
          <div className="container mx-auto max-w-4xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-lg font-bold">✨ FunMax</div>
              <div className="text-xs font-medium text-theme-tertiary italic opacity-0 transition-opacity duration-300 group-hover:opacity-100 hover:opacity-100">
                {thinkMessage.createdAt
                  ? new Date(thinkMessage.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : ''}
              </div>
            </div>
            <StepBadge message={message} />
            <div className="flex flex-col gap-2 space-y-2">
              {toolSelectedMessage?.content.thoughts && <Markdown className="chat">{toolSelectedMessage?.content.thoughts}</Markdown>}
              <ToolMessageContent message={message} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LifecycleMessage = ({ message }: { message: AggregatedMessage }) => {
  if (!('messages' in message)) return null;

  return (
    <div className="space-y-4">
      {message.messages.map((msg, index) => {
        if (!('type' in msg)) return null;

        // 处理生命周期开始
        if (msg.type === 'agent:lifecycle:start') {
          return (
            <div key={index} className="container mx-auto flex max-w-4xl justify-end">
              <UserMessage message={msg as Message<{ request: string }>} />
            </div>
          );
        }

        if (msg.type === 'agent:lifecycle:prepare') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <PrepareMessage message={msg as AggregatedMessage & { type: 'agent:lifecycle:prepare' }} />
            </div>
          );
        }

        if (msg.type === 'agent:lifecycle:plan') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <PlanMessage message={msg as AggregatedMessage & { type: 'agent:lifecycle:plan' }} />
            </div>
          );
        }

        // 处理生命周期完成
        if (msg.type === 'agent:lifecycle:complete') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <CompletionMessage message={msg as Message<{ results: string[]; total_input_tokens: number; total_completion_tokens: number }>} />
            </div>
          );
        }

        // 处理生命周期终止
        if (msg.type === 'agent:lifecycle:terminated') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <TerminatedMessage message={msg} />
            </div>
          );
        }

        // 处理生命周期错误
        if (msg.type === 'agent:lifecycle:error') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <ErrorMessage message={msg} />
            </div>
          );
        }

        // 处理步骤消息
        if (msg.type === 'agent:lifecycle:step') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <StepMessage message={msg as AggregatedMessage & { type: 'agent:lifecycle:step' }} />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

const ChatMessage = ({ message }: { message: AggregatedMessage }) => {
  if (!message.type?.startsWith('agent:lifecycle')) {
    return <Markdown>{message.content}</Markdown>;
  }

  return <LifecycleMessage message={message} />;
};

export const ChatMessages = ({ messages = [] }: ChatMessageProps) => {
  return (
    <div className="h-full space-y-4">
      {messages.map((message, index) => (
        <div key={message.key || index} className="first:pt-0">
          <ChatMessage message={message} />
        </div>
      ))}
    </div>
  );
};
