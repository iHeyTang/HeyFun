/**
 * Turndown 规则
 * 用于将图片转换为 Markdown 格式（HTML → Markdown）
 */

import type { Rule } from 'turndown';

/**
 * 创建图片的 Turndown 规则
 */
export function imageTurndownRule(): Rule {
  return {
    filter: 'img',
    replacement: (content, node) => {
      const img = node as HTMLImageElement;
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const title = img.getAttribute('title') || '';
      const width = img.getAttribute('width');
      const height = img.getAttribute('height');
      // 如果图片有尺寸信息，在 Markdown 中保留（使用 HTML 格式）
      if (width || height) {
        return `<img src="${src}" alt="${alt}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}${title ? ` title="${title}"` : ''} />`;
      }
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    },
  };
}

