import type OpenAI from 'openai';

// 基于OpenAI标准的类型定义
export declare namespace Chat {
  export type ChatCompletionMessageParam = OpenAI.Chat.ChatCompletionMessageParam;
  export type ChatCompletionToolChoiceOption = OpenAI.Chat.ChatCompletionToolChoiceOption;
  export type ChatCompletionTool = OpenAI.Chat.ChatCompletionTool;
  export type ChatCompletionMessageToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

  export type ChatCompletionCreateParams = {
    messages: ChatCompletionMessageParam[];
    tool_choice?: ChatCompletionToolChoiceOption;
    tools?: ChatCompletionTool[];
    stream?: boolean;
    max_tokens?: OpenAI.Chat.ChatCompletionCreateParams['max_tokens'];
    temperature?: OpenAI.Chat.ChatCompletionCreateParams['temperature'];
    top_p?: OpenAI.Chat.ChatCompletionCreateParams['top_p'];
    stop?: OpenAI.Chat.ChatCompletionCreateParams['stop'];
  };

  export type ChatCompletion = OpenAI.Chat.ChatCompletion;
  export type ChatCompletionChunk = OpenAI.Chat.ChatCompletionChunk;
}
