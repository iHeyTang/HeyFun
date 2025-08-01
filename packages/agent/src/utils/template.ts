export interface TemplateVariables {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * 简单的模板管理器，用于渲染包含{{ variable }}格式变量的模板
 */
export class TemplateManager {
  /**
   * 渲染模板，替换其中的变量
   * @param template 包含{{ variable }}格式变量的模板字符串
   * @param variables 变量对象
   * @returns 渲染后的字符串
   */
  public renderTemplate(template: string, variables: TemplateVariables): string {
    let result = template;

    // 匹配 {{ variable }} 格式的变量
    const variableRegex = /\{\{\s*(\w+)\s*\}\}/g;

    result = result.replace(variableRegex, (match, variableName) => {
      const value = variables[variableName];
      if (value === null || value === undefined) {
        console.warn(`Template variable '${variableName}' is not defined`);
        return match; // 保持原样
      }
      return String(value);
    });

    return result;
  }

  /**
   * 安全渲染模板，如果变量不存在则使用默认值
   * @param template 模板字符串
   * @param variables 变量对象
   * @param defaultValue 变量不存在时的默认值
   * @returns 渲染后的字符串
   */
  public renderTemplateSafe(
    template: string,
    variables: TemplateVariables,
    defaultValue: string = ''
  ): string {
    let result = template;

    const variableRegex = /\{\{\s*(\w+)\s*\}\}/g;

    result = result.replace(variableRegex, (match, variableName) => {
      const value = variables[variableName];
      if (value === null || value === undefined) {
        return defaultValue;
      }
      return String(value);
    });

    return result;
  }

  /**
   * 获取模板中的所有变量名
   * @param template 模板字符串
   * @returns 变量名数组
   */
  public getTemplateVariables(template: string): string[] {
    const variableRegex = /\{\{\s*(\w+)\s*\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * 验证模板变量是否都已提供
   * @param template 模板字符串
   * @param variables 变量对象
   * @returns 缺失的变量名数组
   */
  public validateTemplate(template: string, variables: TemplateVariables): string[] {
    const requiredVariables = this.getTemplateVariables(template);
    const missingVariables: string[] = [];

    for (const variable of requiredVariables) {
      if (!(variable in variables) || variables[variable] === null || variables[variable] === undefined) {
        missingVariables.push(variable);
      }
    }

    return missingVariables;
  }
}

// 导出单例模板管理器
export const templateManager = new TemplateManager();
