import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取当前时间的参数 Schema
 */
export const getCurrentTimeParamsSchema = z.object({
  timezone: z.string().optional().describe('时区名称（可选），例如 "Asia/Shanghai"、"America/New_York"、"UTC" 等。如果不提供，返回服务器本地时间。'),
  format: z.enum(['iso', 'locale', 'timestamp']).default('iso').describe('返回格式：iso（ISO 8601 格式）、locale（本地化格式）、timestamp（Unix 时间戳）'),
});

export type GetCurrentTimeParams = z.infer<typeof getCurrentTimeParamsSchema>;

export const getCurrentTimeSchema: ToolDefinition = {
  name: 'get_current_time',
  description: '获取当前时间和日期。可以获取指定时区的时间，如果不指定时区则返回服务器本地时间。',
  displayName: {
    en: 'Get Current Time',
    'zh-CN': '获取当前时间',
    'zh-TW': '獲取當前時間',
    ja: '現在時刻を取得',
    ko: '현재 시간 가져오기',
  },
  parameters: zodToJsonSchema(getCurrentTimeParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  manual: `# get_current_time 工具使用手册

## 功能说明
get_current_time 用于获取当前时间和日期。支持指定时区和多种返回格式。

## 使用场景
1. **获取当前时间**：需要知道当前时间时使用
2. **时区转换**：需要获取特定时区的时间时使用
3. **时间戳获取**：需要Unix时间戳进行计算时使用

## 参数说明
- **timezone**（可选）：时区名称，例如 "Asia/Shanghai"、"America/New_York"、"UTC" 等。如果不提供，返回服务器本地时间
- **format**（可选）：返回格式，可选值：
  - "iso"：ISO 8601 格式（默认），例如 "2024-01-01T12:00:00.000Z"
  - "locale"：本地化格式，例如 "2024年1月1日 12:00:00"
  - "timestamp"：Unix 时间戳（毫秒），例如 1704110400000

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **time**：格式化后的时间字符串
- **timestamp**：Unix 时间戳（毫秒）
- **timezone**：使用的时区

## 使用建议
1. 如果不指定时区，工具会返回服务器本地时间
2. 时区名称使用IANA时区数据库格式（如 "Asia/Shanghai"）
3. 对于需要精确时间戳的计算，使用 "timestamp" 格式
4. 对于用户友好的显示，使用 "iso" 或 "locale" 格式

## 示例
- 获取当前时间（默认格式）：不传参数或 format="iso"
- 获取北京时间：timezone="Asia/Shanghai"
- 获取时间戳：format="timestamp"`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      time: { type: 'string', description: '格式化后的时间字符串' },
      timestamp: { type: 'number', description: 'Unix 时间戳（毫秒）' },
      timezone: { type: 'string', description: '使用的时区' },
    },
  },
};

