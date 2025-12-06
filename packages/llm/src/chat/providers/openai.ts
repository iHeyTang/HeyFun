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
}
