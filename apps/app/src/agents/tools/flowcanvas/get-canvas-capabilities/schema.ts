import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取画布能力的参数 Schema
 */
export const getCanvasCapabilitiesParamsSchema = z.object({
  projectId: z.string().optional().describe('FlowCanvas项目ID（可选）'),
});

export type GetCanvasCapabilitiesParams = z.infer<typeof getCanvasCapabilitiesParamsSchema>;

export const getCanvasCapabilitiesSchema: ToolDefinition = {
  name: 'get_canvas_capabilities',
  description: '获取画布的能力信息，包括支持的节点类型、可用模型、参数配置等。在创建节点前应该先调用此工具了解画布的实际配置',
  displayName: {
    en: 'Get Canvas Capabilities',
    'zh-CN': '获取画布能力',
    'zh-TW': '獲取畫布能力',
    ja: 'キャンバス機能を取得',
    ko: '캔버스 기능 가져오기',
  },
  parameters: zodToJsonSchema(getCanvasCapabilitiesParamsSchema, {
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

