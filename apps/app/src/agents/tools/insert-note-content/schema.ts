import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 插入笔记内容的参数 Schema
 */
export const insertNoteContentParamsSchema = z.object({
  noteId: z.string().describe('笔记ID'),
  lineNumber: z.number().int().describe('插入位置的行号（从1开始）。如果为0或负数，则在开头插入；如果超出范围，则在末尾插入。'),
  content: z.string().describe('要插入的内容（Markdown 格式）'),
});

export type InsertNoteContentParams = z.infer<typeof insertNoteContentParamsSchema>;

export const insertNoteContentSchema: ToolDefinition = {
  name: 'insert_note_content',
  description: '在笔记的指定位置插入内容。需要指定插入位置（行号），适用于在特定位置添加内容。',
  parameters: zodToJsonSchema(insertNoteContentParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
};

