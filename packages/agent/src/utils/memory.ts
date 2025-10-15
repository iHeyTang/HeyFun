import type { UnifiedChat, ChatClient } from '@repo/llm/chat';

export interface MemoryConfig {
  maxMessages?: number;
  llm: ChatClient;
}

export class Memory {
  public messages: UnifiedChat.Message[] = [];
  private maxMessages: number;
  public llm: ChatClient;

  constructor(config: MemoryConfig) {
    this.maxMessages = config.maxMessages || 100;
    this.llm = config.llm;
  }

  /**
   * Add a message to memory
   */
  async addMessage(message: UnifiedChat.Message): Promise<void> {
    this.messages.push(message);
    // Implement message limit
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Add multiple messages to memory
   */
  async addMessages(messages: UnifiedChat.Message[]): Promise<void> {
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
  getRecentMessages(n: number): UnifiedChat.Message[] {
    return this.messages.slice(-n);
  }

  /**
   * Get all messages
   */
  getMessages(): UnifiedChat.Message[] {
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
  getMessagesForLLM(): UnifiedChat.Message[] {
    return this.messages;
  }
}
