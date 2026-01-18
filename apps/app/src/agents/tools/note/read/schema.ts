import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 读取笔记的参数 Schema
 */
export const noteReadParamsSchema = z.object({
  noteId: z.string().describe('笔记 ID'),
});

export type NoteReadParams = z.infer<typeof noteReadParamsSchema>;

export const noteReadSchema: ToolDefinition = {
  name: 'note_read',
  description: '读取指定笔记的内容。返回笔记的完整 Markdown 内容及元数据。',
  displayName: {
    en: 'Read Note',
    'zh-CN': '读取笔记',
    'zh-TW': '讀取筆記',
    ja: 'ノート読み取り',
    ko: '노트 읽기',
  },
  parameters: zodToJsonSchema(noteReadParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'note',
  manual: `# note_read 工具使用手册

## 功能说明
note_read 用于读取指定笔记的完整内容。返回笔记的 Markdown 内容及相关元数据信息。

## 使用场景
1. **查看笔记内容**：读取并显示笔记的完整内容
2. **获取笔记信息**：获取笔记的标题、创建时间等元数据
3. **准备编辑**：读取笔记内容以准备后续的编辑操作
4. **内容引用**：读取笔记内容用于引用或总结

## 参数说明
- **noteId**（必需）：要读取的笔记 ID

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **noteId**：笔记 ID
- **title**：笔记标题
- **content**：笔记内容（Markdown 格式）
- **folderId**：所属文件夹 ID
- **folderName**：所属文件夹名称
- **createdAt**：创建时间
- **updatedAt**：更新时间

## 使用建议
1. 如果需要编辑笔记，先使用此工具读取内容
2. 返回的内容是 Markdown 格式，可直接用于显示或编辑`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      noteId: { type: 'string', description: '笔记 ID' },
      title: { type: 'string', description: '笔记标题' },
      content: { type: 'string', description: '笔记内容（Markdown）' },
      folderId: { type: 'string', description: '文件夹 ID' },
      folderName: { type: 'string', description: '文件夹名称' },
      createdAt: { type: 'string', description: '创建时间' },
      updatedAt: { type: 'string', description: '更新时间' },
    },
  },
};
