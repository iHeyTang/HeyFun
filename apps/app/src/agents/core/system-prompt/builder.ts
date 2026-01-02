/**
 * 系统提示词组装器
 *
 * 负责将各层级的 Blocks 按照优先级和顺序组装成最终的系统提示词
 */

import { SystemPromptBlock, SystemPromptTemplate, SystemPromptLayer } from './types';

/**
 * 组装单个 Block 为 Markdown 格式
 */
function renderBlock(block: SystemPromptBlock, headingLevel: number = 1): string {
  if (block.enabled === false) {
    return '';
  }

  const parts: string[] = [];

  // 如果有标题，添加 Markdown 标题
  if (block.title) {
    const heading = '#'.repeat(headingLevel);
    parts.push(`${heading} ${block.title}`);
    parts.push('');
  }

  // 添加内容
  parts.push(block.content.trim());

  return parts.join('\n');
}

/**
 * 对 Blocks 按优先级排序
 */
function sortBlocks(blocks: SystemPromptBlock[]): SystemPromptBlock[] {
  return [...blocks].sort((a, b) => {
    const priorityA = a.priority ?? 100;
    const priorityB = b.priority ?? 100;
    return priorityA - priorityB;
  });
}

/**
 * 组装系统提示词模板为最终的提示词字符串
 *
 * 组装顺序：
 * 1. Preset 层 Blocks（角色定位、工作流程、约束条件等）
 * 2. 框架层 Blocks（ReAct 工作方式等）
 * 3. 动态层 Blocks（检索到的提示词片段）
 *
 * @param template 系统提示词模板
 * @returns 组装后的系统提示词字符串
 */
export function buildSystemPrompt(template: SystemPromptTemplate): string {
  const sections: string[] = [];

  // 1. Preset 层（角色定位、工作流程等）
  if (template.preset && template.preset.length > 0) {
    const sortedBlocks = sortBlocks(template.preset);
    for (const block of sortedBlocks) {
      const rendered = renderBlock(block, 1);
      if (rendered) {
        sections.push(rendered);
      }
    }
  }

  // 2. 框架层（ReAct 工作方式等）
  if (template.framework && template.framework.length > 0) {
    const sortedBlocks = sortBlocks(template.framework);
    for (const block of sortedBlocks) {
      const rendered = renderBlock(block, 2);
      if (rendered) {
        sections.push(rendered);
      }
    }
  }

  // 3. 动态层（检索到的提示词片段）
  if (template.dynamic && template.dynamic.length > 0) {
    const sortedBlocks = sortBlocks(template.dynamic);
    for (const block of sortedBlocks) {
      const rendered = renderBlock(block, 2);
      if (rendered) {
        sections.push(rendered);
      }
    }
  }

  // 用分隔符连接各部分
  return sections.join('\n\n---\n\n');
}

/**
 * 创建框架层 Block
 */
export function createFrameworkBlock(id: string, content: string, options?: { title?: string; priority?: number }): SystemPromptBlock {
  return {
    id: `framework:${id}`,
    title: options?.title,
    content,
    priority: options?.priority ?? 100,
    enabled: true,
  };
}

/**
 * 创建 Preset 层 Block
 */
export function createPresetBlock(id: string, content: string, options?: { title?: string; priority?: number }): SystemPromptBlock {
  return {
    id: `preset:${id}`,
    title: options?.title,
    content,
    priority: options?.priority ?? 100,
    enabled: true,
  };
}

/**
 * 创建动态层 Block
 */
export function createDynamicBlock(id: string, content: string, options?: { title?: string; priority?: number }): SystemPromptBlock {
  return {
    id: `dynamic:${id}`,
    title: options?.title,
    content,
    priority: options?.priority ?? 100,
    enabled: true,
  };
}

