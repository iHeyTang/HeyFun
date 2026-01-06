import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 更新演示文稿的参数 Schema
 */
export const updatePresentationParamsSchema = z.object({
  assetId: z.string().describe('要更新的演示文稿 Asset ID（HTML 或 PPTX 版本的 ID 都可以）'),
  title: z.string().optional().describe('新的演示文稿标题（可选，不提供则保持原样）'),
  slides: z
    .array(
      z.object({
        index: z.number().optional().describe('要更新的幻灯片索引（从0开始）。如果不提供，则添加新幻灯片'),
        type: z.enum(['title', 'content', 'section', 'image']).describe('幻灯片类型：title（标题页）、content（内容页）、section（章节页）、image（图片页）'),
        title: z.string().optional().describe('幻灯片标题'),
        subtitle: z.string().optional().describe('副标题（仅标题页）'),
        content: z.array(z.string()).optional().describe('内容要点列表（仅内容页）'),
        imageUrl: z.string().optional().describe('图片URL（仅图片页）'),
        notes: z.string().optional().describe('备注'),
        action: z.enum(['update', 'insert', 'delete']).optional().describe('操作类型：update（更新）、insert（插入）、delete（删除）。默认为 update。'),
      }),
    )
    .optional()
    .describe('要更新的幻灯片列表。如果提供 index，则更新对应索引的幻灯片；如果不提供 index，则添加新幻灯片'),
  style: z
    .object({
      theme: z
        .enum(['default', 'minimal', 'professional', 'modern', 'creative', 'corporate'])
        .optional()
        .describe('主题样式：default（默认）、minimal（简约）、professional（专业）、modern（现代）、creative（创意）、corporate（企业）'),
      colorScheme: z.enum(['light', 'dark']).optional().describe('配色方案：light（浅色）、dark（深色）'),
      backgroundColor: z.string().optional().describe('自定义背景颜色（十六进制格式，如 #ffffff）'),
      backgroundImage: z.string().optional().describe('背景图片URL（可选，用于装饰幻灯片背景）'),
    })
    .optional()
    .describe('样式配置（可选，只更新提供的字段）'),
  exportFormats: z
    .array(z.enum(['html', 'pptx']))
    .optional()
    .describe('导出格式列表（可选，默认使用原格式）'),
});

export type UpdatePresentationParams = z.infer<typeof updatePresentationParamsSchema>;

export const updatePresentationSchema: ToolDefinition = {
  name: 'update_presentation',
  description:
    '更新现有的演示文稿。支持部分更新：可以更新标题、修改特定幻灯片、添加新幻灯片、删除幻灯片，或更新样式。更新前会自动保存历史版本。',
  displayName: {
    en: 'Update Presentation',
    'zh-CN': '更新演示文稿',
    'zh-TW': '更新簡報',
    ja: 'プレゼンテーション更新',
    ko: '프레젠테이션 업데이트',
  },
  parameters: zodToJsonSchema(updatePresentationParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'productivity',
  manual: `# update_presentation 工具使用手册

## 功能说明
update_presentation 用于更新现有的演示文稿。支持部分更新，可以修改标题、更新特定幻灯片、添加新幻灯片、删除幻灯片，或更新样式。更新前会自动保存历史版本。

## 使用场景
1. **修改内容**：更新演示文稿中的特定幻灯片
2. **添加内容**：在演示文稿中添加新的幻灯片
3. **删除内容**：删除不需要的幻灯片
4. **更新样式**：修改演示文稿的主题或配色方案
5. **版本管理**：每次更新都会自动保存历史版本

## 参数说明
- **assetId**（必需）：要更新的演示文稿 Asset ID（HTML 或 PPTX 版本的 ID 都可以）
- **title**（可选）：新的演示文稿标题，不提供则保持原样
- **slides**（可选）：要更新的幻灯片列表
  - **index**（可选）：要更新的幻灯片索引（从0开始）。如果不提供，则添加新幻灯片
  - **type**：幻灯片类型
  - **title**：幻灯片标题（可选）
  - **subtitle**：副标题（仅标题页，可选）
  - **content**：内容要点列表（仅内容页，可选）
  - **imageUrl**：图片URL（仅图片页，可选）
  - **notes**：备注（可选）
  - **action**（可选）：操作类型
    - "update"：更新现有幻灯片（默认）
    - "insert"：在指定索引插入新幻灯片
    - "delete"：删除指定索引的幻灯片
- **style**（可选）：样式配置，只更新提供的字段
- **exportFormats**（可选）：导出格式列表，默认使用原格式

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **htmlUrl**：更新后的HTML预览链接
- **pptxUrl**：更新后的PPTX文件下载链接（如果生成）
- **assets**：新创建的 Asset 信息列表
- **historyAssetId**：历史版本的 Asset ID（用于查看历史版本）

## 使用建议
1. **部分更新**：只提供需要更新的字段，其他字段会保持原样
2. **幻灯片操作**：
   - 更新：提供 index 和要更新的字段
   - 插入：不提供 index 或使用 action: "insert"
   - 删除：使用 action: "delete" 和 index
3. **版本管理**：每次更新都会创建新的 Asset，旧版本会标记为历史版本
4. **格式选择**：如果不指定 exportFormats，会使用原演示文稿的格式`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      htmlUrl: { type: 'string', description: '更新后的HTML预览链接' },
      pptxUrl: { type: 'string', description: '更新后的PPTX文件下载链接（如果生成）' },
      assets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fileKey: { type: 'string' },
            fileUrl: { type: 'string' },
            type: { type: 'string' },
          },
        },
        description: '新创建的 Asset 信息列表',
      },
      historyAssetId: { type: 'string', description: '历史版本的 Asset ID' },
    },
  },
};

