import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 创建笔记的参数 Schema
 */
export const noteCreateParamsSchema = z.object({
  title: z.string().describe('笔记标题'),
  content: z.string().describe('笔记内容（Markdown 格式）'),
  folderId: z.string().optional().describe('文件夹 ID（可选，不传则放在根目录）'),
});

export type NoteCreateParams = z.infer<typeof noteCreateParamsSchema>;

export const noteCreateSchema: ToolDefinition = {
  name: 'note_create',
  description: '创建一个新笔记。笔记使用 Markdown 格式存储，创建后会自动关联到当前会话作为素材资产。',
  displayName: {
    en: 'Create Note',
    'zh-CN': '创建笔记',
    'zh-TW': '建立筆記',
    ja: 'ノート作成',
    ko: '노트 작성',
  },
  parameters: zodToJsonSchema(noteCreateParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'note',
  manual: `# note_create 工具使用手册

## 功能说明
note_create 用于创建一个新的笔记文档。笔记内容使用 Markdown 格式存储，创建后会自动关联到当前会话作为素材资产。

## 使用场景
1. **记录会话成果**：将对话中产生的重要信息保存为笔记
2. **创建知识文档**：创建结构化的知识文档
3. **保存分析结果**：保存数据分析、代码分析等结果
4. **生成报告**：生成格式化的报告文档

## 参数说明
- **title**（必需）：笔记标题
- **content**（必需）：笔记内容，支持 Markdown 格式
- **folderId**（可选）：目标文件夹 ID，不传则放在根目录

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **noteId**：创建的笔记 ID
- **title**：笔记标题
- **assetId**：关联的素材资产 ID

## Markdown 格式支持
支持标准 Markdown 语法，包括：
- 标题（# ## ###）
- 列表（- * 1.）
- 代码块（\`\`\`）
- 链接和图片
- 表格
- 引用（>）`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      noteId: { type: 'string', description: '笔记 ID' },
      title: { type: 'string', description: '笔记标题' },
      assetId: { type: 'string', description: '素材资产 ID' },
    },
  },
};
