import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const replaceNoteContentSchema: ToolDefinition = {
  name: 'replace_note_content',
  description: '替换笔记中指定范围的内容（按行号）。需要指定替换的起始和结束行号，适用于精确修改特定段落。',
  parameters: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: '笔记ID',
      },
      startLine: {
        type: 'number',
        description: '替换起始行号（从1开始，包含此行）',
      },
      endLine: {
        type: 'number',
        description: '替换结束行号（从1开始，包含此行）',
      },
      content: {
        type: 'string',
        description: '替换后的新内容（Markdown 格式）',
      },
    },
    required: ['noteId', 'startLine', 'endLine', 'content'],
  },
  runtime: ToolRuntime.SERVER,
};

