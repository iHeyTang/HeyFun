import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取或创建 Sandbox 的参数 Schema
 */
export const sandboxGetParamsSchema = z.object({
  workspaceRoot: z.string().optional().describe('工作区根路径（默认：/workspace，仅在创建新 sandbox 时使用）'),
  costProfile: z.enum(['cheap', 'standard', 'expensive']).optional().describe('成本配置（默认：standard，仅在创建新 sandbox 时使用）'),
});

export type SandboxGetParams = z.infer<typeof sandboxGetParamsSchema>;

export const sandboxGetSchema: ToolDefinition = {
  name: 'sandbox_get',
  description:
    '获取当前会话的 sandbox。如果会话中已有可用的 sandbox，直接返回；如果没有，会自动创建一个新的。这是获取 sandbox 的唯一方式，框架会自动处理复用逻辑。',
  displayName: {
    en: 'Sandbox',
    'zh-CN': 'Sandbox',
    'zh-TW': 'Sandbox',
    ja: 'Sandbox',
    ko: 'Sandbox',
  },
  parameters: zodToJsonSchema(sandboxGetParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'sandbox',
  manual: `# sandbox_get 工具使用手册

## 功能说明
sandbox_get 用于获取当前会话的 sandbox。这是获取 sandbox 的唯一方式：
- **自动复用**：如果会话中已有可用的 sandbox，直接返回现有的（框架会自动处理复用逻辑）
- **自动创建**：如果没有 sandbox 或 sandbox 已过期，会自动创建一个新的

你不需要关心是"获取"还是"创建"，框架会自动处理这些细节。

## 使用场景
1. **执行代码**：需要运行 Python、Node.js 等代码时
2. **执行命令**：需要运行 shell 命令时
3. **文件操作**：需要创建、读取、写入文件时
4. **安装依赖**：需要安装包或依赖时

## 参数说明
所有参数都是可选的，仅在创建新 sandbox 时使用：
- **workspaceRoot**（可选）：工作区根路径（默认：/workspace）
- **costProfile**（可选）：成本配置，可选值：
  - "cheap"：低成本配置
  - "standard"：标准配置（默认）
  - "expensive"：高性能配置

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **provider**：Sandbox Provider 类型（daytona/e2b）
- **workspaceRoot**：工作区根路径
- **status**：Sandbox 状态

## 使用建议
1. **直接调用即可**：不需要先检查是否存在，直接调用 sandbox_get，框架会自动处理
2. **生命周期管理**：
   - Sandbox 与 session 关联，同一个 session 中的多次调用会复用同一个 sandbox
   - 任务完成后可以调用 sandbox.destroy 释放资源
3. **状态持久化**：
   - Sandbox 内的文件、安装的依赖等会通过 Volume 持久化保存
   - 适合需要多次操作的场景（如：安装依赖 -> 运行脚本 -> 读取结果）`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      provider: { type: 'string', description: 'Sandbox Provider 类型' },
      workspaceRoot: { type: 'string', description: '工作区根路径' },
      status: { type: 'string', description: 'Sandbox 状态' },
    },
  },
};
