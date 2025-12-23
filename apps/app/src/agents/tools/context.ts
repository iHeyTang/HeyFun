import { WorkflowContext } from '@upstash/workflow';

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
}

