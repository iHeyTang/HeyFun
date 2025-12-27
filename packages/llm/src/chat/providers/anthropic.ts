import { BaseProvider, ProviderConfig } from './base';

export class AnthropicProvider extends BaseProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly baseURL = 'https://api.anthropic.com/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('Anthropic API key is required');
    return { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  }

  /**
   * Anthropic 目前不提供 embedding API
   * 如果需要，可以通过其他 provider 或 LangChain 实现
   */
  protected getDefaultEmbeddingModel(): string {
    throw new Error('Anthropic does not provide embedding models. Please use another provider.');
  }

  async embedQuery(text: string, model?: string): Promise<number[]> {
    throw new Error('Anthropic does not provide embedding models. Please use OpenAI or another provider.');
  }

  async embedDocuments(texts: string[], model?: string): Promise<number[][]> {
    throw new Error('Anthropic does not provide embedding models. Please use OpenAI or another provider.');
  }
}
