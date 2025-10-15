import { BaseProvider, ProviderConfig } from './base';

export class VercelProvider extends BaseProvider {
  readonly id = 'vercel';
  readonly name = 'Vercel';
  readonly baseURL = 'https://ai-gateway.vercel.sh/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('Vercel API key is required');
    return { Authorization: `Bearer ${key}` };
  }
}
