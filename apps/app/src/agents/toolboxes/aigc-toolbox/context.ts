import { WorkflowContext } from '@upstash/workflow';

/**
 * AIGC 工具执行上下文
 * 提供执行 AIGC 工具所需的资源
 */
export interface AigcToolboxContext {
  /** 组织ID */
  organizationId?: string;
  /** 会话ID */
  sessionId?: string;
  /** Workflow上下文 */
  workflow: WorkflowContext;
  /** 工具调用ID，用于生成唯一的 step name */
  toolCallId?: string;
}
