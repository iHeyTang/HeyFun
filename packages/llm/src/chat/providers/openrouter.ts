import { BaseProvider, ProviderConfig } from './base';

export class OpenRouterProvider extends BaseProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';
  readonly baseURL = 'https://openrouter.ai/api/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('OpenRouter API key is required');
    return { Authorization: `Bearer ${key}` };
  }

  protected getExtraHeaders(): Record<string, string> {
    return { 'HTTP-Referer': 'https://heyfun.ai', 'X-Title': 'HeyFun AI' };
  }
}
