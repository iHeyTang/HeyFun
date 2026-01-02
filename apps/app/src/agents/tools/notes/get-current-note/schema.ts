import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取笔记的参数 Schema
 */
export const getCurrentNoteParamsSchema = z.object({
  noteId: z.string().describe('笔记ID'),
});

export type GetCurrentNoteParams = z.infer<typeof getCurrentNoteParamsSchema>;

export const getCurrentNoteSchema: ToolDefinition = {
  name: 'get_current_note',
  description: '获取指定笔记的完整内容，包括标题和正文。在修改笔记前，应该先使用此工具了解笔记的当前状态。',
  displayName: {
    en: 'Get Current Note',
    'zh-CN': '获取当前笔记',
    'zh-TW': '獲取當前筆記',
    ja: '現在のノートを取得',
    ko: '현재 노트 가져오기',
  },
  parameters: zodToJsonSchema(getCurrentNoteParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
};

