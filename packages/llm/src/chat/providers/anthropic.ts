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
}
