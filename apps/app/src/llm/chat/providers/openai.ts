import { BaseProvider, ProviderConfig } from './base';

export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly baseURL = 'https://api.openai.com/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('OpenAI API key is required');
    return { Authorization: `Bearer ${key}` };
  }

  /**
   * 使用 LangChain OpenAI Embeddings（如果可用）
   * 可以通过覆盖此方法使用 LangChain 实现
   */
  protected getDefaultEmbeddingModel(): string {
    return 'text-embedding-3-small';
  }

  /**
   * 可选：使用 LangChain 实现 embedding
   * 取消注释以下代码以使用 LangChain（需要安装 @langchain/openai）
   *
   * 使用 LangChain 的优势：
   * - 自动处理批量请求优化
   * - 更好的错误处理和重试机制
   * - 与 LangChain 生态系统兼容
   */
  // async embedQuery(text: string, model?: string): Promise<number[]> {
  //   const { OpenAIEmbeddings } = await import('@langchain/openai');
  //   const embeddings = new OpenAIEmbeddings({
  //     openAIApiKey: this.config.apiKey,
  //     modelName: model || this.getDefaultEmbeddingModel(),
  //   });
  //   return embeddings.embedQuery(text);
  // }

  // async embedDocuments(texts: string[], model?: string): Promise<number[][]> {
  //   const { OpenAIEmbeddings } = await import('@langchain/openai');
  //   const embeddings = new OpenAIEmbeddings({
  //     openAIApiKey: this.config.apiKey,
  //     modelName: model || this.getDefaultEmbeddingModel(),
  //   });
  //   // LangChain 会自动优化批量请求
  //   return embeddings.embedDocuments(texts);
  // }
}
