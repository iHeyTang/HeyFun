import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 更新笔记内容的参数 Schema
 */
export const updateNoteContentParamsSchema = z.object({
  noteId: z.string().describe('笔记ID'),
  content: z.string().describe('新的笔记正文内容（Markdown 格式）'),
});

export type UpdateNoteContentParams = z.infer<typeof updateNoteContentParamsSchema>;

export const updateNoteContentSchema: ToolDefinition = {
  name: 'update_note_content',
  description: '更新笔记的正文内容。用于整体替换笔记内容，适用于大幅修改或重写场景。',
  parameters: zodToJsonSchema(updateNoteContentParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
};

