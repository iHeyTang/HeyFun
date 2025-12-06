import { UnifiedChat } from '../types';

export abstract class BaseAdapter {
  abstract readonly protocol: string;
  abstract readonly name: string;

  abstract formatRequest(params: UnifiedChat.ChatCompletionParams, modelId: string): any;
  abstract parseResponse(response: any, modelId: string): UnifiedChat.ChatCompletion;
  abstract parseStreamChunk(chunk: any, modelId: string): UnifiedChat.ChatCompletionChunk | null;
  abstract getChatEndpoint(): string;
  abstract supportsStreaming(): boolean;
}
