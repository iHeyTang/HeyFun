/**
 * Session 管理器主入口
 */

import type { SessionManager } from './types';
import { RemoteSessionManager } from './remote';
import { LocalSessionManager } from './local';
import { FlowCanvasSessionManager } from './flowcanvas';
import { AgentSessionManager } from './agent';

// 导出类型
export type { SessionManager, ChatSession, ChatMessage, ChatSessionWithMessages, ToolCall } from './types';

// 导出实现
export { RemoteSessionManager } from './remote';
export { LocalSessionManager } from './local';
export { FlowCanvasSessionManager } from './flowcanvas';
export { AgentSessionManager } from './agent';

/**
 * 创建 Session 管理器
 * @param type 'remote' | 'local'
 */
export function createSessionManager(type: 'remote' | 'local' = 'remote'): SessionManager {
  if (type === 'local') {
    return new LocalSessionManager();
  }
  return new RemoteSessionManager();
}

/**
 * 创建 FlowCanvas Session 管理器
 * @param projectId FlowCanvas 项目 ID
 */
export function createFlowCanvasSessionManager(projectId: string): SessionManager {
  return new FlowCanvasSessionManager(projectId);
}

/**
 * 创建 Agent Session 管理器
 * @param agentId Agent ID，默认为 'general'
 */
export function createAgentSessionManager(agentId: string = 'general'): SessionManager {
  return new AgentSessionManager(agentId);
}
