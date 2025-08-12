import type { Chat, LLMClient } from '@repo/llm/chat';

export interface MemoryConfig {
  maxMessages?: number;
  llm: LLMClient;
}

export class Memory {
  public messages: Chat.ChatCompletionMessageParam[] = [];
  private maxMessages: number;
  public llm: LLMClient;

  constructor(config: MemoryConfig) {
    this.maxMessages = config.maxMessages || 100;
    this.llm = config.llm;
  }

  /**
   * Add a message to memory
   */
  async addMessage(message: Chat.ChatCompletionMessageParam): Promise<void> {
    this.messages.push(message);
    // Implement message limit
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Add multiple messages to memory
   */
  async addMessages(messages: Chat.ChatCompletionMessageParam[]): Promise<void> {
    this.messages.push(...messages);
    // Implement message limit
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get n most recent messages
   */
  getRecentMessages(n: number): Chat.ChatCompletionMessageParam[] {
    return this.messages.slice(-n);
  }

  /**
   * Get all messages
   */
  getMessages(): Chat.ChatCompletionMessageParam[] {
    return [...this.messages];
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get messages formatted for LLM API
   */
  getMessagesForLLM(): Chat.ChatCompletionMessageParam[] {
    return this.messages;
  }
}
