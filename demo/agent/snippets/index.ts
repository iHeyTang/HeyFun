/**
 * 提示词片段管理器
 *
 * 管理 Agent 系统提示词中的动态片段
 * 用于告诉 Agent 前端支持哪些特殊语法（如地图、图表等）
 *
 * 注意：这只管理提示词层面，实际的渲染能力由前端组件实现
 *
 * 现在使用数据库存储，支持本地和云端 snippets
 */

import { PromptFragmentConfig } from './types';
import { SnippetStore } from './snippet-store';

/**
 * 片段注册表（使用 Map 存储，用于缓存，实际数据从数据库读取）
 */
const fragmentRegistry = new Map<string, PromptFragmentConfig>();

/**
 * Snippet Store 实例（延迟初始化）
 */
let snippetStore: SnippetStore | null = null;

/**
 * 初始化 Snippet Store（需要在应用启动时调用）
 * @param workspacePath 工作空间路径
 */
export function initializeSnippetStore(workspacePath: string): void {
  if (snippetStore) {
    console.warn('[Snippets] SnippetStore 已初始化，跳过重复初始化');
    return;
  }

  snippetStore = new SnippetStore(workspacePath);
  console.log('[Snippets] SnippetStore 初始化完成');

  // 从数据库加载本地 snippets 到内存缓存
  loadFragmentsFromDatabase();
}

/**
 * 从数据库加载本地 snippets 到内存缓存
 */
export function loadFragmentsFromDatabase(): void {
  if (!snippetStore) {
    console.warn('[Snippets] SnippetStore 未初始化，无法加载片段');
    return;
  }

  const fragments = snippetStore.getEnabledLocalFragments();
  fragmentRegistry.clear();

  fragments.forEach((fragment) => {
    fragmentRegistry.set(fragment.id, fragment);
  });

  console.log(`[Snippets] 从数据库加载了 ${fragments.length} 个启用的片段`);
}

/**
 * 注册一个提示词片段（同时保存到数据库和内存缓存）
 * @param fragment 片段配置
 */
export function registerFragment(fragment: PromptFragmentConfig): void {
  // 保存到数据库（如果已初始化）
  if (snippetStore) {
    snippetStore.saveFromConfig(fragment, 'local');
  }

  // 更新内存缓存
  fragmentRegistry.set(fragment.id, fragment);
  console.log(`✅ 注册提示词片段: ${fragment.name} (${fragment.id})`);
}

/**
 * 注销一个提示词片段
 * @param fragmentId 片段 ID
 * @returns 是否成功注销
 */
export function unregisterFragment(fragmentId: string): boolean {
  const deleted = fragmentRegistry.delete(fragmentId);
  if (deleted) {
    console.log(`🗑️ 注销提示词片段: ${fragmentId}`);
  }
  return deleted;
}

/**
 * 获取所有已注册的片段（从数据库读取）
 */
export function getAllFragments(): PromptFragmentConfig[] {
  if (!snippetStore) {
    // 如果未初始化，返回内存缓存（向后兼容）
    return Array.from(fragmentRegistry.values());
  }

  // 从数据库读取所有本地片段
  const localSnippets = snippetStore.getAllLocal();
  return localSnippets.map((record) => ({
    id: record.id,
    name: record.name,
    description: record.description,
    enabled: record.enabled,
    content: record.content,
    version: record.version,
    author: record.author,
    category: record.category,
    priority: record.priority,
    section: record.section,
  }));
}

/**
 * 获取所有启用的片段（按优先级排序，从数据库读取）
 */
