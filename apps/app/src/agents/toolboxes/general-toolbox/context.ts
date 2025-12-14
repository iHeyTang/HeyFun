/**
 * 服务端工具执行上下文
 * 提供执行服务端工具所需的资源
 */
export interface GeneralToolboxContext {
  /** 组织ID */
  organizationId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 其他上下文信息 */
  [key: string]: any;
}

