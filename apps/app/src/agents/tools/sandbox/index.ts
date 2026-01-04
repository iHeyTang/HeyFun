/**
 * Sandbox 工具集合 - 最小化实现
 * 只保留核心功能：获取（自动复用/创建）、执行命令、读写文件
 * 注意：cleanup 和 destroy 由框架内部管理，不暴露给 Agent
 */

import { sandboxGetTool } from './get';
import { sandboxExecTool } from './exec';
import { sandboxReadFileTool } from './read-file';
import { sandboxWriteFileTool } from './write-file';

export const sandboxToolboxes = [sandboxGetTool, sandboxExecTool, sandboxReadFileTool, sandboxWriteFileTool];
