import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 编辑画布的参数 Schema
 */
export const editFlowCanvasParamsSchema = z.object({
  projectId: z.string().describe('FlowCanvas项目ID'),
  mode: z.enum(['replace', 'merge']).default('merge').describe('更新模式：replace 表示完全替换画布（用于创建新工作流），merge 表示合并更新（用于修改现有工作流）。默认为 merge。'),
  nodes: z
    .array(
      z.object({
        id: z.string().optional().describe('节点 ID。如果不存在，会自动生成。在 merge 模式下，如果 ID 已存在则更新该节点。'),
        type: z.enum(['text', 'image', 'video', 'audio', 'music', 'group']).describe('节点类型'),
        position: z
          .object({
            x: z.number(),
            y: z.number(),
          })
          .describe('节点位置'),
        parentId: z.string().optional().describe('父节点 ID（用于 group 节点）'),
        data: z
          .object({
            label: z.string().optional().describe('节点标签/标题'),
            description: z.string().optional().describe('节点描述'),
            auto: z.boolean().optional().describe('是否自动执行'),
            actionData: z.record(z.any()).optional().describe('节点动作数据。根据节点类型不同：text 节点使用 text 字段；image/video/music 节点使用 prompt、selectedModel 等；audio 节点使用 prompt、voiceId、selectedModel 等'),
          })
          .optional()
          .describe('节点数据'),
      }),
    )
    .default([])
    .describe('节点列表。在 replace 模式下，这会完全替换所有节点；在 merge 模式下，这会更新或添加节点（根据节点 ID 匹配）。如果节点没有 ID，会自动生成。'),
  edges: z
    .array(
      z.object({
        id: z.string().optional().describe('连接 ID。如果不存在，会自动生成。'),
        source: z.string().describe('源节点 ID'),
        target: z.string().describe('目标节点 ID'),
        sourceHandle: z.string().default('output').describe('源节点连接点，默认 output'),
        targetHandle: z.string().default('input').describe('目标节点连接点，默认 input'),
        type: z.string().default('default').describe('连接类型，默认 default'),
      }),
    )
    .default([])
    .describe('连接列表。在 replace 模式下，这会完全替换所有连接；在 merge 模式下，这会更新或添加连接（根据连接 ID 或 source/target 匹配）。如果连接没有 ID，会自动生成。'),
  deleteNodes: z.array(z.string()).default([]).describe('要删除的节点 ID 列表（仅在 merge 模式下有效）'),
  deleteEdges: z.array(z.string()).default([]).describe('要删除的连接 ID 列表（仅在 merge 模式下有效）'),
});

export type EditFlowCanvasParams = z.infer<typeof editFlowCanvasParamsSchema>;

export const editFlowCanvasSchema: ToolDefinition = {
  name: 'edit_flow_canvas',
  description:
    '编辑工作流画布。支持创建新工作流、修改现有节点和连接、删除节点和连接。每次调用应尽可能完成所有需要的修改，而不是分次调用。例如：创建完整工作流时传入完整的 nodes 和 edges；修改时传入所有需要修改的节点和边。',
  displayName: {
    en: 'Edit Flow Canvas',
    'zh-CN': '编辑工作流画布',
    'zh-TW': '編輯工作流程畫布',
    ja: 'フローキャンバスを編集',
    ko: '플로우 캔버스 편집',
  },
  parameters: zodToJsonSchema(editFlowCanvasParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'canvas',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};

