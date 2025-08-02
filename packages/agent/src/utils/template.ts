import Handlebars from "handlebars";

// 定义模板函数类型
export type HandlebarsTemplateDelegate = Handlebars.TemplateDelegate;

/**
 * 模板数据接口
 */
export interface TemplateData {
  [key: string]: any;
}

/**
 * 编译模板并返回渲染函数
 * @param template 模板字符串
 * @returns 编译后的模板函数
 */
export function compileTemplate(template: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(template);
}

/**
 * 直接渲染模板
 * @param template 模板字符串
 * @param data 模板数据
 * @returns 渲染后的字符串
 */
export function renderTemplate(template: string, data: TemplateData): string {
  const compiled = compileTemplate(template);
  return compiled(data);
}

/**
 * 预编译模板以提高性能
 * @param templates 模板对象，键为模板名称，值为模板字符串
 * @returns 编译后的模板对象
 */
export function compileTemplates<T extends Record<string, string>>(
  templates: T
): Record<keyof T, HandlebarsTemplateDelegate> {
  const compiled: Record<keyof T, HandlebarsTemplateDelegate> = {} as any;

  for (const [key, template] of Object.entries(templates)) {
    compiled[key as keyof T] = compileTemplate(template);
  }

  return compiled;
}

/**
 * 注册Handlebars助手函数
 * @param name 助手名称
 * @param fn 助手函数
 */
export function registerHelper(
  name: string,
  fn: (...args: any[]) => string
): void {
  Handlebars.registerHelper(name, fn);
}

/**
 * 注册默认助手函数
 */
export function registerDefaultHelpers(): void {
  // 格式化时间助手
  registerHelper("formatTime", function (time: string | Date, format?: string) {
    const date = new Date(time);
    if (format === "iso") {
      return date.toISOString();
    }
    if (format === "local") {
      return date.toLocaleString();
    }
    return date.toISOString();
  });

  // 条件助手
  registerHelper(
    "ifEquals",
    function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    }
  );

  // 默认值助手
  registerHelper("default", function (value: any, defaultValue: any) {
    return value || defaultValue;
  });
}

// 注册默认助手函数
registerDefaultHelpers();
