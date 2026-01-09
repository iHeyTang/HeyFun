import { BaseAdapter } from './base';
import { UnifiedChat } from '../types';

export class GoogleAdapter extends BaseAdapter {
  readonly protocol = 'google';
  readonly name = 'Google Gemini Protocol';

  formatRequest(params: UnifiedChat.ChatCompletionParams, modelId: string): any {
    const contents = params.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof msg.content === 'string' ? msg.content : this.formatContent(msg.content) }],
    }));

    const request: any = { contents };
    const generationConfig: any = {};

    if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
    if (params.top_p !== undefined) generationConfig.topP = params.top_p;
    if (params.max_tokens !== undefined) generationConfig.maxOutputTokens = params.max_tokens;
    if (params.stop !== undefined) generationConfig.stopSequences = Array.isArray(params.stop) ? params.stop : [params.stop];

    if (Object.keys(generationConfig).length > 0) request.generationConfig = generationConfig;
    return request;
  }

  private formatContent(content: (UnifiedChat.TextContent | UnifiedChat.ImageContent)[]): string {
    return content
      .filter(item => item.type === 'text')
      .map(item => (item as UnifiedChat.TextContent).text)
      .join('\n');
  }

  parseResponse(response: any, modelId: string): UnifiedChat.ChatCompletion {
    const now = Math.floor(Date.now() / 1000);
    const candidate = response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: now,
      model: modelId,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: this.mapFinishReason(candidate?.finishReason),
        },
      ],
      usage: response.usageMetadata
        ? {
            prompt_tokens: response.usageMetadata.promptTokenCount || 0,
            completion_tokens: response.usageMetadata.candidatesTokenCount || 0,
            total_tokens: response.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  parseStreamChunk(chunk: any, modelId: string): UnifiedChat.ChatCompletionChunk | null {
    if (!chunk || !chunk.candidates) return null;
    const now = Math.floor(Date.now() / 1000);
    const candidate = chunk.candidates[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason;

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: now,
      model: modelId,
      choices: [
        {
          index: 0,
          delta: { content },
          finish_reason: finishReason ? this.mapFinishReason(finishReason) : null,
        },
      ],
    };
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      default:
        return null;
    }
  }

  getChatEndpoint(): string {
    return '/generateContent';
  }

  supportsStreaming(): boolean {
    return true;
  }
}
