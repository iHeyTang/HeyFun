/**
 * General Agent 系统提示词
 *
 * 设计原则：
 * - 内容保持 Markdown 格式，便于阅读和编辑
 * - 动态内容通过 Handlebars 模板引擎插入
 * - 只在导出时包装为 Block，不过度拆分
 * - 模板文件独立维护，使用 .template.md 文件格式（确保编辑器识别为 Markdown）
 * - 使用 Handlebars 语法：{{variable}} 用于变量替换，支持条件判断和循环等高级功能
 */

import { formatTime } from '@/lib/shared/time';
import { SystemPromptBlock, createPresetBlock } from '@/agents/core/system-prompt';
import { createTemplateLoader } from '@/lib/shared/template-loader';

// ============================================================================
// 模板变量
// ============================================================================

interface PromptVariables {
  currentTimeISO: string;
  currentTimeLocale: string;
}

/**
 * 获取所有 Preset 层提示词 Blocks
 * 整体作为一个 Block 导出，保持内容的完整性和可读性
 */
export function getPromptBlocks(): SystemPromptBlock[] {
  const now = new Date();
  const template = createTemplateLoader<PromptVariables>(import.meta.url, 'system-prompt.template.md');
  const content = template({
    currentTimeISO: now.toISOString(),
    currentTimeLocale: formatTime(now),
  });
  return [createPresetBlock('general-agent', content, { title: 'General Agent 系统提示词' })];
}
