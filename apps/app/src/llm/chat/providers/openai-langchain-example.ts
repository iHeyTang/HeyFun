/**
 * OpenAI Provider 使用 LangChain 的示例实现
 *
 * 这是一个示例文件，展示如何在 Provider 中使用 LangChain 实现 embedding
 * 要使用此实现，请取消注释 OpenAIProvider 中的相应代码
 */

import { BaseProvider, ProviderConfig } from './base';

/**
 * 使用 LangChain 的 OpenAI Provider 示例
 *
 * 注意：这只是一个示例，实际使用时请取消注释 OpenAIProvider 中的代码
 */
export class OpenAIProviderWithLangChain extends BaseProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly baseURL = 'https://api.openai.com/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('OpenAI API key is required');
    return { Authorization: `Bearer ${key}` };
  }

  protected getDefaultEmbeddingModel(): string {
    return 'text-embedding-3-small';
  }

  /**
   * 使用 LangChain OpenAI Embeddings 实现
   */
  async embedQuery(text: string, model?: string): Promise<number[]> {
    const { OpenAIEmbeddings } = await import('@langchain/openai');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: model || this.getDefaultEmbeddingModel(),
    });
    return embeddings.embedQuery(text);
  }

  /**
   * 使用 LangChain OpenAI Embeddings 批量实现
   * LangChain 会自动处理批量请求
   */
  async embedDocuments(texts: string[], model?: string): Promise<number[][]> {
    const { OpenAIEmbeddings } = await import('@langchain/openai');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: model || this.getDefaultEmbeddingModel(),
    });
    return embeddings.embedDocuments(texts);
  }
}
