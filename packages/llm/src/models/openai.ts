import { z } from 'zod';
import OpenAI from 'openai';
import { BaseModel } from './base';
import { Chat } from './types';

const configSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().default('https://api.openai.com/v1'),
  timeout: z.number().default(30000),
  maxRetries: z.number().default(3),
  model: z.string(),
});

export class OpenAIModel extends BaseModel<z.infer<typeof configSchema>> {
  readonly supportedInstructTypes = ['openai', 'gpt'];

  readonly configSchema = configSchema;
  private client: OpenAI | null = null;

  protected defaultConfig: z.infer<typeof configSchema> = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    timeout: 30000,
    maxRetries: 3,
    model: 'gpt-4o',
  };

  private initializeClient(): OpenAI {
    if (!this.client ) {
      this.client = new OpenAI({
        apiKey: this.getConfig().apiKey,
        baseURL: this.getConfig().baseUrl,
        timeout: this.getConfig().timeout,
        maxRetries: this.getConfig().maxRetries,
      });
    }
    return this.client;
  }

  async sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion> {
    const client = this.initializeClient();

    try {
      // 直接使用OpenAI SDK，无需格式转换
      const response = await client.chat.completions.create({
        ...params,
        model: this.getConfig().model,
        stream: false,
      });
      return response;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>> {
    const client = this.initializeClient();

    try {
      // 直接使用OpenAI SDK的流式响应
      const stream = await client.chat.completions.create({
        ...params,
        model: this.getConfig().model,
        stream: true,
      });

      return stream as any;
    } catch (error) {
      console.error('OpenAI Streaming API error:', error);
      throw error;
    }
  }
}
