import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取画布状态的参数 Schema
 */
export const getCanvasStateParamsSchema = z.object({
  projectId: z.string().describe('FlowCanvas项目ID'),
  includeNodeDetails: z.boolean().default(true).describe('是否包含节点详细信息'),
});

export type GetCanvasStateParams = z.infer<typeof getCanvasStateParamsSchema>;

export const getCanvasStateSchema: ToolDefinition = {
  name: 'get_canvas_state',
  description: '获取指定FlowCanvas项目的完整状态',
  displayName: {
    en: 'Get Canvas State',
    'zh-CN': '获取画布状态',
    'zh-TW': '獲取畫布狀態',
    ja: 'キャンバス状態を取得',
    ko: '캔버스 상태 가져오기',
  },
  parameters: zodToJsonSchema(getCanvasStateParamsSchema, {
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

