import { BaseAdapter } from './base';
import { UnifiedChat } from '../types';

export class AnthropicAdapter extends BaseAdapter {
  readonly protocol = 'anthropic';
  readonly name = 'Anthropic Protocol';

  formatRequest(params: UnifiedChat.ChatCompletionParams, modelId: string): any {
    const systemMessages = params.messages.filter(m => m.role === 'system');
    const otherMessages = params.messages.filter(m => m.role !== 'system');

    const request: any = {
      model: modelId,
      messages: otherMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : this.formatContent(msg.content),
      })),
      max_tokens: params.max_tokens || 4096,
    };

    if (systemMessages.length > 0) {
      const systemContent = systemMessages.map(m => (typeof m.content === 'string' ? m.content : '')).join('\n');
      if (systemContent) request.system = systemContent;
    }

    if (params.temperature !== undefined) request.temperature = params.temperature;
    if (params.top_p !== undefined) request.top_p = params.top_p;
    if (params.stop !== undefined) request.stop_sequences = Array.isArray(params.stop) ? params.stop : [params.stop];
    if (params.stream !== undefined) request.stream = params.stream;

    return request;
  }

  private formatContent(content: (UnifiedChat.TextContent | UnifiedChat.ImageContent)[]): any[] {
    return content.map(item => {
      if (item.type === 'text') {
        return { type: 'text', text: item.text };
      } else if (item.type === 'image_url') {
        return { type: 'image', source: { type: 'url', url: item.image_url.url } };
      }
      return item;
    });
  }

  parseResponse(response: any, modelId: string): UnifiedChat.ChatCompletion {
    const now = Math.floor(Date.now() / 1000);
    return {
      id: response.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: now,
      model: modelId,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: response.content?.[0]?.text || '' },
          finish_reason: this.mapFinishReason(response.stop_reason),
        },
      ],
      usage: response.usage
        ? {
            prompt_tokens: response.usage.input_tokens || 0,
            completion_tokens: response.usage.output_tokens || 0,
            total_tokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
          }
        : undefined,
    };
  }

  parseStreamChunk(chunk: any, modelId: string): UnifiedChat.ChatCompletionChunk | null {
    if (!chunk) return null;
    const now = Math.floor(Date.now() / 1000);
    const id = chunk.id || `chatcmpl-${Date.now()}`;

    if (chunk.type === 'content_block_delta') {
      return {
        id,
        object: 'chat.completion.chunk',
        created: now,
        model: modelId,
        choices: [{ index: 0, delta: { content: chunk.delta?.text || '' }, finish_reason: null }],
      };
    } else if (chunk.type === 'message_stop') {
      return {
        id,
        object: 'chat.completion.chunk',
        created: now,
        model: modelId,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      };
    }
    return null;
  }

  private mapFinishReason(stopReason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return null;
    }
  }

  getChatEndpoint(): string {
    return '/messages';
  }

  supportsStreaming(): boolean {
    return true;
  }
}
