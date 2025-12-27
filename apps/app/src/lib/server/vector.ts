/**
 * 向量库工具
 * 用于存储和检索提示词片段的向量嵌入
 *
 * 支持多个向量库，通过 VectorManager 管理
 */

import { vectorManager } from './vector/manager';
import type { VectorProvider } from './vector/types';

/**
 * 向量维度（根据使用的 embedding 模型确定）
 * OpenAI text-embedding-3-small: 1536
 * OpenAI text-embedding-3-large: 3072
 * OpenAI text-embedding-ada-002: 1536
 */
export const VECTOR_DIMENSION = 1536; // 默认使用 1536 维度

/**
 * 向量索引名称
 */
export const VECTOR_INDEX_NAME = 'system-prompt-snippets';

/**
 * 获取默认的向量库提供者（向后兼容）
 * 优先使用 'snippets' 名称的向量库，否则使用 'default'
 */
function getDefaultProvider(): VectorProvider | undefined {
  return vectorManager.getProvider('upstash', 'snippets') || vectorManager.getProvider('upstash', 'default');
}

/**
 * 检查向量索引是否可用（向后兼容）
 */
export function isVectorIndexAvailable(): boolean {
  return !!getDefaultProvider()?.isAvailable();
}

/**
 * 生成向量 ID（用于向量库）
 */
export function generateVectorId(snippetId: string): string {
  return `snippet:${snippetId}`;
}

/**
 * 从向量 ID 提取片段 ID
 */
export function extractSnippetIdFromVectorId(vectorId: string): string {
  return vectorId.replace(/^snippet:/, '');
}

/**
 * 导出向量管理器（用于高级用法）
 */
export { vectorManager } from './vector/manager';
export type { VectorProvider, VectorProviderConfig } from './vector/types';
