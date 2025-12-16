import { WorkflowContext } from '@upstash/workflow';

/**
 * 服务端工具执行上下文
 * 提供执行服务端工具所需的资源
 */
export interface GeneralToolboxContext {
  /** 组织ID */
  organizationId?: string;
  /** 会话ID */
  sessionId?: string;
  /** Workflow上下文 */
  workflow: WorkflowContext;
  /** 工具调用ID，用于生成唯一的 step name */
  toolCallId?: string;
}
