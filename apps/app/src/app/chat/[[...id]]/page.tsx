import { getModelProviderConfigs } from '@/actions/llm';
import { getChatSession } from '@/actions/chat';
import { ChatContainer } from '@/components/features/simple-chat/chat-container';
import { LLMFactory } from '@repo/llm/chat';

interface ChatPageProps {
  params: Promise<{
    id?: string[];
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const sessionId = (await params).id?.[0];

  try {
    // Get available providers and their configs
    const configsResult = await getModelProviderConfigs({});

    const configs = configsResult.data ?? [];

    // Get available models from configured providers
    const availableModels: Array<{ provider: string; id: string; name: string }> = [];

    for (const config of configs) {
      try {
        const provider = LLMFactory.getProvider(config.provider);
        if (provider) {
          const models = await provider.getModels();
          if (models && Array.isArray(models)) {
            for (const model of models) {
              availableModels.push({
                provider: config.provider,
                id: model.id,
                name: model.name || model.id,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to get models for provider ${config.provider}:`, error);
      }
    }

    // If sessionId exists, try to fetch the session
    let existingSession = null;
    if (sessionId) {
      try {
        const sessionResult = await getChatSession({ sessionId });
        existingSession = sessionResult.data;
      } catch (error) {
        console.error('Error loading session:', error);
      }
    }

    return (
      <div className="h-full">
        <ChatContainer availableModels={availableModels} sessionId={sessionId} existingSession={existingSession} />
      </div>
    );
  } catch (error) {
    console.error('Error loading chat page:', error);
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold">Error Loading Chat</h2>
          <p className="text-muted-foreground">Please try refreshing the page or check your configuration.</p>
        </div>
      </div>
    );
  }
}
