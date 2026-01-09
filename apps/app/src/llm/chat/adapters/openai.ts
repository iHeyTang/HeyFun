import { BaseAdapter } from './base';
import { UnifiedChat } from '../types';

export class OpenAIAdapter extends BaseAdapter {
  readonly protocol = 'openai';
  readonly name = 'OpenAI Protocol';

  formatRequest(params: UnifiedChat.ChatCompletionParams, modelId: string): any {
    const request: any = { model: modelId, messages: params.messages };
    if (params.temperature !== undefined) request.temperature = params.temperature;
    if (params.top_p !== undefined) request.top_p = params.top_p;
    if (params.max_tokens !== undefined) request.max_tokens = params.max_tokens;
    if (params.stream !== undefined) request.stream = params.stream;
    if (params.stop !== undefined) request.stop = params.stop;
    if (params.tools !== undefined) request.tools = params.tools;
    if (params.tool_choice !== undefined) request.tool_choice = params.tool_choice;
    if (params.presence_penalty !== undefined) request.presence_penalty = params.presence_penalty;
    if (params.frequency_penalty !== undefined) request.frequency_penalty = params.frequency_penalty;
    return request;
  }

  parseResponse(response: any, modelId: string): UnifiedChat.ChatCompletion {
    return response as UnifiedChat.ChatCompletion;
  }

  parseStreamChunk(chunk: any, modelId: string): UnifiedChat.ChatCompletionChunk | null {
    if (!chunk || !chunk.choices) return null;
    return chunk as UnifiedChat.ChatCompletionChunk;
  }

  getChatEndpoint(): string {
    return '/chat/completions';
  }

  supportsStreaming(): boolean {
    return true;
  }
}
