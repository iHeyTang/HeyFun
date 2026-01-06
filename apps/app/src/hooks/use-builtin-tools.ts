import { create } from 'zustand';
import { getBuiltinTools } from '@/actions/tools';
import { useMemo, useEffect } from 'react';
import { useLocale } from 'next-intl';

type BuiltinTool = NonNullable<Awaited<ReturnType<typeof getBuiltinTools>>['data']>[number];

/**
 * 内置工具全局 Store
 * 统一管理所有内置工具信息，避免重复请求
 */
interface BuiltinToolsState {
  // 按 locale 存储的工具数据
  toolsByLocale: Record<string, BuiltinTool[]>;
  // 加载状态
  isLoading: boolean;
  // 初始化状态（按 locale）
  initiatedLocales: Set<string>;
  // 正在初始化的 locale 集合（防止并发请求）
  initiatingLocales: Set<string>;
  // 错误信息
  error: Error | undefined;
  // 加载工具数据
  loadTools: (locale: string) => Promise<void>;
  // 刷新工具数据
  refreshTools: (locale: string) => Promise<void>;
}

export const useBuiltinToolsStore = create<BuiltinToolsState>((set, get) => ({
  toolsByLocale: {},
  isLoading: false,
  initiatedLocales: new Set(),
  initiatingLocales: new Set(),
  error: undefined,
  loadTools: async (locale: string) => {
    const state = get();
    // 如果已经初始化完成或正在初始化，直接返回
    if (state.initiatedLocales.has(locale) || state.initiatingLocales.has(locale)) {
      return;
    }
    // 设置 initiating 为 true，防止并发调用
    set({
      initiatingLocales: new Set(state.initiatingLocales).add(locale),
      isLoading: true,
      error: undefined,
    });
    try {
      const res = await getBuiltinTools({ locale });
      const tools = res.data || [];
      set({
        toolsByLocale: { ...state.toolsByLocale, [locale]: tools },
        initiatedLocales: new Set(state.initiatedLocales).add(locale),
        initiatingLocales: new Set([...state.initiatingLocales].filter(l => l !== locale)),
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err as Error,
        initiatedLocales: new Set(state.initiatedLocales).add(locale),
        initiatingLocales: new Set([...state.initiatingLocales].filter(l => l !== locale)),
        isLoading: false,
      });
    }
  },
  refreshTools: async (locale: string) => {
    const state = get();
    set({
      initiatingLocales: new Set(state.initiatingLocales).add(locale),
      isLoading: true,
      error: undefined,
    });
    try {
      const res = await getBuiltinTools({ locale });
      const tools = res.data || [];
      set({
        toolsByLocale: { ...state.toolsByLocale, [locale]: tools },
        initiatingLocales: new Set([...state.initiatingLocales].filter(l => l !== locale)),
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err as Error,
        initiatingLocales: new Set([...state.initiatingLocales].filter(l => l !== locale)),
        isLoading: false,
      });
    }
  },
}));

/**
 * Hook 用于获取所有内置工具信息
 */
export function useBuiltinTools() {
  const locale = useLocale();
  const { toolsByLocale, isLoading, loadTools, refreshTools } = useBuiltinToolsStore();

  // 自动加载工具数据
  useEffect(() => {
    loadTools(locale);
  }, [locale, loadTools]);

  const tools = useMemo(() => toolsByLocale[locale] || [], [toolsByLocale, locale]);

  // 创建工具名称到工具信息的映射
  const toolMap = useMemo(() => {
    if (!tools.length) return new Map<string, BuiltinTool>();
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
    tools,
    toolMap,
    getToolDisplayName,
    isLoading,
    refresh: () => refreshTools(locale),
  };
}

/**
 * Hook 用于获取单个内置工具信息
 */
export function useBuiltinTool(toolName: string) {
  const locale = useLocale();
  const { toolsByLocale, loadTools } = useBuiltinToolsStore();

  // 自动加载工具数据
  useEffect(() => {
    loadTools(locale);
  }, [locale, loadTools]);

  const tools = toolsByLocale[locale] || [];
  const tool = tools.find(t => t.name === toolName);

  return {
    tool: tool || null,
    displayName: tool?.displayName || toolName,
    isLoading: false,
    refresh: () => loadTools(locale),
  };
}
