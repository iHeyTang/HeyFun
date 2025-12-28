/**
 * Map Embed Extension
 * 地图嵌入扩展的统一导出
 *
 * 这个模块包含了地图嵌入扩展的所有功能：
 * - extension: TipTap 扩展定义
 * - component: React 组件
 * - utils: 工具函数
 * - turndown-rule: Turndown 规则（HTML → Markdown）
 * - markdown-processor: Markdown 处理器（Markdown → HTML）
 */

export { MapEmbedExtension } from './extension';
export { MapEmbed } from './component';
export { mapEmbedAttrsToJSON, jsonToMapEmbedAttrs } from './utils';
export { mapEmbedTurndownRule } from './turndown-rule';
export { processMapCommentsInHTML } from './markdown-processor';

