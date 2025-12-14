import { UnifiedChat } from '@repo/llm/chat';

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent 唯一标识 */
  id: string;
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** Agent 支持的工具列表 */
  tools: UnifiedChat.Tool[];
  /** 是否为默认 Agent */
  isDefault?: boolean;
  /** Observation 提示词（可选，用于 ReAct 框架的观察阶段，引导 Agent 分析工具结果并继续推理） */
  observationPrompt?: string;
}

/**
 * Agent 接口（内部使用）
 */
export interface IAgent {
  getConfig(): AgentConfig;
}

export abstract class BaseAgent implements IAgent {
  protected abstract config: AgentConfig;

  getConfig(): AgentConfig {
    return this.config;
  }
}
