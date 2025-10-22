/**
 * Coordinator Agent 工具集
 *
 * 工具的 schema 定义和执行器统一在 browser/executors/canvas
 * 这里只负责导出 schema 给 LLM 使用，执行器在浏览器端自动匹配
 */

import { CANVAS_TOOL_SCHEMAS } from '../../../browser/executors/canvas';

export const COORDINATOR_TOOLS = CANVAS_TOOL_SCHEMAS;
