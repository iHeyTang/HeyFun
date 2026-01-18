import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 单个编辑操作的 Schema
 */
const editOperationSchema = z.object({
  oldText: z.string().describe('要替换的原文本（需要精确匹配）'),
  newText: z.string().describe('替换后的新文本'),
});

/**
 * 编辑笔记的参数 Schema
 */
export const noteEditParamsSchema = z.object({
  noteId: z.string().describe('笔记 ID'),
  title: z.string().optional().describe('新的笔记标题（可选，不传则不修改）'),
  edits: z
    .array(editOperationSchema)
    .optional()
    .describe('编辑操作列表，每个操作包含 oldText（原文本）和 newText（新文本）。使用精确匹配替换。'),
  fullContent: z.string().optional().describe('完整的新内容（可选，如果提供则覆盖整个笔记内容，优先级高于 edits）'),
});

export type EditOperation = z.infer<typeof editOperationSchema>;
export type NoteEditParams = z.infer<typeof noteEditParamsSchema>;

export const noteEditSchema: ToolDefinition = {
  name: 'note_edit',
  description:
    '编辑现有笔记的内容。支持两种编辑模式：1) diff 模式 - 通过 edits 参数指定要替换的文本片段；2) 覆盖模式 - 通过 fullContent 参数直接替换整个内容。',
  displayName: {
    en: 'Edit Note',
    'zh-CN': '编辑笔记',
    'zh-TW': '編輯筆記',
    ja: 'ノート編集',
    ko: '노트 편집',
  },
  parameters: zodToJsonSchema(noteEditParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'note',
  manual: `# note_edit 工具使用手册

## 功能说明
note_edit 用于编辑现有笔记的内容。支持两种编辑模式：
1. **diff 模式**：通过指定要替换的文本片段进行精确编辑
2. **覆盖模式**：直接用新内容替换整个笔记内容

## 使用场景
1. **修正内容**：修正笔记中的错误或过时信息
2. **追加内容**：在特定位置追加新内容
3. **重构内容**：重新组织笔记结构
4. **更新标题**：修改笔记标题

## 参数说明
- **noteId**（必需）：要编辑的笔记 ID
- **title**（可选）：新的笔记标题
- **edits**（可选）：编辑操作列表，每个操作包含：
  - **oldText**：要替换的原文本（需要精确匹配，包括空格和换行）
  - **newText**：替换后的新文本（可以为空字符串，表示删除）
- **fullContent**（可选）：完整的新内容，提供后将覆盖整个笔记内容

## 编辑模式优先级
1. 如果提供了 fullContent，则使用覆盖模式
2. 如果没有 fullContent 但有 edits，则使用 diff 模式
3. 如果只有 title，则只更新标题

## diff 模式使用示例

### 替换文本
\`\`\`json
{
  "noteId": "note123",
  "edits": [
    {
      "oldText": "旧的文本内容",
      "newText": "新的文本内容"
    }
  ]
}
\`\`\`

### 删除文本
\`\`\`json
{
  "noteId": "note123",
  "edits": [
    {
      "oldText": "要删除的文本",
      "newText": ""
    }
  ]
}
\`\`\`

### 多处修改
\`\`\`json
{
  "noteId": "note123",
  "edits": [
    { "oldText": "修改1旧", "newText": "修改1新" },
    { "oldText": "修改2旧", "newText": "修改2新" }
  ]
}
\`\`\`

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **noteId**：笔记 ID
- **title**：更新后的笔记标题
- **editCount**：成功执行的编辑数量
- **failedEdits**：失败的编辑操作（如果有）

## 使用建议
1. 编辑前建议先使用 note_read 读取笔记内容
2. diff 模式的 oldText 需要精确匹配，包括空格和换行符
3. 对于大范围修改，建议使用 fullContent 覆盖模式
4. 多处小修改建议使用 edits 数组一次性提交`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      noteId: { type: 'string', description: '笔记 ID' },
      title: { type: 'string', description: '笔记标题' },
      editCount: { type: 'number', description: '成功执行的编辑数量' },
      failedEdits: {
        type: 'array',
        description: '失败的编辑操作',
        items: {
          type: 'object',
          properties: {
            oldText: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
};
