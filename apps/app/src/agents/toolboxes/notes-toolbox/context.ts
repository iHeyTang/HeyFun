import { WorkflowContext } from '@upstash/workflow';

/**
 * 笔记工具执行上下文
 * 提供执行笔记工具所需的资源
 */
export interface NotesToolboxContext {
  /** 组织ID */
  organizationId?: string;
  /** 会话ID */
  sessionId?: string;
  /** Workflow上下文 */
  workflow: WorkflowContext;
  /** 工具调用ID，用于生成唯一的 step name */
  toolCallId?: string;
  /** 笔记ID（从session中提取） */
  noteId?: string;
}

