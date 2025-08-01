import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { BaseModel } from './base';
import { Chat } from './types';

const configSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().default('https://api.anthropic.com'),
  timeout: z.number().default(30000),
  maxRetries: z.number().default(3),
  version: z.string().default('2023-06-01'),
  model: z.string(),
});

export class AnthropicModel extends BaseModel<z.infer<typeof configSchema>> {
  readonly supportedInstructTypes = ['anthropic', 'claude'];

  readonly configSchema = configSchema;
  private client: Anthropic | null = null;

  protected defaultConfig: z.infer<typeof configSchema> = {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    timeout: 30000,
    maxRetries: 3,
    version: '2023-06-01',
    model: 'claude-3-5-sonnet-20240620',
  };

  private initializeClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.getConfig().apiKey,
        baseURL: this.getConfig().baseUrl,
        timeout: this.getConfig().timeout,
        maxRetries: this.getConfig().maxRetries,
        defaultHeaders: {
          'anthropic-version': this.getConfig().version,
        },
      });
    }
    return this.client;
  }

  async sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion> {
    const client = this.initializeClient();

    try {
      // 将OpenAI格式转换为Anthropic格式
      const anthropicParams = this.convertToAnthropicFormat(params);

      // 调用Anthropic API
      const response = await client.messages.create(anthropicParams) as Anthropic.Message;

      // 将Anthropic响应转换为OpenAI格式
      return this.convertFromAnthropicFormat(response, this.getConfig().model);
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  async sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>> {
    const client = this.initializeClient();

    try {
      // 将OpenAI格式转换为Anthropic格式
      const anthropicParams = this.convertToAnthropicFormat(params, true);

      // 调用Anthropic流式API
      const stream = await client.messages.create(anthropicParams) as any;

      // 返回转换后的流式响应
      return this.convertStreamFromAnthropicFormat(stream, this.getConfig().model);
    } catch (error) {
      console.error('Anthropic Streaming API error:', error);
      throw error;
    }
  }

  /**
   * 将OpenAI格式转换为Anthropic格式
   */
     private convertToAnthropicFormat(
     params: Chat.ChatCompletionCreateParams,
     stream = false
   ): any {
    const messages = Array.isArray(params.messages) ? [...params.messages] : [];
    let systemMessage = '';

    // 提取system消息
    const systemIndex = messages.findIndex(msg => msg.role === 'system');
    if (systemIndex !== -1) {
      const systemMsg = messages[systemIndex];
      systemMessage = this.extractTextContent(systemMsg.content);
      messages.splice(systemIndex, 1);
    }

    // 转换消息格式
    const anthropicMessages = this.convertMessages(messages);

         const anthropicParams: any = {
      model: this.getConfig().model,
      max_tokens: params.max_tokens || 4096,
      messages: anthropicMessages,
    };

    if (systemMessage) {
      anthropicParams.system = systemMessage;
    }

    // 转换可选参数
    if (params.temperature !== undefined) anthropicParams.temperature = params.temperature;
    if (params.top_p !== undefined) anthropicParams.top_p = params.top_p;
    if (params.stop) {
      anthropicParams.stop_sequences = Array.isArray(params.stop) ? params.stop : [params.stop];
    }
         if (stream) anthropicParams.stream = true as any;

    // 转换工具
    if (params.tools) {
      anthropicParams.tools = this.convertTools(params.tools);
    }

    return anthropicParams;
  }

  /**
   * 将Anthropic响应转换为OpenAI格式
   */
     private convertFromAnthropicFormat(response: Anthropic.Message, model: string): any {
    const content = this.extractContentFromAnthropic(response.content);
    const toolCalls = this.extractToolCallsFromAnthropic(response.content);

         const openaiResponse: any = {
      id: response.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
                           message: {
            role: 'assistant',
            content: content,
            ...(toolCalls && { tool_calls: toolCalls }),
          },
        finish_reason: this.mapStopReason(response.stop_reason),
      }],
      usage: response.usage ? {
        prompt_tokens: response.usage.input_tokens || 0,
        completion_tokens: response.usage.output_tokens || 0,
        total_tokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
      } : undefined,
    };

    return openaiResponse;
  }

  /**
   * 转换流式响应
   */
  private async *convertStreamFromAnthropicFormat(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>,
    model: string
  ): AsyncIterableIterator<OpenAI.Chat.ChatCompletionChunk> {
    let chunkIndex = 0;

    for await (const chunk of stream) {
      const openaiChunk = this.convertStreamChunk(chunk, model, chunkIndex++);
      if (openaiChunk) {
        yield openaiChunk;
      }
    }
  }

  private convertStreamChunk(
    chunk: Anthropic.MessageStreamEvent,
    model: string,
    index: number
  ): OpenAI.Chat.ChatCompletionChunk | null {
    const delta: OpenAI.Chat.ChatCompletionChunk.Choice.Delta = {};
    let finishReason: OpenAI.Chat.ChatCompletionChunk.Choice['finish_reason'] = null;

    switch (chunk.type) {
      case 'message_start':
        delta.role = 'assistant';
        break;

      case 'content_block_delta':
        if ('delta' in chunk && chunk.delta.type === 'text_delta') {
          delta.content = chunk.delta.text;
        }
        break;

      case 'content_block_start':
        if ('content_block' in chunk && chunk.content_block.type === 'tool_use') {
          delta.tool_calls = [{
            index: 0,
            id: chunk.content_block.id,
            type: 'function',
            function: {
              name: chunk.content_block.name,
              arguments: '',
            },
          }];
        }
        break;

      case 'message_stop':
        finishReason = this.mapStopReason((chunk as any).stop_reason);
        break;

      default:
        return null;
    }

    return {
      id: `anthropic-chunk-${index}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        delta,
        finish_reason: finishReason,
      }],
    };
  }

  private convertMessages(messages: any[]): Anthropic.MessageParam[] {
    return messages.map(message => {
      if (message.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.tool_call_id,
            content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          }],
        };
      }

      const content = this.convertContent(message.content);

      if (message.tool_calls) {
        const toolUses = message.tool_calls.map((toolCall: any) => ({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        }));

        if (Array.isArray(content)) {
          content.push(...toolUses);
        } else {
          return {
            role: message.role === 'user' ? 'user' : 'assistant',
            content: [
              { type: 'text', text: content },
              ...toolUses,
            ],
          };
        }
      }

      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content,
      };
    });
  }

  private convertContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(part => {
        if (part.type === 'text') {
          return {
            type: 'text',
            text: part.text,
          };
        } else if (part.type === 'image_url') {
          const imageUrl = part.image_url.url;
          if (imageUrl.startsWith('data:')) {
            const [mimeType, base64Data] = imageUrl.split(',');
            const mediaType = mimeType.split(':')[1].split(';')[0];
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            };
          } else {
            throw new Error('Anthropic API does not support image URLs, only base64 encoded images');
          }
        }
        return part;
      });
    }

    return content;
  }

     private convertTools(tools: OpenAI.Chat.ChatCompletionTool[]): any[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description || '',
      input_schema: tool.function.parameters || {},
    }));
  }

  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');
    }

    return '';
  }

  private extractContentFromAnthropic(content: Anthropic.ContentBlock[]): string {
    return content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('');
  }

  private extractToolCallsFromAnthropic(content: Anthropic.ContentBlock[]): OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined {
    const toolUses = content.filter(block => block.type === 'tool_use') as Anthropic.ToolUseBlock[];

    if (toolUses.length === 0) {
      return undefined;
    }

    return toolUses.map(toolUse => ({
      id: toolUse.id,
      type: 'function',
      function: {
        name: toolUse.name,
        arguments: JSON.stringify(toolUse.input),
      },
    }));
  }

  private mapStopReason(stopReason: string | null): OpenAI.Chat.ChatCompletion.Choice['finish_reason'] {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
