/**
 * 向量嵌入生成工具
 * 用于为提示词片段生成向量嵌入
 * 使用统一的 LLM 接口（通过 ChatClient 获取 Provider）
 */

import CHAT from '@/llm/chat';
import { getModels } from '@/lib/server/gateway';

/**
 * 默认 embedding 模型 ID
 */
const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/**
 * 生成文本的向量嵌入
 * 使用统一的 LLM 接口，通过 ChatClient 获取 Provider
 * @param text 要嵌入的文本
 * @param modelId 可选的模型 ID（默认使用 text-embedding-3-small）
 * @returns 向量嵌入数组
 */
export async function generateEmbedding(text: string, modelId: string = DEFAULT_EMBEDDING_MODEL): Promise<number[]> {
  try {
    // 获取可用模型列表
    const availableModels = await getModels();
    const modelInfo = availableModels.find((m: { id: string }) => m.id === modelId);

    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (modelInfo.type !== 'embedding') {
      throw new Error(`Model ${modelId} is not an embedding model`);
    }

    // 使用统一的 LLM 接口创建 ChatClient
    CHAT.setModels(availableModels);
    const chatClient = CHAT.createClient(modelId);

    // 从 ChatClient 获取 Provider
    const provider = chatClient.getProvider();

    // 使用 Provider 的 embedQuery 方法（与 LangChain 兼容）
    // Provider 可以使用自己的实现或 LangChain
    const providerModelId = (modelInfo.metadata?.providerModelId as string) || modelId;
    return await provider.embedQuery(text, providerModelId);
  } catch (error) {
    console.error('[Embeddings] ❌ 生成向量嵌入失败:', error);
    throw error;
  }
}

/**
 * 批量生成向量嵌入
 * 使用统一的 LLM 接口，通过 ChatClient 获取 Provider
 * @param texts 文本数组
 * @param modelId 可选的模型 ID
 * @returns 向量嵌入数组
 */
export async function generateEmbeddingsBatch(texts: string[], modelId: string = DEFAULT_EMBEDDING_MODEL): Promise<number[][]> {
  try {
    // 获取可用模型列表
    const availableModels = await getModels();
    const modelInfo = availableModels.find((m: { id: string }) => m.id === modelId);

    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (modelInfo.type !== 'embedding') {
      throw new Error(`Model ${modelId} is not an embedding model`);
    }

    // 使用统一的 LLM 接口创建 ChatClient
    CHAT.setModels(availableModels);
    const chatClient = CHAT.createClient(modelId);

    // 从 ChatClient 获取 Provider
    const provider = chatClient.getProvider();

    // 使用 Provider 的 embedDocuments 方法（与 LangChain 兼容）
    // Provider 可以使用批量 API 或 LangChain 实现
    const providerModelId = (modelInfo.metadata?.providerModelId as string) || modelId;
    return await provider.embedDocuments(texts, providerModelId);
  } catch (error) {
    console.error('[Embeddings] ❌ 批量生成向量嵌入失败:', error);
    throw error;
  }
}
