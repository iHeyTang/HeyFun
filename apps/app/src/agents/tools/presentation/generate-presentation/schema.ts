import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 生成演示文稿的参数 Schema
 */
export const generatePresentationParamsSchema = z.object({
  title: z.string().describe('演示文稿标题'),
  slides: z
    .array(
      z.object({
        type: z
          .enum(['title', 'content', 'section', 'image'])
          .describe('幻灯片类型：title（标题页）、content（内容页）、section（章节页）、image（图片页）'),
        title: z.string().optional().describe('幻灯片标题'),
        subtitle: z.string().optional().describe('副标题（仅标题页）'),
        content: z.array(z.string()).optional().describe('内容要点列表（仅内容页）'),
        imageUrl: z.string().optional().describe('图片URL（仅图片页）'),
        notes: z.string().optional().describe('备注'),
      }),
    )
    .describe('幻灯片列表（工具内部会使用 LLM 进行智能设计，包括布局、位置、大小、配色等）'),
  style: z
    .object({
      theme: z
        .enum(['default', 'minimal', 'professional', 'modern', 'creative', 'corporate'])
        .default('default')
        .describe('主题样式：default（默认）、minimal（简约）、professional（专业）、modern（现代）、creative（创意）、corporate（企业）'),
      colorScheme: z.enum(['light', 'dark']).default('light').describe('配色方案：light（浅色）、dark（深色）'),
      backgroundColor: z.string().optional().describe('自定义背景颜色（十六进制格式，如 #ffffff）'),
      backgroundImage: z.string().optional().describe('背景图片URL（可选，用于装饰幻灯片背景）'),
    })
    .optional()
    .describe('样式配置'),
  exportFormats: z
    .array(z.enum(['html', 'pptx']))
    .default(['html'])
    .describe('导出格式列表，默认只生成HTML预览'),
});

export type GeneratePresentationParams = z.infer<typeof generatePresentationParamsSchema>;

export const generatePresentationSchema: ToolDefinition = {
  name: 'generate_presentation',
  description:
    '生成演示文稿（PPT）。工具内部会使用 LLM 进行智能设计决策（包括布局、位置、大小、配色等），根据提供的标题和幻灯片内容，生成HTML预览版本和可选的PowerPoint文件。HTML版本便于即时查看，PPTX版本可用于编辑和分享。',
  displayName: {
    en: 'Generate Presentation',
    'zh-CN': '生成演示文稿',
    'zh-TW': '生成簡報',
    ja: 'プレゼンテーション生成',
    ko: '프레젠테이션 생성',
  },
  parameters: zodToJsonSchema(generatePresentationParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'productivity',
  manual: `# generate_presentation 工具使用手册

## 功能说明
generate_presentation 用于生成演示文稿（PPT）。根据提供的标题和幻灯片内容，生成HTML预览版本和可选的PowerPoint文件。

## 使用场景
1. **创建演示文稿**：根据主题和大纲生成完整的PPT
2. **快速预览**：生成HTML版本便于即时查看和分享
3. **导出编辑**：生成PPTX文件用于进一步编辑

## 参数说明
- **title**（必需）：演示文稿标题
- **slides**（必需）：幻灯片列表，每个幻灯片包含：
  - **type**：幻灯片类型
    - "title"：标题页
    - "content"：内容页
    - "section"：章节页
    - "image"：图片页
  - **title**：幻灯片标题（可选）
  - **subtitle**：副标题（仅标题页，可选）
  - **content**：内容要点列表（仅内容页，可选）
  - **imageUrl**：图片URL（仅图片页，可选）
  - **notes**：备注（可选）
- **style**（可选）：样式配置
  - **theme**：主题样式（default、minimal、professional）
  - **colorScheme**：配色方案（light、dark）
- **exportFormats**（可选）：导出格式列表，默认只生成HTML

## 返回结果
返回包含以下字段的对象：
- **success**：是否成功
- **htmlUrl**：HTML预览链接
- **pptxUrl**：PPTX文件下载链接（如果生成）
- **fileKeys**：文件在OSS中的key列表

## 使用建议

**重要**：工具内部会自动使用 LLM 进行智能设计决策，你只需要提供基础内容即可。

1. **提供基础内容**：
   - 标题、副标题、内容要点、图片URL
   - 工具会自动分析内容，生成最佳布局、位置、大小和配色

2. **图片获取**：可以使用 \`image_search\` 工具搜索相关图片，获取高质量的配图URL
   - 根据每张幻灯片的内容主题，搜索合适的配图
   - 例如：如果幻灯片讲"人工智能"，可以搜索"artificial intelligence"、"AI technology"等相关图片
   - 将搜索到的图片URL添加到幻灯片的 \`imageUrl\` 字段中

3. **主题选择**：根据演示场景选择合适的主题
   - 商务演示：使用 professional 或 corporate 主题
   - 创意展示：使用 creative 或 modern 主题
   - 简约风格：使用 minimal 主题

4. **工具内部设计**：工具会自动：
   - 分析内容类型和密度
   - 选择最佳布局（左右分栏、全屏、两列等）
   - 计算元素位置和大小（图片至少40%宽度，合理留白）
   - 应用配色方案（确保对比度）
   - 生成渐变背景（可选）

5. **其他建议**：
   - 优先使用HTML格式进行预览，加载速度快
   - 需要编辑时再生成PPTX格式
   - 图片URL需要是可访问的公开链接或OSS链接`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      htmlUrl: { type: 'string', description: 'HTML预览链接' },
      pptxUrl: { type: 'string', description: 'PPTX文件下载链接（如果生成）' },
      fileKeys: { type: 'array', items: { type: 'string' }, description: '文件在OSS中的key列表' },
    },
  },
};
