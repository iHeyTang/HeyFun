'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { createChatSession, sendMessage } from '@/actions/chat';
import { toast } from 'sonner';
import { useRecentChatSessions } from './chat-history-sidebar';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isComplete: boolean;
  createdAt: Date;
}

interface ChatContainerProps {
  availableModels: Array<{
    provider: string;
    id: string;
    name: string;
  }>;
  sessionId?: string;
  existingSession?: any; // Will be typed properly with Prisma types
}

export const ChatContainer = ({ availableModels, sessionId, existingSession }: ChatContainerProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [selectedModel, setSelectedModel] = useState<
    | {
        provider: string;
        id: string;
        name: string;
      }
    | undefined
  >(existingSession ? { provider: existingSession.modelProvider, id: existingSession.modelId, name: existingSession.modelId } : availableModels[0]);

  const { refreshSessions } = useRecentChatSessions();
  const router = useRouter();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing messages if there's an existing session
  useEffect(() => {
    if (existingSession && existingSession.messages) {
      const loadedMessages: Message[] = existingSession.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        isStreaming: msg.isStreaming,
        isComplete: msg.isComplete,
        createdAt: new Date(msg.createdAt),
      }));
      setMessages(loadedMessages);
    }
  }, [existingSession]);

  const createNewSession = async () => {
    if (!selectedModel) {
      toast.error('Please select a model first');
      return null;
    }

    try {
      const result = await createChatSession({
        modelProvider: selectedModel.provider,
        modelId: selectedModel.id,
      });

      const newSessionId = result.data?.id ?? null;

      if (newSessionId) {
        // Refresh the sidebar to show the new session
        await refreshSessions();
      }

      return newSessionId;
    } catch (error) {
      toast.error('Failed to create chat session');
      console.error('Create session error:', error);
      return null;
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedModel) {
      toast.error('Please select a model first');
      return;
    }

    setIsLoading(true);

    try {
      let sessionId = currentSessionId;

      // Create new session if none exists
      if (!sessionId) {
        sessionId = await createNewSession();
        if (!sessionId) {
          setIsLoading(false);
          return;
        }
        setCurrentSessionId(sessionId);
      }

      // Add user message to UI
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content,
        isComplete: true,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Send message and get AI response
      const result = await sendMessage({
        sessionId,
        content,
      });

      const { aiMessage } = result.data!;

      // Add AI message placeholder
      const aiMessagePlaceholder: Message = {
        id: aiMessage.id,
        role: 'assistant',
        content: '',
        isStreaming: true,
        isComplete: false,
        createdAt: new Date(aiMessage.createdAt),
      };
      setMessages(prev => [...prev, aiMessagePlaceholder]);

      // Start streaming response
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          messageId: aiMessage.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get streaming response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                setMessages(prev => prev.map(msg => (msg.id === aiMessage.id ? { ...msg, isStreaming: false, isComplete: true } : msg)));
                break;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'content') {
                  setMessages(prev => prev.map(msg => (msg.id === aiMessage.id ? { ...msg, content: parsed.fullContent } : msg)));
                } else if (parsed.type === 'finished') {
                  setMessages(prev =>
                    prev.map(msg => (msg.id === aiMessage.id ? { ...msg, content: parsed.fullContent, isStreaming: false, isComplete: true } : msg)),
                  );
                } else if (parsed.type === 'error') {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === aiMessage.id ? { ...msg, content: `Error: ${parsed.error}`, isStreaming: false, isComplete: true } : msg,
                    ),
                  );
                  toast.error('AI response error: ' + parsed.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }

      // Update URL after message is sent successfully (only if we're not already in this session URL)
      if (!currentSessionId && sessionId) {
        window.history.replaceState(null, '', `/chat/${sessionId}`);
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');

      // Remove the AI message placeholder on error
      setMessages(prev => prev.filter(msg => msg.id !== `ai_${Date.now()}`));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    // Navigate to new chat
    router.push('/chat');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-4 opacity-50">
            <Image src="/logo.png" alt="HeyFun" width={64} height={64} />
            <div className="flex flex-col">
              <div className="text-2xl font-bold">HeyFun</div>
              <div className="text-muted-foreground text-sm">Hey! Let&apos;s bring a little fun to this world together.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {messages.map(message => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                isStreaming={message.isStreaming}
                timestamp={message.createdAt}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading || !selectedModel}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        onClearChat={clearChat}
        showClearChat={messages.length > 0}
      />
    </div>
  );
};
