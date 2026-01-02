import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 自动布局画布的参数 Schema
 */
export const autoLayoutCanvasParamsSchema = z.object({
  projectId: z.string().describe('FlowCanvas项目ID'),
  direction: z.enum(['TB', 'LR']).default('LR').describe('布局方向：TB（从上到下）或 LR（从左到右）'),
});

export type AutoLayoutCanvasParams = z.infer<typeof autoLayoutCanvasParamsSchema>;

export const autoLayoutCanvasSchema: ToolDefinition = {
  name: 'auto_layout_canvas',
  description: '自动优化画布布局，重新排列节点位置',
  displayName: {
    en: 'Auto Layout Canvas',
    'zh-CN': '自动布局画布',
    'zh-TW': '自動佈局畫布',
    ja: 'キャンバスを自動レイアウト',
    ko: '캔버스 자동 레이아웃',
  },
  parameters: zodToJsonSchema(autoLayoutCanvasParamsSchema, {
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
