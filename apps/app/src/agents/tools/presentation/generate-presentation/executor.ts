import { generatePresentationParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { AssetManager } from '@/lib/server/asset-manager';
import { convertLegacyPresentationToNewFormat, type ExtendedLegacySlide } from '../_lib/converter';
import { generateHtmlContent } from '../_lib/renderers/html-renderer';
import { generatePptxBuffer } from '../_lib/renderers/pptx-renderer';
import { extractJsonFromText } from '@/lib/shared/json';
import type { LegacyStyle } from '../_lib/types';
import type { ChatClient } from '@/llm/chat';

/**
 * 使用 LLM 进行智能设计决策
 * 分析内容，为每张幻灯片生成布局、位置、大小、配色等设计信息
 */
export async function designSlidesWithLLM(
  title: string,
  slides: Array<{ type: string; title?: string; subtitle?: string; content?: string[]; imageUrl?: string; notes?: string }>,
  style: LegacyStyle,
  llmClient: ChatClient,
): Promise<ExtendedLegacySlide[]> {
  // 构建设计提示词
  const slidesJson = JSON.stringify(slides, null, 2);
  const prompt = `你是一个专业的 PPT 设计师。请根据以下内容，为每张幻灯片设计最佳的布局、位置、大小和配色。

**演示文稿标题**：${title}
**主题**：${style.theme}
**配色方案**：${style.colorScheme}

**幻灯片内容**：
${slidesJson}

**设计任务**：
为每张幻灯片生成详细的设计信息，包括：
1. **layout**：布局类型（title/title-content/content-only/two-column/image-left/image-right/image-full/section）
2. **elements**：元素数组，每个元素包含：
   - type: 元素类型（heading/text/list/image）
   - content: 内容
   - imageUrl: 图片URL（如果是图片元素）
   - layout: 位置和大小（百分比坐标 0-100）
     - x, y: 坐标
     - width, height: 大小
   - style: 样式（fontSize, fontWeight, color, align, lineHeight）
3. **background**：背景设计（可选）
   - type: color/gradient/image
   - 相应的配置

**设计原则**：
1. **图片布局**：
   - 有文字+图片：使用 image-left 或 image-right，图片占 40-50%，文字占 50-60%
   - 只有图片：使用 image-full，全屏显示（100%）
   - 图片不要太小，至少占 40% 宽度
2. **视觉层次**：标题字体 36-48pt，正文字体 20-24pt
3. **留白**：内容区域不超过 80%，保持 20% 留白
4. **配色**：根据主题选择，确保文字和背景对比度足够
5. **布局选择**：
   - 标题页：layout = "title"，标题居中，大字体
   - 章节页：layout = "section"，标题居中，大字体
   - 有图片+文字：layout = "image-left" 或 "image-right"
   - 只有图片：layout = "image-full"
   - 内容多：layout = "two-column"

**输出格式**：
返回 JSON 数组，每个元素对应一张幻灯片，格式如下：
[
  {
    "type": "content",
    "title": "标题",
    "content": ["要点1", "要点2"],
    "imageUrl": "图片URL",
    "layout": "image-right",
    "elements": [
      {
        "type": "heading",
        "content": "标题",
        "layout": { "x": 10, "y": 10, "width": 45, "height": 15 },
        "style": { "fontSize": 42, "fontWeight": "bold", "color": "#1a1a1a" }
      },
      {
        "type": "list",
        "content": ["要点1", "要点2"],
        "layout": { "x": 10, "y": 30, "width": 45, "height": 60 },
        "style": { "fontSize": 22, "lineHeight": 1.6, "color": "#333333" }
      },
      {
        "type": "image",
        "imageUrl": "图片URL",
        "layout": { "x": 55, "y": 15, "width": 40, "height": 70 }
      }
    ],
    "background": {
      "type": "gradient",
      "direction": "linear",
      "stops": [
        { "offset": 0, "color": "#ffffff" },
        { "offset": 100, "color": "#f5f5f5" }
      ],
      "angle": 135
    }
  }
]

**重要**：
- 只返回 JSON 数组，不要添加任何说明文字
- 确保 JSON 格式正确
- 每张幻灯片都要有完整的设计信息
- 图片布局要合理，不要太小或位置不当`;

  const response = await llmClient.chat({
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7, // 稍微高一点，让设计更有创意
    max_tokens: 8000,
  });

  const choice = response.choices?.[0];
  const content = choice?.message?.content || '';
  const contentStr =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map(c => (typeof c === 'string' ? c : c.type === 'text' ? c.text : '')).join('')
        : String(content);

  // 提取 JSON
  const designedSlides = extractJsonFromText<ExtendedLegacySlide[]>(contentStr, true);

  if (!designedSlides || !Array.isArray(designedSlides)) {
    throw new Error(`Failed to parse LLM design response: ${contentStr.substring(0, 500)}`);
  }

  // 验证并补充必要字段
  return designedSlides.map((slide, index) => {
    const originalSlide = slides[index];
    if (!originalSlide) {
      return slide;
    }
    return {
      ...originalSlide, // 保留原始数据
      ...slide, // 覆盖设计信息
      type: slide.type || originalSlide.type,
      title: slide.title || originalSlide.title,
      subtitle: slide.subtitle || originalSlide.subtitle,
      content: slide.content || originalSlide.content,
      imageUrl: slide.imageUrl || originalSlide.imageUrl,
      notes: slide.notes || originalSlide.notes,
    };
  });
}

export const generatePresentationExecutor = definitionToolExecutor(generatePresentationParamsSchema, async (args, context) => {
  try {
    if (!context.sessionId || !context.organizationId) {
      return {
        success: false,
        error: 'Session ID and Organization ID are required',
      };
    }

    const { title, slides, style = { theme: 'default', colorScheme: 'light' }, exportFormats = ['html'] } = args;

    // 使用 LLM 进行智能设计决策
    let designedSlides: ExtendedLegacySlide[] = slides;

    if (context.llmClient) {
      try {
        designedSlides = await designSlidesWithLLM(title, slides, style, context.llmClient);
      } catch (error) {
        console.error('Failed to design slides with LLM, using fallback:', error);
        // LLM 设计失败时，使用原始数据 + 智能分析
        designedSlides = slides;
      }
    }

    // 将设计后的数据转换为新格式（统一数据结构）
    const presentationData = convertLegacyPresentationToNewFormat(title, designedSlides, style);

    // 生成HTML内容
    let htmlContent = '';
    if (exportFormats.includes('html')) {
      htmlContent = generateHtmlContent(presentationData);
    }

    // 生成PPTX Buffer
    let pptxBuffer: Buffer | null = null;
    if (exportFormats.includes('pptx')) {
      try {
        pptxBuffer = await generatePptxBuffer(presentationData);
      } catch (error) {
        console.error('Failed to generate PPTX:', error);
        // PPTX 生成失败不影响 HTML 生成
      }
    }

    // 使用 AssetManager 上传文件，确保路径正确并创建 Assets 记录
    const assets: Array<{ id: string; fileKey: string; fileUrl: string; type: string }> = [];
    let htmlUrl = '';
    let pptxUrl = '';

    if (!context.organizationId || !context.sessionId) {
      return {
        success: false,
        error: 'Organization ID and Session ID are required',
      };
    }

    // 上传HTML文件
    if (exportFormats.includes('html') && htmlContent) {
      try {
        const htmlAsset = await AssetManager.createAsset({
          organizationId: context.organizationId,
          sessionId: context.sessionId,
          fileContent: Buffer.from(htmlContent, 'utf-8'),
          fileName: `${title || 'presentation'}.html`,
          mimeType: 'text/html',
          type: 'presentation',
          title: `${title || '演示文稿'} (HTML)`,
          description: `HTML版本的演示文稿：${title}`,
          toolCallId: context.toolCallId,
          messageId: context.messageId,
          metadata: {
            presentationTitle: title,
            slides: slides,
            style: style,
            exportFormats: exportFormats,
            version: 2, // 新版本使用统一数据结构
            isHistory: false,
            presentationData: presentationData, // 保存统一数据结构
          },
        });
        assets.push(htmlAsset);
        htmlUrl = htmlAsset.fileUrl;
      } catch (error) {
        console.error('Failed to upload HTML:', error);
      }
    }

    // 上传PPTX文件
    if (exportFormats.includes('pptx') && pptxBuffer) {
      try {
        const pptxAsset = await AssetManager.createAsset({
          organizationId: context.organizationId,
          sessionId: context.sessionId,
          fileContent: pptxBuffer,
          fileName: `${title || 'presentation'}.pptx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          type: 'presentation',
          title: `${title || '演示文稿'} (PPTX)`,
          description: `PPTX版本的演示文稿：${title}`,
          toolCallId: context.toolCallId,
          messageId: context.messageId,
          metadata: {
            presentationTitle: title,
            slides: slides,
            style: style,
            exportFormats: exportFormats,
            version: 2, // 新版本使用统一数据结构
            isHistory: false,
            presentationData: presentationData, // 保存统一数据结构
          },
        });
        assets.push(pptxAsset);
        pptxUrl = pptxAsset.fileUrl;
      } catch (error) {
        console.error('Failed to upload PPTX:', error);
      }
    }

    return {
      success: true,
      data: {
        htmlUrl: htmlUrl || undefined,
        pptxUrl: pptxUrl || undefined,
        assets: assets.map(a => ({
          id: a.id,
          fileKey: a.fileKey,
          fileUrl: a.fileUrl,
          type: a.type,
        })),
        // 向后兼容：保留 fileKeys
        fileKeys: assets.map(a => a.fileKey),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
