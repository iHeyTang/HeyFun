import { UnifiedChat } from '@repo/llm/chat';
import type { SystemPromptBlock } from '@/agents/core/system-prompt';

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
  /** Preset 层提示词 Blocks，用于分块组织提示词内容 */
  promptBlocks: SystemPromptBlock[];
  /** Agent 支持的工具列表（内置工具，启动时就有，不参与动态检索） */
  tools: UnifiedChat.Tool[];
  /** Observation 提示词（可选，用于 ReAct 框架的观察阶段，引导 Agent 分析工具结果并继续推理） */
  observationPrompt?: string;
}

/**
 * 从 AgentConfig 的 tools 中提取内置工具名称列表
 */
export function getBuiltinToolNames(config: AgentConfig): string[] {
  return config.tools.map(t => t.function?.name).filter((name): name is string => !!name);
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
