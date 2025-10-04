import { Markdown } from '@/components/block/markdown/markdown';
import { Badge } from '@/components/ui/badge';
import { AggregatedMessage, Message } from '@/lib/browser/chat-messages/types';
import { formatNumber } from '@/lib/utils';
import { StepBadge } from './step';
import { ToolMessageContent } from './tools';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

interface ChatMessageProps {
  messages: AggregatedMessage[];
}

const UserMessage = ({ message }: { message: Message<{ request: string }> }) => (
  <div className="bg-muted rounded-lg">
    <Markdown className="chat">{message.content.request}</Markdown>
  </div>
);

const PrepareMessage = ({ message, t }: { message: AggregatedMessage & { type: 'agent:lifecycle:prepare' }; t: any }) => {
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
            <span>{t('preparing')}</span>
          </Badge>
        </div>
      ) : (
        <Badge variant="outline" className="cursor-pointer font-mono">
          ⚙️ {t('prepared')}
        </Badge>
      )}
    </div>
  );
};

const PlanMessage = ({ message, t }: { message: AggregatedMessage & { type: 'agent:lifecycle:plan' }; t: any }) => {
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
              <span>📝 {t('planCompleted')}</span>
            </Badge>
          </div>
          <div className="bg-muted rounded-lg">
            <Markdown className="chat">{planCompleteMessage?.content.plan}</Markdown>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground mt-2 mb-2 font-mono text-xs">
          <Badge className="cursor-pointer font-mono text-xs">
            <span className="thinking-animation">📝</span>
            <span>{t('planning')}</span>
          </Badge>
        </div>
      )}
    </div>
  );
};

interface CompletionMessageProps {
  message: Message<{ results: string[]; total_input_tokens: number; total_completion_tokens: number }>;
}

const CompletionMessage = ({ message, t }: CompletionMessageProps & { t: any }) => {
  const showTokenCount = message.content.total_input_tokens || message.content.total_completion_tokens;
  return (
    <Badge className="cursor-pointer font-mono">
      🎉 {t('taskCompleted')}{' '}
      {showTokenCount && (
        <>
          (
          <span>
            {formatNumber(message.content.total_input_tokens || 0, { autoUnit: true })} {t('inputTokens')};{' '}
            {formatNumber(message.content.total_completion_tokens || 0, { autoUnit: true })} {t('completionTokens')}
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

const TerminatedMessage = ({ message, t }: TerminatedMessageProps & { t: any }) => {
  const showTokenCount = message.content.total_input_tokens || message.content.total_completion_tokens;
  return (
    <Badge className="cursor-pointer font-mono">
      🚫 {t('taskTerminated')}{' '}
      {showTokenCount && (
        <>
          (
          <span>
            {formatNumber(message.content.total_input_tokens || 0, { autoUnit: true })} {t('inputTokens')};{' '}
            {formatNumber(message.content.total_completion_tokens || 0, { autoUnit: true })} {t('completionTokens')}
          </span>
          )
        </>
      )}
    </Badge>
  );
};

const ErrorMessage = ({
  message,
  t,
}: {
  message: Message<{ error: string; total_input_tokens?: number; total_completion_tokens?: number }>;
  t: any;
}) => {
  const showTokenCount = message.content.total_input_tokens || message.content.total_completion_tokens;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="cursor-pointer font-mono">
            🚫 {t('taskError')}{' '}
            {showTokenCount && (
              <>
                (
                <span>
                  {formatNumber(message.content.total_input_tokens || 0, { autoUnit: true })} {t('inputTokens')};{' '}
                  {formatNumber(message.content.total_completion_tokens || 0, { autoUnit: true })} {t('completionTokens')}
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
              <div className="text-xs font-medium italic opacity-0 transition-opacity duration-300 group-hover:opacity-100 hover:opacity-100">
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
              {toolSelectedMessage?.content.thoughts && (
                <div className="bg-muted rounded-lg">
                  <Markdown className="chat">{toolSelectedMessage?.content.thoughts}</Markdown>
                </div>
              )}
              <ToolMessageContent message={message} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LifecycleMessage = ({ message, t }: { message: AggregatedMessage; t: any }) => {
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
              <PrepareMessage message={msg as AggregatedMessage & { type: 'agent:lifecycle:prepare' }} t={t} />
            </div>
          );
        }

        if (msg.type === 'agent:lifecycle:plan') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <PlanMessage message={msg as AggregatedMessage & { type: 'agent:lifecycle:plan' }} t={t} />
            </div>
          );
        }

        // 处理生命周期完成
        if (msg.type === 'agent:lifecycle:complete') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <CompletionMessage message={msg as Message<{ results: string[]; total_input_tokens: number; total_completion_tokens: number }>} t={t} />
            </div>
          );
        }

        // 处理生命周期终止
        if (msg.type === 'agent:lifecycle:terminated') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <TerminatedMessage message={msg} t={t} />
            </div>
          );
        }

        // 处理生命周期错误
        if (msg.type === 'agent:lifecycle:error') {
          return (
            <div key={index} className="container mx-auto max-w-4xl">
              <ErrorMessage message={msg} t={t} />
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

const ChatMessage = ({ message, t }: { message: AggregatedMessage; t: any }) => {
  if (!message.type?.startsWith('agent:lifecycle')) {
    return <Markdown>{message.content}</Markdown>;
  }

  return <LifecycleMessage message={message} t={t} />;
};

export const ChatMessages = ({ messages = [] }: ChatMessageProps) => {
  const t = useTranslations('chat.messages');

  return (
    <div className="h-full space-y-4">
      {messages.map((message, index) => (
        <div key={message.key || index} className="first:pt-0">
          <ChatMessage message={message} t={t} />
        </div>
      ))}
    </div>
  );
};
