import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 任务完成的参数 Schema
 * 注意：此工具不需要任何参数，它只是一个标记任务完成的标志
 */
export const completeParamsSchema = z.object({});

export type CompleteParams = z.infer<typeof completeParamsSchema>;

export const completeSchema: ToolDefinition = {
  name: 'complete',
  description: '当agent完成所有工作或需要停止工作等待用户输入时，必须在同一轮响应中调用此工具。如果只输出文本询问用户而不调用此工具，系统会继续循环导致死循环。',
  displayName: {
    en: 'Complete',
    'zh-CN': '完成',
    'zh-TW': '完成',
    ja: '完了',
    ko: '완료',
  },
  parameters: zodToJsonSchema(completeParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  manual: `# complete 工具使用手册

## 功能说明
complete 用于标记任务完成或停止工作流等待用户输入。调用此工具后，当前工作流会结束。

## 使用场景
1. **任务完成**：完成所有工作后，调用此工具标记任务完成
2. **等待用户输入**：需要用户提供信息、做出选择或确认操作时，必须在询问用户的同时调用此工具（同一轮完成）
3. **停止循环**：如果不调用此工具，系统会继续下一轮循环，可能导致死循环

## 参数说明
- 此工具不需要任何参数

## 返回结果
- 此工具没有返回值，调用后当前工作流会结束

## 使用建议
1. 任务完成时调用此工具
2. **关键**：需要等待用户输入时，必须在询问用户的同时（同一轮响应中）调用此工具
3. 不能先询问用户，下一轮再调用，因为系统检测到没有工具调用会继续循环

## 重要提示
- 询问用户和调用此工具必须在同一轮完成
- 如果只输出文本询问用户而不调用此工具，系统会继续循环，下一轮会看到你的问题
`,
};
