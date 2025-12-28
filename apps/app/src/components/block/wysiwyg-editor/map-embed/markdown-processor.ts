/**
 * Markdown 处理器
 * 用于将 Markdown 注释格式转换为 <map-embed> 标签（Markdown → HTML）
 */

import { jsonToMapEmbedAttrs } from './utils';

/**
 * 处理 HTML 中的地图注释，将其转换为 <map-embed> 标签
 * @param html - 包含地图注释的 HTML 字符串
 * @returns 处理后的 HTML 字符串
 */
export function processMapCommentsInHTML(html: string): string {
  // 处理地图注释：将 HTML 注释格式 <!-- map: {...} --> 转换为 <map-embed> 标签
  // 使用更复杂的正则来匹配嵌套的 JSON 对象
  const mapCommentRegex = /<!--\s*map:\s*(\{[\s\S]*?\})\s*-->/g;

  return html.replace(mapCommentRegex, (match, jsonStr) => {
    try {
      // 尝试解析 JSON
      const mapData = JSON.parse(jsonStr);

      // 验证数据有效性
      const isRouteMode = mapData.from && mapData.to;
      if (isRouteMode) {
        if (!mapData.from?.location || !mapData.to?.location) {
          console.warn('路径规划地图缺少起点或终点 location 字段:', jsonStr);
          return match; // 返回原注释，不处理
        }
      } else {
        if (!mapData.location) {
          console.warn('地图注释缺少 location 字段:', jsonStr);
          return match; // 返回原注释，不处理
        }
      }

      // 使用工具函数转换为属性
      const attrs = jsonToMapEmbedAttrs(mapData);
      return `<map-embed ${attrs.join(' ')}></map-embed>`;
    } catch (error) {
      console.error('解析地图注释失败:', jsonStr, error);
      return match; // 返回原注释，不处理
    }
  });
}

