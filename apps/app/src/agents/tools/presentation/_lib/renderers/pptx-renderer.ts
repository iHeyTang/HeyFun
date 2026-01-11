/**
 * PPTX 渲染器：使用 PptxGenJS 将 PresentationData 渲染为 PPTX
 */
import PptxGenJS from 'pptxgenjs';
import { Buffer } from 'node:buffer';
import type { PresentationData, Slide, SlideElement, Theme } from '../types';

// PPTX 标准尺寸（英寸）
const PPTX_WIDTH = 10; // 16:9 宽高比
const PPTX_HEIGHT = 5.625;

/**
 * 百分比坐标转换为英寸
 */
function percentToInches(percent: number, total: number): number {
  return (percent / 100) * total;
}

/**
 * 颜色转换：hex 转 RGB
 */
function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1] || '0', 16),
        g: parseInt(result[2] || '0', 16),
        b: parseInt(result[3] || '0', 16),
      }
    : null;
}

/**
 * 渲染单个元素到 PPTX
 */
function renderElementToPptx(slide: PptxGenJS.Slide, element: SlideElement, theme: Theme): void {
  const { x, y, width, height } = element.layout;

  const xInches = percentToInches(x, PPTX_WIDTH);
  const yInches = percentToInches(y, PPTX_HEIGHT);
  const wInches = percentToInches(width, PPTX_WIDTH);
  const hInches = percentToInches(height, PPTX_HEIGHT);

  switch (element.type) {
    case 'heading': {
      const textStyle = element.style || {};
      const fontSize = textStyle.fontSize || theme.typography.fontSize.h2;
      const color = textStyle.color || theme.colors.primary;
      const align = textStyle.align || 'left';
      const fontWeight = textStyle.fontWeight === 'bold';

      const content = Array.isArray(element.content) ? element.content[0] : element.content;
      if (!content) break;

      const textOptions: PptxGenJS.TextPropsOptions = {
        x: xInches,
        y: yInches,
        w: wInches,
        h: hInches,
        fontSize: fontSize * 0.75, // pt 转 PptxGenJS 单位（约）
        align: align as 'left' | 'center' | 'right',
        bold: fontWeight,
        color: color,
      };

      slide.addText(content, textOptions);
      break;
    }

    case 'text': {
      const textStyle = element.style || {};
      const fontSize = textStyle.fontSize || theme.typography.fontSize.body;
      const color = textStyle.color || theme.colors.text;
      const align = textStyle.align || 'left';

      const content = Array.isArray(element.content) ? element.content[0] : element.content;
      if (!content) break;

      const textOptions: PptxGenJS.TextPropsOptions = {
        x: xInches,
        y: yInches,
        w: wInches,
        h: hInches,
        fontSize: fontSize * 0.75,
        align: align as 'left' | 'center' | 'right',
        color: color,
      };

      slide.addText(content, textOptions);
      break;
    }

    case 'list': {
      const textStyle = element.style || {};
      const fontSize = textStyle.fontSize || theme.typography.fontSize.body;
      const color = textStyle.color || theme.colors.text;
      const items = Array.isArray(element.content) ? element.content : [];

      if (items.length === 0) break;

      // PptxGenJS 的 bullet 列表
      const bulletText = items.join('\n');

      const textOptions: PptxGenJS.TextPropsOptions = {
        x: xInches,
        y: yInches,
        w: wInches,
        h: hInches,
        fontSize: fontSize * 0.75,
        bullet: true,
        color: color,
      };

      slide.addText(bulletText, textOptions);
      break;
    }

    case 'image': {
      if (!element.imageUrl) break;

      // 注意：PptxGenJS 需要图片 URL 可访问，或者使用 base64
      // 这里假设 imageUrl 是可访问的 URL
      try {
        const imageOptions: PptxGenJS.ImageProps = {
          x: xInches,
          y: yInches,
          w: wInches,
          h: hInches,
          path: element.imageUrl,
          sizing: { type: 'contain', w: wInches, h: hInches },
        };

        slide.addImage(imageOptions);
      } catch (error) {
        console.warn(`Failed to add image ${element.imageUrl}:`, error);
        // 如果图片加载失败，添加占位文本
        const textOptions: PptxGenJS.TextPropsOptions = {
          x: xInches,
          y: yInches,
          w: wInches,
          h: hInches,
          fontSize: 12,
          align: 'center',
          color: '#999999',
        };
        slide.addText(`[图片: ${element.alt || '未加载'}]`, textOptions);
      }
      break;
    }

    default:
      break;
  }
}

/**
 * 渲染背景
 */
function renderBackgroundToPptx(slide: PptxGenJS.Slide, slideData: Slide, theme: Theme): void {
  if (slideData.background) {
    const bg = slideData.background;

    if (bg.type === 'color' && bg.color) {
      const rgb = hexToRgb(bg.color);
      if (rgb) {
        slide.background = {
          color: `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`,
        };
      }
    } else if (bg.type === 'image' && bg.imageUrl) {
      // PptxGenJS 支持背景图片
      slide.background = { path: bg.imageUrl };
    }
  } else {
    const rgb = hexToRgb(theme.colors.background);
    if (rgb) {
      slide.background = {
        color: `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`,
      };
    }
  }
}

/**
 * 生成 PPTX Buffer
 */
export async function generatePptxBuffer(data: PresentationData): Promise<Buffer> {
  const pres = new PptxGenJS();

  // 设置演示文稿属性
  pres.author = data.metadata.author || 'AI Assistant';
  pres.title = data.metadata.title;
  pres.subject = data.metadata.description || '';

  // 设置布局（16:9）
  pres.layout = 'LAYOUT_WIDE';

  // 渲染每个幻灯片
  for (const slideData of data.slides) {
    const slide = pres.addSlide();

    // 设置背景
    renderBackgroundToPptx(slide, slideData, data.theme);

    // 渲染元素
    for (const element of slideData.elements) {
      renderElementToPptx(slide, element, data.theme);
    }

    // 添加备注（PptxGenJS 使用 addNotes 方法）
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  // 生成 Buffer
  const pptxBuffer = await pres.write({ outputType: 'nodebuffer' });
  // PptxGenJS 返回的是 ArrayBuffer 或 Buffer
  if (pptxBuffer instanceof ArrayBuffer) {
    return Buffer.from(pptxBuffer);
  }
  return pptxBuffer as Buffer;
}
