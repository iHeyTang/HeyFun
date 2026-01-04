import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 执行命令的参数 Schema
 */
export const sandboxExecParamsSchema = z.object({
  command: z.string().describe('要执行的命令，例如 "python script.py"、"ls -la" 等'),
  env: z.record(z.string()).optional().describe('环境变量（可选）'),
  timeout: z.number().optional().describe('超时时间（秒，可选）'),
});

export type SandboxExecParams = z.infer<typeof sandboxExecParamsSchema>;

export const sandboxExecSchema: ToolDefinition = {
  name: 'sandbox.exec',
  description: '在 sandbox 中执行 shell 命令。命令会在隔离的环境中运行，返回执行结果（退出码、标准输出、标准错误）。',
  displayName: {
    en: 'Sandbox Command',
    'zh-CN': 'Sandbox 命令',
    'zh-TW': 'Sandbox 命令',
    ja: 'Sandbox コマンド',
    ko: 'Sandbox 명령',
  },
  parameters: zodToJsonSchema(sandboxExecParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'sandbox',
  manual: `# sandbox.exec 工具使用手册

## 功能说明
sandbox.exec 用于在 sandbox 环境中执行 shell 命令。命令会在隔离的环境中运行，可以执行任何 shell 支持的命令。

## 使用场景
1. **运行脚本**：执行 Python、Node.js、Bash 等脚本
2. **安装依赖**：使用 pip、npm、apt 等安装包
3. **执行命令**：运行任何 shell 命令
4. **系统操作**：创建目录、移动文件等

## 参数说明
- **command**（必需）：要执行的命令，例如：
  - "python script.py"
  - "ls -la"
  - "pip install numpy"
  - "cd /workspace && npm install"
- **env**（可选）：环境变量，例如 {"PYTHONPATH": "/workspace"}
- **timeout**（可选）：超时时间（秒）

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **exitCode**：命令退出码（0 表示成功）
- **stdout**：标准输出
- **stderr**：标准错误输出

## 使用建议
1. 执行命令前会自动使用当前会话的 sandbox（框架自动管理）
2. 对于长时间运行的命令，建议设置 timeout
3. 使用环境变量传递配置信息
4. 检查 exitCode 判断命令是否成功执行`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      exitCode: { type: 'number', description: '命令退出码（0 表示成功）' },
      stdout: { type: 'string', description: '标准输出' },
      stderr: { type: 'string', description: '标准错误输出' },
    },
  },
};
