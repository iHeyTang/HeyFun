import { LLMClient } from '@repo/llm';
import { ToolResult } from '../types';
import { AbstractBaseTool } from './base';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * 创建聊天完成工具 - 用于与LLM进行对话
 */
export class CreateChatCompletionTool extends AbstractBaseTool {
  public name = 'create_chat_completion';
  public description = 'Create a chat completion using the LLM for specific tasks or questions';

  constructor(private llm?: LLMClient) {
    super();
  }

  async execute(params: Parameters<Client["callTool"]>[0]): Promise<ToolResult> {
    const input = params.arguments as {
    messages: Array<{ role: string; content: string }>;
    system_message?: string;
    temperature?: number;
    max_tokens?: number;
  };
    if (!this.llm) {
      return {
        content: 'Error: No LLM instance available',
        error: 'LLM not configured',
      };
    }

    try {
      const messages = input.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      if (input.system_message) {
        messages.unshift({
          role: 'system',
          content: input.system_message,
        });
      }

      const response = await this.llm.chat({
        messages,
        temperature: input.temperature,
        max_tokens: input.max_tokens,
      });

      const content = response.choices[0]?.message?.content || 'No response generated';

      return {
        content: `Chat completion result:\n${content}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: `Error creating chat completion: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  protected getParametersSchema(): any {
    return {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
          description: 'Array of messages for the chat completion',
        },
        system_message: {
          type: 'string',
          description: 'Optional system message to prepend',
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          description: 'Sampling temperature (0-2)',
        },
        max_tokens: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum number of tokens to generate',
        },
      },
      required: ['messages'],
    };
  }
}
