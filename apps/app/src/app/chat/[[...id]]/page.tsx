'use client';

import { getChatSession } from '@/actions/chat';
import { ChatContainer } from '@/components/features/chat/chat-container';
import { useLLM } from '@/hooks/use-llm';
import { useEffect, useState } from 'react';

interface ChatPageProps {
  params: Promise<{
    id?: string[];
  }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [existingSession, setExistingSession] = useState<Awaited<ReturnType<typeof getChatSession>>['data'] | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { availableModels } = useLLM();

  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoadingSession(true);
        const resolvedParams = await params;
        const id = resolvedParams.id?.[0];
        setSessionId(id);
        if (id) {
          try {
            const sessionResult = await getChatSession({ sessionId: id });
            setExistingSession(sessionResult?.data || null);
          } catch (error) {
            console.error('Error loading session:', error);
          }
        }
      } catch (error) {
        console.error('Error initializing chat page:', error);
        setError('Failed to initialize chat page');
      } finally {
        setLoadingSession(false);
      }
    };

    initializePage();
  }, [params]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold">Error Loading Chat</h2>
          <p className="text-muted-foreground">Please try refreshing the page or check your configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChatContainer loading={loadingSession} availableModels={availableModels} sessionId={sessionId} existingSession={existingSession} />
    </div>
  );
}
