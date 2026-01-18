import { BaseProvider } from './base';

export class VApiProvider extends BaseProvider {
  readonly id = 'v-api';
  readonly name = 'V-API';
  readonly baseURL = 'https://api.vveai.com/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('V-API API key is required');
    return { Authorization: `Bearer ${key}` };
  }

  protected getDefaultEmbeddingModel(): string {
    return 'text-embedding-3-small';
  }
}
