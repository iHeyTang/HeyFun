import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const insertNoteContentSchema: ToolDefinition = {
  name: 'insert_note_content',
  description: '在笔记的指定位置插入内容。需要指定插入位置（行号），适用于在特定位置添加内容。',
  parameters: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: '笔记ID',
      },
      lineNumber: {
        type: 'number',
        description: '插入位置的行号（从1开始）。如果为0或负数，则在开头插入；如果超出范围，则在末尾插入。',
      },
      content: {
        type: 'string',
        description: '要插入的内容（Markdown 格式）',
      },
    },
    required: ['noteId', 'lineNumber', 'content'],
  },
  runtime: ToolRuntime.SERVER,
};

