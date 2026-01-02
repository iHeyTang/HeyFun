import { Locale } from '@/i18n/config';

/**
 * 根据语言代码获取工具的显示名称
 * @param toolName 工具名称（唯一标识）
 * @param displayNameMap 工具的 displayName 映射对象
 * @param locale 当前语言代码
 * @returns 工具的显示名称，如果没有则返回工具名称本身
 */
export function getToolDisplayName(toolName: string, displayNameMap?: Record<string, string>, locale?: Locale): string {
  if (!displayNameMap || !locale) {
    return toolName;
  }

  // 优先使用当前语言的显示名称
  if (displayNameMap[locale]) {
    return displayNameMap[locale];
  }

  // 如果没有当前语言的显示名称，尝试使用英语
  if (displayNameMap['en']) {
    return displayNameMap['en'];
  }

  // 如果都没有，返回工具名称本身
  return toolName;
}

