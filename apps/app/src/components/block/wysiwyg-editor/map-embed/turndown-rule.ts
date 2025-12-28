/**
 * Turndown 规则
 * 用于将 <map-embed> 标签转换为 Markdown 注释格式（HTML → Markdown）
 */

import type { Rule } from 'turndown';
import { mapEmbedAttrsToJSON } from './utils';

/**
 * 创建地图嵌入的 Turndown 规则
 */
export function mapEmbedTurndownRule(): Rule {
  return {
    filter: (node: any) => {
      return node.nodeName === 'MAP-EMBED';
    },
    replacement: (content: string, node: any) => {
      const attrs: Record<string, any> = {};

      // 收集所有属性
      if (node.hasAttributes()) {
        Array.from(node.attributes).forEach((attr: any) => {
          attrs[attr.name] = attr.value;
        });
      }

      // 使用工具函数转换为 JSON
      const mapData = mapEmbedAttrsToJSON(attrs);

      // 转换为 HTML 注释格式
      const jsonStr = JSON.stringify(mapData);
      return `\n\n<!-- map: ${jsonStr} -->\n\n`;
    },
  };
}

