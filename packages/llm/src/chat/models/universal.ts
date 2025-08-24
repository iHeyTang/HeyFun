import { z } from 'zod';
import { BaseModel } from './base';
import { Chat } from './types';
import { UniversalApiAdapter } from '../providers/builtin/adapters';

const configSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string(),
  timeout: z.number().default(30000),
  maxRetries: z.number().default(3),
  model: z.string(),
  adapterType: z.string(), // 服务商类型
});

/**
 * 通用模型实现 - 使用UniversalApiAdapter处理不同服务商
 */
export class UniversalModel extends BaseModel<z.infer<typeof configSchema>> {
  readonly supportedInstructTypes = ['openai', 'anthropic', 'google'];

  readonly configSchema = configSchema;
  private adapter: UniversalApiAdapter | null = null;

  protected defaultConfig: z.infer<typeof configSchema> = {
    apiKey: '',
    baseUrl: '',
    timeout: 30000,
    maxRetries: 3,
    model: '',
    adapterType: '',
  };

  private getAdapter(): UniversalApiAdapter {
    if (!this.adapter) {
      // 这里需要从builtin provider获取适配器
      // 实际使用时会通过LLMClient设置
      throw new Error('Universal adapter not initialized. Please use BuiltinProvider to create models.');
    }
    return this.adapter;
  }

  /**
   * 设置API适配器（由BuiltinProvider调用）
   */
  setAdapter(adapter: UniversalApiAdapter): void {
    this.adapter = adapter;
  }

  async sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion> {
    try {
      const adapter = this.getAdapter();
      return await adapter.sendChatCompletion(params);
    } catch (error) {
      throw new Error(`Universal model request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>> {
    try {
      const adapter = this.getAdapter();
      return await adapter.sendStreamingChatCompletion(params);
    } catch (error) {
      throw new Error(`Universal model streaming request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}