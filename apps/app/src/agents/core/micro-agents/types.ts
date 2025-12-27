/**
 * 微代理（Micro Agent）核心类型定义
 *
 * 微代理是轻量级的、专门化的代理，用于执行特定任务
 * 例如：意图检测、场景分析、内容验证等
 */

import type { UnifiedChat, ChatClient } from '@repo/llm/chat';

/**
 * 微代理执行上下文
 */
export interface MicroAgentContext {
  /**
   * 当前消息历史（UnifiedChat.Message 格式）
   */
  messages: UnifiedChat.Message[];

  /**
   * Agent 配置
   */
  agentConfig: {
    modelId: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };

  /**
   * LLM 客户端（可选，用于需要 LLM 的微代理）
   */
  llmClient?: ChatClient;

  /**
   * 当前迭代次数
   */
  iteration?: number;

  /**
   * 已激活的片段 ID 集合
   */
  activatedFragments?: Set<string>;

  /**
   * 其他自定义上下文数据
   */
  metadata?: Record<string, any>;
}

/**
 * 微代理执行结果
 */
export interface MicroAgentResult {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 微代理 ID（由 MicroAgentManager 自动添加）
   */
  agentId?: string;

  /**
   * 开始时间戳（由 MicroAgentManager 自动添加）
   */
  startTime?: number;

  /**
   * 结束时间戳（由 MicroAgentManager 自动添加）
   */
  endTime?: number;

  /**
   * 执行时长（毫秒，由 MicroAgentManager 自动添加）
   */
  duration?: number;

  /**
   * 结果数据（微代理可以返回任意数据）
   */
  data?: any;

  /**
   * 错误信息（如果失败）
   */
  error?: string;

  /**
   * Token 使用情况
   */
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };

  /**
   * 是否需要更新系统提示词
   */
  shouldUpdateSystemPrompt?: boolean;

  /**
   * 是否需要重新执行当前迭代
   */
  shouldRetry?: boolean;

  /**
   * 元数据（用于传递额外信息）
   */
  metadata?: Record<string, any>;
}

/**
 * 微代理触发时机
 */
export enum MicroAgentTrigger {
  /**
   * 在每次迭代前触发（默认）
   */
  PRE_ITERATION = 'pre_iteration',

  /**
   * 在每次迭代后触发
   */
  POST_ITERATION = 'post_iteration',

  /**
   * 在工具调用前触发
   */
  PRE_TOOL_CALL = 'pre_tool_call',

  /**
   * 在工具调用后触发
   */
  POST_TOOL_CALL = 'post_tool_call',

  /**
   * 在最终答案生成前触发
   */
  PRE_FINAL_ANSWER = 'pre_final_answer',

  /**
   * 按需触发（需要显式调用）
   */
  ON_DEMAND = 'on_demand',

  /**
   * 在初始化时触发（仅一次）
   */
  INITIALIZATION = 'initialization',
}

/**
 * 微代理配置
 */
export interface MicroAgentConfig {
  /**
   * 微代理 ID（唯一标识）
   */
  id: string;

  /**
   * 微代理名称
   */
  name: string;

  /**
   * 微代理描述
   */
  description: string;

  /**
   * 触发时机
   */
  trigger: MicroAgentTrigger | MicroAgentTrigger[];

  /**
   * 是否启用（默认 true）
   */
  enabled?: boolean;

  /**
   * 优先级（数字越小优先级越高，默认 100）
   */
  priority?: number;

  /**
   * 自定义配置
   */
  options?: Record<string, any>;
}

/**
 * 微代理接口
 */
export interface IMicroAgent {
  /**
   * 微代理配置
   */
  readonly config: MicroAgentConfig;

  /**
   * 执行微代理任务
   * @param context 执行上下文
   * @returns 执行结果
   */
  execute(context: MicroAgentContext): Promise<MicroAgentResult>;

  /**
   * 检查是否应该执行（可选，用于条件判断）
   * @param context 执行上下文
   * @returns 是否应该执行
   */
  shouldExecute?(context: MicroAgentContext): Promise<boolean> | boolean;

  /**
   * 清理资源（可选）
   */
  cleanup?(): Promise<void> | void;
}

/**
 * 微代理注册信息
 */
export interface MicroAgentRegistration {
  /**
   * 微代理实例
   */
  agent: IMicroAgent;

  /**
   * 注册时间
   */
  registeredAt: number;

  /**
   * 执行次数统计
   */
  executionCount: number;

  /**
   * 最后执行时间
   */
  lastExecutedAt?: number;
}

/**
 * 上下文窗口管理结果
 * 用于上下文持久化微代理
 */
export interface ContextWindowResult {
  originalMessageCount?: number;
  managedMessageCount?: number;
  strategy?: string;
  preservedMessages?: number;
  compressedMessages?: number;
  summary?: string;
  keyPoints?: string[];
  preservedContext?: string;
  importantDecisions?: string[];
  originalTokenCount?: number;
  compressedTokenCount?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

