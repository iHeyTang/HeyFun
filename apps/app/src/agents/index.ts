/**
 * Agent 系统统一入口
 */

// 服务端
export { getAgent } from './server';
export type { AgentConfig } from './server/types';

// 浏览器端
export type { ToolCall, ToolResult, ToolExecutionContext, ToolExecutor } from './browser/types';
