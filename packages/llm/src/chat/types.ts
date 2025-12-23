/**
 * 统一的聊天类型定义
 * 基于 OpenAI 格式作为标准
 */

export namespace UnifiedChat {
  // ============ 消息类型 ============

  export interface TextContent {
    type: 'text';
    text: string;
  }

  export interface ImageContent {
    type: 'image_url';
    image_url: {
      url: string;
      detail?: 'auto' | 'low' | 'high';
    };
  }

  export type MessageContent = string | (TextContent | ImageContent)[];

  export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: MessageContent;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
  }

  // ============ 工具调用 ============

  export interface ToolCall {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }

  export interface Tool {
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, any>;
    };
  }

  export type ToolChoice = 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };

  // ============ 请求参数 ============

  export interface ChatCompletionParams {
    messages: Message[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    stop?: string | string[];
    tools?: Tool[];
    tool_choice?: ToolChoice;
    presence_penalty?: number;
    frequency_penalty?: number;
    [key: string]: any; // 允许扩展参数
  }

  // ============ 响应类型 ============

  export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_prompt_tokens?: number; // 缓存的输入token数量
    cached_completion_tokens?: number; // 缓存的输出token数量
  }

  export interface Choice {
    index: number;
    message: Message;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }

  export interface ChatCompletion {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Choice[];
    usage?: Usage;
  }

  // ============ 流式响应 ============

  export interface ChoiceDelta {
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }

  export interface ChatCompletionChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: ChoiceDelta[];
    usage?: Usage;
  }
}
