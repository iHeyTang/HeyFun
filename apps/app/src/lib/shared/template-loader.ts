/**
 * 模板加载工具
 * 用于编译 Handlebars 模板文件（.template.md）
 *
 * 使用场景：
 * - 系统提示词模板
 * - 其他需要独立维护的模板文件
 *
 * 特性：
 * - 支持 Handlebars 模板语法
 * - 模板文件使用 .template.md 扩展名，编辑器会识别为 Markdown
 * - 使用 webpack 在构建时将模板内容内联到代码中，兼容 Vercel standalone 模式
 */

import Handlebars from 'handlebars';

/**
 * 编译 Handlebars 模板
 * @param templateString - 模板内容字符串
 * @returns 编译后的 Handlebars 模板函数
 */
function compileHandlebarsTemplate<T>(templateString: string): HandlebarsTemplateDelegate<T> {
  return Handlebars.compile<T>(templateString);
}

/**
 * 创建模板加载器（工厂函数）
 * 用于在模块级别创建模板实例，避免重复编译
 *
 * @example
 * ```typescript
 * // 在模块顶部，直接导入模板文件
 * import templateContent from './my-template.template.md';
 * const template = createTemplateLoader(templateContent);
 *
 * // 使用时
 * const rendered = template({ variable: 'value' });
 * ```
 */
export function createTemplateLoader<T = any>(templateContent: string): HandlebarsTemplateDelegate<T> {
  return compileHandlebarsTemplate<T>(templateContent);
}
