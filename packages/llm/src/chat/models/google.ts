import { z } from 'zod';
import { BaseModel } from './base';
import { Chat } from './types';

const configSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().default('https://generativelanguage.googleapis.com'),
  timeout: z.number().default(30000),
  maxRetries: z.number().default(3),
  model: z.string(),
});

export class GoogleModel extends BaseModel<z.infer<typeof configSchema>> {
  readonly supportedInstructTypes = ['google', 'gemini'];

  readonly configSchema = configSchema;

  protected defaultConfig: z.infer<typeof configSchema> = {
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    timeout: 30000,
    maxRetries: 3,
    model: 'gemini-1.5-pro',
  };

  async sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion> {
    try {
      const config = this.getConfig();
      const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

      // 转换OpenAI格式消息到Google Gemini格式
      const contents = this.convertMessagesToGeminiFormat(params.messages);

      const requestBody = {
        contents,
        generationConfig: {
          temperature: params.temperature,
          topP: params.top_p,
          maxOutputTokens: params.max_tokens,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 转换Google响应格式到OpenAI格式
      return this.convertGeminiResponseToOpenAI(data, config.model);

    } catch (error) {
      throw new Error(`Google API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>> {
    try {
      const config = this.getConfig();
      const url = `${config.baseUrl}/v1beta/models/${config.model}:streamGenerateContent?key=${config.apiKey}`;

      // 转换OpenAI格式消息到Google Gemini格式
      const contents = this.convertMessagesToGeminiFormat(params.messages);

      const requestBody = {
        contents,
        generationConfig: {
          temperature: params.temperature,
          topP: params.top_p,
          maxOutputTokens: params.max_tokens,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      return this.parseGeminiStream(response.body, config.model);

    } catch (error) {
      throw new Error(`Google streaming request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private convertMessagesToGeminiFormat(messages: Chat.ChatCompletionMessageParam[]): any[] {
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have a system role, prepend to the first user message
        continue;
      }
      
      const role = message.role === 'assistant' ? 'model' : 'user';
      const content = typeof message.content === 'string' ? message.content : 
        Array.isArray(message.content) ? message.content.map(c => 
          typeof c === 'string' ? c : (c.type === 'text' ? c.text : '')
        ).join(' ') : '';
      
      contents.push({
        role,
        parts: [{ text: content }]
      });
    }

    // 如果有system message，将其添加到第一条用户消息前
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      const systemContent = typeof systemMessage.content === 'string' ? systemMessage.content : '';
      contents[0].parts[0].text = `${systemContent}\n\n${contents[0].parts[0].text}`;
    }

    return contents;
  }

  private convertGeminiResponseToOpenAI(data: any, model: string): Chat.ChatCompletion {
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          refusal: null,
        },
        logprobs: null,
        finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : 'length',
      }],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  private async *parseGeminiStream(stream: ReadableStream, model: string): AsyncIterableIterator<Chat.ChatCompletionChunk> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const candidate = parsed.candidates?.[0];
              const delta = candidate?.content?.parts?.[0]?.text || '';

              if (delta) {
                yield {
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{
                    index: 0,
                    delta: {
                      content: delta,
                    },
                    finish_reason: null,
                  }],
                };
              }

              if (candidate?.finishReason === 'STOP') {
                yield {
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop',
                  }],
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}