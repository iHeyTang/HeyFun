import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 写入文件的参数 Schema
 */
export const sandboxWriteFileParamsSchema = z.object({
  path: z.string().describe('文件路径（相对于 workspaceRoot），例如 "script.py"、"data/file.txt"'),
  content: z.string().describe('文件内容（文本）'),
});

export type SandboxWriteFileParams = z.infer<typeof sandboxWriteFileParamsSchema>;

export const sandboxWriteFileSchema: ToolDefinition = {
  name: 'sandbox.write_file',
  description: '向 sandbox 中写入文件内容。如果文件不存在会创建，如果存在会覆盖。文件路径相对于 workspaceRoot。',
  displayName: {
    en: 'Sandbox Write File',
    'zh-CN': 'Sandbox 写入文件',
    'zh-TW': 'Sandbox 寫入檔案',
    ja: 'Sandbox ファイル書き込み',
    ko: 'Sandbox 파일 쓰기',
  },
  parameters: zodToJsonSchema(sandboxWriteFileParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'sandbox',
  manual: `# sandbox.write_file 工具使用手册

## 功能说明
sandbox.write_file 用于向 sandbox 中写入文件内容。如果文件不存在会创建，如果存在会覆盖。文件路径相对于 workspaceRoot。

## 使用场景
1. **创建脚本**：创建 Python、JavaScript 等脚本文件
2. **写入数据**：写入 JSON、CSV 等数据文件
3. **创建配置**：创建配置文件
4. **保存结果**：保存命令执行的结果

## 参数说明
- **path**（必需）：文件路径（相对于 workspaceRoot），例如：
  - "script.py"
  - "data/file.txt"
  - "output/result.json"
- **content**（必需）：文件内容（文本）

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **path**：文件路径

## 使用建议
1. 确保文件路径正确，相对于 workspaceRoot
2. 父目录会自动创建
3. 只能写入文本文件，不支持二进制文件
4. 如果文件已存在，会被覆盖`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      path: { type: 'string', description: '文件路径' },
    },
  },
};
