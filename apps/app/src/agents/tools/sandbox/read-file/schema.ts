import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 读取文件的参数 Schema
 */
export const sandboxReadFileParamsSchema = z.object({
  path: z.string().describe('文件路径（相对于 workspaceRoot），例如 "script.py"、"data/file.txt"'),
});

export type SandboxReadFileParams = z.infer<typeof sandboxReadFileParamsSchema>;

export const sandboxReadFileSchema: ToolDefinition = {
  name: 'sandbox.read_file',
  description: '从 sandbox 中读取文件内容。文件路径相对于 workspaceRoot。',
  displayName: {
    en: 'Sandbox Read File',
    'zh-CN': 'Sandbox 读取文件',
    'zh-TW': 'Sandbox 讀取檔案',
    ja: 'Sandbox ファイル読み取り',
    ko: 'Sandbox 파일 읽기',
  },
  parameters: zodToJsonSchema(sandboxReadFileParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'sandbox',
  manual: `# sandbox.read_file 工具使用手册

## 功能说明
sandbox.read_file 用于从 sandbox 中读取文件内容。文件路径相对于 workspaceRoot。

## 使用场景
1. **读取脚本**：读取 Python、JavaScript 等脚本文件
2. **读取数据**：读取 JSON、CSV 等数据文件
3. **读取配置**：读取配置文件
4. **查看结果**：读取命令执行生成的文件

## 参数说明
- **path**（必需）：文件路径（相对于 workspaceRoot），例如：
  - "script.py"
  - "data/file.txt"
  - "output/result.json"

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **content**：文件内容（文本）
- **path**：文件路径

## 使用建议
1. 确保文件路径正确，相对于 workspaceRoot
2. 对于大文件，注意内容可能被截断
3. 二进制文件不支持，只能读取文本文件`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      content: { type: 'string', description: '文件内容' },
      path: { type: 'string', description: '文件路径' },
    },
  },
};
