import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 更新笔记标题的参数 Schema
 */
export const updateNoteTitleParamsSchema = z.object({
  noteId: z.string().describe('笔记ID'),
  title: z.string().min(1).describe('新的笔记标题'),
});

export type UpdateNoteTitleParams = z.infer<typeof updateNoteTitleParamsSchema>;

export const updateNoteTitleSchema: ToolDefinition = {
  name: 'update_note_title',
  description: '更新笔记的标题。当用户要求修改标题时使用此工具。',
  parameters: zodToJsonSchema(updateNoteTitleParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
};

