import { BaseProvider, ProviderConfig } from './base';

export class DeepSeekProvider extends BaseProvider {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek';
  readonly baseURL = 'https://api.deepseek.com/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('DeepSeek API key is required');
    return { Authorization: `Bearer ${key}` };
  }
}
