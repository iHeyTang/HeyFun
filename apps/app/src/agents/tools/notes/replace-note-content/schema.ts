import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 替换笔记内容的参数 Schema
 */
export const replaceNoteContentParamsSchema = z
  .object({
    noteId: z.string().describe('笔记ID'),
    startLine: z.number().int().min(1).describe('替换起始行号（从1开始，包含此行）'),
    endLine: z.number().int().min(1).describe('替换结束行号（从1开始，包含此行）'),
    content: z.string().describe('替换后的新内容（Markdown 格式）'),
  })
  .refine(data => data.startLine <= data.endLine, {
    message: 'Start line must be <= end line',
    path: ['startLine'],
  });

export type ReplaceNoteContentParams = z.infer<typeof replaceNoteContentParamsSchema>;

export const replaceNoteContentSchema: ToolDefinition = {
  name: 'replace_note_content',
  description: '替换笔记中指定范围的内容（按行号）。需要指定替换的起始和结束行号，适用于精确修改特定段落。',
  displayName: {
    en: 'Replace Note Content',
    'zh-CN': '替换笔记内容',
    'zh-TW': '替換筆記內容',
    ja: 'ノート内容を置換',
    ko: '노트 내용 교체',
  },
  parameters: zodToJsonSchema(replaceNoteContentParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
};

