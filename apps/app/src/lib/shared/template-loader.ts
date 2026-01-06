/**
 * 模板加载工具
 * 用于从文件系统加载 Handlebars 模板文件（.template.md）
 *
 * 使用场景：
 * - 系统提示词模板
 * - 其他需要独立维护的模板文件
 *
 * 特性：
 * - 使用 import.meta.url 自动获取当前文件目录
 * - 支持 Handlebars 模板语法
 * - 模板文件使用 .template.md 扩展名，编辑器会识别为 Markdown
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

/**
 * 从文件加载模板内容（原始字符串）
 * @param importMetaUrl - 当前文件的 import.meta.url，用于获取文件目录
 * @param filename - 模板文件名（相对于当前文件目录），默认为 'system-prompt.template.md'
 * @returns 模板文件的原始内容
 */
function loadTemplateFile(importMetaUrl: string, filename: string): string {
  if (typeof import.meta === 'undefined' || !importMetaUrl) {
    throw new Error('import.meta.url is not available. This code requires ESM environment.');
  }

  try {
    // 使用 import.meta.url 获取当前文件的目录路径
    const currentDir = dirname(fileURLToPath(importMetaUrl));
    const templatePath = join(currentDir, filename);
    const template = readFileSync(templatePath, 'utf-8');
    return template;
  } catch (error) {
    console.error(`[TemplateLoader] Failed to load template file "${filename}":`, error);
    throw new Error(`Failed to load template file "${filename}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 加载并编译 Handlebars 模板
 * @param importMetaUrl - 当前文件的 import.meta.url
 * @param filename - 模板文件名，默认为 'system-prompt.template.md'
 * @returns 编译后的 Handlebars 模板函数
 */
function loadHandlebarsTemplate<T>(importMetaUrl: string, filename: string): HandlebarsTemplateDelegate<T> {
  const templateString = loadTemplateFile(importMetaUrl, filename);
  return Handlebars.compile<T>(templateString);
}

/**
 * 创建模板加载器（工厂函数）
 * 用于在模块级别创建模板实例，避免重复加载
 *
 * @example
 * ```typescript
 * // 在模块顶部
 * const template = createTemplateLoader(import.meta.url, 'my-template.template.md');
 *
 * // 使用时
 * const rendered = template({ variable: 'value' });
 * ```
 */
export function createTemplateLoader<T = any>(importMetaUrl: string, filename: string): HandlebarsTemplateDelegate<T> {
  return loadHandlebarsTemplate<T>(importMetaUrl, filename);
}
