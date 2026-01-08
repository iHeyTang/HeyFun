import { WorkflowContext } from '@upstash/workflow';
import type { UnifiedChat, ChatClient } from '@repo/llm/chat';
import { ReactAgent } from '@/agents/core/frameworks/react';

/**
 * 动态系统提示词管理器
 * 用于工具更新动态系统提示词片段
 */
export interface DynamicSystemPromptManager {
  /**
   * 设置动态系统提示词片段
   * 这个片段会被添加到基础系统提示词后面
   * @param fragments 动态系统提示词片段内容
   */
  setDynamicSystemPrompt(fragments: string): void;

  /**
   * 获取当前动态系统提示词片段
   * @returns 动态系统提示词片段内容，如果未设置则返回 undefined
   */
  getDynamicSystemPrompt(): string | undefined;

  /**
   * 清除动态系统提示词片段
   */
  clearDynamicSystemPrompt(): void;
}

/**
 * 工具管理器
 * 用于工具动态添加其他工具到 agent 的工具列表
 */
export interface ToolManager {
  /**
   * 根据工具名称列表添加工具到 agent 的工具列表
   * @param toolNames 工具名称数组
   */
  addToolsByName(toolNames: string[]): void;

  /**
   * 获取已添加的工具名称列表
   * @returns 已添加的工具名称数组
   */
  getAddedTools(): string[];
}

/**
 * 完结类型
 */
export type CompletionType = 'complete' | 'configure_environment_variable' | string;

/**
 * 完结信息
 */
export interface CompletionInfo {
  /** 完结类型 */
  type: CompletionType;
  /** 触发完结的工具名称 */
  toolName: string;
  /** 自定义参数，用于传递给前端渲染 */
  params?: Record<string, any>;
}

/**
 * 完结管理器
 * 用于工具设置 workflow 完结状态
 */
export interface CompletionManager {
  /**
   * 设置 workflow 完结状态
   * @param type 完结类型
   * @param toolName 触发完结的工具名称
   * @param params 自定义参数，用于传递给前端渲染
   */
  setCompletion(type: CompletionType, toolName: string, params?: Record<string, any>): void;

  /**
   * 获取当前完结信息
   * @returns 完结信息，如果未设置则返回 undefined
   */
  getCompletion(): CompletionInfo | undefined;

  /**
   * 清除完结状态
   */
  clearCompletion(): void;
}

/**
 * 全局动态系统提示词片段存储
 * key: sessionId, value: 动态系统提示词片段内容
 */
const dynamicSystemPromptStore = new Map<string, string>();

/**
 * 创建动态系统提示词管理器实现
 * 使用内存存储，在同一进程内共享
 */
export function createDynamicSystemPromptManager(sessionId: string): DynamicSystemPromptManager {
  return {
    setDynamicSystemPrompt(fragments: string): void {
      dynamicSystemPromptStore.set(sessionId, fragments);
    },

    getDynamicSystemPrompt(): string | undefined {
      return dynamicSystemPromptStore.get(sessionId);
    },

    clearDynamicSystemPrompt(): void {
      dynamicSystemPromptStore.delete(sessionId);
    },
  };
}

/**
 * 获取会话的动态系统提示词片段（全局函数，供外部使用）
 */
export function getSessionDynamicSystemPrompt(sessionId: string): string | undefined {
  return dynamicSystemPromptStore.get(sessionId);
}

/**
 * 全局工具管理器存储
 * key: sessionId, value: ToolManager 实例
 */
const toolManagerStore = new Map<string, ToolManager>();

/**
 * 创建工具管理器实现
 * 接收当前 ReactAgent 实例，用于动态添加工具
 */
export function createToolManager(sessionId: string, reactAgent?: ReactAgent): ToolManager | undefined {
  if (!reactAgent) {
    return undefined;
  }

  const addedTools: string[] = [];

  const manager: ToolManager = {
    addToolsByName(toolNames: string[]): void {
      // 去重并过滤已添加的工具
      const newTools = toolNames.filter(name => !addedTools.includes(name));
      if (newTools.length > 0) {
        addedTools.push(...newTools);
        reactAgent.addToolsByName(newTools);
      }
    },

    getAddedTools(): string[] {
      return [...addedTools];
    },
  };

  // 存储到全局存储中
  toolManagerStore.set(sessionId, manager);

  return manager;
}

/**
 * 获取会话的工具管理器（全局函数，供外部使用）
 */
export function getSessionToolManager(sessionId: string): ToolManager | undefined {
  return toolManagerStore.get(sessionId);
}

/**
 * 全局完结信息存储
 * key: sessionId, value: 完结信息
 */
const completionStore = new Map<string, CompletionInfo>();

/**
 * 创建完结管理器实现
 * 使用内存存储，在同一进程内共享
 */
export function createCompletionManager(sessionId: string): CompletionManager {
  return {
    setCompletion(type: CompletionType, toolName: string, params?: Record<string, any>): void {
      completionStore.set(sessionId, { type, toolName, params });
    },

    getCompletion(): CompletionInfo | undefined {
      return completionStore.get(sessionId);
    },

    clearCompletion(): void {
      completionStore.delete(sessionId);
    },
  };
}

/**
 * 获取会话的完结信息（全局函数，供外部使用）
 */
export function getSessionCompletion(sessionId: string): CompletionInfo | undefined {
  return completionStore.get(sessionId);
}

/**
 * 清除会话的完结信息（全局函数，供外部使用）
 */
export function clearSessionCompletion(sessionId: string): void {
  completionStore.delete(sessionId);
}

/**
 * 通用工具执行上下文
 * 所有工具都使用这个统一的上下文
 */
export interface ToolContext {
  /** 组织ID */
  organizationId?: string;
  /** 会话ID */
  sessionId?: string;
  /** Workflow上下文 */
  workflow: WorkflowContext;
  /** 工具调用ID，用于生成唯一的 step name */
  toolCallId?: string;
  /** 消息ID，用于保存 toolResults */
  messageId?: string;
  /** LLM 客户端，用于工具内部调用模型能力 */
  llmClient?: ChatClient;
  /** 当前消息历史，用于需要访问对话上下文的工具 */
  messages?: UnifiedChat.Message[];
  /** 动态系统提示词管理器，用于工具更新动态系统提示词片段 */
  dynamicSystemPrompt?: DynamicSystemPromptManager;
  /** 工具管理器，用于工具动态添加其他工具到 agent 的工具列表 */
  toolManager?: ToolManager;
  /** 内置工具名称列表（不参与动态检索） */
  builtinToolNames?: string[];
  /** 完结管理器，用于工具设置 workflow 完结状态 */
  completion?: CompletionManager;
}
