import { z } from 'zod';
import type { Chat } from './types';

/**
 * Base Model Client - 以OpenAI格式作为内部标准
 * 所有model客户端都应该提供OpenAI兼容的接口
 */
export abstract class BaseModel<TConfig extends { model: string }> {
  /**
   * Supported instruct types for this model client
   */
  abstract readonly supportedInstructTypes: string[];

  /**
   * Model client configuration schema
   */
  abstract readonly configSchema: z.ZodType<TConfig, any, any>;

  /**
   * Default configuration
   */
  protected  defaultConfig: TConfig = { model: '' } as TConfig;

  /**
   * Current configuration
   */
  private config: TConfig = { model: '' } as TConfig;

  constructor(config: Partial<TConfig>) {
    this.setConfig({ ...this.defaultConfig, ...config });
  }

  /**
   * Set configuration
   */
  private setConfig(config: TConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TConfig {
    return this.config;
  }

  /**
   * Send chat completion request - unified with OpenAI format
   */
  abstract sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion>;

  /**
   * Send streaming chat completion request - unified with OpenAI format
   */
  abstract sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>>;

  /**
   * Check if this model client supports the given instruct type
   */
  supportsInstructType(instructType: string): boolean {
    return this.supportedInstructTypes.includes(instructType);
  }
}