export function getEnabledFragments(): PromptFragmentConfig[] {
  if (!snippetStore) {
    // 如果未初始化，返回内存缓存（向后兼容）
    return Array.from(fragmentRegistry.values())
      .filter((frag) => frag.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // 从数据库读取启用的本地片段
  return snippetStore.getEnabledLocalFragments();
}

/**
 * 获取指定片段（从数据库读取）
 * @param fragmentId 片段 ID
 */
export function getFragment(fragmentId: string): PromptFragmentConfig | undefined {
  if (!snippetStore) {
    // 如果未初始化，从内存缓存读取（向后兼容）
    return fragmentRegistry.get(fragmentId);
  }

  const record = snippetStore.get(fragmentId);
  if (!record || record.source !== 'local') {
    return undefined;
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    enabled: record.enabled,
    content: record.content,
    version: record.version,
    author: record.author,
    category: record.category,
    priority: record.priority,
    section: record.section,
  };
}

/**
 * 检查片段是否存在（从数据库检查）
 * @param fragmentId 片段 ID
 */
export function hasFragment(fragmentId: string): boolean {
  if (!snippetStore) {
    // 如果未初始化，从内存缓存检查（向后兼容）
    return fragmentRegistry.has(fragmentId);
  }

  const record = snippetStore.get(fragmentId);
  return record !== undefined && record.source === 'local';
}

/**
 * 设置片段启用状态（同时更新数据库和内存缓存）
 * @param fragmentId 片段 ID
 * @param enabled 是否启用
 * @returns 是否成功设置
 */
export function setFragmentEnabled(fragmentId: string, enabled: boolean): boolean {
  if (!snippetStore) {
    // 如果未初始化，只更新内存缓存（向后兼容）
    const fragment = fragmentRegistry.get(fragmentId);
    if (fragment) {
      fragment.enabled = enabled;
      console.log(`${enabled ? '✅ 启用' : '❌ 禁用'}提示词片段: ${fragment.name} (${fragmentId})`);
      return true;
    }
    console.warn(`⚠️ 提示词片段不存在: ${fragmentId}`);
    return false;
  }

  // 更新数据库
  const success = snippetStore.update(fragmentId, { enabled });
  if (success) {
    // 更新内存缓存
    const fragment = fragmentRegistry.get(fragmentId);
    if (fragment) {
      fragment.enabled = enabled;
    } else {
      // 如果缓存中没有，重新加载
      loadFragmentsFromDatabase();
    }
    const record = snippetStore.get(fragmentId);
    console.log(`${enabled ? '✅ 启用' : '❌ 禁用'}提示词片段: ${record?.name || fragmentId} (${fragmentId})`);
  } else {
    console.warn(`⚠️ 提示词片段不存在: ${fragmentId}`);
  }
  return success;
}

/**
 * 构建提示词片段组合
 * 将所有启用的片段组合成一个完整的提示词字符串
 * 支持按章节分组显示
 * 注意：只使用本地启用的片段
 */
export function buildFragmentsPrompt(): string {
  const enabledFragments = getEnabledFragments();
  return buildFragmentsPromptByIds(enabledFragments.map((f) => f.id));
}

/**
 * 按需构建提示词片段组合
 * 根据指定的片段 ID 列表，只构建需要的片段
 * 注意：只使用本地启用的片段
 *
 * @param fragmentIds 需要的片段 ID 列表（如果为空或未提供，则使用所有启用的片段）
 * @returns 组合后的提示词字符串
 */
export function buildFragmentsPromptByIds(fragmentIds?: string[]): string {
  let fragments: PromptFragmentConfig[];

  if (fragmentIds && fragmentIds.length > 0) {
    // 按需获取指定片段（从数据库或缓存）
    fragments = fragmentIds
      .map((id) => getFragment(id))
      .filter((frag): frag is PromptFragmentConfig => frag !== undefined && frag.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  } else {
    // 如果没有指定，使用所有启用的片段
    fragments = getEnabledFragments();
  }

  if (fragments.length === 0) {
    return '';
  }

  // 按章节分组
  const fragmentsBySection = new Map<string, PromptFragmentConfig[]>();

  fragments.forEach((fragment) => {
    const section = fragment.section || '其他';
    if (!fragmentsBySection.has(section)) {
      fragmentsBySection.set(section, []);
    }
    fragmentsBySection.get(section)!.push(fragment);
  });

  let prompt = '';

  // 按章节组装提示词
  fragmentsBySection.forEach((fragments, section) => {
    if (section !== '其他') {
      prompt += `\n\n## ${section}\n\n`;
    }

    fragments.forEach((fragment) => {
      // 如果片段内容已经包含标题，直接使用
      if (fragment.content.trim().startsWith('#')) {
        prompt += fragment.content.trim();
      } else {
        // 否则添加标题
        prompt += `### ${fragment.name}\n\n`;
        if (fragment.description) {
          prompt += `**说明**：${fragment.description}\n\n`;
        }
        prompt += fragment.content.trim();
      }
      prompt += '\n\n';
    });
  });

  return prompt;
}

/**
 * 批量注册片段
 * @param fragments 片段配置数组
 */
export function registerFragments(fragments: PromptFragmentConfig[]): void {
  fragments.forEach(registerFragment);
}

/**
 * 清空所有片段（谨慎使用）
 */
export function clearAllFragments(): void {
  fragmentRegistry.clear();
  console.log('🗑️ 已清空所有提示词片段');
}

/**
 * 按分类获取片段（从数据库读取）
 * @param category 片段分类
 */
export function getFragmentsByCategory(category: PromptFragmentConfig['category']): PromptFragmentConfig[] {
  return getAllFragments().filter((frag) => frag.category === category);
}

/**
 * 获取 SnippetStore 实例（用于 IPC 等需要直接访问的场景）
 */
export function getSnippetStore(): SnippetStore | null {
  return snippetStore;
}

// 导出类型
export type { PromptFragmentConfig } from './types';
