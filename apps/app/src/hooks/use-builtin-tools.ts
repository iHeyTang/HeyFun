import { useServerAction } from './use-async';
import { getBuiltinTools, getBuiltinTool } from '@/actions/tools';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

type BuiltinTool = NonNullable<Awaited<ReturnType<typeof getBuiltinTools>>['data']>[number];

/**
 * Hook 用于获取所有内置工具信息
 */
export function useBuiltinTools() {
  const locale = useLocale();
  const { data: tools, isLoading, refresh } = useServerAction(getBuiltinTools, { locale });

  // 创建工具名称到工具信息的映射
  const toolMap = useMemo(() => {
    if (!tools) return new Map<string, BuiltinTool>();
    const map = new Map<string, BuiltinTool>();
    tools.forEach(tool => {
      map.set(tool.name, tool);
    });
    return map;
  }, [tools]);

  // 根据工具名称获取显示名称
  const getToolDisplayName = (toolName: string): string => {
    const tool = toolMap.get(toolName);
    if (!tool) return toolName;
    return tool.displayName || toolName;
  };

  return {
    tools: tools || [],
    toolMap,
    getToolDisplayName,
    isLoading,
    refresh,
  };
}

/**
 * Hook 用于获取单个内置工具信息
 */
export function useBuiltinTool(toolName: string) {
  const locale = useLocale();
  const { data: tool, isLoading, refresh } = useServerAction(getBuiltinTool, { toolName, locale });

  return {
    tool: tool || null,
    displayName: tool?.displayName || toolName,
    isLoading,
    refresh,
  };
}

